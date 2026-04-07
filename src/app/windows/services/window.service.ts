import { computed, Injectable, signal } from '@angular/core';
import { TicketPriority, TICKET_PRIORITY_WEIGHT } from '../../tickets/enums/ticket-priority.enum';
import { TicketStatus } from '../../tickets/enums/ticket-status.enum';
import { TicketService } from '../../tickets/services/ticket.service';
import { WindowStatus } from '../enums/window-status.enum';
import { WindowAlertLevel } from '../enums/window-alert.enum';
import {
  CreateWindowDto,
  UpdateWindowDto,
  Window,
  WindowAlert,
  WindowScheduleSlot,
  WindowSummary,
} from '../models/window.model';

/**
 * Servicio principal del Módulo 2: Ventanillas / Módulos de atención.
 *
 * Cubre RF-21 a RF-35:
 * - RF-21 Registrar ventanilla
 * - RF-22 Asignar servicios
 * - RF-23 Estado de ventanilla
 * - RF-24 Asignación automática (balanceo de carga)
 * - RF-25 Transferencia de tickets entre módulos
 * - RF-26 Prioridad por ventanilla
 * - RF-27 Cierre de ventanilla
 * - RF-28 Reapertura de ventanilla
 * - RF-29 Dashboard en tiempo real (windowSummaries)
 * - RF-30 Capacidad máxima de cola por ventanilla
 * - RF-31 Reasignación automática (redistribución dinámica)
 * - RF-32 Configuración de horarios
 * - RF-33 Estado de mantenimiento
 * - RF-34 Cola independiente por ventanilla
 * - RF-35 Alertas de saturación
 */
@Injectable({ providedIn: 'root' })
export class WindowService {
  constructor(private readonly ticketService: TicketService) {
    // _loadSeedData() en TicketService es síncrono, por lo que los tickets
    // ya están disponibles cuando se ejecuta este constructor.
    this._seedWindowQueues();
  }

  // ─── Estado principal ────────────────────────────────────────────────────

  private readonly _windows  = signal<Window[]>(this._seedWindows());
  private readonly _alerts   = signal<WindowAlert[]>([]);
  private _idCounter = 100;

  // ─── Exposición de signals ───────────────────────────────────────────────

  readonly windows = this._windows.asReadonly();
  readonly alerts  = this._alerts.asReadonly();

  // ─── RF-29: Resúmenes en tiempo real ────────────────────────────────────

  /**
   * Computed que combina ventanillas + tickets del TicketService
   * para producir el snapshot completo del dashboard.
   */
  readonly windowSummaries = computed<WindowSummary[]>(() => {
    const allTickets = this.ticketService.tickets();
    return this._windows().map(win => this._buildSummary(win, allTickets));
  });

  /** Total de ventanillas disponibles */
  readonly totalAvailable = computed(() =>
    this._windows().filter(w => w.status === WindowStatus.Disponible).length
  );

  /** Total de ventanillas ocupadas */
  readonly totalOccupied = computed(() =>
    this._windows().filter(w => w.status === WindowStatus.Ocupado).length
  );

  /** Alertas activas (warning o critical) */
  readonly activeAlerts = computed(() =>
    this._alerts().filter(a => a.level !== WindowAlertLevel.None)
  );

  // ─── RF-21: Registrar ventanilla ────────────────────────────────────────

  createWindow(dto: CreateWindowDto): Window {
    const win: Window = {
      ...dto,
      id: `win-${++this._idCounter}`,
      status: WindowStatus.Offline,
      queuedTicketIds: [],
      currentTicketId: undefined,
      attendedCount: 0,
    };
    this._windows.update(list => [...list, win]);
    return win;
  }

  // ─── RF-21 update / delete ───────────────────────────────────────────────

  updateWindow(id: string, dto: UpdateWindowDto): void {
    this._windows.update(list =>
      list.map(w => (w.id === id ? { ...w, ...dto } : w))
    );
  }

  deleteWindow(id: string): void {
    this._windows.update(list => list.filter(w => w.id !== id));
  }

  // ─── RF-22: Asignar servicios a ventanilla ───────────────────────────────

  assignServices(windowId: string, serviceIds: string[]): void {
    this._patch(windowId, { assignedServiceIds: serviceIds });
  }

  // ─── RF-23: Cambio de estado genérico ────────────────────────────────────

  setStatus(windowId: string, status: WindowStatus): void {
    this._patch(windowId, { status });
  }

  // ─── RF-26: Configurar filtro de prioridad ───────────────────────────────

  setPriorityFilter(windowId: string, priorities: TicketPriority[]): void {
    this._patch(windowId, { priorityFilter: priorities });
  }

  // ─── RF-27: Cerrar ventanilla ────────────────────────────────────────────

  closeWindow(windowId: string): void {
    this._patch(windowId, {
      status: WindowStatus.Cerrada,
      closedAt: new Date(),
      operatorName: undefined,
    });
  }

  // ─── RF-28: Reabrir ventanilla ───────────────────────────────────────────

  openWindow(windowId: string, operatorName: string): void {
    this._patch(windowId, {
      status: WindowStatus.Disponible,
      openedAt: new Date(),
      closedAt: undefined,
      operatorName,
      attendedCount: 0,
    });
  }

  // ─── RF-33: Poner en mantenimiento ───────────────────────────────────────

  setMaintenance(windowId: string): void {
    this._patch(windowId, {
      status: WindowStatus.Mantenimiento,
      operatorName: undefined,
    });
  }

  // ─── RF-24: Asignación automática de ticket (balanceo de carga) ──────────

  /**
   * Busca la ventanilla más adecuada para el ticket dado y lo encola.
   * Algoritmo:
   *  1. Filtra ventanillas disponibles que atiendan el servicio del ticket
   *  2. Respeta el filtro de prioridad configurado por ventanilla (RF-26)
   *  3. Respeta la capacidad máxima de cola (RF-30)
   *  4. Elige la ventanilla con menos tickets en cola (balanceo de carga)
   * @returns La ventanilla asignada, o undefined si no hay disponible
   */
  autoAssign(ticketId: string): Window | undefined {
    const ticket = this.ticketService.tickets().find(t => t.id === ticketId);
    if (!ticket) return undefined;

    const candidates = this._windows()
      .filter(w =>
        w.status === WindowStatus.Disponible &&
        w.assignedServiceIds.includes(ticket.service.id) &&
        this._withinSchedule(w) &&
        (w.maxQueueSize === 0 || w.queuedTicketIds.length < w.maxQueueSize) &&
        (w.priorityFilter.length === 0 || w.priorityFilter.includes(ticket.priority))
      )
      .sort((a, b) => a.queuedTicketIds.length - b.queuedTicketIds.length);

    if (!candidates.length) return undefined;
    const winner = candidates[0];
    this._enqueue(winner.id, ticketId);
    return winner;
  }

  // ─── RF-34: Encolar ticket en ventanilla específica ──────────────────────

  enqueueTicket(windowId: string, ticketId: string): boolean {
    const win = this._find(windowId);
    if (!win) return false;
    if (win.maxQueueSize > 0 && win.queuedTicketIds.length >= win.maxQueueSize) return false;
    this._enqueue(windowId, ticketId);
    this._checkAlerts(windowId);
    return true;
  }

  // ─── RF-40: Tomar el siguiente ticket de la cola (inicio de atención) ──────

  /**
   * Extrae el primer ticket de la cola de la ventanilla, lo marca como
   * EN_ATENCION en el TicketService y lo asigna como currentTicketId.
   * @returns el Ticket tomado, o undefined si la cola estaba vacía.
   */
  takeNextTicket(windowId: string): import('../../tickets/models/ticket.model').Ticket | undefined {
    const win = this._find(windowId);
    if (!win || !win.queuedTicketIds.length) return undefined;

    const allTickets = this.ticketService.tickets();
    // Toma el primer ticket de la cola ordenado por prioridad
    const sorted = win.queuedTicketIds
      .map(id => allTickets.find(t => t.id === id))
      .filter((t): t is import('../../tickets/models/ticket.model').Ticket => !!t)
      .sort((a, b) =>
        TICKET_PRIORITY_WEIGHT[b.priority] - TICKET_PRIORITY_WEIGHT[a.priority] ||
        a.createdAt.getTime() - b.createdAt.getTime()
      );

    const next = sorted[0];
    if (!next) return undefined;

    // Marcar como En Atención en TicketService
    this.ticketService.callNextTicket(next.service.id, win.number);

    // Actualizar la ventanilla: quitar de cola, asignar currentTicketId, poner Ocupado
    this._windows.update(list =>
      list.map(w =>
        w.id === windowId
          ? {
              ...w,
              status:           WindowStatus.Ocupado,
              queuedTicketIds:  w.queuedTicketIds.filter(id => id !== next.id),
              currentTicketId:  next.id,
            }
          : w
      )
    );
    return next;
  }

  // ─── RF-41: Finalizar atención (cerrar ticket actual) ────────────────────

  /**
   * Completa el ticket actualmente en atención de la ventanilla.
   * Actualiza el contador de atendidos y libera el currentTicketId.
   */
  finishCurrentTicket(windowId: string, notes?: string): boolean {
    const win = this._find(windowId);
    if (!win?.currentTicketId) return false;

    this.ticketService.completeTicket(win.currentTicketId, notes);

    const nextStatus = win.queuedTicketIds.length > 0
      ? WindowStatus.Ocupado
      : WindowStatus.Disponible;

    this._windows.update(list =>
      list.map(w =>
        w.id === windowId
          ? {
              ...w,
              status:          nextStatus,
              currentTicketId: undefined,
              attendedCount:   w.attendedCount + 1,
            }
          : w
      )
    );
    return true;
  }

  // ─── RF-25: Transferencia de ticket entre módulos ─────────────────────────

  transferTicket(ticketId: string, fromWindowId: string, toWindowId: string): boolean {
    const toWin = this._find(toWindowId);
    if (!toWin) return false;
    if (toWin.maxQueueSize > 0 && toWin.queuedTicketIds.length >= toWin.maxQueueSize) return false;

    // Quitar de la cola origen
    this._windows.update(list =>
      list.map(w =>
        w.id === fromWindowId
          ? { ...w, queuedTicketIds: w.queuedTicketIds.filter(id => id !== ticketId) }
          : w
      )
    );
    // Agregar a la cola destino
    this._enqueue(toWindowId, ticketId);
    this._checkAlerts(toWindowId);
    return true;
  }

  // ─── RF-31: Reasignación automática (redistribución dinámica) ────────────

  /**
   * Redistribuye tickets de ventanillas saturadas hacia ventanillas con
   * menor carga. Se ejecuta manualmente o puede ser llamado por un timer.
   * @returns Número de tickets redistribuidos
   */
  rebalance(): number {
    let moved = 0;
    const summaries = this.windowSummaries();

    const overloaded = summaries.filter(
      s => s.alertLevel === WindowAlertLevel.Critical && s.queuedTickets.length > 1
    );

    for (const src of overloaded) {
      // Toma el último ticket de la cola (menor prioridad / más reciente)
      const ticketsToMove = src.queuedTickets.slice(Math.ceil(src.queuedTickets.length / 2));
      for (const ticket of ticketsToMove) {
        const target = this._windows()
          .filter(
            w =>
              w.id !== src.window.id &&
              w.status === WindowStatus.Disponible &&
              w.assignedServiceIds.includes(ticket.service.id) &&
              (w.maxQueueSize === 0 || w.queuedTicketIds.length < w.maxQueueSize)
          )
          .sort((a, b) => a.queuedTicketIds.length - b.queuedTicketIds.length)[0];

        if (target) {
          this.transferTicket(ticket.id, src.window.id, target.id);
          moved++;
        }
      }
    }
    return moved;
  }

  // ─── RF-32: Configurar horarios ──────────────────────────────────────────

  setSchedule(windowId: string, slots: WindowScheduleSlot[]): void {
    this._patch(windowId, { schedule: slots });
  }

  // ─── RF-30: Configurar capacidad máxima ──────────────────────────────────

  setMaxQueueSize(windowId: string, max: number): void {
    this._patch(windowId, { maxQueueSize: Math.max(0, max) });
  }

  // ─── RF-35: Configurar umbrales de alerta ────────────────────────────────

  setAlertThresholds(windowId: string, warn: number, critical: number): void {
    this._patch(windowId, { warnThreshold: warn, criticalThreshold: critical });
  }

  dismissAlert(alertId: string): void {
    this._alerts.update(list => list.filter(a => a.id !== alertId));
  }

  dismissAllAlerts(): void {
    this._alerts.set([]);
  }

  // ─── Helpers privados ────────────────────────────────────────────────────

  private _patch(windowId: string, partial: Partial<Window>): void {
    this._windows.update(list =>
      list.map(w => (w.id === windowId ? { ...w, ...partial } : w))
    );
  }

  private _find(windowId: string): Window | undefined {
    return this._windows().find(w => w.id === windowId);
  }

  private _enqueue(windowId: string, ticketId: string): void {
    this._windows.update(list =>
      list.map(w =>
        w.id === windowId
          ? {
              ...w,
              queuedTicketIds: w.queuedTicketIds.includes(ticketId)
                ? w.queuedTicketIds
                : [...w.queuedTicketIds, ticketId],
            }
          : w
      )
    );
  }

  /** RF-35: Evalúa si la cola superó umbrales y emite alerta */
  private _checkAlerts(windowId: string): void {
    const win = this._find(windowId);
    if (!win) return;
    const size = win.queuedTicketIds.length;

    let level = WindowAlertLevel.None;
    let message = '';

    if (win.criticalThreshold > 0 && size >= win.criticalThreshold) {
      level = WindowAlertLevel.Critical;
      message = `${win.name}: ${size} pacientes en cola — saturación crítica`;
    } else if (win.warnThreshold > 0 && size >= win.warnThreshold) {
      level = WindowAlertLevel.Warning;
      message = `${win.name}: ${size} pacientes en cola — carga elevada`;
    }

    if (level !== WindowAlertLevel.None) {
      const alert: WindowAlert = {
        id: `alert-${Date.now()}-${windowId}`,
        windowId,
        windowName: win.name,
        level,
        message,
        triggeredAt: new Date(),
        queueSize: size,
      };
      // Evitar alertas duplicadas recientes (misma ventanilla y nivel)
      this._alerts.update(list => {
        const recent = list.find(a => a.windowId === windowId && a.level === level);
        if (recent) return list;
        return [...list, alert];
      });
    }
  }

  /** RF-29: Construye el WindowSummary para el dashboard */
  private _buildSummary(win: Window, allTickets: import('../../tickets/models/ticket.model').Ticket[]): WindowSummary {
    const queuedTickets = win.queuedTicketIds
      .map(id => allTickets.find(t => t.id === id))
      .filter((t): t is import('../../tickets/models/ticket.model').Ticket => !!t)
      .sort((a, b) =>
        TICKET_PRIORITY_WEIGHT[b.priority] - TICKET_PRIORITY_WEIGHT[a.priority] ||
        a.createdAt.getTime() - b.createdAt.getTime()
      );

    const currentTicket = win.currentTicketId
      ? allTickets.find(t => t.id === win.currentTicketId)
      : undefined;

    const avgWaitMinutes =
      queuedTickets.length > 0
        ? Math.round(
            queuedTickets.reduce((acc, t) => acc + t.estimatedWaitMinutes, 0) /
              queuedTickets.length
          )
        : 0;

    const size = queuedTickets.length;
    let alertLevel = WindowAlertLevel.None;
    if (win.criticalThreshold > 0 && size >= win.criticalThreshold) alertLevel = WindowAlertLevel.Critical;
    else if (win.warnThreshold > 0 && size >= win.warnThreshold) alertLevel = WindowAlertLevel.Warning;

    return {
      window: win,
      queuedTickets,
      currentTicket,
      avgWaitMinutes,
      alertLevel,
      withinSchedule: this._withinSchedule(win),
    };
  }

  /** RF-32: Verifica si la hora actual está dentro del horario configurado */
  private _withinSchedule(win: Window): boolean {
    if (!win.schedule.length) return true; // Sin horario → siempre abierto
    const now = new Date();
    const day = now.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    const hhmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    return win.schedule.some(
      s => s.day === day && hhmm >= s.startTime && hhmm <= s.endTime
    );
  }

  /** Genera el ID de una nueva ventanilla */
  private _nextId(): string {
    return `win-${++this._idCounter}`;
  }

  // ─── Seed de colas ─────────────────────────────────────────────────────

  /**
   * Distribuye los tickets semilla del TicketService en las ventanillas.
   * Mapea cada ticket a la ventanilla más adecuada según el servicio,
   * sin superar la capacidad máxima.
   */
  private _seedWindowQueues(): void {
    const tickets = this.ticketService.tickets();
    if (!tickets.length) return;

    // Solo encolar tickets en espera o en atención
    const active = tickets.filter(
      t => t.status === 'EN_ESPERA' || t.status === 'EN_ATENCION'
    );

    // Mapa: serviceId -> ventanillas disponibles (ordenadas por número de window)
    const winsByService: Record<string, string[]> = {};
    for (const w of this._windows()) {
      if (w.status === WindowStatus.Cerrada || w.status === WindowStatus.Offline || w.status === WindowStatus.Mantenimiento) continue;
      for (const svcId of w.assignedServiceIds) {
        if (!winsByService[svcId]) winsByService[svcId] = [];
        winsByService[svcId].push(w.id);
      }
    }

    // Índice rotativo por servicio para distribuir tickets entre ventanillas
    const rotIdx: Record<string, number> = {};

    for (const ticket of active) {
      const svcId = ticket.service.id;
      const candidates = winsByService[svcId];
      if (!candidates?.length) continue;

      const idx = rotIdx[svcId] ?? 0;
      const winId = candidates[idx % candidates.length];
      rotIdx[svcId] = idx + 1;

      const win = this._find(winId);
      if (!win) continue;
      if (win.maxQueueSize > 0 && win.queuedTicketIds.length >= win.maxQueueSize) continue;

      if (ticket.status === 'EN_ATENCION') {
        const targetWin = this._find(winId);
        if (targetWin && !targetWin.currentTicketId) {
          // Ventanilla libre: asignar como ticket en atención activa
          this._windows.update(list =>
            list.map(w => w.id === winId ? { ...w, currentTicketId: ticket.id, status: WindowStatus.Ocupado } : w)
          );
        } else {
          // Ventanilla ya ocupada: encolar el ticket
          this._enqueue(winId, ticket.id);
        }
      } else {
        this._enqueue(winId, ticket.id);
      }
    }
  }

  // ─── Datos semilla ───────────────────────────────────────────────────────

  private _seedWindows(): Window[] {
    const allPriorities = Object.values(TicketPriority);
    const morningSlots: WindowScheduleSlot[] = [
      { day: 1, startTime: '07:00', endTime: '15:00' },
      { day: 2, startTime: '07:00', endTime: '15:00' },
      { day: 3, startTime: '07:00', endTime: '15:00' },
      { day: 4, startTime: '07:00', endTime: '15:00' },
      { day: 5, startTime: '07:00', endTime: '15:00' },
    ];

    return [
      // ── PASO 1: ADMISIÓN ─────────────────────────────────────────────────
      {
        id: 'win-01', name: 'Ventanilla 1 — Caja / Pagos', number: 1, step: 1,
        assignedServiceIds: ['svc-admision-caja'],
        status: WindowStatus.Disponible,
        priorityFilter: allPriorities,
        maxQueueSize: 10, warnThreshold: 7, criticalThreshold: 10,
        schedule: morningSlots,
        operatorName: 'Operador A',
        openedAt: new Date(),
        queuedTicketIds: [], attendedCount: 0,
      },
      {
        id: 'win-02', name: 'Ventanilla 2 — Caja / Pagos', number: 2, step: 1,
        assignedServiceIds: ['svc-admision-caja'],
        status: WindowStatus.Disponible,
        priorityFilter: allPriorities,
        maxQueueSize: 10, warnThreshold: 7, criticalThreshold: 10,
        schedule: morningSlots,
        operatorName: 'Operador B',
        openedAt: new Date(),
        queuedTicketIds: [], attendedCount: 0,
      },
      {
        id: 'win-03', name: 'Módulo 3 — Citas y Reservas', number: 3, step: 1,
        assignedServiceIds: ['svc-admision-citas'],
        status: WindowStatus.Disponible,
        priorityFilter: allPriorities,
        maxQueueSize: 8, warnThreshold: 6, criticalThreshold: 8,
        schedule: morningSlots,
        operatorName: 'Operador C',
        openedAt: new Date(),
        queuedTicketIds: [], attendedCount: 0,
      },
      {
        id: 'win-04', name: 'Módulo 4 — Información General', number: 4, step: 1,
        assignedServiceIds: ['svc-admision-info'],
        status: WindowStatus.Offline,
        priorityFilter: allPriorities,
        maxQueueSize: 5, warnThreshold: 3, criticalThreshold: 5,
        schedule: morningSlots,
        queuedTicketIds: [], attendedCount: 0,
      },

      // ── PASO 2: PRE-CONSULTA / TRIAJE ────────────────────────────────────
      {
        id: 'win-05', name: 'Box 1 — Triaje', number: 5, step: 2,
        assignedServiceIds: ['svc-triaje'],
        status: WindowStatus.Disponible,
        priorityFilter: allPriorities,
        maxQueueSize: 15, warnThreshold: 10, criticalThreshold: 15,
        schedule: morningSlots,
        operatorName: 'Enf. García',
        openedAt: new Date(),
        queuedTicketIds: [], attendedCount: 0,
      },
      {
        id: 'win-06', name: 'Box 2 — Triaje', number: 6, step: 2,
        assignedServiceIds: ['svc-triaje'],
        status: WindowStatus.Disponible,
        priorityFilter: allPriorities,
        maxQueueSize: 15, warnThreshold: 10, criticalThreshold: 15,
        schedule: morningSlots,
        operatorName: 'Enf. Torres',
        openedAt: new Date(),
        queuedTicketIds: [], attendedCount: 0,
      },

      // ── PASO 3: ESPECIALISTAS ─────────────────────────────────────────────
      {
        id: 'win-07', name: 'Consultorio 1 — Medicina General', number: 7, step: 3,
        assignedServiceIds: ['svc-medicina'],
        status: WindowStatus.Disponible,
        priorityFilter: allPriorities,
        maxQueueSize: 20, warnThreshold: 12, criticalThreshold: 18,
        schedule: morningSlots,
        operatorName: 'Dr. Rojas',
        openedAt: new Date(),
        queuedTicketIds: [], attendedCount: 0,
      },
      {
        id: 'win-08', name: 'Consultorio 2 — Medicina General', number: 8, step: 3,
        assignedServiceIds: ['svc-medicina'],
        status: WindowStatus.Cerrada,
        priorityFilter: allPriorities,
        maxQueueSize: 20, warnThreshold: 12, criticalThreshold: 18,
        schedule: morningSlots,
        queuedTicketIds: [], attendedCount: 0,
      },
      {
        id: 'win-09', name: 'Consultorio 3 — Pediatría', number: 9, step: 3,
        assignedServiceIds: ['svc-pediatria'],
        status: WindowStatus.Disponible,
        priorityFilter: allPriorities,
        maxQueueSize: 15, warnThreshold: 10, criticalThreshold: 14,
        schedule: morningSlots,
        operatorName: 'Dra. Mendoza',
        openedAt: new Date(),
        queuedTicketIds: [], attendedCount: 0,
      },
      {
        id: 'win-10', name: 'Consultorio 4 — Especialidades', number: 10, step: 3,
        assignedServiceIds: ['svc-especialidades'],
        status: WindowStatus.Disponible,
        priorityFilter: allPriorities,
        maxQueueSize: 20, warnThreshold: 12, criticalThreshold: 18,
        schedule: morningSlots,
        operatorName: 'Dr. Vega',
        openedAt: new Date(),
        queuedTicketIds: [], attendedCount: 0,
      },
    ];
  }
}
