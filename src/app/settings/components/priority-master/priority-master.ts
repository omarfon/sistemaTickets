import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { PriorityService } from '../../services/priority.service';
import type { PriorityConfig } from '../../models/priority.model';

@Component({
  selector: 'app-priority-master',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './priority-master.html',
})
export class PriorityMasterComponent {
  readonly priorityService = inject(PriorityService);

  // ─── Estado del formulario ───────────────────────────────────────────

  readonly showForm = signal(false);
  readonly editingId = signal<string | null>(null);
  readonly message = signal<{ text: string; ok: boolean } | null>(null);

  // Campos del formulario
  formCode = '';
  formLabel = '';
  formDescription = '';
  formWeight = 1;
  formIcon = '🟢';
  formColor = 'bg-green-100 text-green-800 ring-green-200';
  formIsActive = true;

  // Opciones de color predefinidas
  readonly colorOptions = [
    { label: 'Verde',    value: 'bg-green-100 text-green-800 ring-green-200',  dot: '🟢' },
    { label: 'Amarillo', value: 'bg-amber-100 text-amber-800 ring-amber-200',  dot: '🟡' },
    { label: 'Naranja',  value: 'bg-orange-100 text-orange-800 ring-orange-200', dot: '🟠' },
    { label: 'Rojo',     value: 'bg-red-100 text-red-800 ring-red-200',        dot: '🔴' },
    { label: 'Azul',     value: 'bg-blue-100 text-blue-800 ring-blue-200',     dot: '🔵' },
    { label: 'Morado',   value: 'bg-purple-100 text-purple-800 ring-purple-200', dot: '🟣' },
    { label: 'Gris',     value: 'bg-gray-100 text-gray-800 ring-gray-200',     dot: '⚪' },
  ];

  // ─── Acciones ────────────────────────────────────────────────────────

  openNew(): void {
    this.editingId.set(null);
    this._clearForm();
    this.showForm.set(true);
  }

  openEdit(p: PriorityConfig): void {
    this.editingId.set(p.id);
    this.formCode = p.code;
    this.formLabel = p.label;
    this.formDescription = p.description;
    this.formWeight = p.weight;
    this.formIcon = p.icon;
    this.formColor = p.color;
    this.formIsActive = p.isActive;
    this.showForm.set(true);
  }

  cancel(): void {
    this.showForm.set(false);
    this._clearForm();
    this.editingId.set(null);
  }

  save(): void {
    const code = this.formCode.trim().toUpperCase();
    const label = this.formLabel.trim();

    if (!code || !label) {
      this._msg('Código y nombre son obligatorios.', false);
      return;
    }

    // Validar código único (excepto al editar el mismo)
    const existing = this.priorityService.getByCode(code);
    if (existing && existing.id !== this.editingId()) {
      this._msg(`Ya existe una prioridad con el código "${code}".`, false);
      return;
    }

    const dto = {
      code,
      label,
      description: this.formDescription.trim(),
      weight: this.formWeight,
      icon: this.formIcon,
      color: this.formColor,
      isActive: this.formIsActive,
    };

    if (this.editingId()) {
      this.priorityService.update(this.editingId()!, dto);
      this._msg(`Prioridad "${label}" actualizada.`, true);
    } else {
      this.priorityService.create(dto);
      this._msg(`Prioridad "${label}" creada.`, true);
    }

    this.showForm.set(false);
    this._clearForm();
    this.editingId.set(null);
  }

  delete(p: PriorityConfig): void {
    this.priorityService.delete(p.id);
    this._msg(`Prioridad "${p.label}" eliminada.`, true);
  }

  toggleActive(p: PriorityConfig): void {
    this.priorityService.toggleActive(p.id);
  }

  // ─── Helpers ──────────────────────────────────────────────────────────

  private _clearForm(): void {
    this.formCode = '';
    this.formLabel = '';
    this.formDescription = '';
    this.formWeight = 1;
    this.formIcon = '🟢';
    this.formColor = 'bg-green-100 text-green-800 ring-green-200';
    this.formIsActive = true;
  }

  private _msg(text: string, ok: boolean): void {
    this.message.set({ text, ok });
    setTimeout(() => this.message.set(null), 4000);
  }
}
