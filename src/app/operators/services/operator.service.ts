import { computed, inject, Injectable, signal } from '@angular/core';
import { OperatorRole }    from '../enums/operator-role.enum';
import { OperatorStatus }  from '../enums/operator-status.enum';
import {
  CreateOperatorDto,
  Operator,
  OperatorHistoryEntry,
  OperatorMetrics,
  OperatorNotification,
  OperatorShiftSlot,
  UpdateOperatorDto,
} from '../models/operator.model';
import { AuthService }     from './auth.service';
import { WindowService }   from '../../windows/services/window.service';
import { TicketService }   from '../../tickets/services/ticket.service';
import { WindowStatus }    from '../../windows/enums/window-status.enum';

/**
 * Servicio principal del Módulo 3 — Operadores.
 *
 * RF-36  Registro de operador (CRUD)
 * RF-37  Login / sesión (delegado a AuthService)
 * RF-38  Asignar operador a ventanilla
 * RF-39  Roles de usuario
 * RF-40  Inicio de atención (tomar ticket)
 * RF-41  Finalizar atención
 * RF-42  Pausas
 * RF-43  Estado del operador
 * RF-44  Historial de atención
 * RF-45  Métricas KPI individuales
 * RF-46  Transferir atención
 * RF-47  Supervisión en tiempo real
 * RF-48  Notificaciones internas
 * RF-49  Configuración de turnos
 * RF-50  Evaluación de desempeño
 */
@Injectable({ providedIn: 'root' })
export class OperatorService {
  private readonly authService   = inject(AuthService);
  private readonly windowService = inject(WindowService);
  private readonly ticketService = inject(TicketService);

  private _idCounter = 200;

  // ─── Estado ──────────────────────────────────────────────────────────────

  private readonly _operators = signal<Operator[]>(this._seedOperators());

  /** Lista de todos los operadores */
  readonly operators = this._operators.asReadonly();

  // ─── RF-47: Supervisión en tiempo real ───────────────────────────────────

  /** Operadores activos (no Offline) para el panel de supervisor */
  readonly activeOperators = computed(() =>
    this._operators().filter(o => o.status !== OperatorStatus.Offline)
  );

  /** Totales por estado para chips del dashboard */
  readonly totalAvailable = computed(() =>
    this._operators().filter(o => o.status === OperatorStatus.Disponible).length
  );
  readonly totalBusy = computed(() =>
    this._operators().filter(o => o.status === OperatorStatus.Ocupado).length
  );
  readonly totalOnBreak = computed(() =>
    this._operators().filter(o => o.status === OperatorStatus.EnPausa).length
  );
  readonly totalOffline = computed(() =>
    this._operators().filter(o => o.status === OperatorStatus.Offline).length
  );

  // ─── RF-45 / RF-50: Métricas por operador ────────────────────────────────

  readonly metrics = computed<OperatorMetrics[]>(() =>
    this._operators().map(op => this._buildMetrics(op))
  );

  // ─── RF-48: Notificaciones del operador en sesión ────────────────────────

  readonly myNotifications = computed<OperatorNotification[]>(() => {
    const me = this.authService.currentOperator();
    if (!me) return [];
    return this._operators()
      .find(o => o.id === me.id)
      ?.notifications.filter(n => !n.read) ?? [];
  });

  readonly unreadCount = computed(() => this.myNotifications().length);

  // ─── RF-36: Registrar operador ───────────────────────────────────────────

  create(dto: CreateOperatorDto): Operator {
    const op: Operator = {
      ...dto,
      id:                `op-${++this._idCounter}`,
      status:            OperatorStatus.Offline,
      shifts:            dto.shifts ?? [],
      history:           [],
      notifications:     [],
      attendedCount:     0,
      totalBreakMinutes: 0,
      score:             80,
      createdAt:         new Date(),
    };
    this._operators.update(list => [...list, op]);
    return op;
  }

  // ─── RF-36 update / delete ───────────────────────────────────────────────

  update(id: string, dto: UpdateOperatorDto): void {
    this._patch(id, dto as Partial<Operator>);
  }

  delete(id: string): void {
    this._operators.update(list => list.filter(o => o.id !== id));
  }

  getById(id: string): Operator | undefined {
    return this._operators().find(o => o.id === id);
  }

  // ─── RF-38: Asignar operador a ventanilla ────────────────────────────────

  assignToWindow(operatorId: string, windowId: string): void {
    this._patch(operatorId, { assignedWindowId: windowId });
    // Actualiza también el campo operatorName en la ventanilla
    const op = this.getById(operatorId);
    if (op) {
      this.windowService.updateWindow(windowId, { operatorName: op.name });
    }
  }

  unassignFromWindow(operatorId: string): void {
    const op = this.getById(operatorId);
    if (op?.assignedWindowId) {
      this.windowService.updateWindow(op.assignedWindowId, { operatorName: undefined });
    }
    this._patch(operatorId, { assignedWindowId: undefined });
  }

  // ─── RF-43: Cambiar estado manualmente ───────────────────────────────────

  setStatus(operatorId: string, status: OperatorStatus): void {
    this._patch(operatorId, { status });
    this.authService.refreshSession(this._operators().find(o => o.id === operatorId)!);
  }

  // ─── RF-40: Inicio de atención ───────────────────────────────────────────

  /**
   * El operador toma el siguiente ticket de su ventanilla.
   * @returns id del ticket tomado, o null si la cola está vacía.
   */
  startAttention(operatorId: string): string | null {
    const op = this.getById(operatorId);
    if (!op?.assignedWindowId) return null;

    const ticket = this.windowService.takeNextTicket(op.assignedWindowId);
    if (!ticket) return null;

    this._patch(operatorId, {
      status:          OperatorStatus.Ocupado,
      currentTicketId: ticket.id,
    });
    this.authService.refreshSession(this._operators().find(o => o.id === operatorId)!);
    return ticket.id;
  }

  // ─── RF-41: Finalizar atención ───────────────────────────────────────────

  finishAttention(operatorId: string, notes?: string): void {
    const op = this.getById(operatorId);
    if (!op?.currentTicketId || !op.assignedWindowId) return;

    const ticket = this.ticketService.tickets().find(t => t.id === op.currentTicketId);
    if (!ticket) return;

    const svc = this.ticketService.services().find(s => s.id === ticket.service.id);
    const win = this.windowService.windows().find(w => w.id === op.assignedWindowId);
    const startedAt = ticket.calledAt ?? ticket.createdAt;
    const now = new Date();
    const durationMinutes = Math.max(1, Math.round(
      (now.getTime() - new Date(startedAt).getTime()) / 60_000
    ));

    // Completa el ticket en WindowService (que delega a TicketService)
    this.windowService.finishCurrentTicket(op.assignedWindowId, notes);

    // Registra en historial del operador
    const entry: OperatorHistoryEntry = {
      ticketId:        ticket.id,
      ticketNumber:    ticket.number,
      patientName:     ticket.patientName ?? 'Anónimo',
      serviceName:     svc?.name ?? ticket.service.id,
      windowName:      win?.name ?? op.assignedWindowId,
      startedAt:       new Date(startedAt),
      finishedAt:      now,
      durationMinutes,
    };

    this._operators.update(list =>
      list.map(o => {
        if (o.id !== operatorId) return o;
        const newScore = this._calcScore(o.attendedCount + 1, durationMinutes, o.totalBreakMinutes);
        return {
          ...o,
          status:          OperatorStatus.Disponible,
          currentTicketId: undefined,
          attendedCount:   o.attendedCount + 1,
          history:         [entry, ...o.history].slice(0, 100),
          score:           newScore,
        };
      })
    );
    this.authService.refreshSession(this._operators().find(o => o.id === operatorId)!);
  }

  // ─── RF-42: Pausas ───────────────────────────────────────────────────────

  startBreak(operatorId: string, reason: string): void {
    this._patch(operatorId, {
      status:         OperatorStatus.EnPausa,
      breakReason:    reason,
      breakStartedAt: new Date(),
    });
    this.authService.refreshSession(this._operators().find(o => o.id === operatorId)!);
  }

  endBreak(operatorId: string): void {
    const op = this.getById(operatorId);
    if (!op?.breakStartedAt) return;

    const breakMins = Math.round(
      (Date.now() - new Date(op.breakStartedAt).getTime()) / 60_000
    );

    this._patch(operatorId, {
      status:            OperatorStatus.Disponible,
      breakReason:       undefined,
      breakStartedAt:    undefined,
      totalBreakMinutes: op.totalBreakMinutes + breakMins,
    });
    this.authService.refreshSession(this._operators().find(o => o.id === operatorId)!);
  }

  // ─── RF-46: Transferir ticket a otro operador/ventanilla ─────────────────

  transferTicket(fromOperatorId: string, toWindowId: string): boolean {
    const op = this.getById(fromOperatorId);
    if (!op?.currentTicketId || !op.assignedWindowId) return false;

    const transferred = this.windowService.transferTicket(
      op.currentTicketId,
      op.assignedWindowId,
      toWindowId
    );
    if (!transferred) return false;

    this._patch(fromOperatorId, {
      status:          OperatorStatus.Disponible,
      currentTicketId: undefined,
    });
    this.authService.refreshSession(this._operators().find(o => o.id === fromOperatorId)!);
    return true;
  }

  /**
   * RF-46: Transferir ticket a otro servicio (cambia de cola).
   * Funciona tanto con el ticket en atención como con un ticket específico de la cola.
   */
  transferTicketToService(
    fromOperatorId: string,
    targetServiceId: string,
    ticketId?: string,
    reason?: string
  ): boolean {
    const op = this.getById(fromOperatorId);
    if (!op?.assignedWindowId) return false;

    const idToTransfer = ticketId ?? op.currentTicketId;
    if (!idToTransfer) return false;

    const isCurrentTicket = idToTransfer === op.currentTicketId;

    // Si es un ticket de la cola, sacarlo de la ventanilla primero
    if (!isCurrentTicket) {
      this.windowService.dequeueTicket(op.assignedWindowId, idToTransfer);
    }

    // Transferir en TicketService (cambia servicio y número)
    const transferred = this.ticketService.transferTicket(idToTransfer, targetServiceId, reason);
    if (!transferred) return false;

    // Auto-asignar a la mejor ventanilla del servicio destino
    this.windowService.autoAssign(idToTransfer);

    // Si era el ticket en atención, liberar al operador
    if (isCurrentTicket) {
      this._patch(fromOperatorId, {
        status:          OperatorStatus.Disponible,
        currentTicketId: undefined,
      });
      this.authService.refreshSession(this._operators().find(o => o.id === fromOperatorId)!);
    }

    return true;
  }

  // ─── RF-48: Notificaciones ───────────────────────────────────────────────

  /** Envía una notificación a un operador específico */
  notify(
    operatorId: string,
    message: string,
    type: OperatorNotification['type'] = 'info'
  ): void {
    this._operators.update(list =>
      list.map(o => {
        if (o.id !== operatorId) return o;
        const notif: OperatorNotification = {
          id:        `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type,
          message,
          createdAt: new Date(),
          read:      false,
        };
        return { ...o, notifications: [notif, ...o.notifications].slice(0, 50) };
      })
    );
  }

  /** Envía notificación a todos los operadores activos */
  broadcast(message: string, type: OperatorNotification['type'] = 'info'): void {
    this._operators.update(list =>
      list.map(o => {
        if (o.status === OperatorStatus.Offline) return o;
        const notif: OperatorNotification = {
          id:        `notif-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          type,
          message,
          createdAt: new Date(),
          read:      false,
        };
        return { ...o, notifications: [notif, ...o.notifications].slice(0, 50) };
      })
    );
  }

  markNotificationRead(operatorId: string, notifId: string): void {
    this._operators.update(list =>
      list.map(o => {
        if (o.id !== operatorId) return o;
        return {
          ...o,
          notifications: o.notifications.map(n =>
            n.id === notifId ? { ...n, read: true } : n
          ),
        };
      })
    );
  }

  markAllRead(operatorId: string): void {
    this._operators.update(list =>
      list.map(o => {
        if (o.id !== operatorId) return o;
        return { ...o, notifications: o.notifications.map(n => ({ ...n, read: true })) };
      })
    );
  }

  // ─── Helpers privados ────────────────────────────────────────────────────

  private _patch(id: string, patch: Partial<Operator>): void {
    this._operators.update(list =>
      list.map(o => (o.id === id ? { ...o, ...patch } : o))
    );
  }

  private _buildMetrics(op: Operator): OperatorMetrics {
    const attended = op.attendedCount;
    const totalDuration = op.history.reduce((s, h) => s + h.durationMinutes, 0);
    const avgDuration = attended > 0 ? Math.round(totalDuration / attended) : 0;
    const efficiency = this._calcEfficiency(attended, op.totalBreakMinutes);
    return {
      operatorId:         op.id,
      attendedToday:      attended,
      avgDurationMinutes: avgDuration,
      breakMinutes:       op.totalBreakMinutes,
      efficiency,
      score:              op.score,
    };
  }

  private _calcEfficiency(attended: number, breakMins: number): number {
    // 8h turno = 480 min. Cada atención promedio ~10 min.
    const workMinutes = Math.max(0, 480 - breakMins);
    const usedMinutes = Math.min(attended * 10, workMinutes);
    return workMinutes > 0 ? Math.round((usedMinutes / workMinutes) * 100) : 0;
  }

  private _calcScore(attended: number, lastDuration: number, breakMins: number): number {
    const base       = Math.min(attended * 4, 60);   // máx 60 pts por volumen
    const speedBonus = lastDuration <= 8 ? 20 : lastDuration <= 15 ? 10 : 0;
    const breakPen   = Math.min(Math.floor(breakMins / 30) * 5, 20); // -5 cada 30 min de pausa
    return Math.min(100, Math.max(0, base + speedBonus - breakPen));
  }

  // ─── Datos semilla — 6 operadores realistas ───────────────────────────────

  private _seedOperators(): Operator[] {
    const ago = (h: number, m = 0) => {
      const d = new Date();
      d.setHours(d.getHours() - h, d.getMinutes() - m);
      return d;
    };

    const shifts: OperatorShiftSlot[] = [
      { day: 1, startTime: '08:00', endTime: '16:00' },
      { day: 2, startTime: '08:00', endTime: '16:00' },
      { day: 3, startTime: '08:00', endTime: '16:00' },
      { day: 4, startTime: '08:00', endTime: '16:00' },
      { day: 5, startTime: '08:00', endTime: '14:00' },
    ];

    const h = (
      tId: string, tNum: string, patient: string,
      service: string, win: string, dMin: number, hoursAgo: number
    ): OperatorHistoryEntry => ({
      ticketId:        tId,
      ticketNumber:    tNum,
      patientName:     patient,
      serviceName:     service,
      windowName:      win,
      startedAt:       ago(hoursAgo, dMin),
      finishedAt:      ago(hoursAgo),
      durationMinutes: dMin,
    });

    return [
      {
        id:                'op-001',
        name:              'María Elena Quispe',
        email:             'admin@mediturno.pe',
        password:          'admin123',
        role:              OperatorRole.Admin,
        status:            OperatorStatus.Disponible,
        assignedWindowId:  'win-01',
        currentTicketId:   undefined,
        shifts,
        history: [
          h('t-s01', 'A001', 'García López, Juan Carlos', 'Caja / Pagos',       'Módulo 1 — Admisión', 6, 1),
          h('t-s02', 'A002', 'Torres Huanca, Rosa',        'Caja / Pagos',       'Módulo 1 — Admisión', 4, 2),
          h('t-s03', 'B001', 'Mamani Chura, Luis',         'Citas y Reservas',   'Módulo 2 — Citas',    9, 3),
        ],
        notifications: [
          { id: 'n-001', type: 'info',    message: '3 nuevos tickets en cola de Caja.', createdAt: ago(0, 30), read: false },
          { id: 'n-002', type: 'warning', message: 'Módulo 3 supera capacidad máxima.', createdAt: ago(1),    read: false },
        ],
        attendedCount:     12,
        totalBreakMinutes: 15,
        score:             92,
        createdAt:         new Date('2026-01-15'),
        lastLoginAt:       ago(0, 5),
      },
      {
        id:                'op-002',
        name:              'Carlos Ramos Flores',
        email:             'supervisor@mediturno.pe',
        password:          'super123',
        role:              OperatorRole.Supervisor,
        status:            OperatorStatus.Disponible,
        assignedWindowId:  undefined,
        currentTicketId:   undefined,
        shifts,
        history: [],
        notifications: [],
        attendedCount:     0,
        totalBreakMinutes: 0,
        score:             85,
        createdAt:         new Date('2026-01-20'),
        lastLoginAt:       ago(0, 10),
      },
      {
        id:                'op-003',
        name:              'Ana Lucía Mendoza',
        email:             'ana.mendoza@mediturno.pe',
        password:          'op123',
        role:              OperatorRole.Operador,
        status:            OperatorStatus.Disponible,
        assignedWindowId:  'win-02',
        currentTicketId:   undefined,
        shifts,
        history: [
          h('t-s04', 'B002', 'Vargas Ríos, Carmen',  'Citas y Reservas', 'Módulo 2 — Citas',    7, 1),
          h('t-s05', 'T001', 'Huanca Torres, Pedro',  'Triaje',           'Consultorio Triaje 1', 11, 2),
          h('t-s06', 'T002', 'Quispe Mamani, Carmen', 'Triaje',           'Consultorio Triaje 1', 8, 3),
        ],
        notifications: [],
        attendedCount:     8,
        totalBreakMinutes: 10,
        score:             88,
        createdAt:         new Date('2026-02-01'),
        lastLoginAt:       ago(0, 15),
      },
      {
        id:                'op-004',
        name:              'Jorge Luis Paredes',
        email:             'jorge.paredes@mediturno.pe',
        password:          'op123',
        role:              OperatorRole.Operador,
        status:            OperatorStatus.EnPausa,
        assignedWindowId:  'win-03',
        currentTicketId:   undefined,
        breakReason:       'Refrigerio',
        breakStartedAt:    ago(0, 20),
        shifts,
        history: [
          h('t-s07', 'M001', 'Ramos Flores, Alberto', 'Medicina General', 'Consultorio Med. 1', 18, 1),
          h('t-s08', 'M002', 'Llanos Parodi, Silvia', 'Medicina General', 'Consultorio Med. 1', 22, 2),
        ],
        notifications: [
          { id: 'n-003', type: 'info', message: '2 tickets en espera en tu módulo.', createdAt: ago(0, 25), read: false },
        ],
        attendedCount:     5,
        totalBreakMinutes: 20,
        score:             74,
        createdAt:         new Date('2026-02-10'),
        lastLoginAt:       ago(0, 25),
      },
      {
        id:                'op-005',
        name:              'Rosa Elena Sánchez',
        email:             'rosa.sanchez@mediturno.pe',
        password:          'op123',
        role:              OperatorRole.Operador,
        status:            OperatorStatus.Disponible,
        assignedWindowId:  'win-04',
        currentTicketId:   undefined,
        shifts,
        history: [
          h('t-s09', 'P001', 'Niño García, Sofía',     'Pediatría', 'Consultorio Pediatría', 14, 1),
          h('t-s10', 'P002', 'Niño Torres, Diego',     'Pediatría', 'Consultorio Pediatría', 17, 2),
          h('t-s11', 'P003', 'Niño Vargas, Valeria',   'Pediatría', 'Consultorio Pediatría', 12, 3),
          h('t-s12', 'E001', 'Mamani Chura, Roberto',  'Especialidades', 'Consultorio Esp. 1', 25, 4),
        ],
        notifications: [],
        attendedCount:     10,
        totalBreakMinutes: 0,
        score:             95,
        createdAt:         new Date('2026-02-15'),
        lastLoginAt:       ago(0, 8),
      },
      {
        id:                'op-006',
        name:              'Miguel Ángel Torres',
        email:             'miguel.torres@mediturno.pe',
        password:          'op123',
        role:              OperatorRole.Operador,
        status:            OperatorStatus.Offline,
        assignedWindowId:  undefined,
        currentTicketId:   undefined,
        shifts: [
          { day: 1, startTime: '14:00', endTime: '22:00' },
          { day: 2, startTime: '14:00', endTime: '22:00' },
          { day: 3, startTime: '14:00', endTime: '22:00' },
        ],
        history:           [],
        notifications:     [],
        attendedCount:     0,
        totalBreakMinutes: 0,
        score:             70,
        createdAt:         new Date('2026-03-01'),
        lastLoginAt:       undefined,
      },
    ];
  }
}
