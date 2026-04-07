/**
 * Eventos que registran el ciclo de vida de un ticket.
 * RF-11: Historial completo de actividad por ticket.
 */
export enum TicketEvent {
  /** Ticket generado en el sistema */
  Creado = 'CREATED',
  /** Ticket llamado a ventanilla */
  Llamado = 'CALLED',
  /** Atención completada satisfactoriamente */
  Atendido = 'COMPLETED',
  /** Ticket anulado */
  Cancelado = 'CANCELLED',
  /** Ticket movido a otro servicio (RF-18) */
  Transferido = 'TRANSFERRED',
  /** Prioridad modificada (RF-10) */
  Reprogramado = 'RESCHEDULED',
  /** Cliente confirmó llegada física (RF-20) */
  CheckIn = 'CHECKIN',
  /** Ticket impreso (RF-14) */
  Impreso = 'PRINTED',
}

export const TICKET_EVENT_LABELS: Record<TicketEvent, string> = {
  [TicketEvent.Creado]: 'Ticket creado',
  [TicketEvent.Llamado]: 'Llamado a ventanilla',
  [TicketEvent.Atendido]: 'Atendido',
  [TicketEvent.Cancelado]: 'Cancelado',
  [TicketEvent.Transferido]: 'Transferido',
  [TicketEvent.Reprogramado]: 'Reprogramado',
  [TicketEvent.CheckIn]: 'Check-in confirmado',
  [TicketEvent.Impreso]: 'Impreso',
};

export const TICKET_EVENT_ICON: Record<TicketEvent, string> = {
  [TicketEvent.Creado]: '🎫',
  [TicketEvent.Llamado]: '📢',
  [TicketEvent.Atendido]: '✅',
  [TicketEvent.Cancelado]: '❌',
  [TicketEvent.Transferido]: '🔄',
  [TicketEvent.Reprogramado]: '📅',
  [TicketEvent.CheckIn]: '📍',
  [TicketEvent.Impreso]: '🖨️',
};

export const TICKET_EVENT_COLOR: Record<TicketEvent, string> = {
  [TicketEvent.Creado]: 'bg-blue-100 text-blue-800',
  [TicketEvent.Llamado]: 'bg-amber-100 text-amber-800',
  [TicketEvent.Atendido]: 'bg-emerald-100 text-emerald-800',
  [TicketEvent.Cancelado]: 'bg-red-100 text-red-800',
  [TicketEvent.Transferido]: 'bg-purple-100 text-purple-800',
  [TicketEvent.Reprogramado]: 'bg-orange-100 text-orange-800',
  [TicketEvent.CheckIn]: 'bg-teal-100 text-teal-800',
  [TicketEvent.Impreso]: 'bg-gray-100 text-gray-800',
};
