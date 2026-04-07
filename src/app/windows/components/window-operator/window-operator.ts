import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { WindowService } from '../../services/window.service';
import { TicketService } from '../../../tickets/services/ticket.service';
import { WindowStatus, WINDOW_STATUS_LABELS, WINDOW_STATUS_CSS, WINDOW_STATUS_DOT } from '../../enums/window-status.enum';
import { TICKET_PRIORITY_LABELS } from '../../../tickets/enums/ticket-priority.enum';
import type { WindowSummary } from '../../models/window.model';

/**
 * RF-24 / RF-25 / RF-31 / RF-34
 * Panel de operador de una ventanilla individual.
 * - RF-24: Asignación automática del siguiente ticket
 * - RF-25: Transferencia de tickets a otra ventanilla
 * - RF-31: Redistribución global (rebalanceo)
 * - RF-34: Visualización de la cola propia
 */
@Component({
  selector: 'app-window-operator',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule],
  templateUrl: './window-operator.html',
})
export class WindowOperatorComponent implements OnInit {
  private readonly windowService  = inject(WindowService);
  private readonly ticketService  = inject(TicketService);
  private readonly route          = inject(ActivatedRoute);

  // ─── ID de la ventanilla activa ─────────────────────────────────────────

  readonly windowId = signal<string>('');

  // ─── Summary de esta ventanilla ─────────────────────────────────────────

  readonly summary = computed<WindowSummary | undefined>(() =>
    this.windowService.windowSummaries().find(s => s.window.id === this.windowId())
  );

  // ─── Todas las ventanillas disponibles para transferencia ────────────────

  readonly transferTargets = computed(() =>
    this.windowService.windowSummaries().filter(
      s => s.window.id !== this.windowId() && s.window.status !== WindowStatus.Cerrada
    )
  );

  // ─── RF-25: Transferencia ────────────────────────────────────────────────

  transferTargetId = '';
  selectedTicketId = signal<string>('');

  // ─── Mensajes de estado ──────────────────────────────────────────────────

  readonly message = signal<{ text: string; ok: boolean } | null>(null);

  // ─── Constantes de plantilla ─────────────────────────────────────────────

  readonly WindowStatus     = WindowStatus;
  readonly statusLabels     = WINDOW_STATUS_LABELS;
  readonly statusCss        = WINDOW_STATUS_CSS;
  readonly statusDot        = WINDOW_STATUS_DOT;
  readonly priorityLabels   = TICKET_PRIORITY_LABELS;

  // ─── Init ────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    const id = this.route.snapshot.paramMap.get('id') ?? '';
    this.windowId.set(id);
  }

  // ─── RF-24: Asignación automática del siguiente ticket ───────────────────

  autoAssign(): void {
    const s = this.summary();
    if (!s) return;

    const next = s.queuedTickets[0];
    if (!next) {
      this._msg('No hay tickets en cola.', false);
      return;
    }

    this.windowService.autoAssign(next.id);
    this._msg(`Ticket ${next.number} asignado automáticamente.`, true);
  }

  // ─── RF-25: Transferir ticket seleccionado ───────────────────────────────

  transfer(): void {
    const ticketId = this.selectedTicketId();
    if (!ticketId || !this.transferTargetId) {
      this._msg('Selecciona un ticket y un módulo destino.', false);
      return;
    }

    const ticket = this.ticketService.tickets().find(t => t.id === ticketId);
    const result = this.windowService.transferTicket(ticketId, this.windowId(), this.transferTargetId);

    if (result) {
      this._msg(
        `Ticket ${ticket?.number ?? ticketId} transferido correctamente.`,
        true,
      );
      this.selectedTicketId.set('');
      this.transferTargetId = '';
    } else {
      this._msg('No se pudo transferir el ticket. Verifica la capacidad del módulo destino.', false);
    }
  }

  // ─── RF-31: Redistribución global ────────────────────────────────────────

  rebalance(): void {
    this.windowService.rebalance();
    this._msg('Cola redistribuida entre módulos disponibles.', true);
  }

  // ─── Cambio de estado ────────────────────────────────────────────────────

  openWindow(): void {
    this.windowService.openWindow(this.windowId(), this._operatorName());
    this._msg('Módulo abierto y disponible.', true);
  }

  private _operatorName(): string {
    return this.summary()?.window.operatorName ?? 'Operador';
  }

  closeWindow(): void {
    this.windowService.closeWindow(this.windowId());
    this._msg('Módulo cerrado.', false);
  }

  setMaintenance(): void {
    this.windowService.setMaintenance(this.windowId());
    this._msg('Módulo en mantenimiento.', false);
  }

  // ─── Etiqueta del ticket seleccionado (para la UI) ──────────────────────

  readonly selectedTicketLabel = computed(() => {
    const id = this.selectedTicketId();
    if (!id) return '(ninguno)';
    const t = this.summary()?.queuedTickets.find(x => x.id === id);
    return t?.number ?? '—';
  });

  // ─── Helper ──────────────────────────────────────────────────────────────

  private _msg(text: string, ok: boolean): void {
    this.message.set({ text, ok });
    setTimeout(() => this.message.set(null), 3500);
  }
}
