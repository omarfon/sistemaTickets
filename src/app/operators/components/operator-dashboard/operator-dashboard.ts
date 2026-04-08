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
import { OperatorService } from '../../services/operator.service';
import { AuthService }     from '../../services/auth.service';
import { WindowService }   from '../../../windows/services/window.service';
import { TicketService }   from '../../../tickets/services/ticket.service';
import { OperatorStatus, OPERATOR_STATUS_CSS, OPERATOR_STATUS_LABELS } from '../../enums/operator-status.enum';
import { TICKET_PRIORITY_LABELS } from '../../../tickets/enums/ticket-priority.enum';

/**
 * RF-40 — Inicio de atención (tomar ticket).
 * RF-41 — Finalizar atención.
 * RF-42 — Pausas (break / descanso).
 * RF-43 — Estado del operador.
 * RF-44 — Historial de atención.
 * RF-46 — Transferir atención a otra ventanilla.
 * RF-48 — Notificaciones internas.
 */
@Component({
  selector: 'app-operator-dashboard',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, FormsModule],
  templateUrl: './operator-dashboard.html',
})
export class OperatorDashboardComponent implements OnInit {
  private readonly operatorService = inject(OperatorService);
  readonly authService             = inject(AuthService);
  private readonly windowService   = inject(WindowService);
  private readonly ticketService   = inject(TicketService);
  private readonly route           = inject(ActivatedRoute);

  // ─── Operador activo ─────────────────────────────────────────────────────

  readonly operatorId = signal<string>('');

  readonly operator = computed(() =>
    this.operatorService.operators().find(o => o.id === this.operatorId())
  );

  // ─── Resumen de la ventanilla asignada ───────────────────────────────────

  readonly windowSummary = computed(() => {
    const winId = this.operator()?.assignedWindowId;
    if (!winId) return undefined;
    return this.windowService.windowSummaries().find(s => s.window.id === winId);
  });

  // ─── Ticket en atención ───────────────────────────────────────────────────

  readonly currentTicket = computed(() => {
    const ticketId = this.operator()?.currentTicketId;
    if (!ticketId) return undefined;
    return this.ticketService.tickets().find(t => t.id === ticketId);
  });

  // ─── RF-48: Notificaciones ───────────────────────────────────────────────

  readonly notifications = computed(() =>
    this.operator()?.notifications.filter(n => !n.read) ?? []
  );

  // ─── RF-46: Transferencia ────────────────────────────────────────────────

  readonly transferTargets = computed(() =>
    this.windowService.windowSummaries().filter(
      s => s.window.id !== this.operator()?.assignedWindowId
    )
  );
  transferTargetId = '';

  /** Servicios disponibles para transferencia por servicio */
  readonly allServices = computed(() => this.ticketService.services());
  transferServiceId = '';
  transferReason = '';
  transferQueueTicketId = '';
  readonly showTransferPanel = signal(false);

  // ─── RF-42: Pausa ────────────────────────────────────────────────────────

  breakReason = '';

  // ─── RF-41: Notas al cerrar ───────────────────────────────────────────────

  finishNotes = '';

  // ─── Feedback ─────────────────────────────────────────────────────────────

  readonly message = signal<{ text: string; ok: boolean } | null>(null);

  // ─── Constantes ──────────────────────────────────────────────────────────

  readonly OperatorStatus  = OperatorStatus;
  readonly statusLabels    = OPERATOR_STATUS_LABELS;
  readonly statusCss       = OPERATOR_STATUS_CSS;
  readonly priorityLabels  = TICKET_PRIORITY_LABELS;

  // ─── Init ────────────────────────────────────────────────────────────────

  ngOnInit(): void {
    // Prioridad: parámetro de ruta → sesión activa
    const routeId = this.route.snapshot.paramMap.get('id');
    const sessionId = this.authService.currentOperator()?.id;
    this.operatorId.set(routeId ?? sessionId ?? '');
  }

  // ─── RF-40: Tomar siguiente ticket ───────────────────────────────────────

  takeNext(): void {
    const id = this.operatorId();
    const ticketId = this.operatorService.startAttention(id);
    if (ticketId) {
      this._msg('✅ Ticket tomado. Atención iniciada.', true);
    } else {
      this._msg('Cola vacía o sin ventanilla asignada.', false);
    }
  }

  // ─── RF-41: Finalizar atención ───────────────────────────────────────────

  finish(): void {
    this.operatorService.finishAttention(this.operatorId(), this.finishNotes || undefined);
    this.finishNotes = '';
    this._msg('✅ Atención finalizada correctamente.', true);
  }

  // ─── RF-42: Iniciar pausa ────────────────────────────────────────────────

  startBreak(): void {
    if (!this.breakReason.trim()) {
      this._msg('Indica el motivo de la pausa.', false);
      return;
    }
    this.operatorService.startBreak(this.operatorId(), this.breakReason.trim());
    this.breakReason = '';
    this._msg('⏸ Pausa iniciada.', true);
  }

  // ─── RF-42: Terminar pausa ────────────────────────────────────────────────

  endBreak(): void {
    this.operatorService.endBreak(this.operatorId());
    this._msg('▶️ Pausa finalizada. ¡Listo para atender!', true);
  }

  // ─── RF-46: Transferir ───────────────────────────────────────────────────

  transfer(): void {
    if (!this.transferTargetId) {
      this._msg('Selecciona una ventanilla destino.', false);
      return;
    }
    const ok = this.operatorService.transferTicket(this.operatorId(), this.transferTargetId);
    if (ok) {
      this.transferTargetId = '';
      this._msg('\u2705 Ticket transferido a otra ventanilla.', true);
    } else {
      this._msg('No se pudo transferir. Verifica la capacidad del m\u00f3dulo destino.', false);
    }
  }

  /** Transfiere el ticket actual o un ticket de la cola a otro servicio */
  transferToService(ticketId?: string): void {
    if (!this.transferServiceId) {
      this._msg('Selecciona un servicio destino.', false);
      return;
    }
    const ok = this.operatorService.transferTicketToService(
      this.operatorId(),
      this.transferServiceId,
      ticketId,
      this.transferReason || undefined
    );
    if (ok) {
      this.transferServiceId = '';
      this.transferReason = '';
      this.transferQueueTicketId = '';
      this.showTransferPanel.set(false);
      this._msg('\u2705 Ticket transferido al servicio correctamente.', true);
    } else {
      this._msg('No se pudo transferir. Verifica el servicio destino.', false);
    }
  }

  /** Abre el panel de transferencia para un ticket de la cola */
  openTransferForQueueTicket(ticketId: string): void {
    this.transferQueueTicketId = ticketId;
    this.showTransferPanel.set(true);
  }

  cancelTransfer(): void {
    this.showTransferPanel.set(false);
    this.transferQueueTicketId = '';
    this.transferServiceId = '';
    this.transferReason = '';
  }

  // ─── RF-48: Marcar notificación como leída ────────────────────────────────

  markRead(notifId: string): void {
    this.operatorService.markNotificationRead(this.operatorId(), notifId);
  }

  markAllRead(): void {
    this.operatorService.markAllRead(this.operatorId());
  }

  // ─── Helper feedback ──────────────────────────────────────────────────────

  private _msg(text: string, ok: boolean): void {
    this.message.set({ text, ok });
    setTimeout(() => this.message.set(null), 4000);
  }
}
