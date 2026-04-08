import { Routes } from '@angular/router';

/**
 * Rutas del Módulo 4 — Panel y Display (RF-51 a RF-60)
 *
 * /display/pantalla/:screenId  → DisplayBoardComponent  (pantalla TV, sin shell)
 * /display/configuracion       → DisplayConfigComponent  (panel admin, con shell)
 */
export const DISPLAY_ROUTES: Routes = [
  // ─── Configuración (con shell, gestionado desde app.routes.ts) ──────────────
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
];
