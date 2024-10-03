import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import AddressForm from "../../components/AddressForm";
import AddressSearch from "../../components/AddressSearch";
import Map from "../../components/Map";

export default function DeliveryInfoRegistration() {
  const router = useRouter();
  const { from: clientId, otp } = router.query;
  const [isValidOtp, setIsValidOtp] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);
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

  const handleLocationSelect = (location, formattedAddress) => {
    setSelectedLocation(location);
    setAddress(formattedAddress);
  };

  if (loading) {
    return <p className="text-center p-4">Verificando enlace...</p>;
  }

  if (error) {
    return <p className="text-center p-4 text-red-500">{error}</p>;
  }

  if (!isValidOtp) {
    return <p className="text-center p-4">El enlace ha expirado o no es válido.</p>;
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4 text-center">Registro de Información de Entrega</h1>
      <AddressSearch onSelect={handleLocationSelect} />
      <Map selectedLocation={selectedLocation} onLocationChange={handleLocationSelect} />
      <AddressForm clientId={clientId} selectedLocation={selectedLocation} address={address} />
    </div>
  );
}
