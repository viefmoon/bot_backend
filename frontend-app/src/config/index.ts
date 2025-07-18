export const config = {
  // API Configuration
  api: {
    baseUrl: import.meta.env.VITE_BACKEND_BASE_URL || 'http://localhost:5000',
    prefix: import.meta.env.VITE_API_PREFIX || '/backend',
  },
  
  
  // Regional Configuration
  regional: {
    countryCode: import.meta.env.VITE_COUNTRY_CODE || 'mx',
    locale: import.meta.env.VITE_LOCALE || 'es-MX',
    timezone: import.meta.env.VITE_TIMEZONE || 'America/Mexico_City',
  },
  
  // Google Maps Configuration
  maps: {
    apiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ['places', 'geometry'] as ('places' | 'geometry')[],
    defaultZoom: {
      initial: 14,
      search: 17,
      selected: 16,
    },
    padding: { top: 50, right: 50, bottom: 50, left: 50 },
  },
  
  // UI Configuration
  ui: {
    mapHeight: {
      mobile: 'h-[300px]',
      desktop: 'sm:h-[400px]',
    },
    colors: {
      primary: '#3B82F6',
      marker: {
        fill: '#3B82F6',
        stroke: '#ffffff',
      },
      polygon: {
        fill: '#3B82F6',
        fillOpacity: 0.2,
        stroke: '#3B82F6',
        strokeOpacity: 0.8,
        strokeWeight: 2,
      },
    },
  },
};

// API Endpoints
export const endpoints = {
  addressRegistration: {
    verifyOtp: `${config.api.prefix}/address-registration/verify-otp`,
    create: `${config.api.prefix}/address-registration/create`,
    update: (addressId: string) => `${config.api.prefix}/address-registration/${addressId}`,
    delete: (addressId: string) => `${config.api.prefix}/address-registration/${addressId}`,
    setDefault: (addressId: string) => `${config.api.prefix}/address-registration/${addressId}/default`,
    getAddresses: (customerId: string) => `${config.api.prefix}/address-registration/${customerId}/addresses`,
    getDeliveryArea: `${config.api.prefix}/address-registration/delivery-area`,
  },
};