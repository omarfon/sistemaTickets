import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TicketService } from '../../services/ticket.service';
import { TicketStatus } from '../../enums/ticket-status.enum';
import type { Ticket } from '../../models/ticket.model';

/**
 * RF-20: Check-in de ticket virtual.
 * El cliente confirma su llegada física buscando su número de turno.
 * Solo entonces el ticket entra a la cola activa de llamado.
 */
@Component({
  selector: 'app-ticket-checkin',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './ticket-checkin.html',
})
export class TicketCheckinComponent {
  private readonly ticketService = inject(TicketService);
  private readonly fb = inject(FormBuilder);

  readonly form = this.fb.nonNullable.group({
    ticketNumber: ['', [Validators.required, Validators.minLength(2)]],
  });

  readonly foundTicket = signal<Ticket | null>(null);
  readonly checkedInTicket = signal<Ticket | null>(null);
  readonly errorMsg = signal<string | null>(null);
  readonly TicketStatus = TicketStatus;

  search(): void {
    const number = this.form.getRawValue().ticketNumber.trim().toUpperCase();
    const ticket = this.ticketService.findByNumber(number);

    if (!ticket) {
      this.errorMsg.set(`No se encontró el ticket "${number}". Verifica el número.`);
      this.foundTicket.set(null);
      return;
    }
    if (ticket.status !== TicketStatus.EnEspera) {
      this.errorMsg.set('Este ticket ya fue atendido o cancelado.');
      this.foundTicket.set(null);
      return;
    }

    this.errorMsg.set(null);
    this.foundTicket.set(ticket);
  }

  confirmCheckIn(): void {
    const ticket = this.foundTicket();
    if (!ticket) return;
    const updated = this.ticketService.checkInTicket(ticket.id);
    if (updated?.checkedIn) {
      this.checkedInTicket.set(updated);
      this.foundTicket.set(null);
    }
  }

  reset(): void {
    this.form.reset({ ticketNumber: '' });
    this.foundTicket.set(null);
    this.checkedInTicket.set(null);
    this.errorMsg.set(null);
  }
}
