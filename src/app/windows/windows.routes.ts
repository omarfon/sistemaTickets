import { Routes } from '@angular/router';

/**
 * Rutas lazy del módulo de Ventanillas (Módulo 2 — RF-21 a RF-35).
 * Usa el TicketsShellComponent como layout principal (sidebar + topbar).
 */
export const WINDOWS_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../tickets/components/shell/shell').then(m => m.TicketsShellComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./components/window-list/window-list').then(m => m.WindowListComponent),
        title: 'Módulos / Ventanillas',
      },
      {
        path: 'nueva',
        loadComponent: () =>
          import('./components/window-form/window-form').then(m => m.WindowFormComponent),
        title: 'Nueva ventanilla',
      },
      {
        path: ':id/editar',
        loadComponent: () =>
          import('./components/window-form/window-form').then(m => m.WindowFormComponent),
        title: 'Editar ventanilla',
      },
      {
        path: ':id/operador',
        loadComponent: () =>
          import('./components/window-operator/window-operator').then(m => m.WindowOperatorComponent),
        title: 'Panel de operador',
      },
    ],
  },
];
