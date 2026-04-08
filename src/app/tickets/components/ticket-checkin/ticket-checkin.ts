import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TicketService } from '../../services/ticket.service';
import { TicketStatus } from '../../enums/ticket-status.enum';
import type { Ticket } from '../../models/ticket.model';
import type { Patient } from '../../models/patient.model';

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
  readonly foundTickets = signal<Ticket[]>([]);
  readonly foundPatient = signal<Patient | null>(null);
  readonly checkedInTicket = signal<Ticket | null>(null);
  readonly errorMsg = signal<string | null>(null);
  readonly TicketStatus = TicketStatus;
  readonly searchedByDni = signal(false);

  search(): void {
    const input = this.form.getRawValue().ticketNumber.trim();
    const isDni = /^\d{8}$/.test(input);

    if (isDni) {
      // Búsqueda por DNI
      const patient = this.ticketService.findPatientByDni(input);
      if (!patient) {
        this.errorMsg.set('DNI no registrado en el sistema.');
        this.foundTicket.set(null);
        this.foundTickets.set([]);
        this.foundPatient.set(null);
        this.searchedByDni.set(false);
        return;
      }

      const activeTickets = this.ticketService.findActiveTicketsByDni(input)
        .filter(t => t.status === TicketStatus.EnEspera);

      if (activeTickets.length === 0) {
        this.errorMsg.set(`No se encontraron turnos activos para ${patient.name}.`);
        this.foundTicket.set(null);
        this.foundTickets.set([]);
        this.foundPatient.set(null);
        this.searchedByDni.set(false);
        return;
      }

      this.errorMsg.set(null);
      this.foundPatient.set(patient);
      this.foundTickets.set(activeTickets);
      this.foundTicket.set(null);
      this.searchedByDni.set(true);
    } else {
      // Búsqueda por número de turno
      this.searchedByDni.set(false);
      this.foundTickets.set([]);
      this.foundPatient.set(null);
      const number = input.toUpperCase();
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
  }

  confirmCheckIn(ticketOrNull?: Ticket): void {
    const ticket = ticketOrNull ?? this.foundTicket();
    if (!ticket) return;
    const updated = this.ticketService.checkInTicket(ticket.id);
    if (updated?.checkedIn) {
      this.checkedInTicket.set(updated);
      this.foundTicket.set(null);
      this.foundTickets.set([]);
    }
  }

  reset(): void {
    this.form.reset({ ticketNumber: '' });
    this.foundTicket.set(null);
    this.foundTickets.set([]);
    this.foundPatient.set(null);
    this.checkedInTicket.set(null);
    this.errorMsg.set(null);
    this.searchedByDni.set(false);
  }
}
