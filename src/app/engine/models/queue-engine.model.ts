import { TicketPriority } from '../../tickets/enums/ticket-priority.enum';
import { QueueRuleType } from '../enums/queue-rule-type.enum';
import { SlaStatus } from '../enums/sla-status.enum';
import { DistributionStrategy } from '../enums/distribution-strategy.enum';
import { AbandonmentReason } from '../enums/abandonment-reason.enum';

// ─────────────────────────────────────────────────────────────────────────────
// RF-63 / RF-73: Reglas de atención
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Franja horaria para reglas activas por horario (RF-73).
 */
export interface TimeSlotConfig {
  /** Hora de inicio en formato HH:MM (24h), ej: "08:00" */
  startTime: string;
  /** Hora de fin en formato HH:MM (24h), ej: "12:00" */
  endTime: string;
  /** Días de la semana en los que aplica (0=Dom, 1=Lun … 6=Sáb) */
  daysOfWeek: number[];
}

/**
 * RF-63: Regla de atención que determina el orden y combinación
 * de tickets en la cola de uno o varios servicios.
 */
export interface QueueRule {
  /** Identificador único */
  id: string;
  /** Nombre descriptivo de la regla */
  name: string;
  /** Tipo de lógica de ordenamiento */
  type: QueueRuleType;
  /** Servicios a los que aplica (ids). Vacío = todos */
  serviceIds: string[];
  /** Para Interleaved: cuántos normales por cada preferencial */
  normalSlots: number;
  /** Para Interleaved: cuántos preferenciales antes del siguiente VIP */
  preferentialSlots: number;
  /** Si la regla está habilitada */
  active: boolean;
  /** Prioridad de evaluación (menor número = primero) */
  priority: number;
  /** Para TimeSlot: franja de aplicación (RF-73) */
  timeSlot?: TimeSlotConfig;
  /** Fecha de creación */
  createdAt: Date;
}

/** DTO para crear una regla */
export type CreateQueueRuleDto = Omit<QueueRule, 'id' | 'createdAt'>;

// ─────────────────────────────────────────────────────────────────────────────
// RF-64: SLA de atención
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Configuración de SLA por prioridad de ticket.
 */
export interface SlaConfig {
  /** Identificador */
  id: string;
  /** Nombre descriptivo */
  name: string;
  /** Prioridad a la que aplica */
  priority: TicketPriority;
  /** Tiempo máximo de espera en minutos */
  maxWaitMinutes: number;
  /** Porcentaje del tiempo máximo a partir del cual se emite warning */
  warningThresholdPct: number;
  /** Servicio específico. null = aplica a todos */
  serviceId: string | null;
  /** Si está activo */
  active: boolean;
}

/**
 * Evaluación del SLA de un ticket en tiempo real.
 */
export interface SlaEvaluation {
  ticketId: string;
  ticketNumber: string;
  priority: TicketPriority;
  waitMinutes: number;
  maxWaitMinutes: number;
  pctUsed: number;
  status: SlaStatus;
  /** Minutos restantes antes de breach (negativo = ya incumplido) */
  minutesRemaining: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// RF-65: Reintentos de llamado
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registro de cada intento de llamado para un ticket (RF-65).
 */
export interface CallAttempt {
  /** Ticket al que corresponde */
  ticketId: string;
  /** Número de ticket (legible) */
  ticketNumber: string;
  /** Número de intento (1-based) */
  attempt: number;
  /** Ventanilla que hizo el llamado */
  windowId: string;
  windowName: string;
  /** Momento del llamado */
  calledAt: Date;
  /** Si el paciente respondió */
  responded: boolean;
}

// ─────────────────────────────────────────────────────────────────────────────
// RF-75: Gestión de abandono
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registro de un paciente perdido / abandonado (RF-75).
 */
export interface AbandonmentRecord {
  id: string;
  ticketId: string;
  ticketNumber: string;
  patientName: string;
  serviceId: string;
  serviceName: string;
  priority: TicketPriority;
  reason: AbandonmentReason;
  /** Tiempo que estuvo en cola antes de abandonar (minutos) */
  waitMinutesBeforeAbandonment: number;
  /** Número de llamados que recibió antes de marcarle como perdido */
  callAttempts: number;
  detectedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// RF-72: Cola virtual (turnos remotos)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Registro de un turno virtual solicitado de forma remota (RF-72).
 */
export interface VirtualTicketRegistration {
  id: string;
  /** Nombre del paciente */
  patientName: string;
  /** Documento (DNI o similar) */
  documentId: string;
  /** Teléfono para notificación */
  phone: string;
  /** Servicio solicitado */
  serviceId: string;
  serviceName: string;
  /** Prioridad declarada */
  priority: TicketPriority;
  /** Ticket generado en el sistema tras confirmar llegada */
  ticketId: string | null;
  /** Número de ticket asignado */
  ticketNumber: string | null;
  /** Tiempo estimado de espera al registrarse (minutos) */
  estimatedWaitAtRegistration: number;
  /** Si ya hizo check-in presencial */
  checkedIn: boolean;
  /** Fecha de registro remoto */
  registeredAt: Date;
  /** Fecha de check-in presencial */
  checkedInAt: Date | null;
  /** Posición en la cola virtual al registrarse */
  queuePositionAtRegistration: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// RF-68: Predicción de demanda
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Punto de predicción de demanda para una franja horaria (RF-68).
 */
export interface DemandPoint {
  /** Hora en formato HH:MM */
  hour: string;
  /** Tickets esperados en esa franja */
  predicted: number;
  /** Tickets reales (si ya pasó) */
  actual: number | null;
  /** Factor de aumento respecto al promedio */
  peakFactor: number;
}

/**
 * Resultado de predicción de demanda para un día y servicio.
 */
export interface DemandPrediction {
  id: string;
  serviceId: string;
  serviceName: string;
  /** Fecha de predicción (YYYY-MM-DD) */
  date: string;
  /** Día de la semana (0=Dom…6=Sáb) */
  dayOfWeek: number;
  points: DemandPoint[];
  /** Total predicho para el día */
  totalPredicted: number;
  /** Hora pico esperada */
  peakHour: string;
  /** Recursos sugeridos (ventanillas) en hora pico */
  suggestedWindows: number;
  generatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// RF-69: Simulación de colas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Parámetros de entrada para una simulación de colas (RF-69).
 */
export interface SimulationParams {
  /** Tickets por hora estimados */
  arrivalRatePerHour: number;
  /** Tiempo medio de atención por ticket (minutos) */
  avgServiceTimeMinutes: number;
  /** Número de ventanillas activas en la simulación */
  serverCount: number;
  /** Duración de la simulación (horas) */
  durationHours: number;
  /** Distribución de prioridades: porcentajes (deben sumar 100) */
  priorityDistribution: { normal: number; preferential: number; vip: number };
  /** Regla de atención aplicada */
  rule: QueueRuleType;
}

/**
 * Resultado de un escenario de simulación (RF-69).
 */
export interface SimulationResult {
  id: string;
  name: string;
  params: SimulationParams;
  /** Tiempo promedio de espera simulado (minutos) */
  avgWaitMinutes: number;
  /** Tiempo máximo de espera simulado (minutos) */
  maxWaitMinutes: number;
  /** Utilización media del servidor (0-1) */
  serverUtilization: number;
  /** Total de tickets procesados */
  ticketsProcessed: number;
  /** Total de abandonos simulados */
  abandonments: number;
  /** Tasa de cumplimiento de SLA (0-100%) */
  slaCompliancePct: number;
  /** Puntos de la curva de cola simulada (por hora) */
  queueCurve: { hour: number; queueLength: number; waitMinutes: number }[];
  simulatedAt: Date;
}

// ─────────────────────────────────────────────────────────────────────────────
// RF-74: Auto-escalamiento
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Regla de auto-escalamiento que activa/desactiva ventanillas según demanda (RF-74).
 */
export interface AutoScaleRule {
  id: string;
  name: string;
  /** Cola mínima para abrir una nueva ventanilla */
  openWindowAtQueueLength: number;
  /** Cola máxima antes de cerrar una ventanilla ociosa */
  closeWindowAtQueueLength: number;
  /** Ventanillas mínimas siempre abiertas */
  minWindows: number;
  /** Ventanillas máximas permitidas */
  maxWindows: number;
  /** Servicios que aplican. Vacío = todos */
  serviceIds: string[];
  active: boolean;
  /** Cuánto tiempo (minutos) debe mantenerse la condición antes de actuar */
  cooldownMinutes: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// RF-71: Gestión de múltiples colas
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Definición de una línea de atención (cola lógica) que agrupa servicios (RF-71).
 */
export interface QueueLine {
  id: string;
  name: string;
  /** Descripción del flujo de esta línea */
  description: string;
  /** Servicios que pertenecen a esta línea (en orden de flujo) */
  serviceIds: string[];
  /** Regla de atención activa para esta línea */
  activeRuleId: string | null;
  /** Estrategia de distribución para esta línea */
  distributionStrategy: DistributionStrategy;
  /** Configuración SLA aplicada */
  slaConfigId: string | null;
  /** Si está activa */
  active: boolean;
  /** Color representativo en la UI */
  color: string;
  /** Ícono */
  icon: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Métricas globales del motor (RF-70: optimización en tiempo real)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Snapshot de métricas en tiempo real del motor de colas (RF-70).
 */
export interface EngineMetrics {
  /** Total de tickets en espera ahora */
  totalWaiting: number;
  /** Total en atención ahora */
  totalInService: number;
  /** Tiempo promedio de espera actual (minutos) */
  avgWaitMinutes: number;
  /** Tiempo máximo de espera actual (minutos) */
  maxWaitMinutes: number;
  /** Utilización media de ventanillas activas (0-100%) */
  serverUtilizationPct: number;
  /** SLA incumplidos activos */
  activeSlaBreaches: number;
  /** SLA en zona de warning */
  activeSlaWarnings: number;
  /** Tasa de cumplimiento SLA en las últimas 24h (%) */
  slaComplianceLast24h: number;
  /** Tickets abandonados en las últimas 24h */
  abandonmentsLast24h: number;
  /** Tasa de abandono (%) */
  abandonmentRatePct: number;
  /** Ventanillas activas ahora */
  activeWindows: number;
  /** Tickets virtuales pendientes de check-in */
  pendingVirtualTickets: number;
  /** Reintentos de llamado pendientes */
  pendingCallRetries: number;
  /** Timestamp del snapshot */
  snapshotAt: Date;
}
