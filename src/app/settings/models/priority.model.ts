/** Configuración de una prioridad de atención */
export interface PriorityConfig {
  id: string;
  /** Código interno (NORMAL, PREFERENCIAL, VIP, etc.) */
  code: string;
  /** Nombre visible en la UI */
  label: string;
  /** Descripción corta */
  description: string;
  /** Peso numérico para ordenar (mayor = más prioritario) */
  weight: number;
  /** Icono emoji */
  icon: string;
  /** Color CSS (clase Tailwind para el badge) */
  color: string;
  /** Si está habilitada */
  isActive: boolean;
}

export type CreatePriorityDto = Omit<PriorityConfig, 'id'>;
