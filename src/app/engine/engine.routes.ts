import { Routes } from '@angular/router';

export const ENGINE_ROUTES: Routes = [
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
];
