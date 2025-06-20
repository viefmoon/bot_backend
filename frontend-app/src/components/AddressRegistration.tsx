import { useEffect } from 'react';
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
  useSendPreOrderMessage 
} from '@/hooks/useAddressQueries';
import type { AddressFormData, Address } from '@/types';

const libraries: ('places' | 'geometry')[] = ['places', 'geometry'];

interface Location {
  lat: number;
  lng: number;
}

export function AddressRegistration() {
  const [searchParams] = useSearchParams();
  
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
  const sendPreOrderMutation = useSendPreOrderMessage();

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
  }, [otpData, setCustomer, setValidating, setError]);

  const loadExistingAddress = (address: Address) => {
    setEditingAddressId(address.id);
    
    const formattedData: AddressFormData = {
      street: address.street,
      number: address.number,
      interiorNumber: address.interiorNumber || '',
      neighborhood: address.neighborhood || '',
      zipCode: address.zipCode || '',
      city: address.city,
      state: address.state,
      country: address.country,
      references: address.references || '',
      latitude: Number(address.latitude),
      longitude: Number(address.longitude),
    };

    setFormData(formattedData);
  };

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
        ...data,
        city: data.city || 'Ciudad',
        state: data.state || 'Estado',
        country: data.country || 'México'
      };

      if (editingAddressId) {
        // Update existing address
        await updateAddressMutation.mutateAsync({
          addressId: editingAddressId,
          whatsappPhoneNumber: customerId,
          otp,
          address: addressData,
        });
        toast.success('¡Dirección actualizada exitosamente!');
      } else {
        // Create new address
        await createAddressMutation.mutateAsync({
          whatsappPhoneNumber: customerId,
          otp,
          address: addressData,
        });
        toast.success('¡Dirección registrada exitosamente!');
      }

      // Success feedback
      setTimeout(() => {
        toast.success('Ahora puedes cerrar esta ventana y continuar con tu pedido en WhatsApp', {
          duration: 6000,
        });
      }, 1000);

      // If updating for a pre-order, notify backend
      if (preOrderId && customer) {
        await sendPreOrderMutation.mutateAsync({
          customerId: customer.id,
          preOrderId,
        });
        toast.success('Tu pedido ha sido actualizado con la nueva dirección');
      }
      
      resetForm();
    } catch (error: any) {
      console.error('Error al guardar la dirección:', error);
      const errorMessage = error.response?.data?.error || 'Hubo un error al guardar la dirección';
      toast.error(errorMessage);
    } finally {
      setSaving(false);
    }
  };

  const handleUseMyLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          handleLocationSelect({
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          });
        },
        (error) => {
          console.error('Error getting location:', error);
          toast.error('No se pudo obtener tu ubicación actual');
        }
      );
    } else {
      toast.error('Tu navegador no soporta geolocalización');
    }
  };

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

  const selectedLocation = formData.latitude && formData.longitude 
    ? { lat: formData.latitude, lng: formData.longitude } 
    : null;

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50">
      <div className="max-w-4xl mx-auto p-2 sm:p-4">
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl overflow-hidden">
          {/* Header con gradiente naranja-rosa */}
          <div className="bg-gradient-to-r from-orange-500 to-pink-600 p-4 sm:p-6 text-white">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 drop-shadow-lg">
              📍 {editingAddressId ? 'Actualizar Dirección' : 'Registrar Dirección de Entrega'}
            </h1>
            <div className="space-y-1">
              <p className="text-sm sm:text-base text-white font-medium drop-shadow">
                ¡Hola{customer.firstName ? ` ${customer.firstName}` : ''}! Por favor completa tu información de entrega.
              </p>
              {customerId && (
                <div className="inline-block bg-white/20 backdrop-blur-sm rounded-lg px-3 py-1 mt-2">
                  <p className="text-xs sm:text-sm text-white font-medium">
                    📱 Tu número: {customerId}
                  </p>
                </div>
              )}
            </div>
          </div>
          
          <div className="p-4 sm:p-6">


            {/* Use my location button */}
            <div className="mb-6">
            <button
              type="button"
              onClick={handleUseMyLocation}
              className="w-full sm:w-auto px-6 py-3 bg-gradient-to-r from-orange-500 to-pink-600 text-white font-semibold rounded-xl shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200 flex items-center justify-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Usar mi ubicación actual
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
            <div className="mt-6">
            <button
              type="submit"
              onClick={() => handleSubmit(formData)}
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

            {/* List existing addresses */}
            {customer.addresses.length > 0 && !editingAddressId && (
            <div className="mt-8 border-t-2 border-gray-100 pt-6">
              <h3 className="text-xl font-bold text-gray-800 mb-4">Mis direcciones guardadas</h3>
              <div className="space-y-3">
                {customer.addresses.map((address: Address) => (
                  <div 
                    key={address.id} 
                    className="p-4 border-2 border-gray-200 rounded-xl hover:border-indigo-400 hover:shadow-md transform hover:scale-102 transition-all duration-200 cursor-pointer bg-gradient-to-r from-gray-50 to-white"
                    onClick={() => loadExistingAddress(address)}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium">
                          {address.street} {address.number}
                          {address.interiorNumber && ` Int. ${address.interiorNumber}`}
                        </p>
                        <p className="text-sm text-gray-600">
                          {address.neighborhood && `${address.neighborhood}, `}
                          {address.city}, {address.state}
                        </p>
                      </div>
                      {address.isDefault && (
                        <span className="text-xs bg-gradient-to-r from-orange-400 to-pink-500 text-white px-3 py-1 rounded-full font-semibold shadow-sm">
                          Principal
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
              </div>
            )}
          </div>
        </div>
      </div>
      <Toaster position="top-center" />
    </div>
  );
}

export default AddressRegistration;