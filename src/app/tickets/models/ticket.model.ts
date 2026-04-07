import { TicketPriority } from '../enums/ticket-priority.enum';
import { TicketSource } from '../enums/ticket-source.enum';
import { TicketStatus } from '../enums/ticket-status.enum';
import { TicketEvent } from '../enums/ticket-event.enum';
import { ServiceType } from './service-type.model';

/**
 * RF-11: Registro de un evento en el historial del ticket.
 * Permite auditar el ciclo de vida completo.
 */
export interface TicketHistoryEntry {
  /** Identificador único del evento */
  id: string;
  /** Momento en que ocurrió el evento */
  timestamp: Date;
  /** Tipo de evento registrado */
  event: TicketEvent;
  /** Detalle adicional del evento */
  detail?: string;
  /** Operador que realizó la acción */
  operator?: string;
}

/**
 * RF-18: Datos del servicio de origen cuando se realiza una transferencia.
 */
export interface TransferRecord {
  serviceId: string;
  serviceName: string;
  at: Date;
}

/**
 * Entidad central del sistema: representa un turno de atención generado
 * para un usuario en un servicio específico.
 *
 * Modelo: Ticket → Servicio → Prioridad → Estado → Tiempo
 */
export interface Ticket {
  /** Identificador único (UUID) del ticket */
  id: string;

  /**
   * Número de turno visible al usuario (ej: "A001", "B045").
   * Compuesto por el prefijo del servicio + número secuencial de 3 dígitos.
   */
  number: string;

  /** Servicio al que pertenece este ticket */
  service: ServiceType;

  /** Nivel de prioridad de atención */
  priority: TicketPriority;

  /** Estado actual en el ciclo de vida del ticket */
  status: TicketStatus;

  /** Canal a través del cual se generó el ticket */
  source: TicketSource;

  /** Fecha y hora de creación del ticket */
  createdAt: Date;

  /**
   * Fecha y hora en que el ticket fue llamado para atención.
   * `null` si aún no ha sido llamado.
   */
  calledAt: Date | null;

  /**
   * Fecha y hora en que finalizó la atención.
   * `null` si aún no ha sido atendido.
   */
  finishedAt: Date | null;

  /**
   * Tiempo de espera estimado en minutos desde la creación del ticket.
   * Calculado dinámicamente según la cola actual y la prioridad.
   */
  estimatedWaitMinutes: number;

  /**
   * Ventanilla o módulo al que fue asignado el ticket para atención.
   * `null` si aún no ha sido asignado.
   */
  assignedWindow: number | null;

  /**
   * Notas adicionales del operador al finalizar la atención.
   */
  notes?: string;

  /** RF-11: Historial completo del ciclo de vida del ticket */
  history: TicketHistoryEntry[];

  /** RF-19: true si fue generado como turno virtual (web/app) */
  virtualQueue: boolean;

  /** RF-20: true si el cliente confirmó su llegada física */
  checkedIn: boolean;

  /** RF-20: Momento en que se realizó el check-in */
  checkedInAt?: Date;

  /** RF-18: Servicio de origen si el ticket fue transferido */
  transferredFrom?: TransferRecord;

  /** RF-10: Número de veces que fue reprogramado */
  rescheduleCount: number;

  /** RF-14: Fecha y hora en que se imprimió el ticket */
  printedAt?: Date;

  /** DNI del paciente asociado al turno (obtenido desde el kiosko) */
  patientDni?: string;

  /** Nombre completo del paciente (obtenido desde la BD por DNI) */
  patientName?: string;
}

/**
 * Datos necesarios para crear un nuevo ticket.
 * Omite los campos que el sistema asigna automáticamente.
 */
export type CreateTicketDto = Pick<Ticket, 'service' | 'priority' | 'source'> & {
  notes?: string;
  /** RF-19: Marca el ticket como cola virtual (no entra a cola activa hasta check-in) */
  virtualQueue?: boolean;
  /** DNI del paciente (ingresado en el kiosko) */
  patientDni?: string;
  /** Nombre completo del paciente (resuelto por búsqueda de DNI) */
  patientName?: string;
};

/**
 * Resumen estadístico del estado de la cola para un servicio.
 */
export interface QueueSummary {
  service: ServiceType;
  waitingCount: number;
  inProgressCount: number;
  avgWaitMinutes: number;
  lastTicketNumber: string;
}
