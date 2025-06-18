import { translations, type Locale } from './translations';
import { config } from '@/config';

class I18n {
  private locale: Locale;

  constructor() {
    this.locale = (config.regional.locale || 'es-MX') as Locale;
  }

  /**
   * Get translated text
   */
  t(path: string, params?: Record<string, string>): string {
    const keys = path.split('.');
    let value: any = translations[this.locale];

    for (const key of keys) {
      value = value?.[key];
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

  /**
   * Change locale
   */
  setLocale(locale: Locale): void {
    if (translations[locale]) {
      this.locale = locale;
    } else {
      console.warn(`Locale ${locale} not found`);
    }
  }

  /**
   * Get current locale
   */
  getLocale(): Locale {
    return this.locale;
  }
}

export const i18n = new I18n();
export const t = i18n.t.bind(i18n);