import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  output,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { TicketPriority, TICKET_PRIORITY_LABELS } from '../../enums/ticket-priority.enum';
import { TicketSource, TICKET_SOURCE_LABELS, TICKET_SOURCE_ICON } from '../../enums/ticket-source.enum';
import { TicketService } from '../../services/ticket.service';
import { Ticket } from '../../models/ticket.model';

/**
 * Componente de generación de tickets.
 *
 * Permite al operador (o al sistema) crear un nuevo ticket seleccionando:
 * - Servicio (caja, soporte, admisión…)
 * - Canal de origen (manual, kiosko, web, app)
 * - Prioridad (normal, preferencial, VIP)
 *
 * Emite el ticket creado a través del output `ticketCreated`.
 */
@Component({
  selector: 'app-ticket-generator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule],
  templateUrl: './ticket-generator.html',
})
export class TicketGeneratorComponent {
  private readonly ticketService = inject(TicketService);
  private readonly fb = inject(FormBuilder);
  private readonly platformId = inject(PLATFORM_ID);

  // ─── Outputs ────────────────────────────────────────────────────────────
  readonly ticketCreated = output<Ticket>();

  // ─── Datos para la UI ────────────────────────────────────────────────────
  readonly services = this.ticketService.services;

  /** Servicios agrupados por paso clínico (para <optgroup> en el formulario) */
  readonly servicesByStep = computed(() => {
    const all = this.services().filter(s => s.isActive);
    return [
      { step: 1, label: '🏥 Admisión', services: all.filter(s => s.step === 1) },
      { step: 2, label: '🩺 Pre-consulta / Triaje', services: all.filter(s => s.step === 2) },
      { step: 3, label: '👨‍⚕️ Especialistas', services: all.filter(s => s.step === 3) },
    ].filter(g => g.services.length > 0);
  });

  readonly priorities = Object.values(TicketPriority);
  readonly sources = Object.values(TicketSource);
  readonly priorityLabels = TICKET_PRIORITY_LABELS;
  readonly sourceLabels = TICKET_SOURCE_LABELS;
  readonly sourceIcons = TICKET_SOURCE_ICON;

  // ─── Estado interno ──────────────────────────────────────────────────────
  readonly isSubmitting = signal(false);
  readonly lastCreatedTicket = signal<Ticket | null>(null);
  readonly duplicateWarning = signal(false);

  // ─── Formulario reactivo ─────────────────────────────────────────────────
  readonly form = this.fb.nonNullable.group({
    serviceId: ['', Validators.required],
    priority: [TicketPriority.Normal, Validators.required],
    source: [TicketSource.Manual, Validators.required],
    notes: [''],
  });

  /** Servicio seleccionado actualmente */
  readonly selectedService = computed(() => {
    const id = this.form.controls.serviceId.value;
    return this.services().find(s => s.id === id) ?? null;
  });

  /** RF-15: URL del QR para el ticket generado */
  readonly qrUrl = computed(() => {
    const t = this.lastCreatedTicket();
    return t
      ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(t.number)}&bgcolor=ffffff`
      : null;
  });

  // ─── Acciones ────────────────────────────────────────────────────────────

  /** RF-16: Verificar duplicidad al cambiar servicio o canal */
  checkDuplicate(): void {
    const { serviceId, source } = this.form.getRawValue();
    if (!serviceId) { this.duplicateWarning.set(false); return; }
    this.duplicateWarning.set(
      this.ticketService.isDuplicate(serviceId, source as TicketSource)
    );
  }

  submit(): void {
    if (this.form.invalid || this.isSubmitting()) return;

    const { serviceId, priority, source, notes } = this.form.getRawValue();
    const service = this.services().find(s => s.id === serviceId);
    if (!service) return;

    this.isSubmitting.set(true);

    const ticket = this.ticketService.createTicket({
      service,
      priority,
      source,
      notes: notes || undefined,
    });

    this.lastCreatedTicket.set(ticket);
    this.ticketCreated.emit(ticket);
    this.duplicateWarning.set(false);
    this.form.controls.notes.reset('');
    this.isSubmitting.set(false);
  }

  /** RF-14: Registra la impresión y dispara el diálogo del navegador */
  printTicket(): void {
    const ticket = this.lastCreatedTicket();
    if (!ticket) return;
    this.ticketService.printTicket(ticket.id);
    if (isPlatformBrowser(this.platformId)) {
      window.print();
    }
  }

  resetForm(): void {
    this.form.reset({
      serviceId: '',
      priority: TicketPriority.Normal,
      source: TicketSource.Manual,
      notes: '',
    });
    this.lastCreatedTicket.set(null);
    this.duplicateWarning.set(false);
  }
}
