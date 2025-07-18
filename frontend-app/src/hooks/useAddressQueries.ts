import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { addressApi } from '../api/addressApi';
import type { 
  VerifyOtpParams
} from '../api/addressApi';

// Query keys
export const addressQueryKeys = {
  all: ['addresses'] as const,
  verifyOtp: (whatsappPhoneNumber: string, otp: string) => 
    ['addresses', 'verify-otp', whatsappPhoneNumber, otp] as const,
  deliveryArea: ['addresses', 'delivery-area'] as const,
};

// Queries
export const useVerifyOtp = (params: VerifyOtpParams | null) => {
  return useQuery({
    queryKey: params ? addressQueryKeys.verifyOtp(params.whatsappPhoneNumber, params.otp) : [],
    queryFn: () => params ? addressApi.verifyOtp(params) : Promise.reject('No params'),
    enabled: !!params,
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: false,
  });
};

export const useDeliveryArea = () => {
  return useQuery({
    queryKey: addressQueryKeys.deliveryArea,
    queryFn: addressApi.getDeliveryArea,
    staleTime: 30 * 60 * 1000, // 30 minutes
    retry: 2,
  });
};

// Mutations
export const useCreateAddress = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: addressApi.createAddress,
    onSuccess: (_, variables) => {
      // Invalidate the OTP verification query to refresh customer data
      queryClient.invalidateQueries({
        queryKey: addressQueryKeys.verifyOtp(variables.whatsappPhoneNumber, variables.otp),
      });
    },
  });
};

export const useUpdateAddress = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: addressApi.updateAddress,
    onSuccess: (_, variables) => {
      // Invalidate the OTP verification query to refresh customer data
      queryClient.invalidateQueries({
        queryKey: addressQueryKeys.verifyOtp(variables.whatsappPhoneNumber, variables.otp),
      });
    },
  });
};

export const useSetDefaultAddress = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: addressApi.setDefaultAddress,
    onSuccess: (_, variables) => {
      // Invalidate the OTP verification query to refresh customer data
      queryClient.invalidateQueries({
        queryKey: addressQueryKeys.verifyOtp(variables.whatsappPhoneNumber, variables.otp),
      });
    },
  });
};


export const useUpdateCustomerName = () => {
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: addressApi.updateCustomerName,
    onSuccess: (_, variables) => {
      // Invalidate the OTP verification query to refresh customer data
      queryClient.invalidateQueries({
        queryKey: addressQueryKeys.verifyOtp(variables.whatsappPhoneNumber, variables.otp),
      });
    },
  });
};