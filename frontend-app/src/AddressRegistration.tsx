import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { AddressForm } from '@/components/AddressForm';
import { BasicMap } from '@/components/BasicMap';
import { AddressManager } from '@/components/AddressManager';
import { WhatsAppButton } from '@/components/ui';
import customerService from '@/services/customer.service';
import type { AddressFormData, Customer, Address } from '@/types/customer.types';

interface Location {
  lat: number;
  lng: number;
}

function AddressRegistration() {
  const { customerId } = useParams<{ customerId: string }>();
  const [searchParams] = useSearchParams();
  const otp = searchParams.get('otp') || '';
  const preOrderId = searchParams.get('preOrderId');

  const [isValidOtp, setIsValidOtp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [selectedAddress, setSelectedAddress] = useState<Address | null>(null);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [formData, setFormData] = useState<AddressFormData>({
    street: '',
    number: '',
    interiorNumber: '',
    neighborhood: '',
    zipCode: '',
    city: '',
    state: '',
    country: '',
    references: '',
    latitude: 0,
    longitude: 0,
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasVerified, setHasVerified] = useState(false);
  const [polygonCoords, setPolygonCoords] = useState<Location[]>([]);
  const [mapCenter, setMapCenter] = useState<Location | null>(null);
  const [showAddressForm, setShowAddressForm] = useState(false);

  useEffect(() => {
    // Evitar doble verificación
    if (hasVerified) return;
    
    if (customerId && otp) {
      setHasVerified(true);
      verifyOtp();
    } else {
      setLoading(false);
      setIsValidOtp(false);
    }
  }, [customerId, otp, hasVerified]);

  // Load delivery area from backend
  useEffect(() => {
    const loadDeliveryArea = async () => {
      const { polygonCoords: coords } = await customerService.getDeliveryArea();
      if (coords && coords.length > 0) {
        setPolygonCoords(coords);
        
        // Calculate center from polygon
        const sumLat = coords.reduce((sum, coord) => sum + coord.lat, 0);
        const sumLng = coords.reduce((sum, coord) => sum + coord.lng, 0);
        setMapCenter({
          lat: sumLat / coords.length,
          lng: sumLng / coords.length
        });
      }
    };
    
    loadDeliveryArea();
  }, []);

  const verifyOtp = async () => {
    try {
      const response = await customerService.verifyOTP(customerId!, otp);
      
      if (response.valid && response.customer) {
        setIsValidOtp(true);
        setCustomer(response.customer);
        
        // If customer has addresses, show the address manager
        // Otherwise, show the form to add the first address
        if (response.customer.addresses.length === 0) {
          setShowAddressForm(true);
        }
      } else {
        toast.error('❌ El enlace ha expirado o no es válido');
      }
    } catch (error) {
      console.error('Error al verificar el OTP:', error);
      toast.error('⚠️ Hubo un error al verificar el enlace');
    } finally {
      setLoading(false);
    }
  };

  const loadExistingAddress = (address: Address) => {
    setSelectedAddress(address);
    setIsUpdating(true);
    setShowAddressForm(true);
    
    const formattedData: AddressFormData = {
      street: address.street,
      number: address.number,
      interiorNumber: address.interiorNumber || '',
      neighborhood: address.neighborhood || '',
      zipCode: address.zipCode || '',
      city: address.city || '',
      state: address.state || '',
      country: address.country || '',
      references: address.references || '',
      latitude: address.latitude || 0,
      longitude: address.longitude || 0,
    };

    setFormData(formattedData);
    
    if (address.latitude && address.longitude) {
      setSelectedLocation({
        lat: Number(address.latitude),
        lng: Number(address.longitude),
      });
    }
  };

  const handleLocationSelect = (location: Location) => {
    setSelectedLocation(location);
    setLocationError(null);
    
    // Update coordinates immediately
    setFormData(prev => ({
      ...prev,
      latitude: location.lat,
      longitude: location.lng,
    }));
    
    // Reverse geocoding using Google
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const addressComponents = results[0].address_components;
        const formattedAddress = results[0].formatted_address;
        
        const newFormData: Partial<AddressFormData> = {
          latitude: location.lat,
          longitude: location.lng,
        };

        addressComponents.forEach((component) => {
          const types = component.types;
          if (types.includes('route')) {
            newFormData.street = component.long_name;
          } else if (types.includes('street_number')) {
            newFormData.number = component.long_name;
          } else if (types.includes('sublocality_level_1') || types.includes('neighborhood')) {
            newFormData.neighborhood = component.long_name;
          } else if (types.includes('postal_code')) {
            newFormData.zipCode = component.long_name;
          } else if (types.includes('locality')) {
            newFormData.city = component.long_name;
          } else if (types.includes('administrative_area_level_1')) {
            newFormData.state = component.long_name;
          } else if (types.includes('country')) {
            newFormData.country = component.long_name;
          }
        });

        setFormData((prev) => ({ ...prev, ...newFormData }));
      }
    });
  };

  const handleAddNewAddress = () => {
    setShowAddressForm(true);
    setIsUpdating(false);
    setSelectedAddress(null);
    setSelectedLocation(null);
    setFormData({
      street: '',
      number: '',
      interiorNumber: '',
      neighborhood: '',
      zipCode: '',
      city: '',
      state: '',
      country: '',
      references: '',
      latitude: 0,
      longitude: 0,
    });
  };

  const loadCustomerData = async () => {
    try {
      const response = await customerService.verifyOTP(customerId!, otp);
      if (response.valid && response.customer) {
        setCustomer(response.customer);
        setShowAddressForm(false);
      }
    } catch (error) {
      console.error('Error reloading customer data:', error);
    }
  };


  const handleSubmit = async (data: AddressFormData) => {
    if (!selectedLocation) {
      toast.error('📍 Por favor selecciona una ubicación en el mapa');
      return;
    }

    setIsSubmitting(true);
    
    try {
      if (isUpdating && selectedAddress) {
        // Update existing address
        await customerService.updateAddress(
          selectedAddress.id,
          customerId!,
          otp,
          data
        );
        toast.success('✅ ¡Dirección actualizada exitosamente!');
      } else {
        // Create new address
        await customerService.createAddress(customerId!, otp, data);
        toast.success('🎉 ¡Dirección registrada exitosamente!');
      }
      
      // Reload customer data
      await loadCustomerData();

      // Success feedback and redirect to WhatsApp
      toast.success('📱 Redirigiendo a WhatsApp...', {
        duration: 2000,
      });

      // If updating for a pre-order, notify backend
      if (preOrderId) {
        // The backend will handle the pre-order update
        toast.success('🛍️ Tu pedido ha sido actualizado con la nueva dirección');
      }

      // Redirect to WhatsApp after a short delay
      setTimeout(() => {
        const phoneNumber = import.meta.env.VITE_BOT_WHATSAPP_NUMBER;
        const message = preOrderId 
          ? 'Mi dirección ha sido actualizada, por favor continúa con mi pedido.'
          : 'Hola, acabo de registrar mi dirección de entrega.';
        const encodedMessage = encodeURIComponent(message);
        const whatsappUrl = `https://wa.me/${phoneNumber}?text=${encodedMessage}`;
        
        // Try to close the window first, then redirect
        window.location.href = whatsappUrl;
        
        // Try to close the window after redirect (may not work in all browsers)
        setTimeout(() => {
          window.close();
        }, 100);
      }, 2000);
    } catch (error: any) {
      console.error('Error al guardar la dirección:', error);
      const errorMessage = error.response?.data?.error || 'Hubo un error al guardar la dirección';
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUseMyLocation = () => {
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude,
          };
          handleLocationSelect(location);
          toast.success('✨ ¡Ubicación actual capturada con éxito!');
        },
        (error) => {
          console.error('Error getting location:', error);
          let errorMessage = 'No se pudo obtener tu ubicación actual';
          
          switch(error.code) {
            case error.PERMISSION_DENIED:
              errorMessage = 'Permiso de ubicación denegado. Por favor habilita la ubicación en tu navegador.';
              break;
            case error.POSITION_UNAVAILABLE:
              errorMessage = 'La información de ubicación no está disponible.';
              break;
            case error.TIMEOUT:
              errorMessage = 'Se agotó el tiempo de espera para obtener la ubicación.';
              break;
          }
          
          toast.error(errorMessage);
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0
        }
      );
    } else {
      toast.error('Tu navegador no soporta geolocalización');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verificando enlace...</p>
        </div>
      </div>
    );
  }

  if (!isValidOtp) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-lg text-center">
          <svg className="mx-auto h-12 w-12 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Enlace inválido</h2>
          <p className="text-gray-600 mb-4">
            Este enlace ha expirado o no es válido. Por favor, solicita un nuevo enlace desde WhatsApp.
          </p>
          <div className="mt-6">
            <WhatsAppButton 
              className="w-full justify-center"
            >
              Continuar en WhatsApp
            </WhatsAppButton>
          </div>
        </div>
        <Toaster 
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#fff',
            color: '#1f2937',
            padding: '16px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid rgba(0, 0, 0, 0.05)',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
            style: {
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              border: 'none',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
            style: {
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              color: '#fff',
              border: 'none',
            },
          },
        }}
      />
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50">
      <div className="max-w-4xl mx-auto p-2 sm:p-4">
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-orange-500 to-pink-600 p-4 sm:p-6 text-white">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2 drop-shadow-lg">
              {customer && customer.addresses.length > 0 && !showAddressForm 
                ? '📍 Mis Direcciones de Entrega' 
                : isUpdating 
                  ? '📍 Actualizar Dirección' 
                  : '📍 Registrar Dirección de Entrega'}
            </h1>
            <div className="space-y-1">
              <p className="text-sm sm:text-base text-white font-medium drop-shadow">
                {customer && customer.addresses.length > 0 && !showAddressForm
                  ? `¡Hola${customer?.firstName ? ` ${customer.firstName}` : ''}! Selecciona o agrega una dirección de entrega.`
                  : `¡Hola${customer?.firstName ? ` ${customer.firstName}` : ''}! Por favor completa tu información de entrega.`}
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
            {/* Show AddressManager or Form based on state */}
            {customer && customer.addresses.length > 0 && !showAddressForm ? (
              <AddressManager
                addresses={customer.addresses}
                customerId={customerId!}
                otp={otp}
                onAddressClick={loadExistingAddress}
                onAddNew={handleAddNewAddress}
                onAddressesChange={loadCustomerData}
              />
            ) : (
              <>
                {/* Back button if user has addresses */}
                {customer && customer.addresses.length > 0 && (
                  <button
                    onClick={() => setShowAddressForm(false)}
                    className="mb-4 text-orange-600 hover:text-orange-700 flex items-center text-sm font-medium"
                  >
                    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                    </svg>
                    Volver a mis direcciones
                  </button>
                )}

                {/* Use my location button */}
                <div className="mb-4 sm:mb-6">
                  <button
                    type="button"
                    onClick={handleUseMyLocation}
                    className="w-full sm:w-auto bg-white border-2 border-orange-500 text-orange-600 font-medium sm:font-semibold py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg hover:bg-orange-50 transition duration-200 flex items-center justify-center text-sm sm:text-base"
                  >
                    <svg className="w-4 h-4 sm:w-5 sm:h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    Usar mi ubicación actual
                  </button>
                </div>

                {/* Map with Search */}
                <div className="mb-4 sm:mb-6">
                  {mapCenter && (
                    <BasicMap
                      center={selectedLocation || mapCenter}
                      onLocationSelect={handleLocationSelect}
                      selectedLocation={selectedLocation}
                      polygonCoords={polygonCoords}
                      onLocationError={setLocationError}
                    />
                  )}
                  {locationError && (
                    <div className="mt-2 bg-red-50 border border-red-200 text-red-600 px-3 sm:px-4 py-2 rounded-lg text-xs sm:text-sm">
                      {locationError}
                    </div>
                  )}
                </div>

                {/* Address Form */}
                <div className="bg-gray-50 rounded-lg p-4 sm:p-6 mb-4 sm:mb-6">
                  <h2 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4">Detalles de la dirección</h2>
                  <AddressForm
                    formData={formData}
                    onSubmit={handleSubmit}
                    isUpdating={isUpdating}
                  />
                </div>

                {/* Submit Button */}
                <div className="mt-4 sm:mt-6">
                  <button
                    type="submit"
                    onClick={() => handleSubmit(formData)}
                    disabled={isSubmitting || !selectedLocation}
                    className={`w-full py-3 sm:py-4 px-4 sm:px-6 font-medium sm:font-semibold rounded-lg transition duration-200 text-sm sm:text-base ${
                      isSubmitting || !selectedLocation
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-gradient-to-r from-orange-500 to-pink-600 text-white hover:from-orange-600 hover:to-pink-700'
                    }`}
                  >
                    {isSubmitting ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin -ml-1 mr-2 sm:mr-3 h-4 w-4 sm:h-5 sm:w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Guardando...
                      </span>
                    ) : (
                      <span>
                        {isUpdating ? 'Actualizar dirección' : 'Registrar dirección'}
                      </span>
                    )}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>
      <Toaster 
        position="top-center"
        toastOptions={{
          duration: 4000,
          style: {
            background: '#fff',
            color: '#1f2937',
            padding: '16px',
            borderRadius: '12px',
            fontSize: '14px',
            fontWeight: '500',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04)',
            border: '1px solid rgba(0, 0, 0, 0.05)',
          },
          success: {
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
            style: {
              background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
              color: '#fff',
              border: 'none',
            },
          },
          error: {
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
            style: {
              background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
              color: '#fff',
              border: 'none',
            },
          },
        }}
      />
    </div>
  );
}

export default AddressRegistration;