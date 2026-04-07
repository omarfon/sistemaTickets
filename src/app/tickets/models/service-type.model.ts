import { TicketPriority } from '../enums/ticket-priority.enum';

/**
 * Representa un puesto de atención en la clínica.
 * El flujo clínico sigue el orden de pasos:
 * 1 → Admisión (registro, pago, reserva de cita)
 * 2 → Pre-consulta (triaje, signos vitales)
 * 3 → Atención con especialista
 */
export interface ServiceType {
  /** Identificador único del servicio */
  id: string;

  /** Nombre del puesto de atención (ej: "Admisión", "Pre-consulta", "Cardiología") */
  name: string;

  /**
   * Letra o prefijo para la numeración del ticket (ej: "A" → A001).
   * Debe ser único por servicio dentro del sistema.
   */
  prefix: string;

  /** Descripción breve visible al paciente al seleccionar el servicio */
  description: string;

  /** Tiempo promedio de atención por paciente en minutos */
  avgAttentionTimeMinutes: number;

  /** Indica si el puesto está activo y disponible para generar turnos */
  isActive: boolean;

  /** Número de ventanillas o consultorios habilitados */
  windowCount: number;

  /**
   * Paso en el flujo clínico.
   * 1 = Admisión · 2 = Pre-consulta / Triaje · 3 = Especialista
   */
  step: 1 | 2 | 3;

  /** Icono emoji representativo del servicio */
  icon?: string;

  /** Etiqueta para el módulo de atención (ej: "Ventanilla", "Consultorio") */
  windowLabel?: string;
}
