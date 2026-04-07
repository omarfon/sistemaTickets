import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TicketPriority, TICKET_PRIORITY_LABELS } from '../../enums/ticket-priority.enum';
import { TicketSource } from '../../enums/ticket-source.enum';
import { TicketService } from '../../services/ticket.service';
import type { Ticket } from '../../models/ticket.model';

/**
 * RF-03 / RF-19: Cola virtual desde el portal web.
 * Genera tickets con virtualQueue=true: el turno no entra a la cola activa
 * hasta que el cliente confirme su llegada mediante check-in (RF-20).
 */
@Component({
  selector: 'app-ticket-web',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './ticket-web.html',
})
export class TicketWebComponent {
  private readonly ticketService = inject(TicketService);
  private readonly fb = inject(FormBuilder);

  /** Solo servicios de Admisión (paso 1) — la cola virtual es el acceso digital del paciente */
  readonly services = computed(() =>
    this.ticketService.services().filter(s => s.step === 1 && s.isActive),
  );
  readonly priorities = Object.values(TicketPriority);
  readonly priorityLabels = TICKET_PRIORITY_LABELS;
  readonly isSubmitting = signal(false);
  readonly createdTicket = signal<Ticket | null>(null);
  readonly duplicateWarning = signal(false);

  readonly form = this.fb.nonNullable.group({
    serviceId: ['', Validators.required],
    priority: [TicketPriority.Normal, Validators.required],
    notes: [''],
  });

  readonly qrUrl = computed(() => {
    const t = this.createdTicket();
    return t
      ? `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(t.number)}&bgcolor=ffffff`
      : null;
  });

  /** RF-16: Verifica duplicidad al cambiar el servicio */
  checkDuplicate(): void {
    const { serviceId } = this.form.getRawValue();
    if (!serviceId) { this.duplicateWarning.set(false); return; }
    this.duplicateWarning.set(this.ticketService.isDuplicate(serviceId, TicketSource.Web));
  }

  submit(): void {
    if (this.form.invalid || this.isSubmitting()) return;
    const { serviceId, priority, notes } = this.form.getRawValue();
    const service = this.services().find(s => s.id === serviceId);
    if (!service) return;

    this.isSubmitting.set(true);
    const ticket = this.ticketService.createTicket({
      service,
      priority,
      source: TicketSource.Web,
      notes: notes || undefined,
      virtualQueue: true,
    });
    this.createdTicket.set(ticket);
    this.duplicateWarning.set(false);
    this.isSubmitting.set(false);
  }

  reset(): void {
    this.form.reset({ serviceId: '', priority: TicketPriority.Normal, notes: '' });
    this.createdTicket.set(null);
    this.duplicateWarning.set(false);
  }
}
