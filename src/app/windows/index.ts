// Barrel público del módulo de Ventanillas
export { WINDOWS_ROUTES }         from './windows.routes';
export { WindowService }          from './services/window.service';
export { WindowStatus, WINDOW_STATUS_LABELS, WINDOW_STATUS_CSS, WINDOW_STATUS_DOT } from './enums/window-status.enum';
export { WindowAlertLevel, WINDOW_ALERT_LABELS, WINDOW_ALERT_CSS }                  from './enums/window-alert.enum';
export type { Window, WindowAlert, WindowSummary, CreateWindowDto, UpdateWindowDto, WindowScheduleSlot } from './models/window.model';
