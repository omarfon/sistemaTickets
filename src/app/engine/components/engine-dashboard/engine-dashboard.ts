import { ChangeDetectionStrategy, Component, computed, inject, OnDestroy, signal } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule } from '@angular/router';
import { QueueEngineService } from '../../services/queue-engine.service';
import { DistributionStrategy, DISTRIBUTION_STRATEGY_LABELS, DISTRIBUTION_STRATEGY_ICONS } from '../../enums/distribution-strategy.enum';
import { SlaStatus, SLA_STATUS_BADGE, SLA_STATUS_ICON } from '../../enums/sla-status.enum';
import { QUEUE_RULE_LABELS, QUEUE_RULE_ICONS } from '../../enums/queue-rule-type.enum';
import { ABANDONMENT_REASON_LABELS, ABANDONMENT_REASON_BADGE } from '../../enums/abandonment-reason.enum';
import { TICKET_PRIORITY_LABELS } from '../../../tickets/enums/ticket-priority.enum';

/**
 * RF-61…RF-75: Dashboard en tiempo real del Motor de Colas.
 * Muestra métricas globales, SLA, distribución, reintentos y abandono.
 */
@Component({
  selector: 'app-engine-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule, DatePipe],
  templateUrl: './engine-dashboard.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EngineDashboardComponent implements OnDestroy {
  protected readonly engine = inject(QueueEngineService);

  // ─── Enums expuestos a la plantilla ──────────────────────────────────────
  protected readonly DistributionStrategy    = DistributionStrategy;
  protected readonly distStrategyLabels      = DISTRIBUTION_STRATEGY_LABELS;
  protected readonly distStrategyIcons       = DISTRIBUTION_STRATEGY_ICONS;
  protected readonly slaBadge                = SLA_STATUS_BADGE;
  protected readonly slaIcon                 = SLA_STATUS_ICON;
  protected readonly SlaStatus               = SlaStatus;
  protected readonly ruleLabels              = QUEUE_RULE_LABELS;
  protected readonly ruleIcons               = QUEUE_RULE_ICONS;
  protected readonly abandonReasonLabels     = ABANDONMENT_REASON_LABELS;
  protected readonly abandonReasonBadge      = ABANDONMENT_REASON_BADGE;
  protected readonly priorityLabels          = TICKET_PRIORITY_LABELS;

  // ─── Tab activo ───────────────────────────────────────────────────────────
  protected readonly activeTab = signal<'overview' | 'sla' | 'retries' | 'abandonment' | 'virtual'>('overview');

  // ─── Reloj ────────────────────────────────────────────────────────────────
  protected readonly now = signal(Date.now());
  private readonly _clockTimer = setInterval(() => this.now.set(Date.now()), 30_000);

  ngOnDestroy(): void {
    clearInterval(this._clockTimer);
  }

  // ─── Derived computeds ────────────────────────────────────────────────────
  protected readonly metrics        = this.engine.metrics;
  protected readonly slaEvals       = this.engine.slaEvaluations;
  protected readonly pendingRetries = this.engine.pendingRetries;
  protected readonly abandonments   = this.engine.abandonments;
  protected readonly virtualTickets = this.engine.virtualTickets;
  protected readonly sortedQueue    = this.engine.sortedQueue;
  protected readonly activeRule     = this.engine.activeRule;
  protected readonly activeStrategy = this.engine.activeStrategy;

  protected readonly breachedSlas = computed(() =>
    this.slaEvals().filter(e => e.status === SlaStatus.Breached)
  );
  protected readonly warningSlas = computed(() =>
    this.slaEvals().filter(e => e.status === SlaStatus.Warning)
  );

  protected readonly autoScaleActions = computed(() =>
    this.engine.evaluateAutoScale()
  );

  // ─── Acciones ─────────────────────────────────────────────────────────────

  protected setStrategy(s: DistributionStrategy): void {
    this.engine.setDistributionStrategy(s);
  }

  protected jumpToFront(ticketId: string): void {
    const ok = this.engine.jumpToFront(ticketId);
    if (!ok) alert('No se pudo adelantar el ticket');
  }

  protected markResponded(ticketId: string): void {
    this.engine.markResponded(ticketId);
  }

  protected checkInVirtual(id: string): void {
    this.engine.checkInVirtualTicket(id);
  }

  protected removeVirtual(id: string): void {
    if (confirm('¿Eliminar registro virtual?')) {
      this.engine.removeVirtualTicket(id);
    }
  }

  protected detectAbandonments(): void {
    const n = this.engine.detectAutoAbandonments();
    alert(`${n} abandono(s) detectado(s) automáticamente`);
  }

  // ─── Helpers de plantilla ─────────────────────────────────────────────────

  protected slaBarColor(status: SlaStatus): string {
    if (status === SlaStatus.Breached) return 'bg-red-500';
    if (status === SlaStatus.Warning)  return 'bg-amber-400';
    return 'bg-green-500';
  }

  protected utilColor(pct: number): string {
    if (pct >= 90) return 'text-red-600';
    if (pct >= 70) return 'text-amber-600';
    return 'text-green-600';
  }

  protected strategies(): DistributionStrategy[] {
    return Object.values(DistributionStrategy);
  }

  protected tabClass(tab: string): string {
    const active   = 'border-b-2 border-indigo-600 text-indigo-600 font-semibold';
    const inactive = 'text-gray-500 hover:text-gray-800';
    return this.activeTab() === tab ? active : inactive;
  }

  protected formatMinutes(min: number): string {
    if (min <= 0) return '< 1 min';
    if (min < 60) return `${Math.round(min)} min`;
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return `${h}h ${m}min`;
  }

  protected waitMinutes(createdAt: Date): number {
    return (this.now() - createdAt.getTime()) / 60000;
  }

  protected trackById(_: number, item: { id: string }): string {
    return item.id;
  }
}
