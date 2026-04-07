import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { WindowService } from '../../services/window.service';
import { WindowStatus, WINDOW_STATUS_LABELS, WINDOW_STATUS_CSS, WINDOW_STATUS_DOT } from '../../enums/window-status.enum';
import { WindowAlertLevel, WINDOW_ALERT_CSS } from '../../enums/window-alert.enum';
import type { WindowSummary } from '../../models/window.model';

/** Filtros disponibles para el dashboard */
type DashboardFilter = 'all' | WindowStatus;

/**
 * RF-23 / RF-29 / RF-35
 * Dashboard en tiempo real del estado de todas las ventanillas.
 * Muestra tarjetas con estado, operador, cola, tiempo de espera y alertas.
 */
@Component({
  selector: 'app-window-list',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink],
  templateUrl: './window-list.html',
})
export class WindowListComponent {
  private readonly windowService = inject(WindowService);

  // ─── Exposición de datos ─────────────────────────────────────────────────

  readonly summaries      = this.windowService.windowSummaries;
  readonly alerts         = this.windowService.activeAlerts;
  readonly totalAvailable = this.windowService.totalAvailable;
  readonly totalOccupied  = this.windowService.totalOccupied;

  // ─── Filtrado por estado ─────────────────────────────────────────────────

  readonly activeFilter = signal<DashboardFilter>('all');

  readonly filteredSummaries = computed<WindowSummary[]>(() => {
    const f = this.activeFilter();
    return f === 'all'
      ? this.summaries()
      : this.summaries().filter(s => s.window.status === f);
  });

  // ─── Contadores por paso clínico ─────────────────────────────────────────

  readonly byStep = computed(() => {
    const all = this.summaries();
    return [
      { step: 1, label: 'Admisión',        icon: '🏥', count: all.filter(s => s.window.step === 1).length },
      { step: 2, label: 'Pre-consulta',    icon: '🩺', count: all.filter(s => s.window.step === 2).length },
      { step: 3, label: 'Especialistas',   icon: '👨‍⚕️', count: all.filter(s => s.window.step === 3).length },
    ];
  });

  // ─── Enums / constantes para la plantilla ────────────────────────────────

  readonly WindowStatus      = WindowStatus;
  readonly WindowAlertLevel  = WindowAlertLevel;
  readonly statusLabels      = WINDOW_STATUS_LABELS;
  readonly statusCss         = WINDOW_STATUS_CSS;
  readonly statusDot         = WINDOW_STATUS_DOT;
  readonly alertCss          = WINDOW_ALERT_CSS;
  readonly filterOptions: { value: DashboardFilter; label: string }[] = [
    { value: 'all',                        label: 'Todos' },
    { value: WindowStatus.Disponible,      label: 'Disponibles' },
    { value: WindowStatus.Ocupado,         label: 'Ocupados' },
    { value: WindowStatus.Cerrada,         label: 'Cerrados' },
    { value: WindowStatus.Mantenimiento,   label: 'Mantenimiento' },
    { value: WindowStatus.Offline,         label: 'Offline' },
  ];

  // ─── Acciones ─────────────────────────────────────────────────────────────

  setFilter(f: DashboardFilter): void {
    this.activeFilter.set(f);
  }

  dismissAlert(id: string): void {
    this.windowService.dismissAlert(id);
  }

  dismissAllAlerts(): void {
    this.windowService.dismissAllAlerts();
  }

  rebalance(): void {
    this.windowService.rebalance();
  }

  /** RF-32: Texto legible de si el módulo está dentro de horario */
  scheduleLabel(withinSchedule: boolean, hasSchedule: boolean): string {
    if (!hasSchedule) return 'Sin horario configurado';
    return withinSchedule ? 'Dentro de horario' : 'Fuera de horario';
  }
}
