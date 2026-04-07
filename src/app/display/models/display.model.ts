import { TicketPriority } from '../../tickets/enums/ticket-priority.enum';
import { DisplayTheme }   from '../enums/display-theme.enum';

// ─────────────────────────────────────────────────────────────────────────────
// RF-53: Historial de llamados
// ─────────────────────────────────────────────────────────────────────────────

/** Registro de un ticket llamado al display (para el historial) */
export interface CallRecord {
  id:           string;
  ticketNumber: string;
  windowId:     string;
  windowName:   string;
  windowNumber: number;
  patientName:  string;
  serviceName:  string;
  priority:     TicketPriority;
  calledAt:     Date;
  branch:       string;
}

// ─────────────────────────────────────────────────────────────────────────────
// RF-56: Mensajes informativos rotativos
// ─────────────────────────────────────────────────────────────────────────────

/** Mensaje informativo / anuncio para el ticker del display */
export interface DisplayAnnouncement {
  id:        string;
  message:   string;
  active:    boolean;
  createdAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// RF-59: Multi-sucursal
// ─────────────────────────────────────────────────────────────────────────────

/** Sede o sucursal a la que pertenece el display */
export interface DisplayBranch {
  id:      string;
  name:    string;
  address: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// RF-54/55/56/58/59: Configuración de un panel de display
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuración completa de un panel de display.
 *
 * Cada instancia puede mostrarse en una pantalla diferente
 * (RF-54 multi-pantalla) filtrando por ventanillas específicas.
 */
export interface DisplayConfig {
  /** Identificador único */
  id: string;

  /** Nombre descriptivo de la pantalla (visible en la config) */
  name: string;

  /**
   * Identificador de pantalla usado en el routing.
   * /display/pantalla/:screenId
   */
  screenId: string;

  /** RF-59: Sede asociada */
  branch: DisplayBranch;

  /** RF-55: Nombre de la clínica que aparece en pantalla */
  clinicName: string;

  /** RF-55: Emoji o texto representando el logo de la clínica */
  clinicLogo: string;

  /** RF-55: Tema visual del panel */
  theme: DisplayTheme;

  /** RF-53: Mostrar sección de historial de llamados */
  showHistory: boolean;

  /** RF-53: Cantidad máxima de llamados en el historial visible */
  historyCount: number;

  /** RF-56: Mensajes informativos rotativos del ticker inferior */
  announcements: DisplayAnnouncement[];

  /**
   * RF-54: IDs de ventanillas que muestra esta pantalla.
   * Array vacío = mostrar todas las ventanillas.
   */
  windowFilter: string[];

  /** RF-52: Habilitar anuncio de voz al llamar un ticket */
  audioEnabled: boolean;

  /** RF-52: Nombre de la voz del sintetizador de voz (vacío = voz por defecto) */
  audioVoice: string;

  /** RF-52: Volumen del audio 0–1 */
  audioVolume: number;

  /** RF-58: Modo quiosco — pantalla sin controles de navegador */
  kioskMode: boolean;

  /** RF-58: Modo TV — optimizado para pantallas horizontales grandes */
  tvMode: boolean;
}

/** DTO para crear una nueva configuración de display */
export type CreateDisplayConfigDto = Omit<DisplayConfig, 'id'>;

/** DTO para editar parcialmente una configuración de display */
export type UpdateDisplayConfigDto = Partial<CreateDisplayConfigDto>;
