import {
  ChangeDetectionStrategy,
  Component,
  computed,
  EventEmitter,
  inject,
  Input,
  OnInit,
  Output,
  signal,
} from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { OperatorService } from '../../services/operator.service';
import { WindowService }   from '../../../windows/services/window.service';
import {
  OperatorRole,
  OPERATOR_ROLE_LABELS,
  OPERATOR_ROLE_ICON,
} from '../../enums/operator-role.enum';
import type { OperatorShiftSlot } from '../../models/operator.model';

/**
 * RF-36 — Registro/edición de operador.
 * RF-38 — Asignación a ventanilla.
 * RF-39 — Roles de usuario.
 * RF-49 — Configuración de turnos.
 */
@Component({
  selector: 'app-operator-form',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule],
  templateUrl: './operator-form.html',
})
export class OperatorFormComponent implements OnInit {
  private readonly operatorService = inject(OperatorService);
  private readonly windowService   = inject(WindowService);
  private readonly route           = inject(ActivatedRoute);
  private readonly router          = inject(Router);

  // ─── Modo panel (drawer embebido) ────────────────────────────────────────

  /** Cuando se usa como panel deslizante: null=nuevo, 'id'=editar */
  @Input() set panelEditId(id: string | null | undefined) {
    if (id === undefined) return;
    this.panelMode = true;
    // Reset
    this.name             = '';
    this.email            = '';
    this.password         = '';
    this.role             = OperatorRole.Operador;
    this.assignedWindowId = '';
    this.scheduleSlots.set([]);
    this.error.set(null);
    this.isEdit.set(false);
    this.operatorId.set(null);
    if (id) {
      const op = this.operatorService.getById(id);
      if (op) {
        this.isEdit.set(true);
        this.operatorId.set(id);
        this.name             = op.name;
        this.email            = op.email;
        this.password         = op.password;
        this.role             = op.role;
        this.assignedWindowId = op.assignedWindowId ?? '';
        this.scheduleSlots.set([...op.shifts]);
      }
    }
  }

  panelMode = false;

  @Output() readonly closePanel = new EventEmitter<void>();

  // ─── Modo del formulario ─────────────────────────────────────────────────

  readonly isEdit    = signal(false);
  readonly operatorId = signal<string | null>(null);

  // ─── Campos del formulario ───────────────────────────────────────────────

  name             = '';
  email            = '';
  password         = '';
  role: OperatorRole = OperatorRole.Operador;
  assignedWindowId = '';

  // ─── RF-49: Turnos ───────────────────────────────────────────────────────

  readonly scheduleSlots = signal<OperatorShiftSlot[]>([]);
  newSlotDay   = 1;
  newSlotStart = '08:00';
  newSlotEnd   = '16:00';

  // ─── Estado ─────────────────────────────────────────────────────────────

  readonly saving = signal(false);
  readonly error  = signal<string | null>(null);

  // ─── Datos para selects ──────────────────────────────────────────────────

  readonly availableWindows = computed(() =>
    this.windowService.windows().map(w => ({ id: w.id, name: w.name }))
  );

  readonly roleOptions = [
    { value: OperatorRole.Admin,      label: OPERATOR_ROLE_LABELS[OperatorRole.Admin] },
    { value: OperatorRole.Supervisor, label: OPERATOR_ROLE_LABELS[OperatorRole.Supervisor] },
    { value: OperatorRole.Operador,   label: OPERATOR_ROLE_LABELS[OperatorRole.Operador] },
  ];

  readonly dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

  readonly OperatorRole = OperatorRole;
  readonly roleIcon     = OPERATOR_ROLE_ICON;

  // ─── Init ────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    if (this.panelMode) return; // el setter panelEditId ya cargó los datos
    const id = this.route.snapshot.paramMap.get('id');
    if (id) {
      this.isEdit.set(true);
      this.operatorId.set(id);
      const op = this.operatorService.getById(id);
      if (op) {
        this.name             = op.name;
        this.email            = op.email;
        this.password         = op.password;
        this.role             = op.role;
        this.assignedWindowId = op.assignedWindowId ?? '';
        this.scheduleSlots.set([...op.shifts]);
      }
    }
  }

  // ─── RF-49: Manejo de turnos ─────────────────────────────────────────────

  addSlot(): void {
    if (!this.newSlotStart || !this.newSlotEnd) return;
    this.scheduleSlots.update(slots => [
      ...slots,
      {
        day:       this.newSlotDay as 0 | 1 | 2 | 3 | 4 | 5 | 6,
        startTime: this.newSlotStart,
        endTime:   this.newSlotEnd,
      },
    ]);
  }

  removeSlot(index: number): void {
    this.scheduleSlots.update(s => s.filter((_, i) => i !== index));
  }

  // ─── Guardar ─────────────────────────────────────────────────────────────

  save(): void {
    this.error.set(null);
    if (!this.name.trim() || !this.email.trim() || !this.password) {
      this.error.set('Nombre, correo y contraseña son obligatorios.');
      return;
    }

    this.saving.set(true);

    if (this.isEdit()) {
      this.operatorService.update(this.operatorId()!, {
        name:             this.name.trim(),
        email:            this.email.trim(),
        password:         this.password,
        role:             this.role,
        shifts:           this.scheduleSlots(),
        assignedWindowId: this.assignedWindowId || undefined,
      });

      if (this.assignedWindowId) {
        this.operatorService.assignToWindow(this.operatorId()!, this.assignedWindowId);
      } else {
        this.operatorService.unassignFromWindow(this.operatorId()!);
      }
    } else {
      const created = this.operatorService.create({
        name:             this.name.trim(),
        email:            this.email.trim(),
        password:         this.password,
        role:             this.role,
        shifts:           this.scheduleSlots(),
        assignedWindowId: this.assignedWindowId || undefined,
      });

      if (this.assignedWindowId) {
        this.operatorService.assignToWindow(created.id, this.assignedWindowId);
      }
    }

    this.saving.set(false);
    if (this.panelMode) {
      this.closePanel.emit();
    } else {
      this.router.navigate(['/operadores/supervision']);
    }
  }
}
