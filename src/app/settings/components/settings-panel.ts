import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { SettingsService } from '../services/settings.service';
import type { ServiceType } from '../../tickets/models/service-type.model';

/**
 * Panel de configuración del sistema.
 * Permite editar servicios, prefijos, tiempos de atención y configuración global.
 */
@Component({
  selector: 'app-settings-panel',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './settings-panel.html',
})
export class SettingsPanelComponent {
  private readonly settingsService = inject(SettingsService);

  readonly services = this.settingsService.services;
  readonly clinicName = this.settingsService.clinicName;
  readonly autoCheckInEnabled = this.settingsService.autoCheckInEnabled;
  readonly printingEnabled = this.settingsService.printingEnabled;
  readonly ticketSettings = this.settingsService.ticketSettings;

  // ─── Estado local ────────────────────────────────────────────────────

  readonly editingServiceId = signal<string | null>(null);
  readonly message = signal<{ text: string; ok: boolean } | null>(null);
  readonly showExportImport = signal(false);
  readonly showAddService = signal(false);
  readonly editingTicketSettings = signal(false);
  readonly importJson = signal('');

  newClinicName = '';

  // ─── Nuevo servicio ──────────────────────────────────────────────────

  newServiceName = '';
  newServicePrefix = '';
  newServiceTime = 15;
  newServiceWindowCount = 1;
  newServiceStep: 1 | 2 | 3 = 1;
  newServiceIcon = '🏥';
  newServiceWindowLabel = 'Ventanilla';

  // ─── Edición de configuración de tickets ──────────────────────────────────

  editMaxPerDay = 999;
  editResetDaily = true;
  editAllowWalkIn = true;
  editRequirePatientData = false;
  editPriorityEnabled = true;

  // ─── Métodos de edición ──────────────────────────────────────────────────

  startEditService(id: string): void {
    this.editingServiceId.set(id);
  }

  cancelEdit(): void {
    this.editingServiceId.set(null);
  }

  updateServiceField(id: string, field: keyof ServiceType, value: any): void {
    this.settingsService.updateService(id, { [field]: value } as Partial<ServiceType>);
  }

  toggleServiceActive(id: string): void {
    this.settingsService.toggleServiceActive(id);
    this._msg('✅ Servicio actualizado', true);
  }

  updateClinicName(): void {
    if (this.newClinicName.trim()) {
      this.settingsService.updateClinicName(this.newClinicName);
      this.newClinicName = '';
      this._msg('✅ Nombre de clínica actualizado', true);
    }
  }

  toggleAutoCheckIn(): void {
    this.settingsService.toggleAutoCheckIn();
    this._msg('✅ Auto check-in ' + (this.autoCheckInEnabled() ? 'habilitado' : 'deshabilitado'), true);
  }

  togglePrinting(): void {
    this.settingsService.togglePrinting();
    this._msg('✅ Impresión ' + (this.printingEnabled() ? 'habilitada' : 'deshabilitada'), true);
  }

  // ─── Gestión de servicios ─────────────────────────────────────────────────

  addNewService(): void {
    if (!this.newServiceName.trim()) {
      this._msg('❌ El nombre del servicio no puede estar vacío', false);
      return;
    }
    if (!this.newServicePrefix.trim()) {
      this._msg('❌ El prefijo no puede estar vacío', false);
      return;
    }

    const newService: ServiceType = {
      id: `svc-custom-${Date.now()}`,
      name: this.newServiceName.trim(),
      prefix: this.newServicePrefix.trim().toUpperCase(),
      description: '',
      avgAttentionTimeMinutes: this.newServiceTime,
      isActive: true,
      windowCount: this.newServiceWindowCount,
      step: this.newServiceStep,
      icon: this.newServiceIcon || '🏥',
      windowLabel: this.newServiceWindowLabel || 'Ventanilla',
    };

    this.settingsService.addService(newService);
    this.newServiceName = '';
    this.newServicePrefix = '';
    this.newServiceTime = 15;
    this.newServiceWindowCount = 1;
    this.newServiceStep = 1;
    this.showAddService.set(false);
    this._msg('✅ Servicio creado exitosamente', true);
  }

  deleteService(id: string, name: string): void {
    if (confirm(`¿Eliminar el servicio "${name}"? Esta acción no se puede deshacer.`)) {
      this.settingsService.deleteService(id);
      this._msg('✅ Servicio eliminado', true);
    }
  }

  // ─── Configuración de tickets ─────────────────────────────────────────────

  openTicketSettingsEdit(): void {
    const s = this.ticketSettings();
    this.editMaxPerDay = s.maxPerDay;
    this.editResetDaily = s.resetDaily;
    this.editAllowWalkIn = s.allowWalkIn;
    this.editRequirePatientData = s.requirePatientData;
    this.editPriorityEnabled = s.priorityEnabled;
    this.editingTicketSettings.set(true);
  }

  saveTicketSettings(): void {
    if (this.editMaxPerDay < 1) {
      this._msg('❌ El máximo de tickets debe ser mayor a 0', false);
      return;
    }
    this.settingsService.updateTicketSettings({
      maxPerDay: this.editMaxPerDay,
      resetDaily: this.editResetDaily,
      allowWalkIn: this.editAllowWalkIn,
      requirePatientData: this.editRequirePatientData,
      priorityEnabled: this.editPriorityEnabled,
    });
    this.editingTicketSettings.set(false);
    this._msg('✅ Configuración de tickets guardada', true);
  }

  cancelTicketSettingsEdit(): void {
    this.editingTicketSettings.set(false);
  }

  // ─── Exportar/Importar ───────────────────────────────────────────────────

  exportConfig(): void {
    const json = this.settingsService.exportConfiguration();
    const blob = new Blob([json], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mediturno-config-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    window.URL.revokeObjectURL(url);
    this._msg('✅ Configuración exportada', true);
  }

  importConfig(): void {
    if (!this.importJson().trim()) {
      this._msg('Por favor, pega la configuración en JSON', false);
      return;
    }
    if (this.settingsService.importConfiguration(this.importJson())) {
      this.importJson.set('');
      this.showExportImport.set(false);
      this._msg('✅ Configuración importada exitosamente', true);
    } else {
      this._msg('❌ Error al importar: JSON inválido', false);
    }
  }

  resetToDefaults(): void {
    if (confirm('¿Restaurar configuración predeterminada? Esta acción no se puede deshacer.')) {
      this.settingsService.resetToDefaults();
      this._msg('✅ Configuración restaurada', true);
    }
  }

  private _msg(text: string, ok: boolean): void {
    this.message.set({ text, ok });
    setTimeout(() => this.message.set(null), 4000);
  }
}
