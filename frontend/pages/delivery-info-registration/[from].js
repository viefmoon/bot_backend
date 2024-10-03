import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import { useLoadScript } from "@react-google-maps/api";
import AddressForm from "../../components/AddressForm";
import AddressSearch from "../../components/AddressSearch";
import Map from "../../components/Map";

const libraries = ["places"];

export default function DeliveryInfoRegistration() {
  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    libraries,
  });

  const router = useRouter();
  const { from: clientId, otp } = router.query;
  const [isValidOtp, setIsValidOtp] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [address, setAddress] = useState("");

  useEffect(() => {
    if (router.isReady && clientId && otp) {
      verifyOtp(clientId, otp);
    } else if (router.isReady) {
      setLoading(false);
      setError("El enlace no es válido. Falta información necesaria.");
    }
  }, [router.isReady, clientId, otp]);

  const verifyOtp = async (clientId, otp) => {
    try {
      const response = await axios.post("/api/verify_otp", { clientId, otp });
      setLoading(false);
      // Cambiamos esta parte para interpretar directamente el resultado
      setIsValidOtp(response.data);
      if (!response.data) {
        setError(`El enlace ha expirado o no es válido.`);
      }
    } catch (error) {
      console.error("Error al verificar el OTP:", error);
      setLoading(false);
      setError("Hubo un error al verificar el enlace. Por favor, inténtelo de nuevo.");
    }
  };

  const requestLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords;
          const location = { lat: latitude, lng: longitude };
          setCurrentLocation(location);
          setSelectedLocation(location);
          
          // Obtener la dirección a partir de las coordenadas
          const formattedAddress = await getAddressFromCoordinates(location);
          setAddress(formattedAddress);
        },
        (error) => {
          console.error("Error obteniendo la ubicación:", error);
          setError("No se pudo obtener la ubicación actual. Por favor, ingrese su dirección manualmente.");
        }
      );
    } else {
      setError("Geolocalización no está soportada en este navegador.");
    }
  };

  const getAddressFromCoordinates = async (location) => {
    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${location.lat},${location.lng}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
      );
      if (response.data.results.length > 0) {
        return response.data.results[0].formatted_address;
      }
    } catch (error) {
      console.error("Error obteniendo la dirección:", error);
    }
    return "";
  };

  const handleLocationSelect = (location, formattedAddress) => {
    setSelectedLocation(location);
    setAddress(formattedAddress);
  };

  if (loadError) {
    return <div>Error al cargar Google Maps API</div>;
  }

  if (!isLoaded) {
    return <div>Cargando...</div>;
  }

  if (loading) {
    return <p>Verificando enlace...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  if (!isValidOtp) {
    return <p>El enlace ha expirado o no es válido.</p>;
  }

  if (isValidOtp) {
    return (
      <div>
        <h1>Registro de Información de Entrega</h1>
        <button
          onClick={requestLocation}
          className="mb-4 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-600 shadow-lg transform transition-transform duration-300 hover:scale-105"
        >
          Usar ubicación actual
        </button>
        <AddressSearch onSelect={handleLocationSelect} value={address} />
        <Map selectedLocation={selectedLocation} onLocationChange={setSelectedLocation} />
        <AddressForm clientId={clientId} selectedLocation={selectedLocation} address={address} />
      </div>
    );
  }

  return (
    <div>
      <h1>Registro de Información de Entrega</h1>
      <AddressForm clientId={clientId} />
    </div>
  );
}
