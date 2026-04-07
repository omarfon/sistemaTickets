/**
 * RF-39 — Roles de usuario del sistema de colas.
 *
 * Jerarquía:  Admin > Supervisor > Operador
 */
export enum OperatorRole {
  /** Acceso completo: CRUD operadores, configuración global */
  Admin      = 'ADMIN',
  /** Monitoreo en tiempo real, reasignaciones y reportes */
  Supervisor = 'SUPERVISOR',
  /** Atención de pacientes en ventanilla */
  Operador   = 'OPERADOR',
}

/** Etiquetas legibles */
export const OPERATOR_ROLE_LABELS: Record<OperatorRole, string> = {
  [OperatorRole.Admin]:      'Administrador',
  [OperatorRole.Supervisor]: 'Supervisor',
  [OperatorRole.Operador]:   'Operador',
};

/** Clases Tailwind badge por rol */
export const OPERATOR_ROLE_CSS: Record<OperatorRole, string> = {
  [OperatorRole.Admin]:      'bg-violet-100 text-violet-800 ring-violet-200',
  [OperatorRole.Supervisor]: 'bg-blue-100   text-blue-800   ring-blue-200',
  [OperatorRole.Operador]:   'bg-gray-100   text-gray-700   ring-gray-200',
};

/** Emoji por rol */
export const OPERATOR_ROLE_ICON: Record<OperatorRole, string> = {
  [OperatorRole.Admin]:      '🔑',
  [OperatorRole.Supervisor]: '👁️',
  [OperatorRole.Operador]:   '🧑‍💼',
};
