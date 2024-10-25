import { OTPRecord } from '../types/otp.types';

const otpStore: Map<string, OTPRecord> = new Map();

export const generateOTP = (): string => {
  return Math.floor(100000 + Math.random() * 900000).toString();
};

export const storeOTP = (clientId: string, otp: string): void => {
  const expirationTime = Date.now() + 10 * 60 * 1000; // 10 minutos desde ahora
  otpStore.set(clientId, { otp, expiresAt: expirationTime });
};

export const verifyOTP = (clientId: string, otp: string): boolean => {
  const record = otpStore.get(clientId);
  
  if (record) {
    if (Date.now() > record.expiresAt) {
      otpStore.delete(clientId);
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
  for (const [clientId, record] of otpStore.entries()) {
    if (now > record.expiresAt) {
      otpStore.delete(clientId);
    }
  }
};
