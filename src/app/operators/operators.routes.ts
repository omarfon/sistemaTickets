import { Routes } from '@angular/router';

/**
 * Rutas lazy del Módulo 3 — Operadores (RF-36 a RF-50).
 * Usa el TicketsShellComponent como layout principal (sidebar + topbar).
 */
export const OPERATORS_ROUTES: Routes = [
  {
    // RF-37: Login fuera del shell (pantalla completa)
    path: 'login',
    loadComponent: () =>
      import('./components/operator-login/operator-login').then(m => m.OperatorLoginComponent),
    title: 'Iniciar sesión — MediTurno',
  },
  {
    // Rutas protegidas con el shell compartido
    path: '',
    loadComponent: () =>
      import('../tickets/components/shell/shell').then(m => m.TicketsShellComponent),
    children: [
      { path: '', redirectTo: 'supervision', pathMatch: 'full' },
      {
        path: 'supervision',
        loadComponent: () =>
          import('./components/operator-list/operator-list').then(m => m.OperatorListComponent),
        title: 'Supervisión de operadores',
      },
      {
        path: 'nuevo',
        loadComponent: () =>
          import('./components/operator-form/operator-form').then(m => m.OperatorFormComponent),
        title: 'Nuevo operador',
      },
      {
        path: ':id/editar',
        loadComponent: () =>
          import('./components/operator-form/operator-form').then(m => m.OperatorFormComponent),
        title: 'Editar operador',
      },
      {
        // Panel de trabajo: desde supervisor (con :id) o desde login (sin :id)
        path: 'panel',
        loadComponent: () =>
          import('./components/operator-dashboard/operator-dashboard').then(m => m.OperatorDashboardComponent),
        title: 'Panel de operador',
      },
      {
        path: ':id/panel',
        loadComponent: () =>
          import('./components/operator-dashboard/operator-dashboard').then(m => m.OperatorDashboardComponent),
        title: 'Panel de operador',
      },
    ],
  },
];
