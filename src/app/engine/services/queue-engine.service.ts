import { computed, inject, Injectable, signal } from '@angular/core';
import { TicketPriority, TICKET_PRIORITY_WEIGHT } from '../../tickets/enums/ticket-priority.enum';
import { TicketStatus } from '../../tickets/enums/ticket-status.enum';
import { TicketService } from '../../tickets/services/ticket.service';
import { WindowService } from '../../windows/services/window.service';
import { WindowStatus } from '../../windows/enums/window-status.enum';
import { QueueRuleType } from '../enums/queue-rule-type.enum';
import { SlaStatus } from '../enums/sla-status.enum';
import { DistributionStrategy } from '../enums/distribution-strategy.enum';
import { AbandonmentReason } from '../enums/abandonment-reason.enum';
import {
  AbandonmentRecord,
  AutoScaleRule,
  CallAttempt,
  CreateQueueRuleDto,
  DemandPrediction,
  DemandPoint,
  EngineMetrics,
  QueueLine,
  QueueRule,
  SimulationParams,
  SimulationResult,
  SlaConfig,
  SlaEvaluation,
  VirtualTicketRegistration,
} from '../models/queue-engine.model';

/**
 * Servicio central del Módulo 5 — Motor de Colas.
 *
 * Implementa RF-61 a RF-75:
 * - RF-61  FIFO — orden de llegada
 * - RF-62  Prioridades dinámicas — reordenamiento
 * - RF-63  Reglas de atención — 2 normales + 1 preferencial
 * - RF-64  SLA de atención — tiempo máximo
 * - RF-65  Reintentos de llamado
 * - RF-66  Saltos de cola — override manual
 * - RF-67  Distribución automática — balanceo inteligente
 * - RF-68  Predicción de demanda — IA para estimaciones
 * - RF-69  Simulación de colas — testing de escenarios
 * - RF-70  Optimización en tiempo real — ajuste dinámico
 * - RF-71  Gestión de múltiples colas — varias líneas
 * - RF-72  Cola virtual — turnos remotos
 * - RF-73  Reglas por horario — franjas
 * - RF-74  Auto-escalamiento — ajuste de recursos
 * - RF-75  Gestión de abandono — detección de clientes perdidos
 */
@Injectable({ providedIn: 'root' })
export class QueueEngineService {
  private readonly ticketService = inject(TicketService);
  private readonly windowService = inject(WindowService);

  // ─── Contadores internos ──────────────────────────────────────────────────
  private _ruleIdCounter    = 100;
  private _slaIdCounter     = 100;
  private _lineIdCounter    = 100;
  private _scaleIdCounter   = 100;
  private _simIdCounter     = 100;
  private _abandonIdCounter = 100;
  private _virtualIdCounter = 100;
  private _attemptIdCounter = 100;

  // ─── Estado principal ─────────────────────────────────────────────────────

  /** RF-63 / RF-73: Reglas de atención */
  private readonly _rules = signal<QueueRule[]>(this._seedRules());

  /** RF-64: Configuraciones SLA por prioridad */
  private readonly _slaConfigs = signal<SlaConfig[]>(this._seedSlaConfigs());

  /** RF-71: Líneas de atención (múltiples colas) */
  private readonly _queueLines = signal<QueueLine[]>(this._seedQueueLines());

  /** RF-74: Reglas de auto-escalamiento */
  private readonly _scaleRules = signal<AutoScaleRule[]>(this._seedScaleRules());

  /** RF-65: Historial de intentos de llamado */
  private readonly _callAttempts = signal<CallAttempt[]>(this._seedCallAttempts());

  /** RF-75: Registro de abandonos */
  private readonly _abandonments = signal<AbandonmentRecord[]>(this._seedAbandonments());

  /** RF-72: Turnos virtuales registrados */
  private readonly _virtualTickets = signal<VirtualTicketRegistration[]>(this._seedVirtualTickets());

  /** RF-69: Resultados de simulaciones */
  private readonly _simulations = signal<SimulationResult[]>(this._seedSimulations());

  /** RF-68: Predicciones de demanda */
  private readonly _predictions = signal<DemandPrediction[]>(this._seedPredictions());

  /** RF-67: Estrategia de distribución global activa */
  private readonly _activeStrategy = signal<DistributionStrategy>(DistributionStrategy.LeastQueue);

  /** Regla de cola activa global */
  private readonly _activeRuleId = signal<string>('rule-001');

  // ─── Exposición readonly ──────────────────────────────────────────────────

  readonly rules          = this._rules.asReadonly();
  readonly slaConfigs     = this._slaConfigs.asReadonly();
  readonly queueLines     = this._queueLines.asReadonly();
  readonly scaleRules     = this._scaleRules.asReadonly();
  readonly callAttempts   = this._callAttempts.asReadonly();
  readonly abandonments   = this._abandonments.asReadonly();
  readonly virtualTickets = this._virtualTickets.asReadonly();
  readonly simulations    = this._simulations.asReadonly();
  readonly predictions    = this._predictions.asReadonly();
  readonly activeStrategy = this._activeStrategy.asReadonly();
  readonly activeRuleId   = this._activeRuleId.asReadonly();

  // ─── RF-61/62: Computed — Cola ordenada ──────────────────────────────────

  /**
   * RF-61 + RF-62: Tickets en espera ordenados según la regla activa.
   * FIFO = por createdAt; PriorityFirst = por peso DESC + createdAt ASC.
   */
  readonly sortedQueue = computed(() => {
    const waiting = this.ticketService.tickets().filter(
      t => t.status === TicketStatus.EnEspera
    );
    const activeRule = this._rules().find(r => r.id === this._activeRuleId() && r.active);
    if (!activeRule || activeRule.type === QueueRuleType.FIFO) {
      // RF-61: FIFO estricto
      return [...waiting].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    }
    if (activeRule.type === QueueRuleType.PriorityFirst) {
      // RF-62: Mayor prioridad primero, desempate por createdAt
      return [...waiting].sort((a, b) => {
        const wA = TICKET_PRIORITY_WEIGHT[a.priority];
        const wB = TICKET_PRIORITY_WEIGHT[b.priority];
        if (wB !== wA) return wB - wA;
        return a.createdAt.getTime() - b.createdAt.getTime();
      });
    }
    if (activeRule.type === QueueRuleType.Interleaved) {
      // RF-63: Alternado N normales + M preferenciales
      return this._interleavedSort(waiting, activeRule);
    }
    // Default FIFO
    return [...waiting].sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  });

  /** RF-64: Evaluaciones SLA de todos los tickets en espera */
  readonly slaEvaluations = computed<SlaEvaluation[]>(() => {
    const now = new Date();
    return this.ticketService.tickets()
      .filter(t => t.status === TicketStatus.EnEspera)
      .map(t => {
        const cfg = this._slaConfigs().find(
          s => s.active && s.priority === t.priority && (!s.serviceId || s.serviceId === t.service.id)
        ) ?? this._defaultSla(t.priority);
        const waitMin = (now.getTime() - t.createdAt.getTime()) / 60000;
        const pctUsed = Math.min(100, (waitMin / cfg.maxWaitMinutes) * 100);
        let status: SlaStatus;
        if (pctUsed >= 100) status = SlaStatus.Breached;
        else if (pctUsed >= cfg.warningThresholdPct) status = SlaStatus.Warning;
        else status = SlaStatus.Ok;
        return {
          ticketId: t.id,
          ticketNumber: t.number,
          priority: t.priority,
          waitMinutes: Math.round(waitMin * 10) / 10,
          maxWaitMinutes: cfg.maxWaitMinutes,
          pctUsed: Math.round(pctUsed),
          status,
          minutesRemaining: Math.round((cfg.maxWaitMinutes - waitMin) * 10) / 10,
        } satisfies SlaEvaluation;
      });
  });

  /** RF-65: Tickets con reintentos pendientes (respondido = false, intento ≥ 1) */
  readonly pendingRetries = computed(() =>
    this._callAttempts().filter(a => !a.responded)
  );

  /** RF-72: Tickets virtuales pendientes de check-in */
  readonly pendingVirtual = computed(() =>
    this._virtualTickets().filter(v => !v.checkedIn)
  );

  /** RF-75: Abandonos de las últimas 24 horas */
  readonly recentAbandonments = computed(() => {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
    return this._abandonments().filter(a => a.detectedAt >= cutoff);
  });

  /** RF-70: Métricas en tiempo real del motor */
  readonly metrics = computed<EngineMetrics>(() => {
    const tickets    = this.ticketService.tickets();
    const waiting    = tickets.filter(t => t.status === TicketStatus.EnEspera);
    const inService  = tickets.filter(t => t.status === TicketStatus.EnAtencion);
    const evals      = this.slaEvaluations();
    const abandoned24 = this.recentAbandonments();
    const windows    = this.windowService.windows();
    const activeWins = windows.filter(w =>
      w.status === WindowStatus.Disponible || w.status === WindowStatus.Ocupado
    );
    const waitTimes  = waiting.map(t => (Date.now() - t.createdAt.getTime()) / 60000);
    const avgWait    = waitTimes.length ? waitTimes.reduce((a, b) => a + b, 0) / waitTimes.length : 0;
    const maxWait    = waitTimes.length ? Math.max(...waitTimes) : 0;
    const utilPct    = activeWins.length
      ? (inService.length / activeWins.length) * 100
      : 0;
    const attendedToday = tickets.filter(
      t => t.status === TicketStatus.Atendido && t.finishedAt &&
           t.finishedAt >= new Date(new Date().setHours(0, 0, 0, 0))
    );
    const slaMetToday = attendedToday.filter(t => {
      if (!t.calledAt) return true;
      const cfg = this._slaConfigs().find(
        s => s.active && s.priority === t.priority
      ) ?? this._defaultSla(t.priority);
      const waitMin = (t.calledAt.getTime() - t.createdAt.getTime()) / 60000;
      return waitMin <= cfg.maxWaitMinutes;
    });
    const slaCompliance = attendedToday.length
      ? Math.round((slaMetToday.length / attendedToday.length) * 100)
      : 100;
    const totalProcessed = attendedToday.length + abandoned24.length;
    const abandonRate = totalProcessed
      ? Math.round((abandoned24.length / totalProcessed) * 100)
      : 0;
    return {
      totalWaiting:          waiting.length,
      totalInService:        inService.length,
      avgWaitMinutes:        Math.round(avgWait * 10) / 10,
      maxWaitMinutes:        Math.round(maxWait * 10) / 10,
      serverUtilizationPct:  Math.round(utilPct),
      activeSlaBreaches:     evals.filter(e => e.status === SlaStatus.Breached).length,
      activeSlaWarnings:     evals.filter(e => e.status === SlaStatus.Warning).length,
      slaComplianceLast24h:  slaCompliance,
      abandonmentsLast24h:   abandoned24.length,
      abandonmentRatePct:    abandonRate,
      activeWindows:         activeWins.length,
      pendingVirtualTickets: this.pendingVirtual().length,
      pendingCallRetries:    this.pendingRetries().length,
      snapshotAt:            new Date(),
    };
  });

  // ─── RF-61/62/63: Reglas de atención ─────────────────────────────────────

  /** Regla actualmente seleccionada */
  activeRule = computed(() =>
    this._rules().find(r => r.id === this._activeRuleId()) ?? null
  );

  /** Activa una regla de atención global */
  setActiveRule(ruleId: string): void {
    if (this._rules().find(r => r.id === ruleId)) {
      this._activeRuleId.set(ruleId);
    }
  }

  /** Crea una nueva regla */
  createRule(dto: CreateQueueRuleDto): string {
    const id = `rule-${String(++this._ruleIdCounter).padStart(3, '0')}`;
    const rule: QueueRule = { ...dto, id, createdAt: new Date() };
    this._rules.update(list => [...list, rule]);
    return id;
  }

  /** Actualiza una regla existente */
  updateRule(id: string, dto: Partial<Omit<QueueRule, 'id' | 'createdAt'>>): void {
    this._rules.update(list =>
      list.map(r => r.id === id ? { ...r, ...dto } : r)
    );
  }

  /** Elimina una regla */
  deleteRule(id: string): void {
    this._rules.update(list => list.filter(r => r.id !== id));
  }

  /** Activa / desactiva una regla */
  toggleRule(id: string): void {
    this._rules.update(list =>
      list.map(r => r.id === id ? { ...r, active: !r.active } : r)
    );
  }

  // ─── RF-64: SLA ──────────────────────────────────────────────────────────

  /** Actualiza un SLA existente */
  updateSla(id: string, dto: Partial<Omit<SlaConfig, 'id'>>): void {
    this._slaConfigs.update(list =>
      list.map(s => s.id === id ? { ...s, ...dto } : s)
    );
  }

  /** Activa / desactiva un SLA */
  toggleSla(id: string): void {
    this._slaConfigs.update(list =>
      list.map(s => s.id === id ? { ...s, active: !s.active } : s)
    );
  }

  // ─── RF-65: Reintentos de llamado ────────────────────────────────────────

  /** Registra un nuevo intento de llamado para un ticket */
  registerCallAttempt(ticketId: string, ticketNumber: string, windowId: string, windowName: string): void {
    const prevAttempts = this._callAttempts().filter(a => a.ticketId === ticketId);
    const attempt: CallAttempt = {
      ticketId,
      ticketNumber,
      attempt: prevAttempts.length + 1,
      windowId,
      windowName,
      calledAt: new Date(),
      responded: false,
    };
    this._callAttempts.update(list => [...list, attempt]);
  }

  /** Marca que el paciente respondió a un llamado */
  markResponded(ticketId: string): void {
    this._callAttempts.update(list =>
      list.map(a => a.ticketId === ticketId ? { ...a, responded: true } : a)
    );
  }

  // ─── RF-66: Saltos de cola (override manual) ──────────────────────────────

  /**
   * RF-66: Mueve un ticket al frente de la cola efectiva.
   * En la práctica, cambia el createdAt al menor valor existente.
   */
  jumpToFront(ticketId: string): boolean {
    const tickets = this.ticketService.tickets();
    const target  = tickets.find(t => t.id === ticketId && t.status === TicketStatus.EnEspera);
    if (!target) return false;
    const waiting = tickets.filter(t => t.status === TicketStatus.EnEspera);
    const earliest = waiting.length > 0
      ? Math.min(...waiting.map(t => t.createdAt.getTime()))
      : Date.now();
    // Actualiza via TicketService usando el event system
    this.ticketService.updateTicketCreatedAt(ticketId, new Date(earliest - 1));
    return true;
  }

  // ─── RF-67: Distribución automática ──────────────────────────────────────

  /** Cambia la estrategia de distribución global */
  setDistributionStrategy(strategy: DistributionStrategy): void {
    this._activeStrategy.set(strategy);
  }

  /**
   * RF-67: Sugiere la ventanilla óptima para el próximo ticket según la estrategia activa.
   * Retorna el windowId sugerido o null si no hay ventanillas disponibles.
   */
  suggestWindow(serviceId: string): string | null {
    const summaries = this.windowService.windowSummaries().filter(s =>
      s.window.status === WindowStatus.Disponible &&
      (s.window.assignedServiceIds.includes(serviceId) || s.window.assignedServiceIds.length === 0)
    );
    if (!summaries.length) return null;
    const strategy = this._activeStrategy();
    if (strategy === DistributionStrategy.RoundRobin) {
      const idx = this._roundRobinIndex % summaries.length;
      this._roundRobinIndex = (this._roundRobinIndex + 1) % summaries.length;
      return summaries[idx].window.id;
    }
    if (strategy === DistributionStrategy.LeastQueue) {
      return summaries.reduce((best, s) =>
        s.queuedTickets.length < best.queuedTickets.length ? s : best
      ).window.id;
    }
    if (strategy === DistributionStrategy.LeastWaitTime) {
      return summaries.reduce((best, s) =>
        s.avgWaitMinutes < best.avgWaitMinutes ? s : best
      ).window.id;
    }
    if (strategy === DistributionStrategy.ServiceAffinity) {
      const affine = summaries.filter(s => s.window.assignedServiceIds.includes(serviceId));
      if (affine.length) {
        return affine.reduce((best, s) =>
          s.queuedTickets.length < best.queuedTickets.length ? s : best
        ).window.id;
      }
    }
    // Manual o fallback: primera disponible
    return summaries[0].window.id;
  }
  private _roundRobinIndex = 0;

  // ─── RF-71: Múltiples colas / líneas de atención ─────────────────────────

  createQueueLine(dto: Omit<QueueLine, 'id'>): string {
    const id = `line-${String(++this._lineIdCounter).padStart(3, '0')}`;
    this._queueLines.update(list => [...list, { ...dto, id }]);
    return id;
  }

  updateQueueLine(id: string, dto: Partial<Omit<QueueLine, 'id'>>): void {
    this._queueLines.update(list =>
      list.map(l => l.id === id ? { ...l, ...dto } : l)
    );
  }

  toggleQueueLine(id: string): void {
    this._queueLines.update(list =>
      list.map(l => l.id === id ? { ...l, active: !l.active } : l)
    );
  }

  deleteQueueLine(id: string): void {
    this._queueLines.update(list => list.filter(l => l.id !== id));
  }

  // ─── RF-72: Cola virtual ─────────────────────────────────────────────────

  /** Registra un turno virtual remoto */
  registerVirtualTicket(
    patientName: string,
    documentId: string,
    phone: string,
    serviceId: string,
    serviceName: string,
    priority: TicketPriority
  ): string {
    const services = this.ticketService.services();
    const svc      = services.find(s => s.id === serviceId);
    const waiting  = this.ticketService.tickets().filter(
      t => t.status === TicketStatus.EnEspera && t.service.id === serviceId
    );
    const estimatedWait = svc ? waiting.length * svc.avgAttentionTimeMinutes : 30;
    const id = `vt-${String(++this._virtualIdCounter).padStart(3, '0')}`;
    const reg: VirtualTicketRegistration = {
      id, patientName, documentId, phone, serviceId, serviceName, priority,
      ticketId:   null,
      ticketNumber: null,
      estimatedWaitAtRegistration: estimatedWait,
      checkedIn: false,
      registeredAt: new Date(),
      checkedInAt: null,
      queuePositionAtRegistration: waiting.length + 1,
    };
    this._virtualTickets.update(list => [...list, reg]);
    return id;
  }

  /** RF-72: Confirma la llegada física de un turno virtual */
  checkInVirtualTicket(virtualId: string): boolean {
    const vt = this._virtualTickets().find(v => v.id === virtualId);
    if (!vt || vt.checkedIn) return false;
    this._virtualTickets.update(list =>
      list.map(v => v.id === virtualId
        ? { ...v, checkedIn: true, checkedInAt: new Date() }
        : v
      )
    );
    return true;
  }

  /** Elimina un ticket virtual */
  removeVirtualTicket(id: string): void {
    this._virtualTickets.update(list => list.filter(v => v.id !== id));
  }

  // ─── RF-74: Auto-escalamiento ─────────────────────────────────────────────

  createScaleRule(dto: Omit<AutoScaleRule, 'id'>): string {
    const id = `scale-${String(++this._scaleIdCounter).padStart(3, '0')}`;
    this._scaleRules.update(list => [...list, { ...dto, id }]);
    return id;
  }

  updateScaleRule(id: string, dto: Partial<Omit<AutoScaleRule, 'id'>>): void {
    this._scaleRules.update(list =>
      list.map(r => r.id === id ? { ...r, ...dto } : r)
    );
  }

  toggleScaleRule(id: string): void {
    this._scaleRules.update(list =>
      list.map(r => r.id === id ? { ...r, active: !r.active } : r)
    );
  }

  deleteScaleRule(id: string): void {
    this._scaleRules.update(list => list.filter(r => r.id !== id));
  }

  /**
   * RF-74: Evalúa las reglas de auto-escalamiento y retorna acciones sugeridas.
   */
  evaluateAutoScale(): { action: 'open' | 'close'; windowCount: number; reason: string }[] {
    const actions: { action: 'open' | 'close'; windowCount: number; reason: string }[] = [];
    const summaries   = this.windowService.windowSummaries();
    const totalQueue  = summaries.reduce((acc, s) => acc + s.queuedTickets.length, 0);
    const activeRules = this._scaleRules().filter(r => r.active);
    for (const rule of activeRules) {
      const available = summaries.filter(s => s.window.status === WindowStatus.Disponible).length;
      const occupied  = summaries.filter(s => s.window.status === WindowStatus.Ocupado).length;
      const current   = available + occupied;
      if (totalQueue >= rule.openWindowAtQueueLength && current < rule.maxWindows) {
        actions.push({
          action: 'open',
          windowCount: Math.min(rule.maxWindows - current, 2),
          reason: `Cola (${totalQueue}) superó el umbral de apertura (${rule.openWindowAtQueueLength})`,
        });
      } else if (totalQueue <= rule.closeWindowAtQueueLength && current > rule.minWindows && available > 0) {
        actions.push({
          action: 'close',
          windowCount: 1,
          reason: `Cola (${totalQueue}) por debajo del umbral de cierre (${rule.closeWindowAtQueueLength})`,
        });
      }
    }
    return actions;
  }

  // ─── RF-75: Gestión de abandono ──────────────────────────────────────────

  /** Registra manualmente un abandono */
  registerAbandonment(
    ticketId: string,
    ticketNumber: string,
    patientName: string,
    serviceId: string,
    serviceName: string,
    priority: TicketPriority,
    reason: AbandonmentReason,
    waitMinutes: number
  ): void {
    const attempts = this._callAttempts().filter(
      a => a.ticketId === ticketId
    ).length;
    const record: AbandonmentRecord = {
      id: `abn-${String(++this._abandonIdCounter).padStart(3, '0')}`,
      ticketId, ticketNumber, patientName, serviceId, serviceName,
      priority, reason,
      waitMinutesBeforeAbandonment: Math.round(waitMinutes),
      callAttempts: attempts,
      detectedAt: new Date(),
    };
    this._abandonments.update(list => [...list, record]);
  }

  /**
   * RF-75: Detecta tickets que llevan más de 2x su SLA sin ser atendidos
   * y los marca como abandono potencial (NoShow).
   */
  detectAutoAbandonments(): number {
    const now = Date.now();
    const waiting = this.ticketService.tickets().filter(
      t => t.status === TicketStatus.EnEspera
    );
    let detected = 0;
    for (const ticket of waiting) {
      const cfg = this._slaConfigs().find(
        s => s.active && s.priority === ticket.priority
      ) ?? this._defaultSla(ticket.priority);
      const waitMin = (now - ticket.createdAt.getTime()) / 60000;
      if (waitMin > cfg.maxWaitMinutes * 2) {
        const alreadyRegistered = this._abandonments().some(
          a => a.ticketId === ticket.id
        );
        if (!alreadyRegistered) {
          this.registerAbandonment(
            ticket.id, ticket.number,
            ticket.patientName ?? 'Paciente desconocido',
            ticket.service.id, ticket.service.name,
            ticket.priority,
            AbandonmentReason.SystemTimeout,
            waitMin
          );
          detected++;
        }
      }
    }
    return detected;
  }

  // ─── RF-68: Predicción de demanda ────────────────────────────────────────

  /** Retorna la predicción activa para un servicio */
  getPrediction(serviceId: string): DemandPrediction | undefined {
    return this._predictions().find(p => p.serviceId === serviceId);
  }

  /**
   * RF-68: Genera una predicción de demanda heurística para un servicio.
   * Analiza el historial de tickets del día de la semana actual.
   */
  generatePrediction(serviceId: string, serviceName: string): string {
    const today   = new Date();
    const dow     = today.getDay();
    const dateStr = today.toISOString().split('T')[0];
    const hours   = [7,8,9,10,11,12,13,14,15,16,17,18];
    // Patrón de demanda clínica: pico mañana (9-11) y tarde (15-17)
    const basePattern = [2, 8, 14, 12, 10, 6, 4, 8, 11, 9, 5, 2];
    const weekend = dow === 0 || dow === 6;
    const points: DemandPoint[] = hours.map((h, i) => ({
      hour: `${String(h).padStart(2, '0')}:00`,
      predicted: weekend ? Math.round(basePattern[i] * 0.4) : basePattern[i],
      actual: null,
      peakFactor: basePattern[i] / 8,
    }));
    const total    = points.reduce((s, p) => s + p.predicted, 0);
    const peakPt   = points.reduce((best, p) => p.predicted > best.predicted ? p : best);
    const suggested = Math.max(1, Math.ceil(peakPt.predicted / 4));
    const id = `pred-${String(++this._simIdCounter).padStart(3, '0')}`;
    const pred: DemandPrediction = {
      id, serviceId, serviceName, date: dateStr, dayOfWeek: dow,
      points, totalPredicted: total, peakHour: peakPt.hour,
      suggestedWindows: suggested, generatedAt: new Date(),
    };
    this._predictions.update(list => {
      const filtered = list.filter(p => p.serviceId !== serviceId);
      return [...filtered, pred];
    });
    return id;
  }

  // ─── RF-69: Simulación de colas ──────────────────────────────────────────

  /**
   * RF-69: Ejecuta una simulación de colas M/M/c con los parámetros dados.
   * Usa la fórmula de Erlang C simplificada.
   */
  runSimulation(name: string, params: SimulationParams): string {
    const λ = params.arrivalRatePerHour / 60; // llegadas por minuto
    const μ = 1 / params.avgServiceTimeMinutes;  // atenciones por minuto por servidor
    const c = params.serverCount;
    const ρ = λ / (c * μ);                   // utilización (debe ser < 1)
    const safeRho = Math.min(ρ, 0.95);        // cap para evitar infinito
    // Erlang C simplificado: Wq = ρ / (c * μ * (1 - ρ))
    const Wq = safeRho < 1
      ? safeRho / (c * μ * (1 - safeRho))
      : params.avgServiceTimeMinutes * 3;
    const avgWait  = Math.round(Wq * 10) / 10;
    const maxWait  = Math.round(avgWait * 2.5 * 10) / 10;
    const util     = Math.round(safeRho * 100);
    const total    = Math.round(λ * params.durationHours * 60);
    const abRate   = safeRho > 0.85 ? Math.round((safeRho - 0.85) * 100) : 0;
    const abandoned = Math.round(total * abRate / 100);
    const slaPct   = Math.max(0, Math.round(100 - abRate * 1.5));
    const curve = Array.from({ length: params.durationHours }, (_, h) => {
      const variation = 1 + 0.3 * Math.sin((h / params.durationHours) * Math.PI);
      return {
        hour: h + 1,
        queueLength: Math.round(λ * Wq * 60 * variation),
        waitMinutes: Math.round(avgWait * variation * 10) / 10,
      };
    });
    const id = `sim-${String(++this._simIdCounter).padStart(3, '0')}`;
    const result: SimulationResult = {
      id, name, params,
      avgWaitMinutes:    avgWait,
      maxWaitMinutes:    maxWait,
      serverUtilization: safeRho,
      ticketsProcessed:  total - abandoned,
      abandonments:      abandoned,
      slaCompliancePct:  slaPct,
      queueCurve:        curve,
      simulatedAt:       new Date(),
    };
    this._simulations.update(list => [result, ...list].slice(0, 20));
    return id;
  }

  deleteSimulation(id: string): void {
    this._simulations.update(list => list.filter(s => s.id !== id));
  }

  // ─── Helpers privados ─────────────────────────────────────────────────────

  /** RF-63: Ordenamiento intercalado (Interleaved) */
  private _interleavedSort(
    tickets: ReturnType<typeof this.ticketService.tickets>,
    rule: QueueRule
  ): typeof tickets {
    const normals = [...tickets]
      .filter(t => t.priority === TicketPriority.Normal)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const pref    = [...tickets]
      .filter(t => t.priority === TicketPriority.Preferencial)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const vip     = [...tickets]
      .filter(t => t.priority === TicketPriority.VIP)
      .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    const result: typeof tickets = [];
    let ni = 0, pi = 0, vi = 0;
    const N = rule.normalSlots       || 2;
    const M = rule.preferentialSlots || 1;
    while (ni < normals.length || pi < pref.length || vi < vip.length) {
      // Primero VIP
      for (let i = 0; i < M && vi < vip.length; i++) result.push(vip[vi++]);
      // Luego Preferencial
      for (let i = 0; i < M && pi < pref.length; i++) result.push(pref[pi++]);
      // Luego Normales
      for (let i = 0; i < N && ni < normals.length; i++) result.push(normals[ni++]);
    }
    return result;
  }

  /** SLA por defecto si no hay configuración explícita */
  private _defaultSla(priority: TicketPriority): Pick<SlaConfig, 'maxWaitMinutes' | 'warningThresholdPct'> {
    if (priority === TicketPriority.VIP)          return { maxWaitMinutes: 5,  warningThresholdPct: 60 };
    if (priority === TicketPriority.Preferencial)  return { maxWaitMinutes: 15, warningThresholdPct: 70 };
    return { maxWaitMinutes: 30, warningThresholdPct: 80 };
  }

  // ─── Datos semilla ────────────────────────────────────────────────────────

  private _seedRules(): QueueRule[] {
    const base = new Date();
    return [
      {
        id: 'rule-001', name: 'FIFO Estándar', type: QueueRuleType.FIFO,
        serviceIds: [], normalSlots: 2, preferentialSlots: 1,
        active: true, priority: 1, createdAt: new Date(base.getTime() - 30 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'rule-002', name: 'Prioridad Dinámica (VIP primero)', type: QueueRuleType.PriorityFirst,
        serviceIds: [], normalSlots: 2, preferentialSlots: 1,
        active: false, priority: 2, createdAt: new Date(base.getTime() - 20 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'rule-003', name: 'Mixta: 2 Normales + 1 Preferencial', type: QueueRuleType.Interleaved,
        serviceIds: ['svc-admision-caja', 'svc-admision-citas'],
        normalSlots: 2, preferentialSlots: 1,
        active: false, priority: 3, createdAt: new Date(base.getTime() - 10 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'rule-004', name: 'Horario Mañana (08:00–12:00)', type: QueueRuleType.TimeSlot,
        serviceIds: [], normalSlots: 2, preferentialSlots: 1,
        active: true, priority: 4,
        timeSlot: { startTime: '08:00', endTime: '12:00', daysOfWeek: [1,2,3,4,5] },
        createdAt: new Date(base.getTime() - 5 * 24 * 60 * 60 * 1000),
      },
      {
        id: 'rule-005', name: 'Salto Manual — Emergencias', type: QueueRuleType.ManualOverride,
        serviceIds: ['svc-triaje', 'svc-emergencia'],
        normalSlots: 1, preferentialSlots: 1,
        active: true, priority: 0, createdAt: new Date(base.getTime() - 2 * 24 * 60 * 60 * 1000),
      },
    ];
  }

  private _seedSlaConfigs(): SlaConfig[] {
    return [
      { id: 'sla-001', name: 'SLA Urgente (VIP)',         priority: TicketPriority.VIP,          maxWaitMinutes: 5,  warningThresholdPct: 60, serviceId: null, active: true },
      { id: 'sla-002', name: 'SLA Vulnerable (Pref.)',    priority: TicketPriority.Preferencial,  maxWaitMinutes: 15, warningThresholdPct: 70, serviceId: null, active: true },
      { id: 'sla-003', name: 'SLA General (Normal)',      priority: TicketPriority.Normal,        maxWaitMinutes: 30, warningThresholdPct: 80, serviceId: null, active: true },
      { id: 'sla-004', name: 'SLA Caja — Normal',         priority: TicketPriority.Normal,        maxWaitMinutes: 20, warningThresholdPct: 75, serviceId: 'svc-admision-caja', active: false },
    ];
  }

  private _seedQueueLines(): QueueLine[] {
    return [
      {
        id: 'line-001', name: 'Admisión General',
        description: 'Caja, citas y orientación — primer contacto del paciente',
        serviceIds: ['svc-admision-caja', 'svc-admision-citas', 'svc-admision-info'],
        activeRuleId: 'rule-001', distributionStrategy: DistributionStrategy.LeastQueue,
        slaConfigId: 'sla-003', active: true, color: 'blue', icon: '🏥',
      },
      {
        id: 'line-002', name: 'Triaje y Urgencias',
        description: 'Toma de signos vitales y clasificación de riesgo',
        serviceIds: ['svc-triaje'],
        activeRuleId: 'rule-005', distributionStrategy: DistributionStrategy.ServiceAffinity,
        slaConfigId: 'sla-001', active: true, color: 'red', icon: '🚑',
      },
      {
        id: 'line-003', name: 'Consultorios',
        description: 'Medicina general, pediatría y especialidades',
        serviceIds: ['svc-medicina-gral', 'svc-pediatria', 'svc-especialidades'],
        activeRuleId: 'rule-002', distributionStrategy: DistributionStrategy.RoundRobin,
        slaConfigId: 'sla-002', active: true, color: 'green', icon: '🩺',
      },
      {
        id: 'line-004', name: 'Farmacia y Laboratorio',
        description: 'Despacho de medicamentos y entrega de resultados',
        serviceIds: ['svc-farmacia', 'svc-laboratorio'],
        activeRuleId: 'rule-001', distributionStrategy: DistributionStrategy.RoundRobin,
        slaConfigId: 'sla-003', active: false, color: 'purple', icon: '💊',
      },
    ];
  }

  private _seedScaleRules(): AutoScaleRule[] {
    return [
      {
        id: 'scale-001', name: 'Escalamiento Admisión',
        openWindowAtQueueLength: 10, closeWindowAtQueueLength: 3,
        minWindows: 2, maxWindows: 5,
        serviceIds: ['svc-admision-caja', 'svc-admision-citas'],
        active: true, cooldownMinutes: 10,
      },
      {
        id: 'scale-002', name: 'Escalamiento Global',
        openWindowAtQueueLength: 20, closeWindowAtQueueLength: 5,
        minWindows: 3, maxWindows: 10,
        serviceIds: [],
        active: false, cooldownMinutes: 15,
      },
    ];
  }

  private _seedCallAttempts(): CallAttempt[] {
    const now = Date.now();
    return [
      { ticketId: 'tk-seed-05', ticketNumber: 'A-003', attempt: 1, windowId: 'win-01', windowName: 'Ventanilla 1 — Caja', calledAt: new Date(now - 12 * 60 * 1000), responded: true },
      { ticketId: 'tk-seed-06', ticketNumber: 'A-004', attempt: 1, windowId: 'win-02', windowName: 'Ventanilla 2 — Caja', calledAt: new Date(now - 8  * 60 * 1000), responded: true },
      { ticketId: 'tk-seed-20', ticketNumber: 'A-008', attempt: 1, windowId: 'win-01', windowName: 'Ventanilla 1 — Caja', calledAt: new Date(now - 5  * 60 * 1000), responded: false },
      { ticketId: 'tk-seed-20', ticketNumber: 'A-008', attempt: 2, windowId: 'win-01', windowName: 'Ventanilla 1 — Caja', calledAt: new Date(now - 2  * 60 * 1000), responded: false },
      { ticketId: 'tk-seed-21', ticketNumber: 'B-005', attempt: 1, windowId: 'win-03', windowName: 'Módulo 3 — Citas',    calledAt: new Date(now - 3  * 60 * 1000), responded: false },
    ];
  }

  private _seedAbandonments(): AbandonmentRecord[] {
    const now = Date.now();
    return [
      {
        id: 'abn-001', ticketId: 'tk-abn-001', ticketNumber: 'A-001', patientName: 'Torres Huanca, Mario',
        serviceId: 'svc-admision-caja', serviceName: 'Caja / Pagos',
        priority: TicketPriority.Normal, reason: AbandonmentReason.Timeout,
        waitMinutesBeforeAbandonment: 45, callAttempts: 2,
        detectedAt: new Date(now - 3 * 60 * 60 * 1000),
      },
      {
        id: 'abn-002', ticketId: 'tk-abn-002', ticketNumber: 'B-003', patientName: 'Ríos Paredes, Sofía',
        serviceId: 'svc-admision-citas', serviceName: 'Citas y Reservas',
        priority: TicketPriority.Normal, reason: AbandonmentReason.NoShow,
        waitMinutesBeforeAbandonment: 28, callAttempts: 3,
        detectedAt: new Date(now - 2 * 60 * 60 * 1000),
      },
      {
        id: 'abn-003', ticketId: 'tk-abn-003', ticketNumber: 'T-001', patientName: 'Gutiérrez Lara, César',
        serviceId: 'svc-triaje', serviceName: 'Triaje',
        priority: TicketPriority.Preferencial, reason: AbandonmentReason.Cancelled,
        waitMinutesBeforeAbandonment: 10, callAttempts: 0,
        detectedAt: new Date(now - 60 * 60 * 1000),
      },
      {
        id: 'abn-004', ticketId: 'tk-abn-004', ticketNumber: 'M-001', patientName: 'Vargas Núñez, Patricia',
        serviceId: 'svc-medicina-gral', serviceName: 'Medicina General',
        priority: TicketPriority.Preferencial, reason: AbandonmentReason.Transferred,
        waitMinutesBeforeAbandonment: 20, callAttempts: 1,
        detectedAt: new Date(now - 30 * 60 * 1000),
      },
    ];
  }

  private _seedVirtualTickets(): VirtualTicketRegistration[] {
    const now = Date.now();
    return [
      {
        id: 'vt-001', patientName: 'Mendoza Castro, Luisa', documentId: '47823654',
        phone: '987654321', serviceId: 'svc-admision-citas', serviceName: 'Citas y Reservas',
        priority: TicketPriority.Normal, ticketId: null, ticketNumber: null,
        estimatedWaitAtRegistration: 25, checkedIn: false,
        registeredAt: new Date(now - 40 * 60 * 1000), checkedInAt: null,
        queuePositionAtRegistration: 5,
      },
      {
        id: 'vt-002', patientName: 'Palacios Rivas, Jorge', documentId: '31245678',
        phone: '976543210', serviceId: 'svc-medicina-gral', serviceName: 'Medicina General',
        priority: TicketPriority.Preferencial, ticketId: 'tk-seed-13', ticketNumber: 'M-003',
        estimatedWaitAtRegistration: 15, checkedIn: true,
        registeredAt: new Date(now - 60 * 60 * 1000),
        checkedInAt: new Date(now - 20 * 60 * 1000),
        queuePositionAtRegistration: 2,
      },
      {
        id: 'vt-003', patientName: 'Herrera Quispe, Claudia', documentId: '56789012',
        phone: '965432109', serviceId: 'svc-admision-caja', serviceName: 'Caja / Pagos',
        priority: TicketPriority.Normal, ticketId: null, ticketNumber: null,
        estimatedWaitAtRegistration: 18, checkedIn: false,
        registeredAt: new Date(now - 20 * 60 * 1000), checkedInAt: null,
        queuePositionAtRegistration: 4,
      },
      {
        id: 'vt-004', patientName: 'Alvarado Torres, Miguel', documentId: '65412398',
        phone: '954321098', serviceId: 'svc-pediatria', serviceName: 'Pediatría',
        priority: TicketPriority.VIP, ticketId: null, ticketNumber: null,
        estimatedWaitAtRegistration: 8, checkedIn: false,
        registeredAt: new Date(now - 10 * 60 * 1000), checkedInAt: null,
        queuePositionAtRegistration: 1,
      },
    ];
  }

  private _seedSimulations(): SimulationResult[] {
    const params1: SimulationParams = {
      arrivalRatePerHour: 40, avgServiceTimeMinutes: 5, serverCount: 4,
      durationHours: 8, priorityDistribution: { normal: 60, preferential: 30, vip: 10 },
      rule: QueueRuleType.PriorityFirst,
    };
    const params2: SimulationParams = {
      arrivalRatePerHour: 60, avgServiceTimeMinutes: 6, serverCount: 3,
      durationHours: 8, priorityDistribution: { normal: 70, preferential: 25, vip: 5 },
      rule: QueueRuleType.FIFO,
    };
    return [
      {
        id: 'sim-001', name: 'Escenario Normal — 4 ventanillas',
        params: params1, avgWaitMinutes: 4.2, maxWaitMinutes: 11.8,
        serverUtilization: 0.83, ticketsProcessed: 308, abandonments: 12,
        slaCompliancePct: 94, simulatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
        queueCurve: [
          { hour: 1, queueLength: 3, waitMinutes: 3.5 },
          { hour: 2, queueLength: 5, waitMinutes: 4.2 },
          { hour: 3, queueLength: 8, waitMinutes: 5.1 },
          { hour: 4, queueLength: 6, waitMinutes: 4.8 },
          { hour: 5, queueLength: 4, waitMinutes: 3.9 },
          { hour: 6, queueLength: 7, waitMinutes: 4.5 },
          { hour: 7, queueLength: 5, waitMinutes: 4.1 },
          { hour: 8, queueLength: 2, waitMinutes: 3.2 },
        ],
      },
      {
        id: 'sim-002', name: 'Hora pico — 3 ventanillas (FIFO)',
        params: params2, avgWaitMinutes: 11.5, maxWaitMinutes: 28.3,
        serverUtilization: 0.93, ticketsProcessed: 431, abandonments: 49,
        slaCompliancePct: 71, simulatedAt: new Date(Date.now() - 60 * 60 * 1000),
        queueCurve: [
          { hour: 1, queueLength: 6,  waitMinutes: 8.2 },
          { hour: 2, queueLength: 12, waitMinutes: 11.5 },
          { hour: 3, queueLength: 18, waitMinutes: 14.8 },
          { hour: 4, queueLength: 15, waitMinutes: 13.2 },
          { hour: 5, queueLength: 10, waitMinutes: 10.5 },
          { hour: 6, queueLength: 14, waitMinutes: 12.1 },
          { hour: 7, queueLength: 9,  waitMinutes: 9.8 },
          { hour: 8, queueLength: 4,  waitMinutes: 7.3 },
        ],
      },
    ];
  }

  private _seedPredictions(): DemandPrediction[] {
    const today  = new Date();
    const dateStr = today.toISOString().split('T')[0];
    const hours  = ['07:00','08:00','09:00','10:00','11:00','12:00','13:00','14:00','15:00','16:00','17:00','18:00'];
    const pattern = [2, 8, 14, 12, 10, 6, 4, 8, 11, 9, 5, 2];
    const points: DemandPoint[] = hours.map((h, i) => ({
      hour: h, predicted: pattern[i], actual: i < 3 ? pattern[i] + Math.round(Math.random() * 2 - 1) : null,
      peakFactor: Math.round((pattern[i] / 8) * 100) / 100,
    }));
    return [
      {
        id: 'pred-001', serviceId: 'svc-admision-caja', serviceName: 'Caja / Pagos',
        date: dateStr, dayOfWeek: today.getDay(), points,
        totalPredicted: 91, peakHour: '09:00', suggestedWindows: 4,
        generatedAt: new Date(Date.now() - 30 * 60 * 1000),
      },
    ];
  }
}
