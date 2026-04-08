import { Routes } from '@angular/router';

export const OPERATORS_ROUTES: Routes = [
  {
    path: 'login',
    loadComponent: () =>
      import('./components/operator-login/operator-login').then(m => m.OperatorLoginComponent),
    title: 'Iniciar sesión — MediTurno',
  },
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
];
