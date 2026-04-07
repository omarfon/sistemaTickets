import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { OperatorService } from '../../services/operator.service';
import { AuthService }     from '../../services/auth.service';
import {
  OperatorRole,
  OPERATOR_ROLE_CSS,
  OPERATOR_ROLE_ICON,
  OPERATOR_ROLE_LABELS,
} from '../../enums/operator-role.enum';
import {
  OperatorStatus,
  OPERATOR_STATUS_CSS,
  OPERATOR_STATUS_DOT,
  OPERATOR_STATUS_LABELS,
} from '../../enums/operator-status.enum';
import type { Operator } from '../../models/operator.model';

type ListFilter = 'all' | OperatorRole | OperatorStatus;

/**
 * RF-47 — Supervisión en tiempo real de operadores.
 * RF-45 — Métricas KPI individuales.
 * RF-50 — Evaluación de desempeño (score).
 */
@Component({
  selector: 'app-operator-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule],
  templateUrl: './operator-list.html',
})
export class OperatorListComponent {
  private readonly operatorService = inject(OperatorService);
  readonly authService             = inject(AuthService);

  // ─── Datos ──────────────────────────────────────────────────────────────

  readonly operators   = this.operatorService.operators;
  readonly metrics     = this.operatorService.metrics;
  readonly totalAvail  = this.operatorService.totalAvailable;
  readonly totalBusy   = this.operatorService.totalBusy;
  readonly totalBreak  = this.operatorService.totalOnBreak;
  readonly totalOffline= this.operatorService.totalOffline;

  // ─── Filtrado ────────────────────────────────────────────────────────────

  readonly activeFilter = signal<ListFilter>('all');

  readonly filterOptions: { value: ListFilter; label: string }[] = [
    { value: 'all',                       label: 'Todos' },
    { value: OperatorStatus.Disponible,   label: 'Disponibles' },
    { value: OperatorStatus.Ocupado,      label: 'Ocupados' },
    { value: OperatorStatus.EnPausa,      label: 'En pausa' },
    { value: OperatorStatus.Offline,      label: 'Offline' },
    { value: OperatorRole.Admin,          label: 'Admins' },
    { value: OperatorRole.Supervisor,     label: 'Supervisores' },
    { value: OperatorRole.Operador,       label: 'Operadores' },
  ];

  readonly filteredOperators = computed<Operator[]>(() => {
    const f = this.activeFilter();
    if (f === 'all') return this.operators();
    // Filtro por estado
    const isStatus = Object.values(OperatorStatus).includes(f as OperatorStatus);
    if (isStatus) return this.operators().filter(o => o.status === f);
    // Filtro por rol
    return this.operators().filter(o => o.role === f);
  });

  // ─── Helpers ─────────────────────────────────────────────────────────────

  setFilter(f: ListFilter): void { this.activeFilter.set(f); }

  metricsOf(operatorId: string) {
    return this.metrics().find(m => m.operatorId === operatorId);
  }

  unreadNotifs(notifications: import('../../models/operator.model').OperatorNotification[]): number {
    return notifications.filter(n => !n.read).length;
  }

  scoreColor(score: number): string {
    if (score >= 85) return 'text-emerald-600';
    if (score >= 65) return 'text-amber-600';
    return 'text-red-600';
  }

  scoreBar(score: number): string {
    if (score >= 85) return 'bg-emerald-500';
    if (score >= 65) return 'bg-amber-500';
    return 'bg-red-500';
  }

  // ─── RF-48: Broadcast de notificación ────────────────────────────────────

  readonly broadcastMsg = signal('');
  readonly broadcastSent = signal(false);

  sendBroadcast(): void {
    const msg = this.broadcastMsg().trim();
    if (!msg) return;
    this.operatorService.broadcast(msg, 'info');
    this.broadcastMsg.set('');
    this.broadcastSent.set(true);
    setTimeout(() => this.broadcastSent.set(false), 3000);
  }

  // ─── Constantes ──────────────────────────────────────────────────────────

  readonly OperatorRole   = OperatorRole;
  readonly OperatorStatus = OperatorStatus;
  readonly roleLabels     = OPERATOR_ROLE_LABELS;
  readonly roleCss        = OPERATOR_ROLE_CSS;
  readonly roleIcon       = OPERATOR_ROLE_ICON;
  readonly statusLabels   = OPERATOR_STATUS_LABELS;
  readonly statusCss      = OPERATOR_STATUS_CSS;
  readonly statusDot      = OPERATOR_STATUS_DOT;
}
