import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { RouterLink }     from '@angular/router';
import { DatePipe }       from '@angular/common';
import { DisplayService } from '../../services/display.service';
import { WindowService }  from '../../../windows/services/window.service';
import {
  DisplayTheme,
  DISPLAY_THEME_LABELS,
} from '../../enums/display-theme.enum';
import type { DisplayConfig } from '../../models/display.model';

/**
 * DisplayConfigComponent — Panel de configuración de pantallas
 *
 * RF-55  Personalización: nombre, logo, tema
 * RF-56  Mensajes informativos / anuncios rotativos
 * RF-58  Opciones de modo TV / Kiosko
 * RF-59  Asignación de sede (branch)
 * RF-54  Filtro de ventanillas por pantalla
 * RF-52  Configuración de audio
 */
@Component({
  selector:        'app-display-config',
  standalone:      true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl:     './display-config.html',
  imports:         [DatePipe],
})
export class DisplayConfigComponent {

  private readonly displayService = inject(DisplayService);
  private readonly windowService  = inject(WindowService);

  // ─── Enums expuestos al template ─────────────────────────────────────────

  readonly DisplayTheme       = DisplayTheme;
  readonly DisplayThemeLabels = DISPLAY_THEME_LABELS;
  readonly themeOptions       = Object.values(DisplayTheme);

  // ─── Estado de lectura ───────────────────────────────────────────────────

  readonly configs         = this.displayService.configs;
  readonly windows         = computed(() => this.windowService.windows());
  readonly activeCallCount = this.displayService.totalActive;
  readonly historyCount    = this.displayService.totalHistory;
  readonly totalConfigs    = this.displayService.totalConfigs;

  // ─── Config seleccionada para editar ─────────────────────────────────────

  readonly selectedConfigId = signal<string | null>(null);

  readonly selectedConfig = computed<DisplayConfig | null>(() => {
    const id = this.selectedConfigId();
    return id ? (this.displayService.configs().find(c => c.id === id) ?? null) : null;
  });

  // ─── Modo: formulario de nueva pantalla ──────────────────────────────────

  readonly showNewForm = signal(false);

  // Campos del formulario de creación
  newName        = signal('');
  newScreenId    = signal('');
  newClinicName  = signal('MediTurno Clínica');
  newClinicLogo  = signal('🏥');
  newTheme       = signal<DisplayTheme>(DisplayTheme.Oscuro);
  newBranchName  = signal('Sede Central');
  newBranchAddr  = signal('');
  newAudio       = signal(true);
  newTvMode      = signal(true);
  newKioskMode   = signal(false);
  newFormError   = signal('');

  /** Lista de sedes reutilizables (de los configs existentes) */
  readonly knownBranches = computed(() => {
    const seen = new Map<string, { name: string; address: string }>();
    for (const c of this.displayService.configs()) {
      if (!seen.has(c.branch.id)) {
        seen.set(c.branch.id, { name: c.branch.name, address: c.branch.address });
      }
    }
    return [...seen.values()];
  });

  openNewForm(): void {
    this.selectedConfigId.set(null);
    this.newName.set('');
    this.newScreenId.set(this.displayService.nextScreenId());
    this.newClinicName.set('MediTurno Clínica');
    this.newClinicLogo.set('🏥');
    this.newTheme.set(DisplayTheme.Oscuro);
    this.newBranchName.set('Sede Central');
    this.newBranchAddr.set('');
    this.newAudio.set(true);
    this.newTvMode.set(true);
    this.newKioskMode.set(false);
    this.newFormError.set('');
    this.showNewForm.set(true);
  }

  closeNewForm(): void {
    this.showNewForm.set(false);
  }

  useBranch(b: { name: string; address: string }): void {
    this.newBranchName.set(b.name);
    this.newBranchAddr.set(b.address);
  }

  submitNewConfig(): void {
    const name     = this.newName().trim();
    const screenId = this.newScreenId().trim();

    if (!name)     { this.newFormError.set('El nombre de la pantalla es obligatorio.'); return; }
    if (!screenId) { this.newFormError.set('El ID de pantalla es obligatorio.'); return; }

    const duplicate = this.displayService.configs().some(c => c.screenId === screenId);
    if (duplicate) { this.newFormError.set(`Ya existe una pantalla con el ID "${screenId}".`); return; }

    const newId = this.displayService.createConfig({
      name,
      screenId,
      clinicName:   this.newClinicName(),
      clinicLogo:   this.newClinicLogo(),
      theme:        this.newTheme(),
      branch: {
        id:      `branch-${Date.now()}`,
        name:    this.newBranchName() || 'Sede Central',
        address: this.newBranchAddr(),
      },
      showHistory:  true,
      historyCount: 6,
      windowFilter: [],
      audioEnabled: this.newAudio(),
      audioVoice:   '',
      audioVolume:  1,
      kioskMode:    this.newKioskMode(),
      tvMode:       this.newTvMode(),
    });

    this.showNewForm.set(false);
    // Abrir directamente el editor de la pantalla recién creada
    this.selectConfig(newId);
  }

  // ─── Campos del formulario de edición ────────────────────────────────────

  editClinicName   = signal('');
  editClinicLogo   = signal('');
  editTheme        = signal<DisplayTheme>(DisplayTheme.Oscuro);
  editShowHistory  = signal(true);
  editHistoryCount = signal(6);
  editAudioEnabled = signal(true);
  editAudioVolume  = signal(1);
  editKioskMode    = signal(false);
  editTvMode       = signal(true);

  // Nuevo anuncio
  newAnnouncementMsg = signal('');

  // Feedback de guardado
  saved    = signal(false);
  tabIndex = signal(0); // 0=Config, 1=Anuncios, 2=Ventanillas

  // ─── Métodos de selección ────────────────────────────────────────────────

  selectConfig(id: string): void {
    this.selectedConfigId.set(id);
    const cfg = this.displayService.configs().find(c => c.id === id);
    if (!cfg) return;

    this.editClinicName.set(cfg.clinicName);
    this.editClinicLogo.set(cfg.clinicLogo);
    this.editTheme.set(cfg.theme);
    this.editShowHistory.set(cfg.showHistory);
    this.editHistoryCount.set(cfg.historyCount);
    this.editAudioEnabled.set(cfg.audioEnabled);
    this.editAudioVolume.set(cfg.audioVolume);
    this.editKioskMode.set(cfg.kioskMode);
    this.editTvMode.set(cfg.tvMode);
    this.saved.set(false);
    this.tabIndex.set(0);
  }

  closeEditor(): void {
    this.selectedConfigId.set(null);
  }

  // ─── Guardar cambios de config ────────────────────────────────────────────

  saveConfig(): void {
    const id = this.selectedConfigId();
    if (!id) return;

    this.displayService.updateConfig(id, {
      clinicName:   this.editClinicName(),
      clinicLogo:   this.editClinicLogo(),
      theme:        this.editTheme(),
      showHistory:  this.editShowHistory(),
      historyCount: this.editHistoryCount(),
      audioEnabled: this.editAudioEnabled(),
      audioVolume:  this.editAudioVolume(),
      kioskMode:    this.editKioskMode(),
      tvMode:       this.editTvMode(),
    });

    this.saved.set(true);
    setTimeout(() => this.saved.set(false), 2_500);
  }

  // ─── RF-56: Gestión de anuncios ──────────────────────────────────────────

  addAnnouncement(): void {
    const id  = this.selectedConfigId();
    const msg = this.newAnnouncementMsg().trim();
    if (!id || !msg) return;
    this.displayService.addAnnouncement(id, msg);
    this.newAnnouncementMsg.set('');
  }

  removeAnnouncement(annId: string): void {
    const id = this.selectedConfigId();
    if (!id) return;
    this.displayService.removeAnnouncement(id, annId);
  }

  toggleAnnouncement(annId: string): void {
    const id = this.selectedConfigId();
    if (!id) return;
    this.displayService.toggleAnnouncement(id, annId);
  }

  // ─── RF-54: Filtro de ventanillas ────────────────────────────────────────

  toggleWindowFilter(windowId: string): void {
    const id = this.selectedConfigId();
    if (!id) return;
    this.displayService.toggleWindowFilter(id, windowId);
  }

  isWindowInFilter(cfg: DisplayConfig, windowId: string): boolean {
    return cfg.windowFilter.length === 0 || cfg.windowFilter.includes(windowId);
  }

  isWindowSelected(windowId: string): boolean {
    const cfg = this.selectedConfig();
    if (!cfg) return false;
    return cfg.windowFilter.includes(windowId);
  }

  // ─── Abrir pantalla en nueva pestaña ─────────────────────────────────────

  openDisplay(screenId: string): void {
    window.open(`/display/pantalla/${screenId}`, '_blank', 'noopener,noreferrer');
  }

  // ─── Eliminar config ─────────────────────────────────────────────────────

  deleteConfig(id: string): void {
    if (!confirm('¿Eliminar esta configuración de pantalla? Esta acción no se puede deshacer.')) return;
    this.displayService.deleteConfig(id);
    if (this.selectedConfigId() === id) this.selectedConfigId.set(null);
  }

  // ─── Helpers de tema ─────────────────────────────────────────────────────

  themeLabel(theme: DisplayTheme): string {
    return DISPLAY_THEME_LABELS[theme];
  }

  themePillClass(theme: DisplayTheme, selected: boolean): string {
    if (!selected) return 'border border-gray-300 bg-white text-gray-600 hover:bg-gray-50';
    switch (theme) {
      case DisplayTheme.Oscuro:  return 'border border-gray-800 bg-gray-900 text-white';
      case DisplayTheme.Clinico: return 'border border-blue-700 bg-blue-900 text-white';
      default:                   return 'border border-blue-500 bg-blue-600 text-white';
    }
  }
}
