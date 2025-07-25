import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_BACKEND_BASE_URL || 'http://localhost:5000';

export interface VerifyOtpParams {
  whatsappPhoneNumber: string;
  otp: string;
}

export interface CreateAddressParams {
  whatsappPhoneNumber: string;
  otp: string;
  address: {
    name: string;
    street: string;
    number: string;
    interiorNumber?: string;
    neighborhood?: string;
    city: string;
    state: string;
    country: string;
    zipCode?: string;
    deliveryInstructions?: string;
    latitude: number;
    longitude: number;
  };
}

export interface UpdateAddressParams extends CreateAddressParams {
  addressId: string;
}

export interface SetDefaultAddressParams {
  addressId: string;
  whatsappPhoneNumber: string;
  otp: string;
}

export interface UpdateCustomerNameParams {
  whatsappPhoneNumber: string;
  otp: string;
  firstName: string;
  lastName: string;
}

// API client instance
export const apiClient = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// API functions
export const addressApi = {
  verifyOtp: async (params: VerifyOtpParams) => {
    const { data } = await apiClient.post('/backend/address-registration/verify-otp', params);
    return data;
  },

  createAddress: async (params: CreateAddressParams & { preOrderId?: string }) => {
    const { preOrderId, ...addressData } = params;
    
    const bodyParams = preOrderId 
      ? { ...addressData, preOrderId }
      : addressData;
    
    const { data } = await apiClient.post('/backend/address-registration/create', bodyParams);
    return data;
  },

  updateAddress: async ({ addressId, ...params }: UpdateAddressParams) => {
    const { data } = await apiClient.put(`/backend/address-registration/${addressId}`, params);
    return data;
  },

  setDefaultAddress: async ({ addressId, ...params }: SetDefaultAddressParams) => {
    const { data } = await apiClient.put(`/backend/address-registration/${addressId}/default`, params);
    return data;
  },

  getDeliveryArea: async () => {
    const { data } = await apiClient.get('/backend/address-registration/delivery-area');
    return data;
  },


  // Update customer name
  updateCustomerName: async (params: UpdateCustomerNameParams) => {
    const { data } = await apiClient.put('/backend/address-registration/update-customer-name', params);
    return data;
  },
};