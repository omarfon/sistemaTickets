/**
 * RF-43 — Estado operativo del operador.
 *
 * Flujo normal:  Disponible ↔ Ocupado
 * Pausa:         Disponible | Ocupado → EnPausa → Disponible
 */
export enum OperatorStatus {
  /** Listo para recibir el siguiente ticket */
  Disponible = 'DISPONIBLE',
  /** Atendiendo a un paciente en este momento */
  Ocupado    = 'OCUPADO',
  /** RF-42: En pausa o descanso */
  EnPausa    = 'EN_PAUSA',
  /** Sin sesión activa / desconectado */
  Offline    = 'OFFLINE',
}

/** Etiquetas legibles */
export const OPERATOR_STATUS_LABELS: Record<OperatorStatus, string> = {
  [OperatorStatus.Disponible]: 'Disponible',
  [OperatorStatus.Ocupado]:    'Ocupado',
  [OperatorStatus.EnPausa]:    'En pausa',
  [OperatorStatus.Offline]:    'Offline',
};

/** Clases Tailwind badge */
export const OPERATOR_STATUS_CSS: Record<OperatorStatus, string> = {
  [OperatorStatus.Disponible]: 'bg-emerald-100 text-emerald-800 ring-emerald-200',
  [OperatorStatus.Ocupado]:    'bg-blue-100    text-blue-800    ring-blue-200',
  [OperatorStatus.EnPausa]:    'bg-amber-100   text-amber-800   ring-amber-200',
  [OperatorStatus.Offline]:    'bg-gray-100    text-gray-500    ring-gray-200',
};

/** Punto de color (dot indicator) */
export const OPERATOR_STATUS_DOT: Record<OperatorStatus, string> = {
  [OperatorStatus.Disponible]: 'bg-emerald-500',
  [OperatorStatus.Ocupado]:    'bg-blue-500',
  [OperatorStatus.EnPausa]:    'bg-amber-500',
  [OperatorStatus.Offline]:    'bg-gray-400',
};
