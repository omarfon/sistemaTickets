import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QueueEngineService } from '../../services/queue-engine.service';
import { TicketPriority, TICKET_PRIORITY_LABELS } from '../../../tickets/enums/ticket-priority.enum';

/**
 * RF-72: Cola virtual — registro remoto de turnos y check-in presencial.
 */
@Component({
  selector: 'app-engine-virtual-queue',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './engine-virtual-queue.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EngineVirtualQueueComponent {
  protected readonly engine = inject(QueueEngineService);

  protected readonly priorityLabels = TICKET_PRIORITY_LABELS;
  protected readonly TicketPriority = TicketPriority;

  protected readonly virtualTickets = this.engine.virtualTickets;
  protected readonly checkedInCount  = computed(() => this.virtualTickets().filter(v => v.checkedIn).length);
  protected readonly pendingCount    = computed(() => this.virtualTickets().filter(v => !v.checkedIn).length);

  // ─── Formulario de registro ───────────────────────────────────────────────
  protected readonly showForm  = signal(false);
  protected newPatientName     = signal('');
  protected newDocumentId      = signal('');
  protected newPhone           = signal('');
  protected newServiceId       = signal('svc-admision-citas');
  protected newServiceName     = signal('Citas y Reservas');
  protected newPriority        = signal<TicketPriority>(TicketPriority.Normal);
  protected formError          = signal('');

  protected readonly services = [
    { id: 'svc-admision-caja',  name: 'Caja / Pagos',        icon: '💳' },
    { id: 'svc-admision-citas', name: 'Citas y Reservas',     icon: '📅' },
    { id: 'svc-triaje',         name: 'Pre-consulta (Triaje)',icon: '🩺' },
    { id: 'svc-medicina',       name: 'Medicina General',     icon: '👨‍⚕️' },
    { id: 'svc-pediatria',      name: 'Pediatría',            icon: '🧒' },
    { id: 'svc-especialidades', name: 'Especialidades',       icon: '🏥' },
  ];

  protected priorities(): TicketPriority[] {
    return Object.values(TicketPriority);
  }

  protected selectService(id: string, name: string): void {
    this.newServiceId.set(id);
    this.newServiceName.set(name);
  }

  protected openForm(): void {
    this.newPatientName.set('');
    this.newDocumentId.set('');
    this.newPhone.set('');
    this.newServiceId.set('svc-admision-citas');
    this.newServiceName.set('Citas y Reservas');
    this.newPriority.set(TicketPriority.Normal);
    this.formError.set('');
    this.showForm.set(true);
  }

  protected submitRegistration(): void {
    const name = this.newPatientName().trim();
    const doc  = this.newDocumentId().trim();
    const phone = this.newPhone().trim();
    if (!name)  { this.formError.set('El nombre es obligatorio'); return; }
    if (!doc)   { this.formError.set('El documento es obligatorio'); return; }
    if (!phone) { this.formError.set('El teléfono es obligatorio'); return; }
    this.engine.registerVirtualTicket(
      name, doc, phone,
      this.newServiceId(), this.newServiceName(),
      this.newPriority()
    );
    this.showForm.set(false);
  }

  protected checkIn(id: string): void {
    this.engine.checkInVirtualTicket(id);
  }

  protected remove(id: string): void {
    if (confirm('¿Eliminar este turno virtual?')) this.engine.removeVirtualTicket(id);
  }

  protected formatDate(d: Date): string {
    return d.toLocaleTimeString('es-PE', { hour: '2-digit', minute: '2-digit' });
  }

  protected formatMinutes(min: number): string {
    if (min < 1) return '< 1 min';
    if (min < 60) return `${Math.round(min)} min`;
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return `${h}h ${m}min`;
  }
}
