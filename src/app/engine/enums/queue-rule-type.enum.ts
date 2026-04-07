/**
 * RF-63: Tipos de reglas de atención del motor de colas.
 * Define la lógica de ordenamiento y combinación de prioridades.
 */
export enum QueueRuleType {
  /** RF-61: Atención estrictamente por orden de llegada */
  FIFO = 'FIFO',

  /** RF-62: Atención por peso de prioridad (VIP > Preferencial > Normal) */
  PriorityFirst = 'PRIORITY_FIRST',

  /**
   * RF-63: Regla mixta — combina N normales por cada M preferenciales/VIP.
   * Ej: 2 Normales → 1 Preferencial → 2 Normales → 1 VIP
   */
  Interleaved = 'INTERLEAVED',

  /** RF-66: El operador puede llamar a cualquier ticket manualmente (override) */
  ManualOverride = 'MANUAL_OVERRIDE',

  /** RF-73: Regla activa solo en una franja horaria determinada */
  TimeSlot = 'TIME_SLOT',
}

/** Etiquetas para la UI */
export const QUEUE_RULE_LABELS: Record<QueueRuleType, string> = {
  [QueueRuleType.FIFO]:           'FIFO — Primero en llegar',
  [QueueRuleType.PriorityFirst]:  'Prioridad dinámica',
  [QueueRuleType.Interleaved]:    'Regla mixta (N+M)',
  [QueueRuleType.ManualOverride]: 'Salto manual',
  [QueueRuleType.TimeSlot]:       'Por horario',
};

/** Descripciones cortas */
export const QUEUE_RULE_DESCRIPTIONS: Record<QueueRuleType, string> = {
  [QueueRuleType.FIFO]:           'Atiende según el orden de llegada estricto',
  [QueueRuleType.PriorityFirst]:  'Siempre llama primero al ticket de mayor prioridad',
  [QueueRuleType.Interleaved]:    'Alterna N pacientes normales por cada M preferenciales',
  [QueueRuleType.ManualOverride]: 'El operador puede seleccionar cualquier ticket de la cola',
  [QueueRuleType.TimeSlot]:       'La regla aplica solo en el horario definido',
};

/** Ícono representativo */
export const QUEUE_RULE_ICONS: Record<QueueRuleType, string> = {
  [QueueRuleType.FIFO]:           '📋',
  [QueueRuleType.PriorityFirst]:  '⚡',
  [QueueRuleType.Interleaved]:    '🔀',
  [QueueRuleType.ManualOverride]: '✋',
  [QueueRuleType.TimeSlot]:       '🕐',
};
