import type { ServiceType }    from '../../tickets/models/service-type.model';
import type { TicketPriority } from '../../tickets/enums/ticket-priority.enum';
import type { Ticket }         from '../../tickets/models/ticket.model';
import { WindowStatus }        from '../enums/window-status.enum';
import { WindowAlertLevel }    from '../enums/window-alert.enum';

// ─────────────────────────────────────────────────────────────────────────────
// RF-32: Franja horaria de atención
// ─────────────────────────────────────────────────────────────────────────────

/** Franja horaria de atención de una ventanilla */
export interface WindowScheduleSlot {
  /** Día de semana (0 = domingo … 6 = sábado) */
  day: 0 | 1 | 2 | 3 | 4 | 5 | 6;
  /** Hora de inicio en formato "HH:mm" (24h) */
  startTime: string;
  /** Hora de fin en formato "HH:mm" (24h) */
  endTime: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// RF-35: Alerta de saturación
// ─────────────────────────────────────────────────────────────────────────────

/** Evento de alerta generado cuando la cola supera los umbrales configurados */
export interface WindowAlert {
  id: string;
  windowId: string;
  windowName: string;
  level: WindowAlertLevel;
  message: string;
  triggeredAt: Date;
  /** Cantidad de tickets en cola al momento de la alerta */
  queueSize: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// RF-21 a RF-34: Ventanilla / Módulo de atención
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Representa un módulo / ventanilla de atención en la clínica.
 *
 * Una ventanilla pertenece a un paso clínico (step), atiende uno o más
 * servicios, tiene capacidad máxima de cola y puede configurarse con
 * horarios de atención y umbrales de saturación.
 */
export interface Window {
  /** Identificador único de la ventanilla */
  id: string;

  /** Nombre visible del módulo (ej: "Módulo A1", "Consultorio 3") */
  name: string;

  /** Número físico de la ventanilla (visible en el panel de llamado) */
  number: number;

  /**
   * Paso clínico al que pertenece.
   * 1 = Admisión · 2 = Pre-consulta · 3 = Especialista
   */
  step: 1 | 2 | 3;

  /** RF-22: Servicios que puede atender esta ventanilla */
  assignedServiceIds: string[];

  /** RF-23: Estado operativo actual */
  status: WindowStatus;

  /** RF-26: Prioridades que atenderá preferentemente esta ventanilla */
  priorityFilter: TicketPriority[];

  /** RF-30: Máximo de tickets simultáneos en la cola de esta ventanilla (0 = ilimitado) */
  maxQueueSize: number;

  /** RF-35: Umbral (nº de tickets) para emitir alerta de advertencia */
  warnThreshold: number;

  /** RF-35: Umbral (nº de tickets) para emitir alerta crítica */
  criticalThreshold: number;

  /** RF-32: Franjas horarias de atención configuradas */
  schedule: WindowScheduleSlot[];

  /** Nombre del operador actualmente asignado */
  operatorName?: string;

  /** Fecha/hora de apertura del turno actual */
  openedAt?: Date;

  /** Fecha/hora de cierre del turno actual */
  closedAt?: Date;

  /** RF-34: Tickets asignados a la cola de esta ventanilla */
  queuedTicketIds: string[];

  /** Ticket que se está atendiendo actualmente en esta ventanilla */
  currentTicketId?: string;

  /** Acumulado de tickets atendidos en la sesión actual */
  attendedCount: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// DTOs
// ─────────────────────────────────────────────────────────────────────────────

/** Datos para crear una nueva ventanilla (RF-21) */
export type CreateWindowDto = Omit<
  Window,
  'id' | 'status' | 'queuedTicketIds' | 'currentTicketId' | 'attendedCount' | 'openedAt' | 'closedAt'
>;

/** Datos para editar una ventanilla existente */
export type UpdateWindowDto = Partial<CreateWindowDto>;

// ─────────────────────────────────────────────────────────────────────────────
// RF-29: Resumen en tiempo real para el dashboard
// ─────────────────────────────────────────────────────────────────────────────

/** Snapshot del estado de una ventanilla para el panel de monitoreo */
export interface WindowSummary {
  window: Window;
  /** Tickets actualmente en cola de esta ventanilla */
  queuedTickets: Ticket[];
  /** Ticket en atención ahora (si existe) */
  currentTicket?: Ticket;
  /** Tiempo promedio de espera en minutos para esta ventanilla */
  avgWaitMinutes: number;
  /** RF-35: Nivel de alerta por saturación */
  alertLevel: WindowAlertLevel;
  /** Indica si el horario actual está dentro del horario configurado */
  withinSchedule: boolean;
}
