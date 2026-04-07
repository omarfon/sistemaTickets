import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { TicketCardComponent } from '../ticket-card/ticket-card';
import { TicketService } from '../../services/ticket.service';
import { TicketStatus, TICKET_STATUS_LABELS } from '../../enums/ticket-status.enum';
import { TicketPriority, TICKET_PRIORITY_LABELS } from '../../enums/ticket-priority.enum';
import { Ticket } from '../../models/ticket.model';

type FilterStatus = TicketStatus | 'TODOS';
type ActionPanel = { type: 'transfer' | 'reschedule'; ticketId: string; ticketNumber: string };

/**
 * Componente lista de tickets.
 * RF-10/RF-18: Gestiona paneles de reprogramación y transferencia inline.
 */
@Component({
  selector: 'app-ticket-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TicketCardComponent],
  templateUrl: './ticket-list.html',
})
export class TicketListComponent {
  private readonly ticketService = inject(TicketService);

  // ─── Datos para UI ────────────────────────────────────────────────────────
  readonly services = this.ticketService.services;
  readonly priorities = Object.values(TicketPriority);
  readonly priorityLabels = TICKET_PRIORITY_LABELS;
  readonly TicketPriority = TicketPriority;

  // ─── Filtro activo ────────────────────────────────────────────────────────
  readonly activeFilter = signal<FilterStatus>('TODOS');

  // ─── Panel de acción (transfer / reschedule) ──────────────────────────────
  readonly activeAction = signal<ActionPanel | null>(null);

  // ─── Opciones de filtro ───────────────────────────────────────────────────
  readonly filters: { value: FilterStatus; label: string }[] = [
    { value: 'TODOS', label: 'Todos' },
    { value: TicketStatus.EnEspera, label: TICKET_STATUS_LABELS[TicketStatus.EnEspera] },
    { value: TicketStatus.EnAtencion, label: TICKET_STATUS_LABELS[TicketStatus.EnAtencion] },
    { value: TicketStatus.Atendido, label: TICKET_STATUS_LABELS[TicketStatus.Atendido] },
    { value: TicketStatus.Cancelado, label: TICKET_STATUS_LABELS[TicketStatus.Cancelado] },
  ];

  // ─── Tickets filtrados ────────────────────────────────────────────────────
  readonly filteredTickets = computed<Ticket[]>(() => {
    const filter = this.activeFilter();
    const all = this.ticketService.tickets();
    return filter === 'TODOS' ? all : all.filter(t => t.status === filter);
  });

  readonly isEmpty = computed(() => this.filteredTickets().length === 0);

  // ─── Estadísticas rápidas ─────────────────────────────────────────────────
  readonly totalWaiting = this.ticketService.totalWaiting;
  readonly inProgress = computed(() => this.ticketService.inProgressTickets().length);
  readonly totalVirtual = this.ticketService.totalVirtual;

  // ─── Acciones básicas ─────────────────────────────────────────────────────

  setFilter(filter: FilterStatus): void {
    this.activeFilter.set(filter);
  }

  onComplete(ticketId: string): void {
    this.ticketService.completeTicket(ticketId);
  }

  onCancel(ticketId: string): void {
    this.ticketService.cancelTicket(ticketId);
  }

  // ─── RF-18: Transferencia ─────────────────────────────────────────────────

  onTransfer(ticketId: string): void {
    const ticket = this.ticketService.getById(ticketId);
    if (!ticket) return;
    this.activeAction.set({ type: 'transfer', ticketId, ticketNumber: ticket.number });
  }

  confirmTransfer(newServiceId: string): void {
    const action = this.activeAction();
    if (!action || action.type !== 'transfer') return;
    this.ticketService.transferTicket(action.ticketId, newServiceId);
    this.activeAction.set(null);
  }

  // ─── RF-10: Reprogramación ────────────────────────────────────────────────

  onReschedule(ticketId: string): void {
    const ticket = this.ticketService.getById(ticketId);
    if (!ticket) return;
    this.activeAction.set({ type: 'reschedule', ticketId, ticketNumber: ticket.number });
  }

  confirmReschedule(priority: TicketPriority): void {
    const action = this.activeAction();
    if (!action || action.type !== 'reschedule') return;
    this.ticketService.rescheduleTicket(action.ticketId, priority);
    this.activeAction.set(null);
  }

  cancelAction(): void {
    this.activeAction.set(null);
  }
}
