import {
  ChangeDetectionStrategy,
  Component,
  inject,
  signal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService }     from '../../services/auth.service';
import { OperatorService } from '../../services/operator.service';
import { OperatorRole, OPERATOR_ROLE_LABELS, OPERATOR_ROLE_ICON } from '../../enums/operator-role.enum';

/**
 * RF-37 — Pantalla de login del operador.
 * Autenticación por email + contraseña con acceso rápido por perfil.
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

  readonly loading = signal(false);
  readonly error   = signal<string | null>(null);

  // ─── Accesos rápidos (modo prototipo) ───────────────────────────────────

  readonly quickAccess = [
    { label: 'Administrador', email: 'admin@mediturno.pe',       password: 'admin123', role: OperatorRole.Admin },
    { label: 'Supervisor',    email: 'supervisor@mediturno.pe',  password: 'super123', role: OperatorRole.Supervisor },
    { label: 'Operador',      email: 'ana.mendoza@mediturno.pe', password: 'op123',    role: OperatorRole.Operador },
  ];

  readonly OperatorRole      = OperatorRole;
  readonly roleLabels        = OPERATOR_ROLE_LABELS;
  readonly roleIcon          = OPERATOR_ROLE_ICON;

  // ─── RF-37: Login ────────────────────────────────────────────────────────

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

    // Redirige según rol
    if (result.role === OperatorRole.Admin || result.role === OperatorRole.Supervisor) {
      this.router.navigate(['/operadores/supervision']);
    } else {
      this.router.navigate(['/operadores/panel']);
    }
  }

  quickLogin(qa: { email: string; password: string }): void {
    this.email    = qa.email;
    this.password = qa.password;
    this.login();
  }
}
