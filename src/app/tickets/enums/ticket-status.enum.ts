/**
 * Estados del ciclo de vida de un ticket dentro del sistema de colas.
 * Flujo principal: EnEspera → EnAtencion → Atendido
 * Flujo alternativo: cualquier estado → Cancelado
 */
export enum TicketStatus {
  /** Ticket generado, esperando ser llamado */
  EnEspera = 'EN_ESPERA',

  /** Ticket llamado, el cliente está siendo atendido */
  EnAtencion = 'EN_ATENCION',

  /** Atención completada satisfactoriamente */
  Atendido = 'ATENDIDO',

  /** Ticket anulado antes de ser atendido */
  Cancelado = 'CANCELADO',
}

/** Etiquetas legibles para mostrar en la UI */
export const TICKET_STATUS_LABELS: Record<TicketStatus, string> = {
  [TicketStatus.EnEspera]: 'En espera',
  [TicketStatus.EnAtencion]: 'En atención',
  [TicketStatus.Atendido]: 'Atendido',
  [TicketStatus.Cancelado]: 'Cancelado',
};

/** Clases CSS asociadas a cada estado para estilos visuales */
export const TICKET_STATUS_CSS: Record<TicketStatus, string> = {
  [TicketStatus.EnEspera]: 'status--waiting',
  [TicketStatus.EnAtencion]: 'status--in-progress',
  [TicketStatus.Atendido]: 'status--done',
  [TicketStatus.Cancelado]: 'status--cancelled',
};

/** Transiciones válidas desde cada estado */
export const TICKET_STATUS_TRANSITIONS: Record<TicketStatus, TicketStatus[]> = {
  [TicketStatus.EnEspera]: [TicketStatus.EnAtencion, TicketStatus.Cancelado],
  [TicketStatus.EnAtencion]: [TicketStatus.Atendido, TicketStatus.Cancelado],
  [TicketStatus.Atendido]: [],
  [TicketStatus.Cancelado]: [],
};
