import { Routes } from '@angular/router';
import { SettingsPanelComponent } from './components/settings-panel';

export const SETTINGS_ROUTES: Routes = [
  {
    path: 'sistema',
    component: SettingsPanelComponent,
    title: 'Configuración del sistema',
  },
  {
    path: '',
    redirectTo: 'sistema',
    pathMatch: 'full',
  },
];
