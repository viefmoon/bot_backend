import { OTPRecord } from '../types/otp.types';

const otpStore: Map<string, OTPRecord> = new Map();

export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const storeOTP = (customerId: string, otp: string): void => {
  const expirationTime = Date.now() + 10 * 60 * 1000; // 10 minutos desde ahora
  otpStore.set(customerId, { otp, expiresAt: expirationTime });
};

export const verifyOTP = (customerId: string, otp: string): boolean => {
  const record = otpStore.get(customerId);

  if (record) {
    if (Date.now() > record.expiresAt) {
      otpStore.delete(customerId);
      return false;
    }
    
    if (record.otp === otp) {
      return true;
    }
  }
  
  return false;
};

// Función para limpiar OTPs expirados (llamar periódicamente)
export const cleanupExpiredOTPs = (): void => {
  const now = Date.now();
  for (const [customerId, record] of otpStore.entries()) {
    if (now > record.expiresAt) {
      otpStore.delete(customerId);
    }
  }
};
