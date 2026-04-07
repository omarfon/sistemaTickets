/**
 * RF-35: Nivel de alerta por saturación de la cola de una ventanilla.
 */
export enum WindowAlertLevel {
  /** Sin alerta: carga normal */
  None    = 'NONE',
  /** RF-35: Carga moderada, empieza a crecer la cola */
  Warning = 'WARNING',
  /** RF-35: Saturación alta, requiere redistribución inmediata */
  Critical = 'CRITICAL',
}

export const WINDOW_ALERT_LABELS: Record<WindowAlertLevel, string> = {
  [WindowAlertLevel.None]:     'Normal',
  [WindowAlertLevel.Warning]:  'Advertencia',
  [WindowAlertLevel.Critical]: 'Saturación crítica',
};

export const WINDOW_ALERT_CSS: Record<WindowAlertLevel, string> = {
  [WindowAlertLevel.None]:     '',
  [WindowAlertLevel.Warning]:  'border-amber-400 ring-2 ring-amber-300',
  [WindowAlertLevel.Critical]: 'border-red-500   ring-2 ring-red-400',
};
