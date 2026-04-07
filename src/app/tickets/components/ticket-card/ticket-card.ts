import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import type { Ticket } from '../../models/ticket.model';
import {
  TICKET_PRIORITY_LABELS,
  TICKET_STATUS_LABELS,
  TICKET_SOURCE_LABELS,
  TicketPriority,
  TicketStatus,
  TICKET_STATUS_TRANSITIONS,
} from '../../enums';
import { TicketHistoryComponent } from '../ticket-history/ticket-history';

@Component({
  selector: 'app-ticket-card',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TicketHistoryComponent],
  templateUrl: './ticket-card.html',
})
export class TicketCardComponent {
  readonly ticket = input.required<Ticket>();

  // ─── Outputs existentes ───────────────────────────────────────────────────
  readonly cancel = output<string>();
  readonly complete = output<string>();

  // ─── RF-10/RF-18: Nuevos outputs ─────────────────────────────────────────
  readonly transfer = output<string>();
  readonly reschedule = output<string>();

  // ─── UI state ────────────────────────────────────────────────────────────
  readonly showHistory = signal(false);

  // ─── Labels y maps ───────────────────────────────────────────────────────
  readonly priorityLabels = TICKET_PRIORITY_LABELS;
  readonly statusLabels = TICKET_STATUS_LABELS;
  readonly sourceLabels = TICKET_SOURCE_LABELS;
  readonly TicketStatus = TicketStatus;

  readonly priorityClasses: Record<TicketPriority, string> = {
    [TicketPriority.Normal]: 'text-gray-700',
    [TicketPriority.Preferencial]: 'text-orange-600 font-semibold',
    [TicketPriority.VIP]: 'text-purple-700 font-bold',
  };

  // ─── Clases dinámicas Tailwind ───────────────────────────────────────────
  readonly statusCardClasses = computed(() => {
    const map: Record<TicketStatus, string> = {
      [TicketStatus.EnEspera]: 'border-l-amber-400',
      [TicketStatus.EnAtencion]: 'border-l-blue-500 bg-blue-50',
      [TicketStatus.Atendido]: 'border-l-emerald-500 opacity-80',
      [TicketStatus.Cancelado]: 'border-l-red-400 opacity-50',
    };
    return `flex flex-col gap-3 rounded-xl border border-gray-200 border-l-4 bg-white p-4 shadow-sm transition-all hover:shadow-md ${map[this.ticket().status]}`;
  });

  readonly statusBadgeClasses = computed(() => {
    const map: Record<TicketStatus, string> = {
      [TicketStatus.EnEspera]: 'bg-amber-100 text-amber-800',
      [TicketStatus.EnAtencion]: 'bg-blue-100 text-blue-800',
      [TicketStatus.Atendido]: 'bg-emerald-100 text-emerald-800',
      [TicketStatus.Cancelado]: 'bg-red-100 text-red-800',
    };
    return `inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wide ${map[this.ticket().status]}`;
  });

  // ─── Permisos de acción ───────────────────────────────────────────────────
  readonly canComplete = computed(() =>
    TICKET_STATUS_TRANSITIONS[this.ticket().status].includes(TicketStatus.Atendido)
  );
  readonly canCancel = computed(() =>
    TICKET_STATUS_TRANSITIONS[this.ticket().status].includes(TicketStatus.Cancelado)
  );
  /** RF-18: Solo tickets en espera pueden transferirse */
  readonly canTransfer = computed(() => this.ticket().status === TicketStatus.EnEspera);
  /** RF-10: Solo tickets en espera pueden reprogramarse */
  readonly canReschedule = computed(() => this.ticket().status === TicketStatus.EnEspera);

  // ─── Estado virtual / check-in ───────────────────────────────────────────
  /** RF-19 */
  readonly isVirtual = computed(() => this.ticket().virtualQueue);
  /** RF-20 */
  readonly pendingCheckIn = computed(() => this.ticket().virtualQueue && !this.ticket().checkedIn);

  // ─── Tiempos ─────────────────────────────────────────────────────────────
  readonly elapsedMinutes = computed(() => {
    const created = this.ticket().createdAt.getTime();
    return Math.floor((Date.now() - created) / 60_000);
  });

  /** RF-11 */
  readonly historyCount = computed(() => this.ticket().history?.length ?? 0);
}
