/**
 * Niveles de prioridad para la atención de pacientes.
 * Define el orden de atención: Urgente > Vulnerable > General.
 */
export enum TicketPriority {
  /** Paciente estándar sin condición especial */
  Normal = 'NORMAL',

  /** Adultos mayores (≥65 años), gestantes, personas con discapacidad */
  Preferencial = 'PREFERENCIAL',

  /** Paciente con condición que requiere atención prioritaria inmediata */
  VIP = 'VIP',
}

/** Etiquetas legibles para mostrar en la UI */
export const TICKET_PRIORITY_LABELS: Record<TicketPriority, string> = {
  [TicketPriority.Normal]: 'General',
  [TicketPriority.Preferencial]: 'Vulnerable',
  [TicketPriority.VIP]: 'Urgente',
};

/** Orden numérico para comparaciones (mayor = más prioritario) */
export const TICKET_PRIORITY_WEIGHT: Record<TicketPriority, number> = {
  [TicketPriority.Normal]: 1,
  [TicketPriority.Preferencial]: 2,
  [TicketPriority.VIP]: 3,
};
