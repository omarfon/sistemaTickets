import { Routes } from '@angular/router';
import { EngineDashboardComponent }    from './components/engine-dashboard/engine-dashboard';
import { EngineRulesComponent }        from './components/engine-rules/engine-rules';
import { EngineSimulationComponent }   from './components/engine-simulation/engine-simulation';
import { EngineVirtualQueueComponent } from './components/engine-virtual-queue/engine-virtual-queue';

export const ENGINE_ROUTES: Routes = [
  { path: '',             redirectTo: 'dashboard', pathMatch: 'full' },
  { path: 'dashboard',   component: EngineDashboardComponent },
  { path: 'reglas',      component: EngineRulesComponent },
  { path: 'simulacion',  component: EngineSimulationComponent },
  { path: 'cola-virtual',component: EngineVirtualQueueComponent },
];
