import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import { useLoadScript, Autocomplete } from "@react-google-maps/api";
import AddressForm from "../../components/AddressForm";
import Map from "../../components/Map";
import Swal from "sweetalert2";

const libraries = ["places"];

export default function DeliveryInfoRegistration() {
  const router = useRouter();
  const { from: customerId, otp, preOrderId } = router.query;
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
    if (router.isReady && customerId && otp) {
      verifyOtp(customerId, otp);
    } else if (router.isReady) {
      setLoading(false);
      setError("El enlace no es válido. Falta información necesaria.");
    }
  }, [router.isReady, customerId, otp]);

  const verifyOtp = async (customerId, otp) => {
    try {
      const response = await axios.post("/api/verify_otp", { customerId, otp });
      setLoading(false);
      setIsValidOtp(response.data);
      if (response.data) {
        // Si el OTP es válido, intentamos cargar la información existente
        loadExistingDeliveryInfo(customerId);
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

  const loadExistingDeliveryInfo = async (customerId) => {
    try {
      const response = await axios.get(
        `/api/customer_delivery_info/${customerId}`
      );
      console.log("response.data", response.data);
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
        const permissionStatus = await navigator.permissions.query({
          name: "geolocation",
        });

        if (permissionStatus.state === "denied") {
          Swal.fire({
            title: "¡Permisos bloqueados!",
            html: `
              <div class="text-sm">
                <p>Para acceder a tu ubicación:</p>
                <ol class="text-left pl-4 mt-1">
                  <li>1. Clic en el candado</li>
                  <li>2. Busca 'Ubicación'</li>
                  <li>3. Selecciona 'Permitir'</li>
                  <li>4. Recarga la página</li>
                </ol>
              </div>
            `,
            icon: "warning",
            confirmButtonText: "OK",
            confirmButtonColor: "#3085d6",
            width: "280px",
          });
          setLocationError(
            "Ingresa tu dirección manualmente o habilita los permisos."
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
        setLocationError("Por favor, ingresa tu dirección manualmente.");
      }
    } else {
      setLocationError("Por favor, ingresa tu dirección manualmente.");
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
              customerId,
            }
          );
        } else if (isUpdating) {
          response = await axios.put(
            `/api/customer_delivery_info/${customerId}`,
            {
              ...formData,
              customerId,
            }
          );
        } else {
          response = await axios.post("/api/customer_delivery_info", {
            ...formData,
            customerId,
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
          await sendWhatsAppMessage(customerId, mensaje);
        }

        showSuccessMessage(mensaje);
      } catch (error) {
        console.error("Error al guardar la información de entrega:", error);
        alert("Error al guardar la dirección. Por favor, inténtelo de nuevo.");
      } finally {
        setIsSubmitting(false);
      }
    } else {
      Swal.fire({
        title: "¡Campos Requeridos!",
        html: `
          <div class="text-left">
            <p class="font-semibold mb-2">Por favor, completa los siguientes campos:</p>
            <ul class="text-red-500">
              ${Object.values(errors)
                .map((error) => `<li>• ${error}</li>`)
                .join("")}
            </ul>
          </div>
        `,
        icon: "warning",
        confirmButtonText: "Entendido",
        confirmButtonColor: "#3085d6",
        width: "320px",
      });
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

  const showSuccessMessage = () => {
    Swal.fire({
      title: "¡Dirección Registrada!",
      html: `
        <div class="text-center">
          <div class="text-base font-semibold mb-1">
            ¡Gracias por registrar tu dirección!
          </div>
          <div class="text-xs text-gray-500">
            Te redirigiremos a WhatsApp en unos segundos...
          </div>
        </div>
      `,
      icon: "success",
      showConfirmButton: false,
      timer: 5000,
      timerProgressBar: true,
      width: "300px",
    }).then(() => {
      const whatsappNumber = process.env.NEXT_PUBLIC_BOT_WHATSAPP_NUMBER;
      window.location.href = `https://wa.me/${whatsappNumber}`;
    });
  };

  if (loadError)
    return (
      <div className="text-red-600 font-semibold">
        Error al cargar Google Maps API
      </div>
    );
  if (!isLoaded) return <div className="text-gray-600">Cargando...</div>;
  if (loading) return <p className="text-gray-600">Verificando enlace...</p>;
  if (error && !isValidOtp)
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="bg-white p-6 rounded-lg shadow-lg max-w-sm w-full text-center">
          <div className="text-red-500 text-5xl mb-4">
            <i className="fas fa-exclamation-circle"></i>
          </div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">
            ¡Enlace no válido!
          </h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <a
            href={`https://wa.me/${process.env.NEXT_PUBLIC_BOT_WHATSAPP_NUMBER}`}
            className="inline-block bg-green-500 text-white px-6 py-2 rounded-lg hover:bg-green-600 transition-colors"
          >
            Volver a WhatsApp
          </a>
        </div>
      </div>
    );

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
        ID del cliente: {customerId}
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
      {locationError && <p className="text-red-600 text-sm">{locationError}</p>}
      <form onSubmit={handleSubmit}>
        <AddressForm
          customerId={customerId}
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
