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
};

export type TranslationKey = keyof typeof translations['es-MX'];