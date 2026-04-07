import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TicketService } from '../../services/ticket.service';
import { TicketStatus, TICKET_STATUS_LABELS } from '../../enums/ticket-status.enum';
import { QueueSummary, Ticket } from '../../models/ticket.model';

/**
 * Componente de panel de atención (operador).
 *
 * Permite al operador de una ventanilla:
 * - Ver el resumen de la cola por servicio
 * - Llamar al siguiente ticket
 * - Completar o cancelar el ticket en atención
 */
@Component({
  selector: 'app-ticket-status',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './ticket-status.html',
})
export class TicketStatusComponent {
  private readonly ticketService = inject(TicketService);
  private readonly fb = inject(FormBuilder);

  // ─── Formulario de selección de ventanilla ────────────────────────────────
  readonly windowForm = this.fb.nonNullable.group({
    serviceId: ['', Validators.required],
    windowNumber: [1, [Validators.required, Validators.min(1)]],
  });

  // ─── Estado reactivo ──────────────────────────────────────────────────────
  readonly queueSummaries = this.ticketService.queueSummaries;
  readonly inProgressTickets = this.ticketService.inProgressTickets;
  readonly statusLabels = TICKET_STATUS_LABELS;
  readonly TicketStatus = TicketStatus;

  readonly callNotes = signal('');
  readonly lastCalledTicket = signal<Ticket | null>(null);
  readonly lastCalledNumber = computed(() => this.lastCalledTicket()?.number ?? null);
  readonly errorMessage = signal<string | null>(null);

  // ─── Resumen del servicio seleccionado ────────────────────────────────────
  readonly selectedSummary = computed<QueueSummary | null>(() => {
    const id = this.windowForm.controls.serviceId.value;
    return this.queueSummaries().find(s => s.service.id === id) ?? null;
  });

  // ─── Acciones ─────────────────────────────────────────────────────────────

  callNext(): void {
    const { serviceId, windowNumber } = this.windowForm.getRawValue();
    if (!serviceId) return;

    const ticket = this.ticketService.callNextTicket(serviceId, windowNumber);

    if (ticket) {
      this.lastCalledTicket.set(ticket);
      this.errorMessage.set(null);
    } else {
      this.errorMessage.set('No hay tickets en espera para este servicio.');
      this.lastCalledTicket.set(null);
    }
  }

  complete(ticketId: string): void {
    this.ticketService.completeTicket(ticketId, this.callNotes() || undefined);
    this.callNotes.set('');
  }

  cancel(ticketId: string): void {
    this.ticketService.cancelTicket(ticketId);
  }

  updateNotes(value: string): void {
    this.callNotes.set(value);
  }
}
