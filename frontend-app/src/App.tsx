import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useLoadScript, Autocomplete } from '@react-google-maps/api';
import toast, { Toaster } from 'react-hot-toast';
import { AddressForm } from '@/components/AddressForm';
import { Map } from '@/components/Map';
import { Button } from '@/components/ui';
import { customerService } from '@/services/customer.service';
import type { Location, AddressFormData, CustomerDeliveryInfo } from '@/types/customer.types';

const libraries: ('places' | 'geometry')[] = ['places', 'geometry'];

function App() {
  const [searchParams] = useSearchParams();
  const customerId = searchParams.get('from') || '';
  const otp = searchParams.get('otp') || '';
  const preOrderId = searchParams.get('preOrderId');

  const [isValidOtp, setIsValidOtp] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState<Location | null>(null);
  const [formData, setFormData] = useState<AddressFormData>({
    customerId,
    pickupName: '',
    streetAddress: '',
    neighborhood: '',
    postalCode: '',
    city: '',
    state: '',
    country: '',
    latitude: '',
    longitude: '',
    additionalDetails: '',
    geocodedAddress: '',
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
      const isValid = await customerService.verifyOtp(customerId, otp);
      setIsValidOtp(isValid);
      
      if (isValid) {
        await loadExistingDeliveryInfo();
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

  const loadExistingDeliveryInfo = async () => {
    try {
      const existingInfo = await customerService.getDeliveryInfo(customerId);
      
      if (existingInfo) {
        const formattedData: AddressFormData = {
          customerId,
          pickupName: existingInfo.pickupName || '',
          streetAddress: existingInfo.streetAddress || '',
          neighborhood: existingInfo.neighborhood || '',
          postalCode: existingInfo.postalCode || '',
          city: existingInfo.city || '',
          state: existingInfo.state || '',
          country: existingInfo.country || '',
          latitude: existingInfo.latitude?.toString() || '',
          longitude: existingInfo.longitude?.toString() || '',
          additionalDetails: existingInfo.additionalDetails || '',
          geocodedAddress: existingInfo.geocodedAddress || '',
        };

        setFormData(formattedData);
        
        if (existingInfo.latitude && existingInfo.longitude) {
          setSelectedLocation({
            lat: existingInfo.latitude,
            lng: existingInfo.longitude,
          });
        }
        
        setIsUpdating(true);
      }
    } catch (error) {
      console.error('Error al cargar información existente:', error);
    }
  };

  const requestLocation = async () => {
    if (!('geolocation' in navigator)) {
      toast.error('Tu navegador no soporta geolocalización');
      return;
    }

    try {
      const position = await new Promise<GeolocationPosition>((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject);
      });

      const { latitude, longitude } = position.coords;
      const location: Location = { lat: latitude, lng: longitude };
      
      setSelectedLocation(location);
      const addressDetails = await getAddressFromCoordinates(location);
      
      setFormData(prev => ({
        ...prev,
        ...addressDetails,
        latitude: location.lat.toString(),
        longitude: location.lng.toString(),
      }));

      if (!isLocationAllowed(location)) {
        setLocationError('La ubicación actual está fuera del área permitida.');
      } else {
        setLocationError(null);
      }
    } catch (error) {
      console.error('Error obteniendo ubicación:', error);
      toast.error('No se pudo obtener tu ubicación actual');
    }
  };

  const getAddressFromCoordinates = async (location: Location): Promise<Partial<AddressFormData>> => {
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${location.lat},${location.lng}&key=${import.meta.env.VITE_GOOGLE_MAPS_API_KEY}`
      );
      const data = await response.json();
      
      if (data.results.length > 0) {
        return extractAddressDetails(data.results[0].address_components);
      }
    } catch (error) {
      console.error('Error obteniendo dirección:', error);
    }
    return {};
  };

  const extractAddressDetails = (addressComponents: google.maps.GeocoderAddressComponent[]): Partial<AddressFormData> => {
    const details: Partial<AddressFormData> = {
      streetAddress: '',
      neighborhood: '',
      postalCode: '',
      city: '',
      state: '',
      country: '',
    };

    let streetNumber = '';
    let streetName = '';

    addressComponents.forEach((component) => {
      const types = component.types;
      
      if (types.includes('street_number')) {
        streetNumber = component.long_name;
      }
      if (types.includes('route')) {
        streetName = component.long_name;
      }
      if (types.includes('sublocality_level_1') || types.includes('neighborhood')) {
        details.neighborhood = component.long_name;
      }
      if (types.includes('postal_code')) {
        details.postalCode = component.long_name;
      }
      if (types.includes('locality')) {
        details.city = component.long_name;
      }
      if (types.includes('administrative_area_level_1')) {
        details.state = component.long_name;
      }
      if (types.includes('country')) {
        details.country = component.long_name;
      }
    });

    details.streetAddress = streetName + (streetNumber ? ` ${streetNumber}` : '');
    return details;
  };

  const handlePlaceChanged = () => {
    if (!autocomplete) return;
    
    const place = autocomplete.getPlace();
    if (!place.geometry?.location) return;

    const location: Location = {
      lat: place.geometry.location.lat(),
      lng: place.geometry.location.lng(),
    };

    setSelectedLocation(location);
    const addressDetails = extractAddressDetails(place.address_components || []);
    
    setFormData(prev => ({
      ...prev,
      ...addressDetails,
      latitude: location.lat.toString(),
      longitude: location.lng.toString(),
    }));

    if (!isLocationAllowed(location)) {
      setLocationError('La ubicación seleccionada está fuera del área permitida.');
    } else {
      setLocationError(null);
    }
  };

  const isLocationAllowed = (location: Location): boolean => {
    if (!window.google?.maps?.geometry) return true;
    
    const point = new window.google.maps.LatLng(location.lat, location.lng);
    const polygon = new window.google.maps.Polygon({ paths: polygonCoords });
    return window.google.maps.geometry.poly.containsLocation(point, polygon);
  };

  const handleSubmit = async (deliveryInfo: CustomerDeliveryInfo) => {
    if (isSubmitting) return;
    
    setIsSubmitting(true);
    
    try {
      let response;
      
      if (preOrderId) {
        response = await customerService.updatePreOrderDeliveryInfo(preOrderId, deliveryInfo);
      } else if (isUpdating) {
        response = await customerService.updateDeliveryInfo(customerId, deliveryInfo);
      } else {
        response = await customerService.saveDeliveryInfo(deliveryInfo);
      }

      const message = preOrderId
        ? `🎉 Hola ${deliveryInfo.pickupName}, tu información de entrega para la preorden ha sido actualizada exitosamente.`
        : isUpdating
        ? `✅ Hola ${deliveryInfo.pickupName}, tu información de entrega ha sido actualizada exitosamente.`
        : `🚚 Hola ${deliveryInfo.pickupName}, tu información de entrega ha sido guardada exitosamente.`;

      // Send WhatsApp message only if not a pre-order update
      if (!preOrderId) {
        await customerService.sendWhatsAppMessage(customerId, message);
      }

      toast.success('¡Dirección registrada exitosamente!');
      
      // Redirect to WhatsApp after 3 seconds
      setTimeout(() => {
        const whatsappNumber = import.meta.env.VITE_BOT_WHATSAPP_NUMBER;
        window.location.href = `https://wa.me/${whatsappNumber}`;
      }, 3000);
      
    } catch (error) {
      console.error('Error al guardar información:', error);
      toast.error('Error al guardar la dirección. Por favor, inténtelo de nuevo.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loadError) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-red-600 font-semibold">Error al cargar Google Maps API</div>
      </div>
    );
  }

  if (!isLoaded || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-600">Cargando...</div>
      </div>
    );
  }

  if (!isValidOtp) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full text-center">
          <div className="text-red-500 text-5xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">¡Enlace no válido!</h2>
          <p className="text-gray-600 mb-4">El enlace ha expirado o no es válido.</p>
          <a
            href={`https://wa.me/${import.meta.env.VITE_BOT_WHATSAPP_NUMBER}`}
            className="inline-block bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 transition-colors"
          >
            Volver a WhatsApp
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Toaster position="top-center" />
      
      <div className="container mx-auto px-2 py-4 max-w-2xl">
        <h1 className="text-lg md:text-xl font-bold mb-2 text-gray-800 text-center">
          <span className="block text-blue-600">
            {preOrderId
              ? 'Actualizar Información de Entrega para orden'
              : isUpdating
              ? 'Actualizar Información de Entrega'
              : 'Información de Entrega'}
          </span>
        </h1>
        
        <p className="text-center text-gray-600 mb-4 text-sm">
          ID del cliente: {customerId}
        </p>

        <div className="mb-4 p-4 bg-white rounded-lg shadow-md">
          <h2 className="text-base font-semibold mb-2 text-gray-800">
            Busca tu dirección
          </h2>
          <div className="flex flex-col space-y-2">
            <Autocomplete
              onLoad={setAutocomplete}
              onPlaceChanged={handlePlaceChanged}
            >
              <input
                type="text"
                placeholder="Ingresa tu dirección"
                className="w-full p-2 text-base border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
              />
            </Autocomplete>
            <Button
              onClick={requestLocation}
              variant="secondary"
              fullWidth
            >
              Usar ubicación actual
            </Button>
          </div>
        </div>

        {locationError && (
          <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-md text-sm">
            {locationError}
          </div>
        )}

        <AddressForm
          formData={formData}
          onSubmit={handleSubmit}
        />

        <Button
          onClick={() => document.querySelector('form')?.requestSubmit()}
          variant="primary"
          size="lg"
          fullWidth
          isLoading={isSubmitting}
          disabled={!!locationError}
          className="mt-4"
        >
          {isSubmitting
            ? 'Enviando...'
            : isUpdating
            ? 'Actualizar Dirección'
            : 'Guardar Dirección'}
        </Button>

        <Map
          selectedLocation={selectedLocation}
          onLocationChange={setSelectedLocation}
          setError={setLocationError}
          isLocationAllowed={isLocationAllowed}
          polygonCoords={polygonCoords}
        />
      </div>
    </div>
  );
}

export default App;