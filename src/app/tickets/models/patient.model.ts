/**
 * Representa un paciente registrado en el sistema de la clínica.
 * La búsqueda se realiza por DNI (Documento Nacional de Identidad).
 */
export interface Patient {
  /** DNI del paciente (8 dígitos) */
  dni: string;

  /** Nombre completo en formato "Apellidos, Nombre(s)" */
  name: string;

  /** Edad del paciente en años */
  age?: number;

  /** Teléfono de contacto */
  phone?: string;

  /** Tipo de sangre (ej: "O+", "A-") */
  bloodType?: string;

  /** Historial de alergias conocidas */
  allergies?: string;
}
