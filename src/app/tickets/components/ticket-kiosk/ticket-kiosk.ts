import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { isPlatformBrowser } from '@angular/common';
import { TicketPriority, TICKET_PRIORITY_LABELS } from '../../enums/ticket-priority.enum';
import { TicketSource } from '../../enums/ticket-source.enum';
import { TicketService } from '../../services/ticket.service';
import type { Ticket } from '../../models/ticket.model';
import type { Patient } from '../../models/patient.model';

/** Pasos del flujo del kiosko */
type KioskStep = 'dni' | 'done';

/**
 * RF-02: Interfaz táctil de kiosko físico de autoservicio.
 *
 * Flujo clínico:
 * 1. Paciente ingresa su DNI mediante teclado numérico táctil
 * 2. Sistema busca al paciente en la BD y muestra sus datos
 * 3. Paciente selecciona servicio de Admisión (paso 1) y prioridad
 * 4. Se emite el turno, se muestra el QR y se imprime automáticamente
 */
@Component({
  selector: 'app-ticket-kiosk',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [],
  templateUrl: './ticket-kiosk.html',
})
export class TicketKioskComponent {
  private readonly ticketService = inject(TicketService);
  private readonly platformId = inject(PLATFORM_ID);

  // ─── Datos de referencia ─────────────────────────────────────────────────

  /** Solo servicios de Admisión (paso 1) — punto de entrada del paciente */
  readonly services = computed(() =>
    this.ticketService.services().filter(s => s.step === 1 && s.isActive),
  );

  readonly priorities = Object.values(TicketPriority);
  readonly priorityLabels = TICKET_PRIORITY_LABELS;
  readonly TicketPriority = TicketPriority;

  /** Teclas del teclado numérico táctil */
  readonly keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '⌫', '0', '✓'];

  // ─── Estado del kiosko ───────────────────────────────────────────────────

  readonly kioskStep = signal<KioskStep>('dni');
  readonly dniInput = signal('');
  readonly foundPatient = signal<Patient | null>(null);
  readonly dniError = signal('');
  readonly selectedServiceId = signal('');
  readonly selectedPriority = signal<TicketPriority>(TicketPriority.Normal);
  readonly isSubmitting = signal(false);
  readonly createdTicket = signal<Ticket | null>(null);
  readonly existingTicket = signal<Ticket | null>(null);
  readonly countdown = signal(30);
  private countdownInterval: ReturnType<typeof setInterval> | null = null;

  // ─── Computados ──────────────────────────────────────────────────────────

  /** Dígitos del DNI como array de 8 posiciones para mostrar los cuadros */
  readonly dniBoxes = computed<string[]>(() => {
    const digits = this.dniInput().split('');
    return Array.from({ length: 8 }, (_, i) => digits[i] ?? '');
  });

  readonly qrUrl = computed(() => {
    const t = this.createdTicket();
    return t
      ? `https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(t.number)}&bgcolor=ffffff`
      : null;
  });

  // ─── Acciones del teclado numérico ───────────────────────────────────────

  pressKey(key: string): void {
    if (key === '⌫') {
      this.dniInput.update(v => v.slice(0, -1));
      this.dniError.set('');
      return;
    }
    if (key === '✓') {
      this.searchPatient();
      return;
    }
    if (this.dniInput().length >= 8) return;
    this.dniInput.update(v => v + key);
    this.dniError.set('');
  }

  searchPatient(): void {
    const dni = this.dniInput();
    if (dni.length < 8) {
      this.dniError.set('Ingresa los 8 dígitos de tu DNI');
      return;
    }
    const patient = this.ticketService.findPatientByDni(dni);
    if (!patient) {
      this.dniError.set('DNI no registrado. Por favor, acércate a admisión.');
      return;
    }
    this.foundPatient.set(patient);
    this.dniError.set('');

    // Buscar tickets activos del paciente
    const activeTickets = this.ticketService.findActiveTicketsByDni(dni);

    if (activeTickets.length > 0) {
      // Ya tiene cita activa → mostrar ticket existente y dar pase a Pre-consulta
      this.existingTicket.set(activeTickets[0]);
      const triajeService = this.ticketService.services().find(s => s.id === 'svc-triaje');
      if (triajeService) {
        const ticket = this.ticketService.createTicket({
          service: triajeService,
          priority: activeTickets[0].priority,
          source: TicketSource.Kiosko,
          virtualQueue: false,
          patientDni: patient.dni,
          patientName: patient.name,
        });
        this.ticketService.printTicket(ticket.id);
        this.createdTicket.set(ticket);
      }
    } else {
      // Sin cita activa → reserva automática para Admisión
      this.existingTicket.set(null);
      const admisionService = this.services()[0];
      if (admisionService) {
        const ticket = this.ticketService.createTicket({
          service: admisionService,
          priority: TicketPriority.Normal,
          source: TicketSource.Kiosko,
          virtualQueue: false,
          patientDni: patient.dni,
          patientName: patient.name,
        });
        this.ticketService.printTicket(ticket.id);
        this.createdTicket.set(ticket);
      }
    }

    this.kioskStep.set('done');
    this.startCountdown();
  }

  // ─── Selección de servicio y prioridad ───────────────────────────────────

  selectService(id: string): void {
    this.selectedServiceId.set(id);
  }

  selectPriority(p: TicketPriority): void {
    this.selectedPriority.set(p);
  }

  // ─── Emisión del turno ───────────────────────────────────────────────────

  submit(): void {
    const serviceId = this.selectedServiceId();
    const service = this.services().find(s => s.id === serviceId);
    if (!service || this.isSubmitting()) return;

    this.isSubmitting.set(true);
    const patient = this.foundPatient();

    const ticket = this.ticketService.createTicket({
      service,
      priority: this.selectedPriority(),
      source: TicketSource.Kiosko,
      virtualQueue: false,
      patientDni: patient?.dni,
      patientName: patient?.name,
    });

    this.ticketService.printTicket(ticket.id);
    this.createdTicket.set(ticket);
    this.isSubmitting.set(false);
    this.kioskStep.set('done');
    this.startCountdown();

    // RF-14: Dispara impresión automática del comprobante
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => window.print(), 400);
    }
  }

  // ─── Navegación entre pasos ──────────────────────────────────────────────

  backToDni(): void {
    this.kioskStep.set('dni');
    this.dniInput.set('');
    this.foundPatient.set(null);
    this.dniError.set('');
    this.selectedServiceId.set('');
    this.selectedPriority.set(TicketPriority.Normal);
  }

  reset(): void {
    this.clearCountdown();
    this.backToDni();
    this.isSubmitting.set(false);
    this.createdTicket.set(null);
    this.existingTicket.set(null);
  }

  // ─── Temporizador de retorno automático ──────────────────────────────────

  private startCountdown(): void {
    this.clearCountdown();
    this.countdown.set(30);
    if (!isPlatformBrowser(this.platformId)) return;
    this.countdownInterval = setInterval(() => {
      const current = this.countdown();
      if (current <= 1) {
        this.reset();
      } else {
        this.countdown.update(v => v - 1);
      }
    }, 1000);
  }

  private clearCountdown(): void {
    if (this.countdownInterval !== null) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }
}
