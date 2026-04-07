import { computed, Injectable, signal } from '@angular/core';
import { OperatorRole }   from '../enums/operator-role.enum';
import { OperatorStatus } from '../enums/operator-status.enum';
import type { Operator }  from '../models/operator.model';

/**
 * RF-37 — Servicio de autenticación de operadores.
 *
 * Prototipo simplificado (sin JWT ni backend real).
 * La sesión se mantiene en un signal en memoria.
 */
@Injectable({ providedIn: 'root' })
export class AuthService {
  // ─── Estado de sesión ────────────────────────────────────────────────────

  private readonly _currentOperator = signal<Operator | null>(null);

  /** Operador con sesión activa, o null si no hay sesión */
  readonly currentOperator = this._currentOperator.asReadonly();

  /** true si hay sesión activa */
  readonly isLoggedIn = computed(() => this._currentOperator() !== null);

  /** true si el operador tiene rol Admin */
  readonly isAdmin = computed(
    () => this._currentOperator()?.role === OperatorRole.Admin
  );

  /** true si el operador tiene rol Admin o Supervisor */
  readonly isSupervisor = computed(() => {
    const role = this._currentOperator()?.role;
    return role === OperatorRole.Admin || role === OperatorRole.Supervisor;
  });

  // ─── RF-37: Login ────────────────────────────────────────────────────────

  /**
   * Intenta autenticar con email + contraseña.
   * Recibe la lista de operadores del OperatorService para validar.
   * @returns el operador si la autenticación fue exitosa, null si falló.
   */
  login(email: string, password: string, operators: Operator[]): Operator | null {
    const op = operators.find(
      o => o.email.toLowerCase() === email.toLowerCase().trim() &&
           o.password === password
    );
    if (op) {
      this._currentOperator.set({ ...op, lastLoginAt: new Date(), status: OperatorStatus.Disponible });
      return op;
    }
    return null;
  }

  /** Cierra la sesión del operador actual */
  logout(): void {
    this._currentOperator.set(null);
  }

  /**
   * Permite pre-cargar una sesión (ej: desde seed / desarrollo).
   * En producción se usaría un token persistido.
   */
  setSession(op: Operator): void {
    this._currentOperator.set(op);
  }

  /** Actualiza datos del operador en sesión (ej: al cambiar estado) */
  refreshSession(updated: Operator): void {
    if (this._currentOperator()?.id === updated.id) {
      this._currentOperator.set(updated);
    }
  }
}
