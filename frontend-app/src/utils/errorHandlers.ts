import { toast } from 'sonner';

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

export const handleOTPError = (onExpired?: () => void) => {
  toast.error(
    <div className="flex items-center">
      <div className="flex-shrink-0">
        <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <div className="ml-3">
        <p className="text-sm font-semibold text-gray-900">🕒 Enlace Expirado</p>
        <p className="text-xs text-gray-600">
          Tu enlace de registro ha expirado por seguridad.
          Por favor, solicita un nuevo enlace desde WhatsApp.
        </p>
      </div>
    </div>,
    {
      duration: 6000,
      style: {
        background: '#fef2f2',
        border: '1px solid #fecaca',
        padding: '16px',
        maxWidth: '420px',
      },
    }
  );

  // Execute callback after showing toast
  if (onExpired) {
    setTimeout(onExpired, 2000);
  }
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