/**
 * RF-67: Estrategias de distribución automática de tickets entre ventanillas.
 * Define cómo el motor asigna tickets a los módulos disponibles.
 */
export enum DistributionStrategy {
  /** Distribuye de forma circular entre todas las ventanillas activas */
  RoundRobin = 'ROUND_ROBIN',

  /** Asigna al módulo con menor cantidad de tickets en cola */
  LeastQueue = 'LEAST_QUEUE',

  /** Asigna al módulo con menor tiempo estimado de espera total */
  LeastWaitTime = 'LEAST_WAIT_TIME',

  /** Asigna según la afinidad de servicio de cada ventanilla */
  ServiceAffinity = 'SERVICE_AFFINITY',

  /** El operador acepta manualmente el siguiente ticket disponible */
  Manual = 'MANUAL',
}

/** Etiquetas para la UI */
export const DISTRIBUTION_STRATEGY_LABELS: Record<DistributionStrategy, string> = {
  [DistributionStrategy.RoundRobin]:      'Round Robin',
  [DistributionStrategy.LeastQueue]:      'Menor cola',
  [DistributionStrategy.LeastWaitTime]:   'Menor tiempo de espera',
  [DistributionStrategy.ServiceAffinity]: 'Afinidad de servicio',
  [DistributionStrategy.Manual]:          'Manual',
};

/** Descripciones */
export const DISTRIBUTION_STRATEGY_DESCRIPTIONS: Record<DistributionStrategy, string> = {
  [DistributionStrategy.RoundRobin]:      'Reparte tickets en rotación equitativa entre módulos activos',
  [DistributionStrategy.LeastQueue]:      'Siempre dirige al módulo con menos pacientes en espera',
  [DistributionStrategy.LeastWaitTime]:   'Minimiza el tiempo total estimado de atención',
  [DistributionStrategy.ServiceAffinity]: 'Asigna según los servicios que cada módulo atiende',
  [DistributionStrategy.Manual]:          'Cada operador llama al siguiente turno de forma manual',
};

/** Ícono */
export const DISTRIBUTION_STRATEGY_ICONS: Record<DistributionStrategy, string> = {
  [DistributionStrategy.RoundRobin]:      '🔄',
  [DistributionStrategy.LeastQueue]:      '📉',
  [DistributionStrategy.LeastWaitTime]:   '⏱️',
  [DistributionStrategy.ServiceAffinity]: '🎯',
  [DistributionStrategy.Manual]:          '🖐️',
};
