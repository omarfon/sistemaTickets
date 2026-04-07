/** RF-55: Temas de personalización del panel de display público */
export enum DisplayTheme {
  Claro   = 'CLARO',
  Oscuro  = 'OSCURO',
  Clinico = 'CLINICO',
}

export const DISPLAY_THEME_LABELS: Record<DisplayTheme, string> = {
  [DisplayTheme.Claro]:   'Claro',
  [DisplayTheme.Oscuro]:  'Oscuro',
  [DisplayTheme.Clinico]: 'Clínico',
};

/** Clases Tailwind para el fondo principal de la pantalla */
export const DISPLAY_THEME_BG: Record<DisplayTheme, string> = {
  [DisplayTheme.Claro]:   'bg-slate-100 text-gray-900',
  [DisplayTheme.Oscuro]:  'bg-gray-950 text-white',
  [DisplayTheme.Clinico]: 'bg-blue-950 text-white',
};

/** Clases para las tarjetas internas */
export const DISPLAY_THEME_CARD: Record<DisplayTheme, string> = {
  [DisplayTheme.Claro]:   'bg-white ring-1 ring-gray-200 text-gray-900',
  [DisplayTheme.Oscuro]:  'bg-gray-900 ring-1 ring-gray-700 text-white',
  [DisplayTheme.Clinico]: 'bg-blue-900 ring-1 ring-blue-700 text-white',
};

/** Clases para la barra de cabecera */
export const DISPLAY_THEME_HEADER: Record<DisplayTheme, string> = {
  [DisplayTheme.Claro]:   'bg-blue-700 text-white',
  [DisplayTheme.Oscuro]:  'bg-gray-900 text-white border-b border-gray-800',
  [DisplayTheme.Clinico]: 'bg-blue-900 text-white border-b border-blue-800',
};

/** Clases para la barra de anuncios / ticker inferior */
export const DISPLAY_THEME_TICKER: Record<DisplayTheme, string> = {
  [DisplayTheme.Claro]:   'bg-blue-700 text-white',
  [DisplayTheme.Oscuro]:  'bg-gray-900 text-gray-300 border-t border-gray-800',
  [DisplayTheme.Clinico]: 'bg-blue-900 text-blue-100 border-t border-blue-800',
};
