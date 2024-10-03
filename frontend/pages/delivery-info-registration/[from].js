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
  const [formData, setFormData] = useState({
    streetAddress: "",
    neighborhood: "",
    postalCode: "",
    city: "",
    state: "",
    country: "",
    latitude: "",
    longitude: "",
    additionalDetails: "",
  });

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
      setError(
        "Hubo un error al verificar el enlace. Por favor, inténtelo de nuevo."
      );
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
          const addressDetails = await getAddressFromCoordinates(location);
          setAddress(addressDetails.streetAddress);
          setFormData((prev) => ({
            ...prev,
            ...addressDetails,
            latitude: location.lat,
            longitude: location.lng,
          }));
        },
        (error) => {
          console.error("Error obteniendo la ubicación:", error);
          setError(
            "No se pudo obtener la ubicación actual. Por favor, ingrese su dirección manualmente."
          );
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
        const addressComponents = response.data.results[0].address_components;
        const formattedAddress = response.data.results[0].formatted_address;

        const addressDetails = {
          streetAddress: formattedAddress,
          neighborhood: "",
          postalCode: "",
          city: "",
          state: "",
          country: "",
        };

        addressComponents.forEach((component) => {
          if (component.types.includes("neighborhood")) {
            addressDetails.neighborhood = component.long_name;
          }
          if (component.types.includes("postal_code")) {
            addressDetails.postalCode = component.long_name;
          }
          if (component.types.includes("locality")) {
            addressDetails.city = component.long_name;
          }
          if (component.types.includes("administrative_area_level_1")) {
            addressDetails.state = component.long_name;
          }
          if (component.types.includes("country")) {
            addressDetails.country = component.long_name;
          }
        });

        return addressDetails;
      }
    } catch (error) {
      console.error("Error obteniendo la dirección:", error);
    }
    return {};
  };

  const handleLocationSelect = (location, formattedAddress) => {
    setSelectedLocation(location);
    setAddress(formattedAddress);
  };

  if (loadError) {
    return (
      <div className="text-red-600 font-semibold">
        Error al cargar Google Maps API
      </div>
    );
  }

  if (!isLoaded) {
    return <div className="text-gray-600">Cargando...</div>;
  }

  if (loading) {
    return <p className="text-gray-600">Verificando enlace...</p>;
  }

  if (error) {
    return <p className="text-red-600">{error}</p>;
  }

  if (!isValidOtp) {
    return (
      <p className="text-red-600">El enlace ha expirado o no es válido.</p>
    );
  }

  if (isValidOtp) {
    return (
      <div className="container mx-auto px-4 py-8">
        <h1 className="text-4xl font-bold mb-8 text-gray-800 flex items-center justify-center">
          <FaTruck className="mr-4 text-blue-600" />
          <span className="bg-gradient-to-r from-blue-600 to-green-400 text-transparent bg-clip-text">
            Registro de Información de Entrega
          </span>
        </h1>
        <button
          onClick={requestLocation}
          className="bg-blue-600 text-white px-4 py-2 rounded-md mb-6 hover:bg-blue-700 transition duration-300"
        >
          Usar ubicación actual
        </button>
        <AddressSearch onSelect={handleLocationSelect} value={address} />
        <Map
          selectedLocation={selectedLocation}
          onLocationChange={setSelectedLocation}
        />
        <AddressForm
          clientId={clientId}
          selectedLocation={selectedLocation}
          address={address}
          formData={formData}
          setFormData={setFormData}
        />
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">
        Registro de Información de Entrega
      </h1>
      <AddressForm clientId={clientId} />
    </div>
  );
}
