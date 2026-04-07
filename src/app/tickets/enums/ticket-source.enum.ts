/**
 * Canal de origen por el cual se generó el ticket.
 * Permite identificar y analizar el volumen por canal.
 */
export enum TicketSource {
  /** Generado por un operador en mostrador */
  Manual = 'MANUAL',

  /** Generado en un kiosko de autoservicio */
  Kiosko = 'KIOSKO',

  /** Generado desde el portal web */
  Web = 'WEB',

  /** Generado desde la aplicación móvil */
  App = 'APP',
}

/** Etiquetas legibles para mostrar en la UI */
export const TICKET_SOURCE_LABELS: Record<TicketSource, string> = {
  [TicketSource.Manual]: 'Ventanilla',
  [TicketSource.Kiosko]: 'Kiosko',
  [TicketSource.Web]: 'Web',
  [TicketSource.App]: 'App móvil',
};

/** Íconos (Material Symbols) asociados a cada canal */
export const TICKET_SOURCE_ICON: Record<TicketSource, string> = {
  [TicketSource.Manual]: 'point_of_sale',
  [TicketSource.Kiosko]: 'kiosk',
  [TicketSource.Web]: 'public',
  [TicketSource.App]: 'smartphone',
};
