import { useState, useEffect } from "react";
import { useRouter } from "next/router";
import axios from "axios";
import AddressForm from "../../components/AddressForm";

export default function DeliveryInfoRegistration() {
  const router = useRouter();
  const { from, otp } = router.query;
  const [isValidOtp, setIsValidOtp] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (router.isReady && from && otp) {
      verifyOtp(from, otp);
    } else if (router.isReady) {
      setLoading(false);
      setError("El enlace no es válido. Falta información necesaria.");
    }
  }, [router.isReady, from, otp]);

  const verifyOtp = async (phone, otp) => {
    try {
      const response = await axios.post("/api/verify_otp", { phone, otp });
      setLoading(false);
      if (response.data.valid) {
        setIsValidOtp(true);
      } else {
        setError(`El enlace ha expirado o no es válido. ${response || ''}`);
        
      }
    } catch (error) {
      console.error("Error al verificar el OTP:", error);
      setLoading(false);
      setError("Hubo un error al verificar el enlace. Por favor, inténtelo de nuevo.");
    }
  };

  if (loading) {
    return <p>Verificando enlace...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  if (!isValidOtp) {
    return <p>El enlace ha expirado o no es válido.</p>;
  }

  return (
    <div>
      <h1>Registro de Información de Entrega</h1>
      <AddressForm clientId={from} />
    </div>
  );
}
