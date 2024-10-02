interface OTPRecord {
  otp: string;
  expiresAt: number;
}

const otpStore: Map<string, OTPRecord> = new Map();

export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const storeOTP = (phoneNumber: string, otp: string): void => {
  const expirationTime = Date.now() + 10 * 60 * 1000; // 10 minutos desde ahora
  otpStore.set(phoneNumber, { otp, expiresAt: expirationTime });
};

export const verifyOTP = (phoneNumber: string, otp: string): boolean => {
  const record = otpStore.get(phoneNumber);
  if (record && record.otp === otp && Date.now() < record.expiresAt) {
    otpStore.delete(phoneNumber); // Eliminar el OTP después de usarlo
    return true;
  }
  return false;
};

// Función para limpiar OTPs expirados (llamar periódicamente)
export const cleanupExpiredOTPs = (): void => {
  const now = Date.now();
  for (const [phoneNumber, record] of otpStore.entries()) {
    if (now > record.expiresAt) {
      otpStore.delete(phoneNumber);
    }
  }
};
