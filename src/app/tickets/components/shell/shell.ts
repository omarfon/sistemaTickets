import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { TicketService } from '../../services/ticket.service';

/**
 * Componente shell / layout del módulo de tickets.
 * Contiene el sidebar de navegación, la barra superior y el router-outlet.
 */
@Component({
  selector: 'app-tickets-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterOutlet, RouterLink, RouterLinkActive],
  templateUrl: './shell.html',
})
export class TicketsShellComponent {
  private readonly ticketService = inject(TicketService);

  readonly totalWaiting = this.ticketService.totalWaiting;
  readonly totalVirtual = this.ticketService.totalVirtual;
  readonly sidebarCollapsed = signal(false);

  readonly sidebarClasses = computed(() =>
    this.sidebarCollapsed()
      ? 'flex w-16 flex-shrink-0 flex-col bg-slate-900 transition-all duration-300 overflow-hidden'
      : 'flex w-60 flex-shrink-0 flex-col bg-slate-900 transition-all duration-300'
  );
}
