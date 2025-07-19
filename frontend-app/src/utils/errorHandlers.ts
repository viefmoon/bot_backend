export interface ApiError {
  response?: {
    status: number;
    data?: {
      error?: {
        code?: string;
        message?: string;
        type?: string;
      };
      message?: string;
    };
  };
  message?: string;
}

export const isOTPError = (error: any): boolean => {
  if (!error?.response) return false;
  
  const status = error.response.status;
  const errorData = error.response.data?.error || error.response.data;
  
  // Check for 400 status and OTP-related error codes or messages
  return status === 400 && (
    errorData?.code === 'INVALID_OTP' ||
    errorData?.code === 'VAL006' ||
    errorData?.message?.toLowerCase().includes('otp') ||
    errorData?.message?.toLowerCase().includes('expired') ||
    error.message?.toLowerCase().includes('otp')
  );
};

export const getErrorMessage = (error: any): string => {
  // Check for OTP errors first
  if (isOTPError(error)) {
    return 'Tu sesión ha expirado. Por favor, solicita un nuevo enlace desde WhatsApp.';
  }

  // Extract error message from various possible locations
  const errorMessage = 
    error?.response?.data?.error?.message ||
    error?.response?.data?.message ||
    error?.message ||
    'Ha ocurrido un error inesperado';

  return errorMessage;
};