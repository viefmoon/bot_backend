import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLoadScript, Autocomplete } from '@react-google-maps/api';
import toast, { Toaster } from 'react-hot-toast';
import { AddressForm } from '@/components/AddressForm';
import { Map } from '@/components/Map';
import { Button } from '@/components/ui';
import customerService from '@/services/customer.service';
import type { AddressFormData, Customer, Address } from '@/types';

const libraries: ('places' | 'geometry')[] = ['places', 'geometry'];

interface Location {
  lat: number;
  lng: number;
}

function App() {
  const [searchParams] = useSearchParams();
  const customerId = searchParams.get('from') || '';
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
  const [autocomplete, setAutocomplete] = useState<google.maps.places.Autocomplete | null>(null);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries,
  });

  const polygonCoords: Location[] = import.meta.env.VITE_POLYGON_COORDS 
    ? JSON.parse(import.meta.env.VITE_POLYGON_COORDS)
    : [];

  useEffect(() => {
    if (customerId && otp) {
      verifyOtp();
    } else {
      setLoading(false);
      toast.error('El enlace no es válido. Falta información necesaria.');
    }
  }, [customerId, otp]);

  const verifyOtp = async () => {
    try {
      const response = await customerService.verifyOTP(customerId, otp);
      
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
    
    // Reverse geocoding to get address details
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

  const handlePlaceSelect = () => {
    if (autocomplete) {
      const place = autocomplete.getPlace();
      if (place.geometry && place.geometry.location) {
        const location = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        };
        handleLocationSelect(location);
      }
    }
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
          customerId,
          otp,
          data
        );
        toast.success('¡Dirección actualizada exitosamente!');
      } else {
        // Create new address
        await customerService.createAddress(customerId, otp, data);
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
          <p className="text-gray-600">
            Este enlace ha expirado o no es válido. Por favor, solicita un nuevo enlace desde WhatsApp.
          </p>
          <div className="mt-6">
            <a
              href={`https://wa.me/${import.meta.env.VITE_WHATSAPP_NUMBER}`}
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-green-600 hover:bg-green-700"
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
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Cargando mapa...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto p-2">
        <div className="bg-white rounded-lg shadow-lg p-4 mb-4">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            {isUpdating ? 'Actualizar dirección de entrega' : 'Registrar dirección de entrega'}
          </h1>
          
          {customer && (
            <p className="text-gray-600 mb-4">
              Hola {customer.firstName || 'Cliente'}, por favor completa tu información de entrega.
            </p>
          )}

          {/* Address Search */}
          <div className="mb-4">
            <Autocomplete
              onLoad={setAutocomplete}
              onPlaceChanged={handlePlaceSelect}
              options={{
                componentRestrictions: { country: 'mx' },
                fields: ['address_components', 'geometry', 'formatted_address'],
              }}
            >
              <input
                type="text"
                placeholder="Buscar dirección..."
                className="w-full px-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </Autocomplete>
          </div>

          {/* Use my location button */}
          <div className="mb-4">
            <Button
              type="button"
              variant="outline"
              onClick={handleUseMyLocation}
              className="w-full sm:w-auto"
            >
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              Usar mi ubicación actual
            </Button>
          </div>

          {/* Map */}
          <div className="mb-4">
            <Map
              center={selectedLocation || { lat: 20.6597, lng: -103.3496 }}
              onLocationSelect={handleLocationSelect}
              selectedLocation={selectedLocation}
              polygonCoords={polygonCoords}
              onLocationError={setLocationError}
            />
            {locationError && (
              <p className="mt-2 text-sm text-red-600">{locationError}</p>
            )}
          </div>

          {/* Address Form */}
          <AddressForm
            formData={formData}
            onSubmit={handleSubmit}
            isUpdating={isUpdating}
          />

          {/* Submit Button */}
          <div className="mt-4">
            <Button
              type="submit"
              onClick={() => handleSubmit(formData)}
              disabled={isSubmitting || !selectedLocation}
              loading={isSubmitting}
              className="w-full"
            >
              {isSubmitting 
                ? 'Guardando...' 
                : isUpdating 
                  ? 'Actualizar dirección' 
                  : 'Registrar dirección'
              }
            </Button>
          </div>

          {/* List existing addresses if any */}
          {customer && customer.addresses.length > 0 && !isUpdating && (
            <div className="mt-6 border-t pt-4">
              <h3 className="text-lg font-semibold mb-2">Mis direcciones guardadas</h3>
              <div className="space-y-2">
                {customer.addresses.map((address) => (
                  <div 
                    key={address.id} 
                    className="p-3 border rounded-md hover:bg-gray-50 cursor-pointer"
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
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
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
      <Toaster position="top-center" />
    </div>
  );
}

export default App;