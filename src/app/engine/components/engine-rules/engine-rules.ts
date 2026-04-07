import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QueueEngineService } from '../../services/queue-engine.service';
import { QueueRuleType, QUEUE_RULE_LABELS, QUEUE_RULE_ICONS, QUEUE_RULE_DESCRIPTIONS } from '../../enums/queue-rule-type.enum';
import { SlaStatus, SLA_STATUS_BADGE } from '../../enums/sla-status.enum';
import { TicketPriority, TICKET_PRIORITY_LABELS } from '../../../tickets/enums/ticket-priority.enum';
import type { QueueRule, SlaConfig } from '../../models/queue-engine.model';

/**
 * RF-63 / RF-64 / RF-73: Gestión de reglas de atención y SLA.
 * Permite crear, activar/desactivar y eliminar reglas de cola
 * y configurar los tiempos máximos de espera por prioridad.
 */
@Component({
  selector: 'app-engine-rules',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './engine-rules.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EngineRulesComponent {
  protected readonly engine = inject(QueueEngineService);

  // ─── Enums en plantilla ───────────────────────────────────────────────────
  protected readonly ruleLabels       = QUEUE_RULE_LABELS;
  protected readonly ruleIcons        = QUEUE_RULE_ICONS;
  protected readonly ruleDescriptions = QUEUE_RULE_DESCRIPTIONS;
  protected readonly SlaStatusBadge   = SLA_STATUS_BADGE;
  protected readonly TicketPriority   = TicketPriority;
  protected readonly priorityLabels   = TICKET_PRIORITY_LABELS;
  protected readonly QueueRuleType    = QueueRuleType;

  // ─── Datos ───────────────────────────────────────────────────────────────
  protected readonly rules      = this.engine.rules;
  protected readonly slaConfigs = this.engine.slaConfigs;
  protected readonly queueLines = this.engine.queueLines;
  protected readonly activeRuleId = this.engine.activeRuleId;

  // ─── Tab ─────────────────────────────────────────────────────────────────
  protected readonly tab = signal<'rules' | 'sla' | 'lines'>('rules');

  // ─── Formulario nueva regla ───────────────────────────────────────────────
  protected readonly showNewRuleForm = signal(false);
  protected newRuleName    = signal('');
  protected newRuleType    = signal<QueueRuleType>(QueueRuleType.FIFO);
  protected newNormalSlots = signal(2);
  protected newPrefSlots   = signal(1);
  protected newRuleError   = signal('');

  protected ruleTypes(): QueueRuleType[] {
    return Object.values(QueueRuleType);
  }

  protected openNewRuleForm(): void {
    this.newRuleName.set('');
    this.newRuleType.set(QueueRuleType.FIFO);
    this.newNormalSlots.set(2);
    this.newPrefSlots.set(1);
    this.newRuleError.set('');
    this.showNewRuleForm.set(true);
  }

  protected submitNewRule(): void {
    const name = this.newRuleName().trim();
    if (!name) { this.newRuleError.set('El nombre es obligatorio'); return; }
    this.engine.createRule({
      name,
      type:             this.newRuleType(),
      serviceIds:       [],
      normalSlots:      this.newNormalSlots(),
      preferentialSlots: this.newPrefSlots(),
      active:           false,
      priority:         this.rules().length + 1,
    });
    this.showNewRuleForm.set(false);
  }

  protected toggleRule(id: string): void {
    this.engine.toggleRule(id);
  }

  protected activateRule(id: string): void {
    this.engine.setActiveRule(id);
  }

  protected deleteRule(id: string): void {
    if (confirm('¿Eliminar esta regla?')) this.engine.deleteRule(id);
  }

  // ─── SLA ─────────────────────────────────────────────────────────────────

  protected editingSla = signal<string | null>(null);
  protected editMaxWait    = signal(30);
  protected editWarnPct    = signal(80);

  protected startEditSla(sla: SlaConfig): void {
    this.editingSla.set(sla.id);
    this.editMaxWait.set(sla.maxWaitMinutes);
    this.editWarnPct.set(sla.warningThresholdPct);
  }

  protected saveSla(id: string): void {
    this.engine.updateSla(id, {
      maxWaitMinutes:      this.editMaxWait(),
      warningThresholdPct: this.editWarnPct(),
    });
    this.editingSla.set(null);
  }

  protected toggleSla(id: string): void {
    this.engine.toggleSla(id);
  }

  // ─── Líneas de atención ───────────────────────────────────────────────────

  protected toggleLine(id: string): void {
    this.engine.toggleQueueLine(id);
  }

  protected deleteLine(id: string): void {
    if (confirm('¿Eliminar esta línea de atención?')) this.engine.deleteQueueLine(id);
  }

  protected tabClass(t: string): string {
    const active   = 'border-b-2 border-indigo-600 text-indigo-600 font-semibold';
    const inactive = 'text-gray-500 hover:text-gray-800';
    return this.tab() === t ? active : inactive;
  }
}
