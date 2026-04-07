/**
 * RF-23 / RF-27 / RF-28 / RF-33
 * Estado operativo de una ventanilla / módulo de atención.
 *
 * Flujo normal:   Disponible ↔ Ocupado
 * Flujo de cierre: cualquier estado → Cerrada → Disponible
 */
export enum WindowStatus {
  /** Módulo abierto y libre, puede recibir el siguiente ticket */
  Disponible = 'DISPONIBLE',

  /** Módulo atendiendo a un paciente */
  Ocupado = 'OCUPADO',

  /** RF-27: Módulo cerrado temporalmente por el operador */
  Cerrada = 'CERRADA',

  /** RF-33: Módulo fuera de servicio por mantenimiento técnico */
  Mantenimiento = 'MANTENIMIENTO',

  /** Módulo desconectado / sin operador asignado */
  Offline = 'OFFLINE',
}

/** Etiquetas legibles para la UI */
export const WINDOW_STATUS_LABELS: Record<WindowStatus, string> = {
  [WindowStatus.Disponible]:    'Disponible',
  [WindowStatus.Ocupado]:       'Ocupado',
  [WindowStatus.Cerrada]:       'Cerrada',
  [WindowStatus.Mantenimiento]: 'Mantenimiento',
  [WindowStatus.Offline]:       'Offline',
};

/** Clases Tailwind de color para cada estado */
export const WINDOW_STATUS_CSS: Record<WindowStatus, string> = {
  [WindowStatus.Disponible]:    'bg-emerald-100 text-emerald-800 ring-emerald-200',
  [WindowStatus.Ocupado]:       'bg-blue-100    text-blue-800    ring-blue-200',
  [WindowStatus.Cerrada]:       'bg-gray-100    text-gray-600    ring-gray-200',
  [WindowStatus.Mantenimiento]: 'bg-amber-100   text-amber-800   ring-amber-200',
  [WindowStatus.Offline]:       'bg-red-100     text-red-700     ring-red-200',
};

/** Punto de color (dot) para el dashboard en tiempo real */
export const WINDOW_STATUS_DOT: Record<WindowStatus, string> = {
  [WindowStatus.Disponible]:    'bg-emerald-500',
  [WindowStatus.Ocupado]:       'bg-blue-500',
  [WindowStatus.Cerrada]:       'bg-gray-400',
  [WindowStatus.Mantenimiento]: 'bg-amber-500',
  [WindowStatus.Offline]:       'bg-red-500',
};
