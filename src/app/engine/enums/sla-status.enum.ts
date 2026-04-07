/**
 * RF-64: Estados de cumplimiento del SLA (Service Level Agreement) de atención.
 * Determina si el tiempo máximo de espera fue respetado.
 */
export enum SlaStatus {
  /** El ticket aún no ha superado el tiempo máximo */
  Ok = 'OK',

  /** El ticket está próximo a vencer (≥ 80% del tiempo máximo) */
  Warning = 'WARNING',

  /** El ticket superó el tiempo máximo de espera — SLA incumplido */
  Breached = 'BREACHED',

  /** El ticket fue atendido dentro del tiempo máximo — SLA cumplido */
  Met = 'MET',
}

/** Etiquetas legibles */
export const SLA_STATUS_LABELS: Record<SlaStatus, string> = {
  [SlaStatus.Ok]:      'En tiempo',
  [SlaStatus.Warning]: 'Por vencer',
  [SlaStatus.Breached]:'SLA incumplido',
  [SlaStatus.Met]:     'SLA cumplido',
};

/** Clases Tailwind para badges de SLA */
export const SLA_STATUS_BADGE: Record<SlaStatus, string> = {
  [SlaStatus.Ok]:      'bg-green-100 text-green-800 ring-1 ring-green-200',
  [SlaStatus.Warning]: 'bg-amber-100 text-amber-800 ring-1 ring-amber-200',
  [SlaStatus.Breached]:'bg-red-100 text-red-800 ring-1 ring-red-200',
  [SlaStatus.Met]:     'bg-blue-100 text-blue-800 ring-1 ring-blue-200',
};

/** Ícono por estado */
export const SLA_STATUS_ICON: Record<SlaStatus, string> = {
  [SlaStatus.Ok]:      '✅',
  [SlaStatus.Warning]: '⚠️',
  [SlaStatus.Breached]:'🔴',
  [SlaStatus.Met]:     '🏆',
};
