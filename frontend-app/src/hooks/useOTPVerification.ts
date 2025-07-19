import { useEffect, useCallback, useRef } from 'react';
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
  const hasExpired = useRef(false);

  const checkOTPValidity = useCallback(async () => {
    if (!whatsappPhoneNumber || !otp) return;

    try {
      // Make a lightweight API call to verify OTP is still valid
      await addressApi.verifyOtp({ whatsappPhoneNumber, otp });
      // Reset the flag if OTP is valid again (shouldn't happen, but just in case)
      hasExpired.current = false;
    } catch (error: any) {
      // Check if error is due to expired OTP
      const isOTPError = 
        error?.response?.status === 400 &&
        (error?.response?.data?.error?.code === 'INVALID_OTP' ||
         error?.response?.data?.error?.message?.toLowerCase().includes('otp') ||
         error?.response?.data?.error?.message?.toLowerCase().includes('expired'));

      if (isOTPError && !hasExpired.current) {
        hasExpired.current = true;
        
        // Clear interval to stop checking
        if (intervalRef.current) {
          clearInterval(intervalRef.current);
          intervalRef.current = null;
        }

        // Call the expiry callback
        if (onOTPExpired) {
          onOTPExpired();
        }
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