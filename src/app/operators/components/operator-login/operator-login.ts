import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService }     from '../../services/auth.service';
import { OperatorService } from '../../services/operator.service';
import { OperatorRole, OPERATOR_ROLE_LABELS, OPERATOR_ROLE_ICON, OPERATOR_ROLE_CSS } from '../../enums/operator-role.enum';
import { OperatorStatus, OPERATOR_STATUS_LABELS, OPERATOR_STATUS_DOT } from '../../enums/operator-status.enum';
import type { Operator } from '../../models/operator.model';

/**
 * RF-37 — Pantalla de login del operador.
 * Modo demo: selector de perfil con un click.
 * Modo avanzado: formulario email + contraseña.
 */
@Component({
  selector: 'app-operator-login',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [FormsModule],
  templateUrl: './operator-login.html',
})
export class OperatorLoginComponent {
  private readonly authService     = inject(AuthService);
  private readonly operatorService = inject(OperatorService);
  private readonly router          = inject(Router);

  // ─── Campos del formulario ───────────────────────────────────────────────

  email    = '';
  password = '';

  // ─── Estado ─────────────────────────────────────────────────────────────

  readonly loading              = signal(false);
  readonly error                = signal<string | null>(null);
  readonly showCredentialsForm  = signal(false);

  // ─── Operadores disponibles para el selector de perfil ──────────────────

  /** Todos los operadores activos (no Offline) — para el selector rápido */
  readonly profileOperators = computed(() =>
    this.operatorService.operators().filter(o => o.status !== OperatorStatus.Offline)
  );

  readonly OperatorRole   = OperatorRole;
  readonly OperatorStatus = OperatorStatus;
  readonly roleLabels     = OPERATOR_ROLE_LABELS;
  readonly roleIcons      = OPERATOR_ROLE_ICON;
  readonly roleCss        = OPERATOR_ROLE_CSS;
  readonly statusLabels   = OPERATOR_STATUS_LABELS;
  readonly statusDot      = OPERATOR_STATUS_DOT;

  // ─── Login rápido (fake / demo) ──────────────────────────────────────────

  /** Login directo sin contraseña — solo para prototipo */
  loginAs(op: Operator): void {
    this.authService.setSession({ ...op, status: OperatorStatus.Disponible, lastLoginAt: new Date() });
    this._redirect(op.role);
  }

  // ─── RF-37: Login con credenciales ───────────────────────────────────────

  login(): void {
    this.error.set(null);
    if (!this.email.trim() || !this.password) {
      this.error.set('Ingresa tu correo y contraseña.');
      return;
    }

    this.loading.set(true);
    const result = this.authService.login(
      this.email,
      this.password,
      this.operatorService.operators()
    );
    this.loading.set(false);

    if (!result) {
      this.error.set('Correo o contraseña incorrectos.');
      return;
    }

    this._redirect(result.role);
  }

  private _redirect(role: OperatorRole): void {
    if (role === OperatorRole.Admin || role === OperatorRole.Supervisor) {
      this.router.navigate(['/operadores/supervision']);
    } else {
      this.router.navigate(['/operadores/panel']);
    }
  }
}

