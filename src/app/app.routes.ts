import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('./tickets/components/shell/shell').then(m => m.TicketsShellComponent),
    children: [
      {
        path: 'tickets',
        loadChildren: () =>
          import('./tickets/tickets.routes').then(m => m.TICKETS_ROUTES),
      },
      {
        path: 'ventanillas',
        loadChildren: () =>
          import('./windows/windows.routes').then(m => m.WINDOWS_ROUTES),
      },
      {
        path: 'operadores',
        loadChildren: () =>
          import('./operators/operators.routes').then(m => m.OPERATORS_ROUTES),
      },
      {
        path: 'display',
        loadChildren: () =>
          import('./display/display.routes').then(m => m.DISPLAY_ROUTES),
      },
      {
        path: 'motor',
        loadChildren: () =>
          import('./engine/engine.routes').then(m => m.ENGINE_ROUTES),
      },
      {
        path: 'configuracion',
        loadChildren: () =>
          import('./settings/settings.routes').then(m => m.SETTINGS_ROUTES),
      },
      {
        path: '',
        redirectTo: 'tickets',
        pathMatch: 'full',
      },
    ],
  },
];
