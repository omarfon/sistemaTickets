import { bootstrapApplication } from '@angular/platform-browser';
import { registerLocaleData }   from '@angular/common';
import localeEs                 from '@angular/common/locales/es';
import { appConfig }            from './app/app.config';
import { App }                  from './app/app';

// Registrar el locale español para que DatePipe, CurrencyPipe, etc. usen 'es'
registerLocaleData(localeEs, 'es');

bootstrapApplication(App, appConfig)
  .catch((err) => console.error(err));
