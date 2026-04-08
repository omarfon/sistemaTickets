import { Routes } from '@angular/router';

export const WINDOWS_ROUTES: Routes = [
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
];
