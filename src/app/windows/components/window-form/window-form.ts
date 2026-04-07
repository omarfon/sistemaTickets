import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { TicketService } from '../../../tickets/services/ticket.service';
import { TicketPriority, TICKET_PRIORITY_LABELS } from '../../../tickets/enums/ticket-priority.enum';
import { WindowService } from '../../services/window.service';
import type { CreateWindowDto, UpdateWindowDto, WindowScheduleSlot } from '../../models/window.model';

const DAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/**
 * RF-21 / RF-22 / RF-26 / RF-30 / RF-32
 * Formulario para crear o editar una ventanilla / módulo de atención.
 * Modo create: ruta  /ventanillas/nueva
 * Modo edit:   ruta  /ventanillas/:id/editar
 */
@Component({
  selector: 'app-window-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule, RouterLink],
  templateUrl: './window-form.html',
})
export class WindowFormComponent implements OnInit {
  private readonly windowService  = inject(WindowService);
  private readonly ticketService  = inject(TicketService);
  private readonly route          = inject(ActivatedRoute);
  private readonly router         = inject(Router);

  // ─── Modo del formulario ─────────────────────────────────────────────────

  readonly editId  = signal<string | null>(null);
  readonly isEdit  = computed(() => this.editId() !== null);
  readonly saving  = signal(false);
  readonly error   = signal<string | null>(null);

  // ─── Servicios disponibles (para checkboxes RF-22) ───────────────────────

  readonly allServices = this.ticketService.services;

  // ─── Prioridades disponibles (RF-26) ────────────────────────────────────

  readonly allPriorities: { value: TicketPriority; label: string }[] = (
    Object.values(TicketPriority) as TicketPriority[]
  ).map(p => ({ value: p, label: TICKET_PRIORITY_LABELS[p] }));

  // ─── Campos del formulario ───────────────────────────────────────────────

  name             = '';
  number           = 1;
  step: 1 | 2 | 3 = 1;
  operatorName     = '';

  // RF-22: servicios asignados
  selectedServiceIds = signal<Set<string>>(new Set());

  // RF-26: filtro de prioridades
  selectedPriorities = signal<Set<TicketPriority>>(new Set());

  // RF-30: capacidad y umbrales
  maxQueueSize     = 10;
  warnThreshold    = 7;
  criticalThreshold = 9;

  // RF-32: horarios
  scheduleSlots    = signal<WindowScheduleSlot[]>([]);

  // Campos temporales para agregar franja
  newSlotDay: 0|1|2|3|4|5|6 = 1;
  newSlotStart = '07:00';
  newSlotEnd   = '15:00';

  // ─── Constantes de plantilla ─────────────────────────────────────────────

  readonly dayNames = DAY_NAMES;
  readonly stepOptions = [
    { value: 1 as const, label: '🏥 Paso 1 — Admisión' },
    { value: 2 as const, label: '🩺 Paso 2 — Pre-consulta' },
    { value: 3 as const, label: '👨‍⚕️ Paso 3 — Especialista' },
  ];

  // ─── Init ────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) return;

    const win = this.windowService.windows().find(w => w.id === id);
    if (!win) return;

    this.editId.set(id);
    this.name              = win.name;
    this.number            = win.number;
    this.step              = win.step;
    this.operatorName      = win.operatorName ?? '';
    this.maxQueueSize      = win.maxQueueSize;
    this.warnThreshold     = win.warnThreshold;
    this.criticalThreshold = win.criticalThreshold;
    this.selectedServiceIds.set(new Set(win.assignedServiceIds));
    this.selectedPriorities.set(new Set(win.priorityFilter));
    this.scheduleSlots.set([...win.schedule]);
  }

  // ─── RF-22: Toggle de servicio ───────────────────────────────────────────

  toggleService(id: string): void {
    this.selectedServiceIds.update(s => {
      const next = new Set(s);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  isServiceSelected(id: string): boolean {
    return this.selectedServiceIds().has(id);
  }

  // ─── RF-26: Toggle de prioridad ──────────────────────────────────────────

  togglePriority(p: TicketPriority): void {
    this.selectedPriorities.update(s => {
      const next = new Set(s);
      next.has(p) ? next.delete(p) : next.add(p);
      return next;
    });
  }

  isPrioritySelected(p: TicketPriority): boolean {
    return this.selectedPriorities().has(p);
  }

  // ─── RF-32: Gestión de franjas horarias ──────────────────────────────────

  addSlot(): void {
    if (this.newSlotStart >= this.newSlotEnd) {
      this.error.set('La hora de inicio debe ser anterior a la hora de fin.');
      return;
    }
    this.error.set(null);
    this.scheduleSlots.update(slots => [
      ...slots,
      { day: this.newSlotDay, startTime: this.newSlotStart, endTime: this.newSlotEnd },
    ]);
  }

  removeSlot(index: number): void {
    this.scheduleSlots.update(slots => slots.filter((_, i) => i !== index));
  }

  // ─── Guardado ────────────────────────────────────────────────────────────

  save(): void {
    this.error.set(null);

    if (!this.name.trim()) {
      this.error.set('El nombre del módulo es obligatorio.');
      return;
    }

    this.saving.set(true);

    const dto: CreateWindowDto = {
      name:              this.name.trim(),
      number:            this.number,
      step:              this.step,
      operatorName:      this.operatorName.trim() || undefined,
      assignedServiceIds: [...this.selectedServiceIds()],
      priorityFilter:    [...this.selectedPriorities()],
      maxQueueSize:      this.maxQueueSize,
      warnThreshold:     this.warnThreshold,
      criticalThreshold: this.criticalThreshold,
      schedule:          this.scheduleSlots(),
    };

    try {
      if (this.isEdit()) {
        this.windowService.updateWindow(this.editId()!, dto as UpdateWindowDto);
      } else {
        this.windowService.createWindow(dto);
      }
      this.router.navigate(['/ventanillas/dashboard']);
    } catch {
      this.error.set('Ocurrió un error al guardar. Inténtalo de nuevo.');
      this.saving.set(false);
    }
  }
}
