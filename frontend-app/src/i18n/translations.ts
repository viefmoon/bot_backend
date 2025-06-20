export const translations = {
  'es-MX': {
    common: {
      loading: 'Cargando...',
      error: 'Error',
      success: 'Éxito',
      save: 'Guardar',
      cancel: 'Cancelar',
      continue: 'Continuar',
      back: 'Atrás',
      close: 'Cerrar',
    },
    otp: {
      verifying: 'Verificando enlace...',
      invalidLink: 'Enlace inválido',
      expiredLink: 'Este enlace ha expirado o no es válido. Por favor, solicita un nuevo enlace desde WhatsApp.',
      continueWhatsApp: 'Continuar en WhatsApp',
    },
    address: {
      title: 'Registrar Dirección de Entrega',
      updateTitle: 'Actualizar Dirección',
      welcome: '¡Hola{name}! Por favor completa tu información de entrega.',
      yourNumber: 'Tu número: {number}',
      useMyLocation: 'Usar mi ubicación actual',
      searchPlaceholder: 'Busca tu dirección en México...',
      mapError: 'Error al cargar el mapa. Por favor, recarga la página.',
      locationError: 'No se pudo obtener tu ubicación',
      addressDetails: 'Detalles de la dirección',
      
      // Form fields
      street: 'Calle y número',
      neighborhood: 'Colonia',
      zipCode: 'Código postal',
      city: 'Ciudad',
      state: 'Estado',
      country: 'País',
      references: 'Referencias para encontrar tu domicilio',
      referencesPlaceholder: 'Entre calles, color de casa, puntos de referencia...',
      
      // Messages
      selectLocation: 'Por favor, selecciona una ubicación en el mapa',
      completeFields: 'Por favor completa todos los campos requeridos',
      outOfDeliveryArea: 'La dirección está fuera del área de entrega',
      savingAddress: 'Guardando dirección...',
      updatingAddress: 'Actualizando dirección...',
      addressSaved: 'Dirección guardada exitosamente',
      addressUpdated: 'Dirección actualizada exitosamente',
      redirecting: 'Redirigiendo a WhatsApp...',
      errorSaving: 'Error al guardar la dirección',
      errorUpdating: 'Error al actualizar la dirección',
    },
    geolocation: {
      notSupported: 'Tu navegador no soporta geolocalización',
      permissionDenied: 'Permiso de ubicación denegado',
      positionUnavailable: 'Ubicación no disponible',
      timeout: 'Tiempo de espera agotado',
      unknownError: 'Error desconocido al obtener ubicación',
    },
  },
  'en-US': {
    common: {
      loading: 'Loading...',
      error: 'Error',
      success: 'Success',
      save: 'Save',
      cancel: 'Cancel',
      continue: 'Continue',
      back: 'Back',
      close: 'Close',
    },
    otp: {
      verifying: 'Verifying link...',
      invalidLink: 'Invalid link',
      expiredLink: 'This link has expired or is invalid. Please request a new link from WhatsApp.',
      continueWhatsApp: 'Continue on WhatsApp',
    },
    address: {
      title: 'Register Delivery Address',
      updateTitle: 'Update Address',
      welcome: 'Hello{name}! Please complete your delivery information.',
      yourNumber: 'Your number: {number}',
      useMyLocation: 'Use my current location',
      searchPlaceholder: 'Search for your address...',
      mapError: 'Error loading map. Please reload the page.',
      locationError: 'Could not get your location',
      addressDetails: 'Address details',
      
      // Form fields
      street: 'Street and number',
      neighborhood: 'Neighborhood',
      zipCode: 'ZIP code',
      city: 'City',
      state: 'State',
      country: 'Country',
      references: 'References to find your address',
      referencesPlaceholder: 'Between streets, house color, landmarks...',
      
      // Messages
      selectLocation: 'Please select a location on the map',
      completeFields: 'Please complete all required fields',
      outOfDeliveryArea: 'Address is outside delivery area',
      savingAddress: 'Saving address...',
      updatingAddress: 'Updating address...',
      addressSaved: 'Address saved successfully',
      addressUpdated: 'Address updated successfully',
      redirecting: 'Redirecting to WhatsApp...',
      errorSaving: 'Error saving address',
      errorUpdating: 'Error updating address',
    },
    geolocation: {
      notSupported: 'Your browser does not support geolocation',
      permissionDenied: 'Location permission denied',
      positionUnavailable: 'Location unavailable',
      timeout: 'Request timeout',
      unknownError: 'Unknown error getting location',
    },
  },
};

export type TranslationKey = keyof typeof translations['es-MX'];
export type Locale = keyof typeof translations;