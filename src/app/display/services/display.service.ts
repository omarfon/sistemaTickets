import { computed, inject, Injectable, signal } from '@angular/core';
import { WindowService }                       from '../../windows/services/window.service';
import { TicketPriority }                      from '../../tickets/enums/ticket-priority.enum';
import { DisplayTheme }                        from '../enums/display-theme.enum';
import type { Window as AppWindow }            from '../../windows/models/window.model';
import type { Ticket }                         from '../../tickets/models/ticket.model';
import type {
  CallRecord,
  DisplayAnnouncement,
  DisplayConfig,
  UpdateDisplayConfigDto,
} from '../models/display.model';

/**
 * DisplayService — Módulo 4: Panel y Display
 *
 * RF-51  Panel de llamado:  activeCalls computed desde WindowService
 * RF-52  Audio:             speechSynthesis Web API
 * RF-53  Historial:         _callHistory signal (ring buffer 50)
 * RF-54  Multi-pantalla:    screenId → windowFilter por config
 * RF-55  Personalización:   clinicName, logo, theme en DisplayConfig
 * RF-56  Anuncios:          announcements[] rotativo por config
 * RF-57  Tiempo real:       computed() reactivos sobre señales de WindowService
 * RF-58  TV / Kiosk:        kioskMode + tvMode flags
 * RF-59  Multi-sucursal:    branch en DisplayConfig
 * RF-60  Prioridad visual:  priority del ticket en CallRecord → UI lo maneja
 */
@Injectable({ providedIn: 'root' })
export class DisplayService {

  private readonly windowService = inject(WindowService);

  // ─── Estado principal ────────────────────────────────────────────────────

  private readonly _configs     = signal<DisplayConfig[]>(this._buildSeedConfigs());
  private readonly _callHistory = signal<CallRecord[]>(this._buildSeedHistory());
  private _historyIdCounter     = 200;

  // ─── Señales de solo lectura ─────────────────────────────────────────────

  readonly configs     = this._configs.asReadonly();
  readonly callHistory = this._callHistory.asReadonly();

  // ─── RF-57: Computed reactivos ────────────────────────────────────────────

  /** Todos los pares ventanilla-ticket activos en este momento */
  readonly activeCalls = computed(() =>
    this.windowService.windowSummaries().filter(s => !!s.currentTicket)
  );

  readonly totalConfigs = computed(() => this._configs().length);
  readonly totalHistory = computed(() => this._callHistory().length);
  readonly totalActive  = computed(() => this.activeCalls().length);

  // ─── RF-54: Obtener config por screenId ──────────────────────────────────

  configByScreenId(screenId: string): DisplayConfig | undefined {
    return this._configs().find(c => c.screenId === screenId);
  }

  // ─── RF-53: Historial de llamados ─────────────────────────────────────────

  /** Últimos N registros del historial (más reciente primero) */
  recentCalls(count = 10): CallRecord[] {
    return this._callHistory().slice(0, count);
  }

  /**
   * Registra un nuevo llamado en el historial.
   * Llamado desde DisplayBoardComponent cuando detecta un nuevo ticket.
   */
  registerCall(win: AppWindow, ticket: Ticket, branchName = 'Sede Central'): CallRecord {
    const record: CallRecord = {
      id:           `call-${++this._historyIdCounter}`,
      ticketNumber: ticket.number,
      windowId:     win.id,
      windowName:   win.name,
      windowNumber: win.number,
      patientName:  ticket.patientName ?? 'Paciente',
      serviceName:  ticket.service.name,
      priority:     ticket.priority,
      calledAt:     new Date(),
      branch:       branchName,
    };

    // Ring buffer máx. 50 entradas
    this._callHistory.update(h => [record, ...h].slice(0, 50));

    return record;
  }

  // ─── RF-52: Anuncio de voz ────────────────────────────────────────────────

  /**
   * Pronuncia el llamado usando la Web Speech API.
   * No lanza error si el navegador no soporta la API.
   */
  announceCall(
    ticketNumber: string,
    windowName:   string,
    windowNumber: number,
    config?:      DisplayConfig,
    cancelFirst  = true,   // false en carga inicial para encolar varios turnos
  ): void {
    if (!config?.audioEnabled)        return;
    if (!('speechSynthesis' in window)) return;

    if (cancelFirst) {
      window.speechSynthesis.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(
      `Turno ${ticketNumber}, por favor acuda a ${windowName}, módulo ${windowNumber}`
    );
    utterance.lang   = 'es-PE';
    utterance.rate   = 0.85;
    utterance.pitch  = 1.05;
    utterance.volume = config?.audioVolume ?? 1;

    // Seleccionar voz personalizada si está configurada
    if (config?.audioVoice) {
      const voices = window.speechSynthesis.getVoices();
      const voice  = voices.find(v => v.name === config.audioVoice);
      if (voice) utterance.voice = voice;
    }

    window.speechSynthesis.speak(utterance);
  }

  // ─── RF-56: Gestión de anuncios ───────────────────────────────────────────

  addAnnouncement(configId: string, message: string): void {
    const ann: DisplayAnnouncement = {
      id:        `ann-${Date.now()}`,
      message,
      active:    true,
      createdAt: new Date(),
    };
    this._configs.update(list =>
      list.map(c =>
        c.id === configId
          ? { ...c, announcements: [...c.announcements, ann] }
          : c
      )
    );
  }

  removeAnnouncement(configId: string, annId: string): void {
    this._configs.update(list =>
      list.map(c =>
        c.id === configId
          ? { ...c, announcements: c.announcements.filter(a => a.id !== annId) }
          : c
      )
    );
  }

  toggleAnnouncement(configId: string, annId: string): void {
    this._configs.update(list =>
      list.map(c =>
        c.id === configId
          ? {
              ...c,
              announcements: c.announcements.map(a =>
                a.id === annId ? { ...a, active: !a.active } : a
              ),
            }
          : c
      )
    );
  }

  // ─── RF-55/59: CRUD de configuraciones ────────────────────────────────────

  /** Crea una nueva configuración de pantalla y devuelve su ID. */
  createConfig(dto: Omit<import('../models/display.model').CreateDisplayConfigDto, 'announcements'>): string {
    const newId = `disp-${Date.now()}`;
    const config: DisplayConfig = {
      ...dto,
      id:            newId,
      announcements: [],
    };
    this._configs.update(list => [...list, config]);
    return newId;
  }

  /** Devuelve el siguiente screenId disponible (número correlativo). */
  nextScreenId(): string {
    const used = this._configs().map(c => Number(c.screenId)).filter(n => !isNaN(n));
    const max  = used.length ? Math.max(...used) : 0;
    return String(max + 1);
  }

  updateConfig(id: string, dto: UpdateDisplayConfigDto): void {
    this._configs.update(list =>
      list.map(c => (c.id === id ? { ...c, ...dto } : c))
    );
  }

  deleteConfig(id: string): void {
    this._configs.update(list => list.filter(c => c.id !== id));
  }

  /** RF-54: Actualiza el filtro de ventanillas de una pantalla */
  toggleWindowFilter(configId: string, windowId: string): void {
    this._configs.update(list =>
      list.map(c => {
        if (c.id !== configId) return c;
        const has = c.windowFilter.includes(windowId);
        return {
          ...c,
          windowFilter: has
            ? c.windowFilter.filter(id => id !== windowId)
            : [...c.windowFilter, windowId],
        };
      })
    );
  }

  // ─── Seed data ────────────────────────────────────────────────────────────

  private _buildSeedConfigs(): DisplayConfig[] {
    return [
      {
        id:           'disp-1',
        name:         'Pantalla Principal — Admisión',
        screenId:     '1',
        branch:       { id: 'branch-1', name: 'Sede Central', address: 'Av. Javier Prado Este 1200, San Isidro' },
        clinicName:   'MediTurno Clínica',
        clinicLogo:   '🏥',
        theme:        DisplayTheme.Oscuro,
        showHistory:  true,
        historyCount: 6,
        announcements: [
          { id: 'ann-1', message: '⏰ Horario: Lunes a Viernes 8:00–18:00 | Sábados 8:00–13:00', active: true, createdAt: new Date() },
          { id: 'ann-2', message: '📋 Recuerde traer su DNI y documentos de seguro médico para una atención más rápida.', active: true, createdAt: new Date() },
          { id: 'ann-3', message: '🩺 Consultas de Medicina General disponibles sin cita previa. Consulte en Admisión.', active: true, createdAt: new Date() },
        ],
        windowFilter: ['win-01', 'win-02'],
        audioEnabled: true,
        audioVoice:   '',
        audioVolume:  1,
        kioskMode:    false,
        tvMode:       true,
      },
      {
        id:           'disp-2',
        name:         'Pantalla Consultorios — Piso 2',
        screenId:     '2',
        branch:       { id: 'branch-1', name: 'Sede Central', address: 'Av. Javier Prado Este 1200, San Isidro' },
        clinicName:   'MediTurno Clínica',
        clinicLogo:   '🏥',
        theme:        DisplayTheme.Clinico,
        showHistory:  true,
        historyCount: 5,
        announcements: [
          { id: 'ann-4', message: '🔇 Por respeto a todos, silencia tu celular en las salas de espera.', active: true, createdAt: new Date() },
          { id: 'ann-5', message: '💉 Campaña de vacunación disponible todos los martes. Sin cita previa.', active: true, createdAt: new Date() },
        ],
        windowFilter: ['win-03', 'win-05', 'win-06'],
        audioEnabled: true,
        audioVoice:   '',
        audioVolume:  0.8,
        kioskMode:    false,
        tvMode:       true,
      },
      {
        id:           'disp-3',
        name:         'Pantalla Farmacia — San Borja',
        screenId:     '3',
        branch:       { id: 'branch-2', name: 'Sede San Borja', address: 'Jr. Las Camelias 790, San Borja' },
        clinicName:   'MediTurno Clínica — San Borja',
        clinicLogo:   '💊',
        theme:        DisplayTheme.Claro,
        showHistory:  true,
        historyCount: 4,
        announcements: [
          { id: 'ann-6', message: '⚠️ Presente su receta médica y DNI para retirar medicamentos.', active: true, createdAt: new Date() },
        ],
        windowFilter: [],
        audioEnabled: false,
        audioVoice:   '',
        audioVolume:  1,
        kioskMode:    true,
        tvMode:       true,
      },
    ];
  }

  private _buildSeedHistory(): CallRecord[] {
    const ago = (m: number) => new Date(Date.now() - m * 60_000);
    return [
      { id: 'call-1',  ticketNumber: 'A-003', windowId: 'win-01', windowName: 'Ventanilla 1 — Caja / Pagos',            windowNumber:  1, patientName: 'Mendoza Huanca, Pedro Luis',          serviceName: 'Caja / Pagos',             priority: TicketPriority.Preferencial, calledAt: ago(12),  branch: 'Sede Central' },
      { id: 'call-2',  ticketNumber: 'A-004', windowId: 'win-02', windowName: 'Ventanilla 2 — Caja / Pagos',            windowNumber:  2, patientName: 'Pacheco Ramos, Diego Alonso',         serviceName: 'Caja / Pagos',             priority: TicketPriority.Normal,       calledAt: ago(6),   branch: 'Sede Central' },
      { id: 'call-3',  ticketNumber: 'B-002', windowId: 'win-03', windowName: 'Módulo 3 — Citas y Reservas',           windowNumber:  3, patientName: 'Sánchez Vega, Lucía Beatriz',         serviceName: 'Citas y Reservas',         priority: TicketPriority.Preferencial, calledAt: ago(9),   branch: 'Sede Central' },
      { id: 'call-4',  ticketNumber: 'T-002', windowId: 'win-06', windowName: 'Box 2 — Triaje',                         windowNumber:  6, patientName: 'Quispe Mamani, Carmen Rosa',          serviceName: 'Pre-consulta (Triaje)',    priority: TicketPriority.Normal,       calledAt: ago(14),  branch: 'Sede Central' },
      { id: 'call-5',  ticketNumber: 'T-003', windowId: 'win-05', windowName: 'Box 1 — Triaje',                         windowNumber:  5, patientName: 'Castillo Ponce, Roberto Enrique',     serviceName: 'Pre-consulta (Triaje)',    priority: TicketPriority.Preferencial, calledAt: ago(18),  branch: 'Sede Central' },
      { id: 'call-6',  ticketNumber: 'M-003', windowId: 'win-07', windowName: 'Consultorio 1 — Medicina General',       windowNumber:  7, patientName: 'Flores García, Lucía Isabel',          serviceName: 'Medicina General',         priority: TicketPriority.VIP,          calledAt: ago(22),  branch: 'Sede Central' },
      { id: 'call-7',  ticketNumber: 'P-002', windowId: 'win-09', windowName: 'Consultorio 3 — Pediatría',             windowNumber:  9, patientName: 'Apaza Condo, Elizabeth Noemí',        serviceName: 'Pediatría',               priority: TicketPriority.Preferencial, calledAt: ago(5),   branch: 'Sede Central' },
      { id: 'call-8',  ticketNumber: 'E-001', windowId: 'win-10', windowName: 'Consultorio 4 — Especialidades',         windowNumber: 10, patientName: 'Morales Ríos, Fernando Antonio',     serviceName: 'Especialidades',           priority: TicketPriority.Normal,       calledAt: ago(18),  branch: 'Sede Central' },
      { id: 'call-9',  ticketNumber: 'A-001', windowId: 'win-01', windowName: 'Ventanilla 1 — Caja / Pagos',            windowNumber:  1, patientName: 'García López, María Elena',            serviceName: 'Caja / Pagos',             priority: TicketPriority.Normal,       calledAt: ago(35),  branch: 'Sede Central' },
      { id: 'call-10', ticketNumber: 'T-001', windowId: 'win-05', windowName: 'Box 1 — Triaje',                         windowNumber:  5, patientName: 'Huáman Condori, Silvia Milagros',     serviceName: 'Pre-consulta (Triaje)',    priority: TicketPriority.Normal,       calledAt: ago(41),  branch: 'Sede Central' },
      { id: 'call-11', ticketNumber: 'M-001', windowId: 'win-07', windowName: 'Consultorio 1 — Medicina General',       windowNumber:  7, patientName: 'Díaz Vega, María Paz',               serviceName: 'Medicina General',         priority: TicketPriority.Normal,       calledAt: ago(47),  branch: 'Sede Central' },
      { id: 'call-12', ticketNumber: 'A-002', windowId: 'win-02', windowName: 'Ventanilla 2 — Caja / Pagos',            windowNumber:  2, patientName: 'Torres Quispe, Juan Manuel',           serviceName: 'Caja / Pagos',             priority: TicketPriority.Preferencial, calledAt: ago(55),  branch: 'Sede Central' },
      { id: 'call-13', ticketNumber: 'B-001', windowId: 'win-03', windowName: 'Módulo 3 — Citas y Reservas',           windowNumber:  3, patientName: 'Rodríguez Pérez, Carlos Alberto',     serviceName: 'Citas y Reservas',         priority: TicketPriority.Normal,       calledAt: ago(63),  branch: 'Sede Central' },
      { id: 'call-14', ticketNumber: 'P-001', windowId: 'win-09', windowName: 'Consultorio 3 — Pediatría',             windowNumber:  9, patientName: 'Torres Quispe, Juan Manuel (menor)',   serviceName: 'Pediatría',               priority: TicketPriority.Preferencial, calledAt: ago(30),  branch: 'Sede Central' },
      { id: 'call-15', ticketNumber: 'M-002', windowId: 'win-07', windowName: 'Consultorio 1 — Medicina General',       windowNumber:  7, patientName: 'León Pérez, César Augusto',            serviceName: 'Medicina General',         priority: TicketPriority.Normal,       calledAt: ago(68),  branch: 'Sede Central' },
    ];
  }
}
