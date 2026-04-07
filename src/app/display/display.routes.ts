import { Routes } from '@angular/router';

/**
 * Rutas del Módulo 4 — Panel y Display (RF-51 a RF-60)
 *
 * /display/pantalla/:screenId  → DisplayBoardComponent  (pantalla TV, sin shell)
 * /display/configuracion       → DisplayConfigComponent  (panel admin, con shell)
 */
export const DISPLAY_ROUTES: Routes = [

  // ─── RF-51/54/58: Pantalla de TV / Kiosko (sin shell) ─────────────────
  {
    path: 'pantalla/:screenId',
    loadComponent: () =>
      import('./components/display-board/display-board').then(
        m => m.DisplayBoardComponent,
      ),
  },

  // ─── Configuración dentro del shell estándar ──────────────────────────
  {
    path: '',
    loadComponent: () =>
      import('../tickets/components/shell/shell').then(m => m.TicketsShellComponent),
    children: [
      {
        path: 'configuracion',
        loadComponent: () =>
          import('./components/display-config/display-config').then(
            m => m.DisplayConfigComponent,
          ),
      },
      {
        path: '',
        redirectTo: 'configuracion',
        pathMatch: 'full',
      },
    ],
  },
];
