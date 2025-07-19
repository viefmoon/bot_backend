import { translations } from './translations';

class I18n {
  /**
   * Get translated text
   */
  t(path: string, params?: Record<string, string>): string {
    const keys = path.split('.');
    let value: unknown = translations['es-MX'];

    for (const key of keys) {
      if (typeof value === 'object' && value !== null) {
        value = (value as Record<string, unknown>)[key];
      } else {
        value = undefined;
      }
      if (!value) {
        console.warn(`Translation not found for key: ${path}`);
        return path;
      }
    }

    if (typeof value !== 'string') {
      console.warn(`Translation value is not a string for key: ${path}`);
      return path;
    }

    // Replace parameters
    if (params) {
      return value.replace(/{(\w+)}/g, (match, key) => params[key] || match);
    }

    return value;
  }
}

export const i18n = new I18n();
export const t = i18n.t.bind(i18n);