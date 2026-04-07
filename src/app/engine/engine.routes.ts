import { Routes } from '@angular/router';

/**
 * Rutas lazy del Módulo 5 — Motor de Colas (RF-61 a RF-75).
 * Usa el TicketsShellComponent como layout principal (sidebar + topbar).
 */
export const ENGINE_ROUTES: Routes = [
  {
    path: '',
    loadComponent: () =>
      import('../tickets/components/shell/shell').then(m => m.TicketsShellComponent),
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./components/engine-dashboard/engine-dashboard').then(m => m.EngineDashboardComponent),
        title: 'Dashboard — Motor de Colas',
      },
      {
        path: 'reglas',
        loadComponent: () =>
          import('./components/engine-rules/engine-rules').then(m => m.EngineRulesComponent),
        title: 'Reglas y SLA — Motor de Colas',
      },
      {
        path: 'simulacion',
        loadComponent: () =>
          import('./components/engine-simulation/engine-simulation').then(m => m.EngineSimulationComponent),
        title: 'Simulación y Predicción — Motor de Colas',
      },
      {
        path: 'cola-virtual',
        loadComponent: () =>
          import('./components/engine-virtual-queue/engine-virtual-queue').then(m => m.EngineVirtualQueueComponent),
        title: 'Cola Virtual — Motor de Colas',
      },
    ],
  },
];
