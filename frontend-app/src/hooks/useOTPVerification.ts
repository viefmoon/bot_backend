import { useEffect, useCallback, useRef } from 'react';
import { toast } from 'sonner';
import { addressApi } from '../api/addressApi';

interface UseOTPVerificationProps {
  whatsappPhoneNumber: string | null;
  otp: string | null;
  onOTPExpired?: () => void;
  checkInterval?: number; // Interval in milliseconds
}

export const useOTPVerification = ({
  whatsappPhoneNumber,
  otp,
  onOTPExpired,
  checkInterval = 30000 // Check every 30 seconds by default
}: UseOTPVerificationProps) => {
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const hasShownExpiryToast = useRef(false);

  const checkOTPValidity = useCallback(async () => {
    if (!whatsappPhoneNumber || !otp) return;

    try {
      // Make a lightweight API call to verify OTP is still valid
      await addressApi.verifyOtp({ whatsappPhoneNumber, otp });
      // Reset the flag if OTP is valid again (shouldn't happen, but just in case)
      hasShownExpiryToast.current = false;
    } catch (error: any) {
      // Check if error is due to expired OTP
      const isOTPError = 
        error?.response?.status === 400 &&
        (error?.response?.data?.error?.code === 'INVALID_OTP' ||
         error?.response?.data?.error?.message?.toLowerCase().includes('otp') ||
         error?.response?.data?.error?.message?.toLowerCase().includes('expired'));

      if (isOTPError && !hasShownExpiryToast.current) {
        hasShownExpiryToast.current = true;
        
        // Show expiry toast
        toast.error(
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-semibold text-gray-900">Sesión Expirada</p>
              <p className="text-xs text-gray-600">
                Tu sesión ha expirado por seguridad. Serás redirigido para solicitar un nuevo enlace.
              </p>
            </div>
          </div>,
          {
            duration: 4000,
            style: {
              background: '#fef2f2',
              border: '1px solid #fecaca',
              padding: '16px',
              maxWidth: '420px',
            },
          }
        );

        // Clear interval to stop checking
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        // Call the expiry callback after showing the toast
        setTimeout(() => {
          if (onOTPExpired) {
            onOTPExpired();
          }
        }, 2000);
      }
    }
  }, [whatsappPhoneNumber, otp, onOTPExpired]);

  useEffect(() => {
    if (!whatsappPhoneNumber || !otp) return;

    // Start periodic verification
    intervalRef.current = setInterval(checkOTPValidity, checkInterval);

    // Cleanup on unmount or when deps change
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [whatsappPhoneNumber, otp, checkInterval, checkOTPValidity]);

  // Manual check function
  const verifyNow = useCallback(() => {
    return checkOTPValidity();
  }, [checkOTPValidity]);

  return { verifyNow };
};