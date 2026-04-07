/**
 * Módulo de Gestión de Tickets — Barrel principal
 *
 * Exporta todos los elementos públicos del módulo:
 * enums, modelos, servicio y rutas.
 */

// Enums
export * from './enums';

// Modelos
export type { ServiceType, Ticket, CreateTicketDto, QueueSummary } from './models';

// Servicio
export { TicketService } from './services/ticket.service';

// Rutas
export { TICKETS_ROUTES } from './tickets.routes';
