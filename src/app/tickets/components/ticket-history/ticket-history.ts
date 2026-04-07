import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import type { TicketHistoryEntry } from '../../models/ticket.model';
import {
  TICKET_EVENT_COLOR,
  TICKET_EVENT_ICON,
  TICKET_EVENT_LABELS,
} from '../../enums/ticket-event.enum';

/**
 * RF-11: Muestra el historial completo del ciclo de vida de un ticket
 * en forma de línea de tiempo vertical.
 */
@Component({
  selector: 'app-ticket-history',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './ticket-history.html',
})
export class TicketHistoryComponent {
  readonly history = input.required<TicketHistoryEntry[]>();

  readonly eventLabels = TICKET_EVENT_LABELS;
  readonly eventIcons = TICKET_EVENT_ICON;
  readonly eventColors = TICKET_EVENT_COLOR;

  formatDateTime(date: Date): string {
    return new Date(date).toLocaleString('es-ES', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  }
}
