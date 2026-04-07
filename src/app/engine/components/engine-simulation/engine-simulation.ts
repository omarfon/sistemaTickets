import { ChangeDetectionStrategy, Component, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { QueueEngineService } from '../../services/queue-engine.service';
import { QueueRuleType, QUEUE_RULE_LABELS, QUEUE_RULE_ICONS } from '../../enums/queue-rule-type.enum';
import type { SimulationParams, SimulationResult } from '../../models/queue-engine.model';

/**
 * RF-68: Predicción de demanda.
 * RF-69: Simulación de colas — testing de escenarios.
 */
@Component({
  selector: 'app-engine-simulation',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './engine-simulation.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EngineSimulationComponent {
  protected readonly engine = inject(QueueEngineService);

  protected readonly ruleLabels = QUEUE_RULE_LABELS;
  protected readonly ruleIcons  = QUEUE_RULE_ICONS;
  protected readonly QueueRuleType = QueueRuleType;

  protected readonly simulations  = this.engine.simulations;
  protected readonly predictions  = this.engine.predictions;

  // ─── Tab activo ───────────────────────────────────────────────────────────
  protected readonly tab = signal<'simulation' | 'prediction'>('simulation');

  // ─── Formulario de simulación ─────────────────────────────────────────────
  protected simName         = signal('Escenario nuevo');
  protected simArrivalRate  = signal(40);
  protected simServiceTime  = signal(5);
  protected simServers      = signal(3);
  protected simDuration     = signal(8);
  protected simNormal       = signal(60);
  protected simPreferential = signal(30);
  protected simVip          = signal(10);
  protected simRule         = signal<QueueRuleType>(QueueRuleType.PriorityFirst);
  protected simRunning      = signal(false);
  protected simError        = signal('');

  protected readonly totalPct = computed(() =>
    this.simNormal() + this.simPreferential() + this.simVip()
  );

  protected ruleTypes(): QueueRuleType[] {
    return Object.values(QueueRuleType).filter(
      r => r !== QueueRuleType.ManualOverride && r !== QueueRuleType.TimeSlot
    );
  }

  protected runSim(): void {
    const name = this.simName().trim();
    if (!name) { this.simError.set('Escribe un nombre para la simulación'); return; }
    if (this.totalPct() !== 100) {
      this.simError.set(`La distribución de prioridades debe sumar 100% (actual: ${this.totalPct()}%)`);
      return;
    }
    this.simError.set('');
    this.simRunning.set(true);
    const params: SimulationParams = {
      arrivalRatePerHour: this.simArrivalRate(),
      avgServiceTimeMinutes: this.simServiceTime(),
      serverCount: this.simServers(),
      durationHours: this.simDuration(),
      priorityDistribution: {
        normal: this.simNormal(),
        preferential: this.simPreferential(),
        vip: this.simVip(),
      },
      rule: this.simRule(),
    };
    setTimeout(() => {
      this.engine.runSimulation(name, params);
      this.simRunning.set(false);
    }, 800);
  }

  protected deleteSim(id: string): void {
    if (confirm('¿Eliminar esta simulación?')) this.engine.deleteSimulation(id);
  }

  // ─── Predicción de demanda ────────────────────────────────────────────────

  protected readonly availableServices = computed(() =>
    this.engine['ticketService']
      ? []
      : []
  );

  protected selectedService = signal('svc-admision-caja');
  protected selectedServiceName = signal('Caja / Pagos');
  protected generatingPred = signal(false);

  protected generatePrediction(): void {
    this.generatingPred.set(true);
    setTimeout(() => {
      this.engine.generatePrediction(this.selectedService(), this.selectedServiceName());
      this.generatingPred.set(false);
    }, 600);
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  protected utilBadge(u: number): string {
    if (u >= 0.9) return 'bg-red-100 text-red-700';
    if (u >= 0.7) return 'bg-amber-100 text-amber-700';
    return 'bg-green-100 text-green-700';
  }

  protected slaBadge(pct: number): string {
    if (pct >= 90) return 'bg-green-100 text-green-700';
    if (pct >= 70) return 'bg-amber-100 text-amber-700';
    return 'bg-red-100 text-red-700';
  }

  protected barH(count: number, max: number): number {
    return max > 0 ? Math.round((count / max) * 100) : 0;
  }

  protected tabClass(t: string): string {
    const active   = 'border-b-2 border-indigo-600 text-indigo-600 font-semibold';
    const inactive = 'text-gray-500 hover:text-gray-800';
    return this.tab() === t ? active : inactive;
  }
}
