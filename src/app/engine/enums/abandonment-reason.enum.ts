/**
 * RF-75: Razones por las cuales un paciente abandona la cola.
 */
export enum AbandonmentReason {
  /** El paciente no respondió a los llamados y no se presentó */
  NoShow = 'NO_SHOW',

  /** El paciente canceló explícitamente su turno */
  Cancelled = 'CANCELLED',

  /** El paciente esperó demasiado y se fue sin cancelar */
  Timeout = 'TIMEOUT',

  /** El paciente fue derivado a otro servicio o institución */
  Transferred = 'TRANSFERRED',

  /** El sistema detectó inactividad prolongada */
  SystemTimeout = 'SYSTEM_TIMEOUT',
}

/** Etiquetas legibles */
export const ABANDONMENT_REASON_LABELS: Record<AbandonmentReason, string> = {
  [AbandonmentReason.NoShow]:        'No se presentó',
  [AbandonmentReason.Cancelled]:     'Canceló voluntariamente',
  [AbandonmentReason.Timeout]:       'Tiempo de espera excedido',
  [AbandonmentReason.Transferred]:   'Derivado a otro servicio',
  [AbandonmentReason.SystemTimeout]: 'Timeout del sistema',
};

/** Color del badge según razón */
export const ABANDONMENT_REASON_BADGE: Record<AbandonmentReason, string> = {
  [AbandonmentReason.NoShow]:        'bg-red-100 text-red-700',
  [AbandonmentReason.Cancelled]:     'bg-gray-100 text-gray-700',
  [AbandonmentReason.Timeout]:       'bg-amber-100 text-amber-700',
  [AbandonmentReason.Transferred]:   'bg-blue-100 text-blue-700',
  [AbandonmentReason.SystemTimeout]: 'bg-orange-100 text-orange-700',
};

/** Ícono */
export const ABANDONMENT_REASON_ICONS: Record<AbandonmentReason, string> = {
  [AbandonmentReason.NoShow]:        '👻',
  [AbandonmentReason.Cancelled]:     '❌',
  [AbandonmentReason.Timeout]:       '⌛',
  [AbandonmentReason.Transferred]:   '↗️',
  [AbandonmentReason.SystemTimeout]: '🤖',
};
