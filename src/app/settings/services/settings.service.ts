import { computed, Injectable, signal } from '@angular/core';
import { ServiceType } from '../../tickets/models/service-type.model';

/**
 * Servicio centralizado de configuración del sistema.
 *
 * Permite editar:
 * - Prefijos/letras de servicios
 * - Nombres y descripciones de servicios
 * - Tiempos de atención promedio
 * - Capacidades de ventanillas
 * - Otros parámetros del sistema
 */
@Injectable({ providedIn: 'root' })
export class SettingsService {
  // ─── Servicios editables ─────────────────────────────────────────────────

  private readonly _services = signal<ServiceType[]>([
    // ── PASO 1: ADMISIÓN ────────────────────────────────────────────────────
    {
      id: 'svc-admision-caja',
      name: 'Caja / Pagos',
      prefix: 'A',
      description: 'Pago de servicios, copagos y tarifas de consulta',
      avgAttentionTimeMinutes: 5,
      isActive: true,
      windowCount: 3,
      step: 1,
      icon: '💳',
      windowLabel: 'Ventanilla',
    },
    {
      id: 'svc-admision-citas',
      name: 'Citas y Reservas',
      prefix: 'B',
      description: 'Reserva, confirmación y modificación de citas médicas',
      avgAttentionTimeMinutes: 8,
      isActive: true,
      windowCount: 2,
      step: 1,
      icon: '📅',
      windowLabel: 'Módulo',
    },
    {
      id: 'svc-admision-info',
      name: 'Información General',
      prefix: 'C',
      description: 'Orientación, trámites administrativos y documentación',
      avgAttentionTimeMinutes: 4,
      isActive: true,
      windowCount: 1,
      step: 1,
      icon: 'ℹ️',
      windowLabel: 'Módulo',
    },
    {
      id: 'svc-triaje',
      name: 'Pre-consulta (Triaje)',
      prefix: 'T',
      description: 'Evaluación de signos vitales y clasificación de urgencia',
      avgAttentionTimeMinutes: 10,
      isActive: true,
      windowCount: 3,
      step: 2,
      icon: '🩺',
      windowLabel: 'Consultorio',
    },
    {
      id: 'svc-medicina',
      name: 'Medicina General',
      prefix: 'M',
      description: 'Consulta con médico general',
      avgAttentionTimeMinutes: 20,
      isActive: true,
      windowCount: 2,
      step: 3,
      icon: '👨‍⚕️',
      windowLabel: 'Consultorio',
    },
    {
      id: 'svc-pediatria',
      name: 'Pediatría',
      prefix: 'P',
      description: 'Consulta pediátrica',
      avgAttentionTimeMinutes: 20,
      isActive: true,
      windowCount: 1,
      step: 3,
      icon: '👶',
      windowLabel: 'Consultorio',
    },
    {
      id: 'svc-especialidades',
      name: 'Especialidades',
      prefix: 'E',
      description: 'Consulta con especialistas diversos',
      avgAttentionTimeMinutes: 25,
      isActive: true,
      windowCount: 1,
      step: 3,
      icon: '🏥',
      windowLabel: 'Consultorio',
    },
  ]);

  readonly services = this._services.asReadonly();

  // ─── Configuración global ────────────────────────────────────────────────

  private readonly _clinicName = signal('MediTurno Clínica');
  private readonly _autoCheckInEnabled = signal(true);
  private readonly _printingEnabled = signal(true);

  readonly clinicName = this._clinicName.asReadonly();
  readonly autoCheckInEnabled = this._autoCheckInEnabled.asReadonly();
  readonly printingEnabled = this._printingEnabled.asReadonly();

  // ─── Configuración de tickets ────────────────────────────────────────────

  private readonly _ticketSettings = signal({
    maxPerDay: 999,
    resetDaily: true,
    allowWalkIn: true,
    requirePatientData: false,
    priorityEnabled: true,
  });

  readonly ticketSettings = this._ticketSettings.asReadonly();

  // ─── Métodos de edición de servicios ────────────────────────────────────

  /** Actualiza un servicio completo */
  updateService(id: string, patch: Partial<ServiceType>): void {
    this._services.update(list =>
      list.map(s => (s.id === id ? { ...s, ...patch } : s))
    );
  }

  /** Cambia el prefijo de un servicio */
  updateServicePrefix(id: string, newPrefix: string): void {
    this.updateService(id, { prefix: newPrefix.toUpperCase() });
  }

  /** Activa o desactiva un servicio */
  toggleServiceActive(id: string): void {
    const service = this._services().find(s => s.id === id);
    if (service) {
      this.updateService(id, { isActive: !service.isActive });
    }
  }

  /** Obtiene un servicio por ID */
  getService(id: string): ServiceType | undefined {
    return this._services().find(s => s.id === id);
  }

  /** Agrega un nuevo servicio */
  addService(service: ServiceType): void {
    this._services.update(list => [...list, service]);
  }

  /** Elimina un servicio por ID */
  deleteService(id: string): void {
    this._services.update(list => list.filter(s => s.id !== id));
  }

  // ─── Métodos de configuración global ────────────────────────────────────

  updateClinicName(name: string): void {
    this._clinicName.set(name.trim());
  }

  toggleAutoCheckIn(): void {
    this._autoCheckInEnabled.update(v => !v);
  }

  togglePrinting(): void {
    this._printingEnabled.update(v => !v);
  }

  /** Actualiza la configuración de creación de tickets */
  updateTicketSettings(patch: Partial<{
    maxPerDay: number;
    resetDaily: boolean;
    allowWalkIn: boolean;
    requirePatientData: boolean;
    priorityEnabled: boolean;
  }>): void {
    this._ticketSettings.update(s => ({ ...s, ...patch }));
  }

  // ─── Exportar/Importar configuración ────────────────────────────────────

  exportConfiguration(): string {
    const config = {
      version: '1.0',
      exportedAt: new Date().toISOString(),
      clinicName: this._clinicName(),
      autoCheckInEnabled: this._autoCheckInEnabled(),
      printingEnabled: this._printingEnabled(),
      ticketSettings: this._ticketSettings(),
      services: this._services(),
    };
    return JSON.stringify(config, null, 2);
  }

  importConfiguration(jsonString: string): boolean {
    try {
      const config = JSON.parse(jsonString);
      if (config.version === '1.0' && config.services) {
        this._clinicName.set(config.clinicName || 'MediTurno Clínica');
        this._autoCheckInEnabled.set(config.autoCheckInEnabled ?? true);
        this._printingEnabled.set(config.printingEnabled ?? true);
        if (config.ticketSettings) {
          this._ticketSettings.set(config.ticketSettings);
        }
        this._services.set(config.services);
        return true;
      }
      return false;
    } catch (e) {
      console.error('Error importing configuration:', e);
      return false;
    }
  }

  resetToDefaults(): void {
    this._clinicName.set('MediTurno Clínica');
    this._autoCheckInEnabled.set(true);
    this._printingEnabled.set(true);
    this._ticketSettings.set({
      maxPerDay: 999,
      resetDaily: true,
      allowWalkIn: true,
      requirePatientData: false,
      priorityEnabled: true,
    });
    // Services se reinician directamente en el signal
    this._services.set([
      {
        id: 'svc-admision-caja',
        name: 'Caja / Pagos',
        prefix: 'A',
        description: 'Pago de servicios, copagos y tarifas de consulta',
        avgAttentionTimeMinutes: 5,
        isActive: true,
        windowCount: 3,
        step: 1,
        icon: '💳',
        windowLabel: 'Ventanilla',
      },
      {
        id: 'svc-admision-citas',
        name: 'Citas y Reservas',
        prefix: 'B',
        description: 'Reserva, confirmación y modificación de citas médicas',
        avgAttentionTimeMinutes: 8,
        isActive: true,
        windowCount: 2,
        step: 1,
        icon: '📅',
        windowLabel: 'Módulo',
      },
      {
        id: 'svc-admision-info',
        name: 'Información General',
        prefix: 'C',
        description: 'Orientación, trámites administrativos y documentación',
        avgAttentionTimeMinutes: 4,
        isActive: true,
        windowCount: 1,
        step: 1,
        icon: 'ℹ️',
        windowLabel: 'Módulo',
      },
      {
        id: 'svc-triaje',
        name: 'Pre-consulta (Triaje)',
        prefix: 'T',
        description: 'Evaluación de signos vitales y clasificación de urgencia',
        avgAttentionTimeMinutes: 10,
        isActive: true,
        windowCount: 3,
        step: 2,
        icon: '🩺',
        windowLabel: 'Consultorio',
      },
      {
        id: 'svc-medicina',
        name: 'Medicina General',
        prefix: 'M',
        description: 'Consulta con médico general',
        avgAttentionTimeMinutes: 20,
        isActive: true,
        windowCount: 2,
        step: 3,
        icon: '👨‍⚕️',
        windowLabel: 'Consultorio',
      },
      {
        id: 'svc-pediatria',
        name: 'Pediatría',
        prefix: 'P',
        description: 'Consulta pediátrica',
        avgAttentionTimeMinutes: 20,
        isActive: true,
        windowCount: 1,
        step: 3,
        icon: '👶',
        windowLabel: 'Consultorio',
      },
      {
        id: 'svc-especialidades',
        name: 'Especialidades',
        prefix: 'E',
        description: 'Consulta con especialistas diversos',
        avgAttentionTimeMinutes: 25,
        isActive: true,
        windowCount: 1,
        step: 3,
        icon: '🏥',
        windowLabel: 'Consultorio',
      },
    ]);
  }
}
