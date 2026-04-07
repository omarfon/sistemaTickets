import type { OperatorRole }   from '../enums/operator-role.enum';
import type { OperatorStatus } from '../enums/operator-status.enum';

// ─────────────────────────────────────────────────────────────────────────────
// RF-44: Entrada del historial de atención por operador
// ─────────────────────────────────────────────────────────────────────────────

export interface OperatorHistoryEntry {
  ticketId:        string;
  ticketNumber:    string;
  patientName:     string;
  serviceName:     string;
  windowName:      string;
  startedAt:       Date;
  finishedAt:      Date;
  durationMinutes: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// RF-48: Notificación interna
// ─────────────────────────────────────────────────────────────────────────────

export type NotificationType = 'info' | 'warning' | 'urgent';

export interface OperatorNotification {
  id:        string;
  type:      NotificationType;
  message:   string;
  createdAt: Date;
  read:      boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// RF-49: Franja de turno laboral
// ─────────────────────────────────────────────────────────────────────────────

export interface OperatorShiftSlot {
  /** 0 = domingo … 6 = sábado */
  day:       0 | 1 | 2 | 3 | 4 | 5 | 6;
  startTime: string; // "HH:mm"
  endTime:   string; // "HH:mm"
}

// ─────────────────────────────────────────────────────────────────────────────
// RF-45 / RF-50: Métricas e indicadores KPI
// ─────────────────────────────────────────────────────────────────────────────

export interface OperatorMetrics {
  operatorId:          string;
  attendedToday:       number;
  avgDurationMinutes:  number;
  breakMinutes:        number;
  /** Porcentaje de ocupación efectiva (0-100) */
  efficiency:          number;
  /** Puntuación de desempeño RF-50 (0-100) */
  score:               number;
}

// ─────────────────────────────────────────────────────────────────────────────
// RF-36: Operador del sistema
// ─────────────────────────────────────────────────────────────────────────────

export interface Operator {
  id:                string;
  /** Nombre completo */
  name:              string;
  email:             string;
  /** Contraseña en texto plano (prototipo — en producción usar hash + JWT) */
  password:          string;
  /** RF-39: Rol de acceso */
  role:              OperatorRole;
  /** RF-43: Estado operativo actual */
  status:            OperatorStatus;
  /** RF-38: Ventanilla asignada actualmente */
  assignedWindowId?: string;
  /** RF-40/41: Ticket que está atendiendo ahora */
  currentTicketId?:  string;
  /** RF-42: Razón de la pausa en curso */
  breakReason?:      string;
  /** RF-42: Momento en que inició la pausa */
  breakStartedAt?:   Date;
  /** RF-49: Franjas de turno configuradas */
  shifts:            OperatorShiftSlot[];
  /** RF-44: Historial de atenciones */
  history:           OperatorHistoryEntry[];
  /** RF-48: Notificaciones internas */
  notifications:     OperatorNotification[];
  /** Contadores acumulados de hoy */
  attendedCount:     number;
  totalBreakMinutes: number;
  /** RF-50: Puntuación de desempeño (0-100) */
  score:             number;
  createdAt:         Date;
  lastLoginAt?:      Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// DTOs
// ─────────────────────────────────────────────────────────────────────────────

export type CreateOperatorDto = Pick<
  Operator,
  'name' | 'email' | 'password' | 'role' | 'shifts'
> & { assignedWindowId?: string };

export type UpdateOperatorDto = Partial<CreateOperatorDto>;
