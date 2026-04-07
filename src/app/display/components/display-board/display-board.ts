import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  OnDestroy,
  signal,
} from '@angular/core';
import { DatePipe }        from '@angular/common';
import { ActivatedRoute }  from '@angular/router';
import { DisplayService }  from '../../services/display.service';
import { WindowService }   from '../../../windows/services/window.service';
import { TicketPriority }  from '../../../tickets/enums/ticket-priority.enum';
import {
  DisplayTheme,
  DISPLAY_THEME_BG,
  DISPLAY_THEME_CARD,
  DISPLAY_THEME_HEADER,
  DISPLAY_THEME_TICKER,
} from '../../enums/display-theme.enum';
import type { DisplayConfig } from '../../models/display.model';

/**
 * DisplayBoardComponent — Panel de llamado de TV / Kiosko
 *
 * RF-51  Visualización de tickets en pantalla grande
 * RF-52  Anuncio de voz al llamar un ticket
 * RF-53  Historial de últimos llamados
 * RF-54  Soporte multi-pantalla (filtro por ventanilla)
 * RF-57  Actualización en tiempo real (computed sobre signals)
 * RF-58  Modo TV / Kiosko (pantalla completa)
 * RF-60  Priorización visual (VIP = rojo + pulso / Preferencial = ámbar)
 *
 * Este componente se monta SIN shell (pantalla completa para TV).
 * Ruta: /display/pantalla/:screenId
 */
@Component({
  selector:        'app-display-board',
  standalone:      true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl:     './display-board.html',
  imports:         [DatePipe],
})
export class DisplayBoardComponent implements OnDestroy {

  private readonly route          = inject(ActivatedRoute);
  private readonly displayService = inject(DisplayService);
  private readonly windowService  = inject(WindowService);

  // ─── Enums y mapas expuestos al template ─────────────────────────────────

  readonly TicketPriority = TicketPriority;
  readonly DisplayTheme   = DisplayTheme;
  readonly ThemeBg        = DISPLAY_THEME_BG;
  readonly ThemeCard      = DISPLAY_THEME_CARD;
  readonly ThemeHeader    = DISPLAY_THEME_HEADER;
  readonly ThemeTicker    = DISPLAY_THEME_TICKER;

  // ─── Estado ───────────────────────────────────────────────────────────────

  readonly screenId = signal(this.route.snapshot.paramMap.get('screenId') ?? '1');
  readonly now      = signal(new Date());

  // ─── RF-55: Config de esta pantalla ──────────────────────────────────────

  readonly config = computed<DisplayConfig | undefined>(
    () => this.displayService.configByScreenId(this.screenId())
  );

  // ─── RF-51/57: Llamados activos filtrados por config ─────────────────────

  readonly activeSummaries = computed(() => {
    const cfg = this.config();
    const all = this.windowService.windowSummaries().filter(s => !!s.currentTicket);
    if (!cfg || cfg.windowFilter.length === 0) return all;
    return all.filter(s => cfg.windowFilter.includes(s.window.id));
  });

  // ─── RF-53: Historial ────────────────────────────────────────────────────

  readonly callHistory = computed(() => {
    const cfg   = this.config();
    const count = cfg?.historyCount ?? 6;
    return this.displayService.recentCalls(count);
  });

  // ─── RF-56: Anuncios rotativos ───────────────────────────────────────────

  readonly tickerIndex = signal(0);

  readonly activeAnnouncements = computed(() => {
    const cfg = this.config();
    return cfg ? cfg.announcements.filter(a => a.active) : [];
  });

  readonly currentAnnouncement = computed(() => {
    const anns = this.activeAnnouncements();
    if (!anns.length) return null;
    return anns[this.tickerIndex() % anns.length];
  });

  // ─── RF-52: Seguimiento de cambios para detección de nuevos tickets ───────

  private readonly _prevTicketIds = new Map<string, string>(); // windowId → ticketId
  private _firstRender = true; // primer ciclo: solo poblar el mapa, no anunciar
  private readonly _clockInterval:  ReturnType<typeof setInterval>;
  private readonly _tickerInterval: ReturnType<typeof setInterval>;

  constructor() {
    // Reloj cada segundo
    this._clockInterval = setInterval(() => this.now.set(new Date()), 1_000);

    // Rotar anuncios cada 8 segundos (RF-56)
    this._tickerInterval = setInterval(() => {
      const anns = this.activeAnnouncements();
      if (anns.length > 1) {
        this.tickerIndex.update(i => (i + 1) % anns.length);
      }
    }, 8_000);

    // RF-52/53: Detectar nuevos tickets y registrar + anunciar por voz
    effect(() => {
      const summaries = this.activeSummaries();
      const cfg       = this.config();

      summaries.forEach(s => {
        const tid  = s.currentTicket?.id;
        const prev = this._prevTicketIds.get(s.window.id);

        if (tid && tid !== prev) {
          this._prevTicketIds.set(s.window.id, tid);

          // En el primer render solo se registra el historial,
          // NO se anuncia por voz (evitar que suenen todos los turnos al abrir)
          if (!this._firstRender && s.currentTicket) {
            const record = this.displayService.registerCall(
              s.window,
              s.currentTicket,
              cfg?.branch.name ?? 'Sede Central',
            );
            // RF-52: anuncio de voz solo para tickets NUEVOS
            this.displayService.announceCall(
              record.ticketNumber,
              record.windowName,
              record.windowNumber,
              cfg,
            );
          }
        }
      });

      // Limpiar ventanillas que ya no tienen ticket activo
      this._prevTicketIds.forEach((_, winId) => {
        if (!summaries.find(s => s.window.id === winId && s.currentTicket)) {
          this._prevTicketIds.delete(winId);
        }
      });

      // Marcar que el primer ciclo ya pasó
      this._firstRender = false;
    });
  }

  ngOnDestroy(): void {
    clearInterval(this._clockInterval);
    clearInterval(this._tickerInterval);
    if ('speechSynthesis' in window) window.speechSynthesis.cancel();
  }

  // ─── RF-60: Helpers de prioridad ─────────────────────────────────────────

  priorityCardClass(priority: TicketPriority): string {
    switch (priority) {
      case TicketPriority.VIP:          return 'ring-2 ring-red-500 bg-red-950/40';
      case TicketPriority.Preferencial: return 'ring-2 ring-amber-400 bg-amber-950/20';
      default:                          return '';
    }
  }

  priorityTicketClass(priority: TicketPriority): string {
    switch (priority) {
      case TicketPriority.VIP:          return 'text-red-400 animate-pulse';
      case TicketPriority.Preferencial: return 'text-amber-400';
      default:                          return 'text-white';
    }
  }

  priorityBadgeClass(priority: TicketPriority): string {
    switch (priority) {
      case TicketPriority.VIP:          return 'bg-red-600 text-white animate-pulse';
      case TicketPriority.Preferencial: return 'bg-amber-500 text-white';
      default:                          return 'bg-blue-600 text-white';
    }
  }

  priorityLabel(priority: TicketPriority): string {
    switch (priority) {
      case TicketPriority.VIP:          return '🔴 URGENTE';
      case TicketPriority.Preferencial: return '🟡 PREFERENTE';
      default:                          return '🔵 GENERAL';
    }
  }

  historyDotClass(priority: TicketPriority): string {
    switch (priority) {
      case TicketPriority.VIP:          return 'bg-red-500';
      case TicketPriority.Preferencial: return 'bg-amber-400';
      default:                          return 'bg-blue-400';
    }
  }
}
