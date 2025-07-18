import { useEffect, useState, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLoadScript } from '@react-google-maps/api';
import toast, { Toaster } from 'react-hot-toast';
import { AddressForm } from '@/components/AddressForm';
import { BasicMap as Map } from '@/components/BasicMap';
import { useAddressRegistrationStore } from '@/store/addressRegistrationStore';
import { 
  useVerifyOtp, 
  useCreateAddress, 
  useUpdateAddress, 
  useDeliveryArea,
  useUpdateCustomerName,
  useSetDefaultAddress 
} from '@/hooks/useAddressQueries';
import { CustomerNameForm } from '@/components/CustomerNameForm';
import type { AddressFormData, Address } from '@/types';
import { t } from '@/i18n';

const libraries: ('places' | 'geometry')[] = ['places', 'geometry'];

interface Location {
  lat: number;
  lng: number;
}

export function AddressRegistration() {
  const [searchParams] = useSearchParams();
  
  // Estado para controlar qué vista mostrar - MUST be before any conditional returns
  const [viewMode, setViewMode] = useState<'list' | 'form'>('list');
  const [isEditingCustomerName, setIsEditingCustomerName] = useState(false);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  
  // Get store state and actions
  const {
    customerId,
    otp,
    preOrderId,
    customer,
    formData,
    isValidating,
    isSaving,
    editingAddressId,
    setSession,
    setCustomer,
    setFormData,
    updateFormField,
    setValidating,
    setSaving,
    setError,
    setEditingAddressId,
    resetForm,
  } = useAddressRegistrationStore();

  // Initialize session from URL params
  useEffect(() => {
    // Clear old localStorage data with wrong field names
    const storedData = localStorage.getItem('address-registration-storage');
    if (storedData) {
      try {
        const parsed = JSON.parse(storedData);
        if (parsed.state?.formData?.references !== undefined) {
          console.log('Clearing old localStorage data with references field');
          localStorage.removeItem('address-registration-storage');
        }
      } catch (e) {
        console.error('Error parsing localStorage:', e);
      }
    }
    
    // Get customerId from URL path (e.g., /address-registration/5213320407035)
    const pathParts = window.location.pathname.split('/');
    const urlCustomerId = pathParts[pathParts.length - 1] || searchParams.get('from') || '';
    const urlOtp = searchParams.get('otp') || '';
    const urlPreOrderId = searchParams.get('preOrderId') || null;
    
    if (urlCustomerId && urlOtp) {
      setSession(urlCustomerId, urlOtp, urlPreOrderId || undefined);
    }
  }, [searchParams, setSession]);

  // Google Maps
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries,
  });

  // React Query hooks
  const { data: otpData, isLoading: isVerifying } = useVerifyOtp(
    customerId && otp ? { whatsappPhoneNumber: customerId, otp } : null
  );
  
  const { data: deliveryAreaData } = useDeliveryArea();
  const createAddressMutation = useCreateAddress();
  const updateAddressMutation = useUpdateAddress();
  const updateCustomerNameMutation = useUpdateCustomerName();
  const setDefaultAddressMutation = useSetDefaultAddress();

  const loadExistingAddress = useCallback((address: Address) => {
    setEditingAddressId(address.id.toString());
    
    const formattedData: AddressFormData = {
      name: address.name || '',
      street: address.street,
      number: address.number,
      interiorNumber: address.interiorNumber || '',
      neighborhood: address.neighborhood || '',
      zipCode: address.zipCode || '',
      city: address.city || '',
      state: address.state || '',
      country: address.country || '',
      deliveryInstructions: address.deliveryInstructions || '',
      latitude: Number(address.latitude),
      longitude: Number(address.longitude),
    };

    setFormData(formattedData);
  }, [setFormData, setEditingAddressId]);

  // Handle OTP verification response
  useEffect(() => {
    if (otpData) {
      if (otpData.valid && otpData.customer) {
        setCustomer(otpData.customer);
        setValidating(false);
        
        // If customer has addresses, load the default one
        if (otpData.customer.addresses.length > 0) {
          const defaultAddress = otpData.customer.addresses.find((addr: Address) => addr.isDefault) 
            || otpData.customer.addresses[0];
          loadExistingAddress(defaultAddress);
        }
      } else {
        setError('El enlace ha expirado o no es válido.');
        toast.error('El enlace ha expirado o no es válido.');
      }
    }
  }, [otpData, setCustomer, setValidating, setError, loadExistingAddress]);

  const handleLocationSelect = (location: Location) => {
    updateFormField('latitude', location.lat);
    updateFormField('longitude', location.lng);
    
    // Reverse geocoding
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const addressComponents = results[0].address_components;
        
        const updates: Partial<AddressFormData> = {};
        
        addressComponents.forEach((component) => {
          const types = component.types;
          if (types.includes('route')) {
            updates.street = component.long_name;
          } else if (types.includes('street_number')) {
            updates.number = component.long_name;
          } else if (types.includes('sublocality_level_1') || types.includes('neighborhood')) {
            updates.neighborhood = component.long_name;
          } else if (types.includes('postal_code')) {
            updates.zipCode = component.long_name;
          } else if (types.includes('locality')) {
            updates.city = component.long_name;
          } else if (types.includes('administrative_area_level_1')) {
            updates.state = component.long_name;
          } else if (types.includes('country')) {
            updates.country = component.long_name;
          }
        });

        setFormData(updates);
      }
    });
  };

  const handleSubmit = async (data: AddressFormData) => {
    console.log('Submit called with data:', data);
    console.log('Current form data:', formData);
    console.log('Session data:', { customerId, otp });
    
    if (!data.name || data.name.trim() === '') {
      toast.error('Por favor ingresa un nombre para identificar esta dirección');
      return;
    }
    
    if (!data.latitude || !data.longitude) {
      toast.error('Por favor selecciona una ubicación en el mapa');
      return;
    }

    if (!customerId || !otp) {
      toast.error('Información de sesión no válida');
      return;
    }

    setSaving(true);
    
    try {
      // Ensure required fields have values
      const addressData = {
        name: data.name.trim(), // Ensure name is trimmed
        street: data.street,
        number: data.number,
        interiorNumber: data.interiorNumber || '',
        neighborhood: data.neighborhood || '',
        city: data.city || 'Ciudad',
        state: data.state || 'Estado',
        country: data.country || 'México',
        zipCode: data.zipCode || '',
        deliveryInstructions: data.deliveryInstructions || '',
        latitude: data.latitude,
        longitude: data.longitude
      };
      
      console.log('Sending address data:', addressData);

      if (editingAddressId) {
        // Update existing address
        await updateAddressMutation.mutateAsync({
          addressId: editingAddressId,
          whatsappPhoneNumber: customerId,
          otp,
          address: addressData,
        });
        toast.success(
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-semibold text-gray-900">¡Dirección actualizada!</p>
              <p className="text-xs text-gray-600">Los cambios se guardaron correctamente</p>
            </div>
          </div>,
          {
            duration: 4000,
            style: {
              background: '#f0fdf4',
              border: '1px solid #86efac',
              padding: '16px',
              maxWidth: '420px',
            },
          }
        );
      } else {
        // Create new address
        await createAddressMutation.mutateAsync({
          whatsappPhoneNumber: customerId,
          otp,
          address: addressData,
          preOrderId: preOrderId || undefined,
        });
        toast.success(
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-semibold text-gray-900">¡Dirección guardada!</p>
              <p className="text-xs text-gray-600">Tu nueva dirección está lista para usar</p>
            </div>
          </div>,
          {
            duration: 4000,
            style: {
              background: '#f0fdf4',
              border: '1px solid #86efac',
              padding: '16px',
              maxWidth: '420px',
            },
          }
        );
      }

      // Note: If updating for a pre-order, the backend automatically
      // recreates the preOrder with the new address when it's created
      
      resetForm();
      
      // Siempre volver a la lista de direcciones
      setTimeout(() => {
        setViewMode('list');
        setEditingAddressId(null);
      }, 1500); // Esperar un poco para que el usuario vea el mensaje de éxito
    } catch (error) {
      console.error('Error al guardar la dirección:', error);
      const errorMessage = error instanceof Error ? error.message : 'Hubo un error al guardar la dirección';
      toast.error(
        <div className="flex items-center">
          <div className="flex-shrink-0">
            <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm font-semibold text-gray-900">Error al guardar</p>
            <p className="text-xs text-gray-600">{errorMessage}</p>
          </div>
        </div>,
        {
          duration: 5000,
          style: {
            background: '#fef2f2',
            border: '1px solid #fecaca',
            padding: '16px',
            maxWidth: '420px',
          },
        }
      );
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateCustomerName = async (firstName: string, lastName: string) => {
    try {
      console.log('Updating customer name:', { firstName, lastName, customerId, otp });
      console.log('Full params being sent:', {
        whatsappPhoneNumber: customerId,
        otp,
        firstName,
        lastName,
      });
      
      if (!customerId || !otp) {
        console.error('Missing required data:', { customerId, otp });
        toast.error('Información de sesión no válida. Por favor, recarga la página.');
        return;
      }
      
      const result = await updateCustomerNameMutation.mutateAsync({
        whatsappPhoneNumber: customerId,
        otp,
        firstName,
        lastName,
      });
      
      console.log('Update result:', result);
      
      if (result.success && result.customer) {
        console.log('Updated customer:', result.customer);
        
        // Update the customer state with the new data
        const updatedCustomer = {
          ...result.customer,
          addresses: result.customer.addresses || []
        };
        
        setCustomer(updatedCustomer);
        toast.success('¡Información actualizada correctamente!');
        
        // If customer has addresses, load the default one
        if (updatedCustomer.addresses.length > 0) {
          const defaultAddress = updatedCustomer.addresses.find((addr: Address) => addr.isDefault) 
            || updatedCustomer.addresses[0];
          loadExistingAddress(defaultAddress);
        }
      }
    } catch (error) {
      console.error('Error updating customer name:', error);
      
      let errorMessage = 'Error al actualizar tu información';
      
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      toast.error(errorMessage);
    }
  };

  const handleUseMyLocation = async () => {
    if (!('geolocation' in navigator)) {
      toast.error(t('geolocation.notSupported'));
      return;
    }

    setIsGettingLocation(true);

    try {
      // Primero verificar el estado de los permisos si la API está disponible
      if ('permissions' in navigator) {
        try {
          const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
          
          // Si los permisos fueron previamente denegados, informar al usuario
          if (permissionStatus.state === 'denied') {
            toast.error(t('geolocation.permissionDenied'));
            setIsGettingLocation(false);
            return;
          }
        } catch {
          // La API de permisos no está disponible en todos los navegadores, continuar
          console.log('Permissions API not available');
        }
      }

      // Solicitar la ubicación con opciones mejoradas
      navigator.geolocation.getCurrentPosition(
        (position) => {
          handleLocationSelect({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
          setIsGettingLocation(false);
          toast.success('Ubicación obtenida exitosamente');
        },
        (error) => {
          console.error('Geolocation error:', error);
          setIsGettingLocation(false);
          
          // Manejar diferentes tipos de error
          switch (error.code) {
            case error.PERMISSION_DENIED:
              toast.error(t('geolocation.permissionDenied'));
              break;
            case error.POSITION_UNAVAILABLE:
              toast.error(t('geolocation.positionUnavailable'));
              break;
            case error.TIMEOUT:
              toast.error(t('geolocation.timeout'));
              break;
            default:
              toast.error(t('geolocation.unknownError'));
          }
        },
        {
          enableHighAccuracy: true,
          timeout: 10000, // 10 segundos
          maximumAge: 0 // No usar caché
        }
      );
    } catch (error) {
      console.error('Unexpected error:', error);
      setIsGettingLocation(false);
      toast.error(t('geolocation.unknownError'));
    }
  };

  // Si el usuario tiene direcciones, mostrar la lista primero
  useEffect(() => {
    if (customer?.addresses && customer.addresses.length > 0) {
      setViewMode('list');
    } else {
      setViewMode('form');
    }
  }, [customer?.addresses?.length]);

  const selectedLocation = formData.latitude && formData.longitude 
    ? { lat: formData.latitude, lng: formData.longitude } 
    : null;

  // Loading states
  if (isVerifying || isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-red-50 to-pink-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verificando enlace...</p>
        </div>
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-lg text-center">
          <svg className="mx-auto h-12 w-12 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Enlace inválido</h2>
          <p className="text-gray-600">
            Este enlace ha expirado o no es válido. Por favor, solicita un nuevo enlace desde WhatsApp.
          </p>
          <div className="mt-6">
            <a
              href={`https://wa.me/${import.meta.env.VITE_WHATSAPP_NUMBER}`}
              className="inline-flex items-center px-6 py-3 text-white font-semibold rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 hover:shadow-lg transform hover:scale-105 transition-all duration-200"
            >
              Abrir WhatsApp
            </a>
          </div>
        </div>
        <Toaster position="top-center" />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="text-center text-red-600">
          Error al cargar Google Maps. Por favor, recarga la página.
        </div>
      </div>
    );
  }

  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-red-50 to-pink-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando mapa...</p>
        </div>
      </div>
    );
  }

  // Debug logs
  console.log('Render state:', {
    customer,
    hasFirstName: customer?.firstName,
    hasLastName: customer?.lastName,
    shouldShowNameForm: customer && (!customer.firstName || !customer.lastName),
    shouldShowAddressForm: customer && customer.firstName && customer.lastName,
    viewMode
  });

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50">
      <div className="max-w-4xl mx-auto p-2 sm:p-4">
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl overflow-hidden">
          {/* Header con gradiente naranja-rosa */}
          <div className="bg-gradient-to-r from-orange-500 to-pink-600 p-4 sm:p-6 text-white">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 drop-shadow-lg">
              📍 {viewMode === 'list' 
                ? 'Mis Direcciones de Entrega' 
                : editingAddressId 
                  ? `Actualizar: ${formData.name || 'Dirección'}` 
                  : 'Registrar Dirección de Entrega'}
            </h1>
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex items-center gap-2">
                <p className="text-sm sm:text-base text-white font-medium drop-shadow">
                  {customer.firstName && customer.lastName 
                    ? `${customer.firstName} ${customer.lastName}`
                    : customer.firstName 
                      ? customer.firstName
                      : 'Cliente'}
                </p>
                {customer.firstName && customer.lastName && (
                  <button
                    onClick={() => setIsEditingCustomerName(true)}
                    className="p-1.5 rounded-lg bg-white/20 hover:bg-white/30 transition-colors"
                    title="Editar nombre"
                  >
                    <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                )}
              </div>
              {customerId && (
                <div className="inline-block bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1">
                  <p className="text-xs sm:text-sm text-white font-medium">
                    📱 {customerId}
                  </p>
                </div>
              )}
            </div>
          </div>
          
          <div className="p-4 sm:p-6">
            {/* Show name form if customer doesn't have firstName or lastName OR if editing */}
            {customer && ((!customer.firstName || !customer.lastName) || isEditingCustomerName) && (
              <CustomerNameForm
                onSubmit={async (firstName, lastName) => {
                  await handleUpdateCustomerName(firstName, lastName);
                  setIsEditingCustomerName(false);
                }}
                isSubmitting={updateCustomerNameMutation.isPending}
                initialFirstName={customer.firstName || ''}
                initialLastName={customer.lastName || ''}
                isEditing={isEditingCustomerName}
                onCancel={() => setIsEditingCustomerName(false)}
              />
            )}

            {/* Show list view if customer has addresses and viewMode is 'list' AND not editing name */}
            {customer && customer.firstName && customer.lastName && !isEditingCustomerName && viewMode === 'list' && customer.addresses.length > 0 && (
              <div>
                <div className="grid gap-4 mb-6">
                  {customer.addresses.map((address) => (
                    <div 
                      key={address.id} 
                      className={`relative group transition-all duration-300 ${
                        address.isDefault 
                          ? 'ring-2 ring-orange-400 shadow-lg' 
                          : 'hover:shadow-lg'
                      }`}
                    >
                      <div className="bg-white rounded-2xl p-6 border border-gray-100">
                        <div className="flex justify-between items-start gap-4">
                          <div className="flex-1">
                            {/* Address Name with Icon */}
                            <div className="flex items-center gap-3 mb-3">
                              <div className={`p-2 rounded-lg ${
                                address.isDefault 
                                  ? 'bg-gradient-to-r from-orange-100 to-pink-100' 
                                  : 'bg-gray-100'
                              }`}>
                                <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                </svg>
                              </div>
                              <h3 className="font-bold text-xl text-gray-800">{address.name}</h3>
                              {/* Default Badge inline */}
                              {address.isDefault && (
                                <span className="inline-flex items-center gap-1 bg-gradient-to-r from-orange-400 to-pink-500 text-white text-xs font-semibold px-3 py-1 rounded-full">
                                  <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                                  </svg>
                                  Principal
                                </span>
                              )}
                            </div>

                            {/* Address Details */}
                            <div className="space-y-1 text-gray-600">
                              <p className="font-medium">
                                {address.street} {address.number}
                                {address.interiorNumber && ` Int. ${address.interiorNumber}`}
                              </p>
                              <p className="text-sm">
                                {address.neighborhood && `${address.neighborhood}, `}
                                {address.city}, {address.state}
                              </p>
                            </div>

                            {/* Delivery Instructions */}
                            {address.deliveryInstructions && (
                              <div className="mt-3 flex items-start gap-2">
                                <svg className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                                </svg>
                                <p className="text-sm text-gray-500">{address.deliveryInstructions}</p>
                              </div>
                            )}
                          </div>

                          {/* Actions Column */}
                          <div className="flex flex-col gap-2">
                            {/* Edit Button */}
                            <button
                              onClick={() => {
                                loadExistingAddress(address);
                                setViewMode('form');
                              }}
                              className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-all duration-200 group"
                            >
                              <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                              </svg>
                              <span className="text-sm font-medium">Editar</span>
                            </button>

                            {/* Set as Default Button */}
                            {!address.isDefault && (
                              <button
                                onClick={async () => {
                                  try {
                                    await setDefaultAddressMutation.mutateAsync({
                                      addressId: address.id,
                                      whatsappPhoneNumber: customerId!,
                                      otp: otp!
                                    });
                                    toast.success(
                                      <div className="flex items-center">
                                        <div className="flex-shrink-0">
                                          <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                          </svg>
                                        </div>
                                        <div className="ml-3">
                                          <p className="text-sm font-semibold text-gray-900">¡Dirección principal actualizada!</p>
                                          <p className="text-xs text-gray-600">{address.name} es ahora tu dirección principal</p>
                                        </div>
                                      </div>,
                                      {
                                        duration: 4000,
                                        style: {
                                          background: '#f0fdf4',
                                          border: '1px solid #86efac',
                                          padding: '16px',
                                          maxWidth: '420px',
                                        },
                                      }
                                    );
                                    // Actualizar el estado del cliente
                                    if (customer) {
                                      const updatedAddresses = customer.addresses.map((addr) => ({
                                        ...addr,
                                        isDefault: addr.id === address.id
                                      }));
                                      setCustomer({ ...customer, addresses: updatedAddresses });
                                    }
                                  } catch {
                                    toast.error(
                                      <div className="flex items-center">
                                        <div className="flex-shrink-0">
                                          <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                          </svg>
                                        </div>
                                        <div className="ml-3">
                                          <p className="text-sm font-semibold text-gray-900">Error</p>
                                          <p className="text-xs text-gray-600">No se pudo cambiar la dirección principal</p>
                                        </div>
                                      </div>,
                                      {
                                        duration: 5000,
                                        style: {
                                          background: '#fef2f2',
                                          border: '1px solid #fecaca',
                                          padding: '16px',
                                          maxWidth: '420px',
                                        },
                                      }
                                    );
                                  }
                                }}
                                disabled={setDefaultAddressMutation.isPending}
                                className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-pink-600 text-white rounded-lg hover:shadow-md transition-all duration-200 group disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {setDefaultAddressMutation.isPending ? (
                                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                                ) : (
                                  <svg className="w-4 h-4 group-hover:scale-110 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                  </svg>
                                )}
                                <span className="text-sm font-medium">Hacer principal</span>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
                
                <button
                  onClick={() => {
                    resetForm();
                    setEditingAddressId(null);
                    setViewMode('form');
                  }}
                  className="w-full px-6 py-4 bg-gradient-to-r from-orange-500 to-pink-600 text-white font-bold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200"
                >
                  <span className="flex items-center justify-center">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                    </svg>
                    Agregar nueva dirección
                  </span>
                </button>
              </div>
            )}

            {/* Show form view if viewMode is 'form' or no addresses AND not editing name */}
            {customer && customer.firstName && customer.lastName && !isEditingCustomerName && (viewMode === 'form' || customer.addresses.length === 0) && (
              <>
                {/* Botón para volver a la lista si hay direcciones */}
                {customer.addresses.length > 0 && (
                  <div className="mb-4">
                    <button
                      type="button"
                      onClick={() => {
                        setViewMode('list');
                        setEditingAddressId(null);
                        resetForm();
                      }}
                      className="flex items-center text-gray-600 hover:text-gray-800 font-medium"
                    >
                      <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      Volver a mis direcciones
                    </button>
                  </div>
                )}
                
                {/* Use my location button */}
                <div className="mb-6">
                  <button
                    type="button"
                    onClick={handleUseMyLocation}
                    disabled={isGettingLocation}
                    className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                  >
                    {isGettingLocation ? (
                      <>
                        <svg className="animate-spin w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Obteniendo ubicación...
                      </>
                    ) : (
                      <>
                        <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        {t('address.useMyLocation')}
                      </>
                    )}
                  </button>
                </div>

                {/* Map */}
                <div className="mb-6">
                  <Map
              center={selectedLocation || { lat: 20.6597, lng: -103.3496 }}
              onLocationSelect={handleLocationSelect}
              selectedLocation={selectedLocation}
              polygonCoords={deliveryAreaData?.polygonCoords || []}
              onLocationError={(error) => toast.error(error)}
                  />
                </div>

                {/* Address Form */}
                <AddressForm
                  formData={formData}
                  onSubmit={handleSubmit}
                  isUpdating={!!editingAddressId}
                />

                {/* Submit Button */}
                <div className="mt-6 space-y-3">
                  <button
                    type="button"
                    onClick={() => {
                      // Trigger the form's submit to use its validation
                      const submitButton = document.getElementById('address-form-submit') as HTMLButtonElement;
                      if (submitButton) {
                        submitButton.click();
                      }
                    }}
                    disabled={isSaving || !selectedLocation}
                    className={`w-full px-6 py-4 font-bold text-white rounded-xl shadow-lg transform transition-all duration-200 ${
                      isSaving || !selectedLocation
                        ? 'bg-gray-400 cursor-not-allowed'
                        : 'bg-gradient-to-r from-orange-500 to-pink-600 hover:shadow-xl hover:scale-105'
                    }`}
                  >
                    {isSaving 
                      ? (
                        <div className="flex items-center justify-center">
                          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                          Guardando...
                        </div>
                      )
                      : editingAddressId 
                        ? 'Actualizar dirección' 
                        : 'Registrar dirección'
                    }
                  </button>
                </div>
              </>
            )}

          </div>
        </div>
      </div>
      <Toaster position="top-center" />
    </div>
  );
}

export default AddressRegistration;