import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import { useLoadScript, Autocomplete } from "@react-google-maps/api";
import AddressForm from "../../components/AddressForm";
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

          // Actualizar el campo de búsqueda de dirección
          const inputElement = document.querySelector('input[type="text"]');
          if (inputElement) {
            inputElement.value = addressDetails.streetAddress;
          }
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

        const addressDetails = {
          streetAddress: "",
          neighborhood: "",
          postalCode: "",
          city: "",
          state: "",
          country: "",
        };

        addressComponents.forEach((component) => {
          if (component.types.includes("street_number")) {
            addressDetails.streetAddress = component.long_name + " ";
          }
          if (component.types.includes("route")) {
            addressDetails.streetAddress += component.long_name;
          }
          if (
            component.types.includes("sublocality_level_1") ||
            component.types.includes("neighborhood")
          ) {
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

  const handlePlaceChanged = (autocomplete) => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      if (place.geometry) {
        const selectedLocation = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        };
        setSelectedLocation(selectedLocation);
        setAddress(place.formatted_address);

        // Actualizar los detalles de la dirección
        const addressDetails = extractAddressDetails(place.address_components);
        setFormData((prev) => ({
          ...prev,
          ...addressDetails,
          latitude: selectedLocation.lat,
          longitude: selectedLocation.lng,
          streetAddress: place.formatted_address,
        }));
      }
    }
  };

  const extractAddressDetails = (addressComponents) => {
    const addressDetails = {
      streetAddress: "",
      neighborhood: "",
      postalCode: "",
      city: "",
      state: "",
      country: "",
    };

    addressComponents.forEach((component) => {
      if (component.types.includes("street_number")) {
        addressDetails.streetAddress = component.long_name + " ";
      }
      if (component.types.includes("route")) {
        addressDetails.streetAddress += component.long_name;
      }
      if (
        component.types.includes("sublocality_level_1") ||
        component.types.includes("neighborhood")
      ) {
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
      <div className="container mx-auto px-1 py-1">
        <h1 className="text-lg md:text-xl font-bold mb-0.5 text-gray-800 text-center">
          Registro de
          <span className="block text-blue-600">Información de Entrega</span>
        </h1>
        <p className="text-center text-gray-600 mb-1 text-sm">
          ID del cliente: {clientId}
        </p>
        <div className="mb-2 p-2 bg-white rounded-lg shadow-md">
          <h2 className="text-base font-semibold mb-1 text-gray-800">
            Busca tu dirección
          </h2>
          <div className="flex flex-col space-y-2">
            <Autocomplete
              onLoad={(autocomplete) =>
                autocomplete.addListener("place_changed", () =>
                  handlePlaceChanged(autocomplete)
                )
              }
            >
              <input
                type="text"
                placeholder="Ingresa tu dirección"
                className="w-full p-0.5 text-sm border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
              />
            </Autocomplete>
            <button
              onClick={requestLocation}
              className="bg-blue-600 text-white px-2 py-0.5 rounded-md hover:bg-blue-700 transition duration-300 text-sm"
            >
              Usar ubicación actual
            </button>
          </div>
        </div>
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
    <div className="container mx-auto px-2 py-4">
      <h1 className="text-3xl font-bold mb-8 text-gray-800">
        Registro de Información de Entrega
      </h1>
      <AddressForm clientId={clientId} />
    </div>
  );
}
