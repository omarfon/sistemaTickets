import { Routes } from '@angular/router';
import { SettingsPanelComponent } from './components/settings-panel';
import { PriorityMasterComponent } from './components/priority-master/priority-master';

export const SETTINGS_ROUTES: Routes = [
  {
    path: 'sistema',
    component: SettingsPanelComponent,
    title: 'Configuración del sistema',
  },
  {
    path: 'prioridades',
    component: PriorityMasterComponent,
    title: 'Maestro de Prioridades',
  },
  {
    path: '',
    redirectTo: 'sistema',
    pathMatch: 'full',
  },
];
