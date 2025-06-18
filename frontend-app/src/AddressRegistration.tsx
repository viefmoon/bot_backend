import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { AddressForm } from '@/components/AddressForm';
import { BasicMap } from '@/components/BasicMap';
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
    geocodedAddress: '',
  });
  const [isUpdating, setIsUpdating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [hasVerified, setHasVerified] = useState(false);
  const [polygonCoords, setPolygonCoords] = useState<Location[]>([]);
  const [mapCenter, setMapCenter] = useState<Location | null>(null);

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
        
        // If customer has addresses, load the default one
        if (response.customer.addresses.length > 0) {
          const defaultAddress = response.customer.addresses.find(addr => addr.isDefault) || response.customer.addresses[0];
          loadExistingAddress(defaultAddress);
        }
      } else {
        toast.error('El enlace ha expirado o no es válido.');
      }
    } catch (error) {
      console.error('Error al verificar el OTP:', error);
      toast.error('Hubo un error al verificar el enlace.');
    } finally {
      setLoading(false);
    }
  };

  const loadExistingAddress = (address: Address) => {
    setSelectedAddress(address);
    setIsUpdating(true);
    
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
      geocodedAddress: address.geocodedAddress || '',
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
    
    // Reverse geocoding using Google
    const geocoder = new google.maps.Geocoder();
    geocoder.geocode({ location }, (results, status) => {
      if (status === 'OK' && results && results[0]) {
        const addressComponents = results[0].address_components;
        const formattedAddress = results[0].formatted_address;
        
        const newFormData: Partial<AddressFormData> = {
          latitude: location.lat,
          longitude: location.lng,
          geocodedAddress: formattedAddress,
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


  const handleSubmit = async (data: AddressFormData) => {
    if (!selectedLocation) {
      toast.error('Por favor selecciona una ubicación en el mapa');
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
        toast.success('¡Dirección actualizada exitosamente!');
      } else {
        // Create new address
        await customerService.createAddress(customerId!, otp, data);
        toast.success('¡Dirección registrada exitosamente!');
      }

      // Success feedback
      setTimeout(() => {
        toast.success('Ahora puedes cerrar esta ventana y continuar con tu pedido en WhatsApp', {
          duration: 6000,
        });
      }, 1000);

      // If updating for a pre-order, notify backend
      if (preOrderId) {
        // The backend will handle the pre-order update
        toast.success('Tu pedido ha sido actualizado con la nueva dirección');
      }
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

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
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
        <Toaster position="top-center" />
      </div>
    );
  }


  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
      <div className="max-w-4xl mx-auto p-2 sm:p-4">
        <div className="bg-white rounded-xl sm:rounded-2xl shadow-xl overflow-hidden">
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-4 sm:p-6 text-white">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2">
              {isUpdating ? '📍 Actualizar Dirección' : '📍 Registrar Dirección de Entrega'}
            </h1>
            <div className="space-y-1">
              <p className="text-sm sm:text-base text-blue-100">
                ¡Hola{customer?.firstName ? ` ${customer.firstName}` : ''}! Por favor completa tu información de entrega.
              </p>
              {customerId && (
                <p className="text-xs sm:text-sm text-blue-200">
                  📱 Tu número: {customerId}
                </p>
              )}
            </div>
          </div>
          
          <div className="p-4 sm:p-6">

            {/* Use my location button */}
            <div className="mb-4 sm:mb-6">
              <button
                type="button"
                onClick={handleUseMyLocation}
                className="w-full sm:w-auto bg-white border-2 border-blue-500 text-blue-600 font-medium sm:font-semibold py-2.5 sm:py-3 px-4 sm:px-6 rounded-lg hover:bg-blue-50 transition duration-200 flex items-center justify-center text-sm sm:text-base"
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
                    : 'bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700'
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

            {/* List existing addresses if any */}
            {customer && customer.addresses.length > 0 && !isUpdating && (
              <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-gray-200">
                <h3 className="text-base sm:text-lg font-semibold text-gray-800 mb-3 sm:mb-4">📍 Mis direcciones guardadas</h3>
                <div className="space-y-2 sm:space-y-3">
                  {customer.addresses.map((address) => (
                    <div 
                      key={address.id} 
                      className="group p-3 sm:p-4 bg-white border-2 border-gray-200 rounded-lg hover:border-blue-400 hover:shadow-md cursor-pointer transition duration-200"
                      onClick={() => loadExistingAddress(address)}
                    >
                      <div className="flex justify-between items-start">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium sm:font-semibold text-gray-800 group-hover:text-blue-600 text-sm sm:text-base truncate">
                            {address.street} {address.number}
                            {address.interiorNumber && ` Int. ${address.interiorNumber}`}
                          </p>
                          <p className="text-xs sm:text-sm text-gray-600 mt-1 truncate">
                            {address.neighborhood && `${address.neighborhood}, `}
                            {address.city}, {address.state}
                          </p>
                        </div>
                        <div className="flex items-center space-x-1 sm:space-x-2 ml-2">
                          {address.isDefault && (
                            <span className="text-xs bg-green-100 text-green-700 px-2 sm:px-3 py-1 rounded-full font-medium whitespace-nowrap">
                              Principal
                            </span>
                          )}
                          <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-blue-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                          </svg>
                        </div>
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