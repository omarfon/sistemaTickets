import { Routes } from '@angular/router';

export const TICKETS_ROUTES: Routes = [
  { path: '', redirectTo: 'lista', pathMatch: 'full' },
  {
    path: 'lista',
    loadComponent: () =>
      import('./components/ticket-list/ticket-list').then(m => m.TicketListComponent),
    title: 'Cola de tickets',
  },
  {
    path: 'nuevo',
    loadComponent: () =>
      import('./components/ticket-generator/ticket-generator').then(
        m => m.TicketGeneratorComponent
      ),
    title: 'Generar ticket',
  },
  {
    path: 'atencion',
    loadComponent: () =>
      import('./components/ticket-status/ticket-status').then(m => m.TicketStatusComponent),
    title: 'Panel de atención',
  },
  {
    path: 'kiosko',
    loadComponent: () =>
      import('./components/ticket-kiosk/ticket-kiosk').then(m => m.TicketKioskComponent),
    title: 'Kiosko',
  },
  {
    path: 'virtual',
    loadComponent: () =>
      import('./components/ticket-web/ticket-web').then(m => m.TicketWebComponent),
    title: 'Cola Virtual',
  },
  {
    path: 'checkin',
    loadComponent: () =>
      import('./components/ticket-checkin/ticket-checkin').then(m => m.TicketCheckinComponent),
    title: 'Check-in',
  },
];
