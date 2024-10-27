import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import { useLoadScript, Autocomplete } from "@react-google-maps/api";
import AddressForm from "../../components/AddressForm";
import Map from "../../components/Map";

const libraries = ["places"];

export default function DeliveryInfoRegistration() {
  const router = useRouter();
  const { from: clientId, otp, preOrderId } = router.query;
  const [isValidOtp, setIsValidOtp] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [address, setAddress] = useState("");
  const [formData, setFormData] = useState({
    pickupName: "",
    streetAddress: "",
    neighborhood: "",
    postalCode: "",
    city: "",
    state: "",
    country: "",
    latitude: "",
    longitude: "",
    additionalDetails: "",
    geocodedAddress: "",
  });
  const [formErrors, setFormErrors] = useState({});
  const [isUpdating, setIsUpdating] = useState(false);
  const [locationError, setLocationError] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { isLoaded, loadError } = useLoadScript({
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY,
    libraries,
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
      setIsValidOtp(response.data);
      if (response.data) {
        // Si el OTP es válido, intentamos cargar la información existente
        loadExistingDeliveryInfo(clientId);
      } else {
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

  const loadExistingDeliveryInfo = async (clientId) => {
    try {
      const response = await axios.get(
        `/api/customer_delivery_info/${clientId}`
      );
      if (response.data && Object.keys(response.data).length > 0) {
        const formattedData = {
          pickupName: response.data.pickupName || "",
          streetAddress: response.data.streetAddress || "",
          neighborhood: response.data.neighborhood || "",
          postalCode: response.data.postalCode || "",
          city: response.data.city || "",
          state: response.data.state || "",
          country: response.data.country || "",
          latitude: response.data.latitude?.toString() || "",
          longitude: response.data.longitude?.toString() || "",
          additionalDetails: response.data.additionalDetails || "",
        };

        setFormData(formattedData);
        setAddress(formattedData.streetAddress);

        if (response.data.latitude && response.data.longitude) {
          setSelectedLocation({
            lat: parseFloat(response.data.latitude),
            lng: parseFloat(response.data.longitude),
          });
        }

        setIsUpdating(true);
      } else {
        // Si no hay datos, inicializamos el formulario con valores vacíos
        setFormData({
          pickupName: "",
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
        setIsUpdating(false);
      }
    } catch (error) {
      console.error(
        "Error al cargar la información de entrega existente:",
        error
      );
      // En caso de error, también inicializamos el formulario con valores vacíos
      setFormData({
        pickupName: "",
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
      setIsUpdating(false);
    }
  };

  const requestLocation = async () => {
    if ("geolocation" in navigator) {
      try {
        // Primero verificamos el estado de los permisos
        const permissionStatus = await navigator.permissions.query({ name: 'geolocation' });
        
        if (permissionStatus.state === 'denied') {
          // Si los permisos están bloqueados, mostramos instrucciones al usuario
          setLocationError(
            "Los permisos de ubicación están bloqueados. Por favor, sigue estos pasos para habilitarlos:\n" +
            "1. Haz clic en el ícono del candado en la barra de direcciones\n" +
            "2. Busca 'Ubicación' en la configuración\n" +
            "3. Cambia el permiso a 'Permitir'\n" +
            "4. Recarga la página e intenta nuevamente"
          );
          return;
        }

        // Si los permisos no están bloqueados, procedemos normalmente
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const { latitude, longitude } = position.coords;
            const location = { lat: latitude, lng: longitude };

            setSelectedLocation(location);

            const addressDetails = await getAddressFromCoordinates(location);
            setAddress(addressDetails.streetAddress);
            setFormData((prev) => ({
              ...prev,
              ...addressDetails,
              latitude: location.lat,
              longitude: location.lng,
            }));

            const inputElement = document.querySelector('input[type="text"]');
            if (inputElement) {
              inputElement.value = addressDetails.streetAddress;
            }

            if (!isLocationAllowed(location)) {
              setLocationError(
                "La ubicación actual está fuera del área permitida."
              );
            } else {
              setLocationError(null);
            }
          },
          (error) => {
            console.error("Error obteniendo la ubicación:", error);
            setLocationError(
              "No se pudo obtener la ubicación actual. Por favor, ingrese su dirección manualmente o intente compartir su ubicación nuevamente."
            );
          }
        );
      } catch (error) {
        console.error("Error al verificar permisos:", error);
        setLocationError(
          "Hubo un error al verificar los permisos de ubicación. Por favor, ingrese su dirección manualmente."
        );
      }
    } else {
      setLocationError("Geolocalización no está soportada en este navegador.");
    }
  };

  const getAddressFromCoordinates = async (location) => {
    try {
      const response = await axios.get(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${location.lat},${location.lng}&key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}`
      );
      if (response.data.results.length > 0) {
        const addressDetails = extractAddressDetails(
          response.data.results[0].address_components
        );
        return addressDetails;
      }
    } catch (error) {
      console.error("Error obteniendo la dirección:", error);
    }
    return {};
  };

  const handlePlaceChanged = async (autocomplete) => {
    if (autocomplete !== null) {
      const place = autocomplete.getPlace();
      if (place.geometry) {
        const selectedLocation = {
          lat: place.geometry.location.lat(),
          lng: place.geometry.location.lng(),
        };

        setSelectedLocation(selectedLocation);
        const addressDetails = extractAddressDetails(place.address_components);
        setAddress(addressDetails.streetAddress); // Cambio realizado aquí
        setFormData((prev) => ({
          ...prev,
          ...addressDetails,
          latitude: selectedLocation.lat,
          longitude: selectedLocation.lng,
          streetAddress: addressDetails.streetAddress,
        }));

        if (!isLocationAllowed(selectedLocation)) {
          setLocationError(
            "La ubicación seleccionada está fuera del área permitida."
          );
        } else {
          setLocationError(null);
        }
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

    let streetNumber = "";
    let streetName = "";

    addressComponents.forEach((component) => {
      if (component.types.includes("street_number")) {
        streetNumber = component.long_name;
      }
      if (component.types.includes("route")) {
        streetName = component.long_name;
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

    // Combinar el nombre de la calle y el número en el orden correcto
    addressDetails.streetAddress =
      streetName + (streetNumber ? ` ${streetNumber}` : "");

    return addressDetails;
  };

  const validateForm = () => {
    const errors = {};
    if (!formData.pickupName.trim())
      errors.pickupName = "El nombre del cliente es obligatorio";
    if (!formData.streetAddress.trim())
      errors.streetAddress = "La dirección completa es obligatoria";
    if (!formData.city.trim()) errors.city = "La ciudad es obligatoria";
    if (!formData.state.trim()) errors.state = "El estado es obligatorio";
    if (!formData.country.trim()) errors.country = "El país es obligatorio";
    if (!formData.postalCode.trim())
      errors.postalCode = "El código postal es obligatorio";
    return errors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isSubmitting) return;

    const errors = validateForm();
    setFormErrors(errors);

    if (Object.keys(errors).length === 0) {
      setIsSubmitting(true);

      try {
        let response;
        if (preOrderId) {
          // Si hay un preOrderId, usamos el nuevo endpoint
          response = await axios.put(
            `/api/update_pre_order_delivery_info/${preOrderId}`,
            {
              ...formData,
              clientId,
            }
          );
        } else if (isUpdating) {
          response = await axios.put(
            `/api/customer_delivery_info/${clientId}`,
            {
              ...formData,
              clientId,
            }
          );
        } else {
          response = await axios.post("/api/customer_delivery_info", {
            ...formData,
            clientId,
          });
        }

        console.log("Información de entrega guardada:", response.data);

        // Mensaje personalizado basado en si es una actualización de preorden o no
        const mensaje = preOrderId
          ? `🎉 Hola ${formData.pickupName}, tu información de entrega para la preorden ha sido actualizada exitosamente. 📦 Tu dirección registrada es: ${response.data.streetAddress}. ¡Gracias! 🙌`
          : isUpdating
          ? `✅ Hola ${formData.pickupName}, tu información de entrega ha sido actualizada exitosamente. 📍 Tu dirección registrada es: ${response.data.streetAddress}. ¡Gracias! 😊`
          : `🚚 Hola ${formData.pickupName}, tu información de entrega ha sido guardada exitosamente. 📫 Tu dirección registrada es: ${response.data.streetAddress}. ¡Gracias! 🎉`;

        // Solo enviamos el mensaje de WhatsApp si no es una actualización de preorden
        if (!preOrderId) {
          await sendWhatsAppMessage(clientId, mensaje);
        }

        alert(mensaje);
        const whatsappNumber = process.env.NEXT_PUBLIC_BOT_WHATSAPP_NUMBER;
        window.location.href = `https://wa.me/${whatsappNumber}`;
      } catch (error) {
        console.error("Error al guardar la información de entrega:", error);
        alert("Error al guardar la dirección. Por favor, inténtelo de nuevo.");
      } finally {
        setIsSubmitting(false);
      }
    } else {
      const errorMessages = Object.values(errors).join("\n");
      alert(`Por favor, complete los siguientes campos:\n\n${errorMessages}`);
    }
  };

  const sendWhatsAppMessage = async (to, message) => {
    try {
      const response = await axios.post("/api/send_whatsapp_message", {
        to,
        message,
      });
      if (response.data.success) {
        console.log("Mensaje de WhatsApp enviado con éxito");
      } else {
        console.error(
          "Error al enviar mensaje de WhatsApp:",
          response.data.message
        );
      }
    } catch (error) {
      console.error("Error al enviar mensaje de WhatsApp:", error);
    }
  };

  if (loadError)
    return (
      <div className="text-red-600 font-semibold">
        Error al cargar Google Maps API
      </div>
    );
  if (!isLoaded) return <div className="text-gray-600">Cargando...</div>;
  if (loading) return <p className="text-gray-600">Verificando enlace...</p>;
  if (error && !isValidOtp) return <p className="text-red-600">{error}</p>;

  return (
    <div className="container mx-auto px-1 py-1">
      <h1 className="text-lg md:text-xl font-bold mb-0.5 text-gray-800 text-center">
        <span className="block text-blue-600">
          {preOrderId
            ? "Actualizar Información de Entrega para orden"
            : isUpdating
            ? "Actualizar Información de Entrega"
            : "Información de Entrega"}
        </span>
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
              className="w-full p-1.5 text-base border border-gray-300 rounded-md focus:ring-1 focus:ring-blue-500 focus:border-blue-500 transition duration-200"
            />
          </Autocomplete>
          <button
            onClick={requestLocation}
            className="bg-green-600 text-white px-3 py-1.5 rounded-md hover:bg-green-700 transition duration-300 text-base"
          >
            Usar ubicación actual
          </button>
        </div>
      </div>
      {locationError && <p className="text-red-600">{locationError}</p>}
      <form onSubmit={handleSubmit}>
        <AddressForm
          clientId={clientId}
          selectedLocation={selectedLocation}
          address={address}
          formData={formData}
          setFormData={setFormData}
          formErrors={formErrors}
        />
        <button
          type="submit"
          className="
            w-full mt-2 px-3 py-2 text-base rounded-md font-semibold
            bg-blue-600 text-white
            hover:bg-blue-700
            disabled:bg-gray-400 disabled:cursor-not-allowed
            transition duration-300
          "
          disabled={!!locationError || isSubmitting}
        >
          {isSubmitting
            ? "Enviando..."
            : isUpdating
            ? "Actualizar Dirección"
            : "Guardar Dirección"}
        </button>
        <Map
          selectedLocation={selectedLocation}
          onLocationChange={setSelectedLocation}
          setError={setLocationError}
          isLocationAllowed={isLocationAllowed}
        />
      </form>
    </div>
  );
}

const isLocationAllowed = (location) => {
  const polygonCoords = JSON.parse(
    process.env.NEXT_PUBLIC_POLYGON_COORDS || "[]"
  );
  const point = new window.google.maps.LatLng(location.lat, location.lng);
  const polygon = new window.google.maps.Polygon({ paths: polygonCoords });
  return window.google.maps.geometry.poly.containsLocation(point, polygon);
};
