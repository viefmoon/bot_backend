import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3001/backend';

export interface VerifyOtpParams {
  customerId: string;
  otp: string;
}

export interface CreateAddressParams {
  customerId: string;
  otp: string;
  address: {
    street: string;
    number: string;
    interiorNumber?: string;
    neighborhood?: string;
    city: string;
    state: string;
    country: string;
    zipCode?: string;
    references?: string;
    latitude: number;
    longitude: number;
  };
}

export interface UpdateAddressParams extends CreateAddressParams {
  addressId: string;
}

export interface DeleteAddressParams {
  addressId: string;
  customerId: string;
  otp: string;
}

export interface SetDefaultAddressParams {
  addressId: string;
  customerId: string;
  otp: string;
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
    const { data } = await apiClient.post('/address-registration/verify-otp', params);
    return data;
  },

  createAddress: async (params: CreateAddressParams) => {
    const { data } = await apiClient.post('/address-registration/create', params);
    return data;
  },

  updateAddress: async ({ addressId, ...params }: UpdateAddressParams) => {
    const { data } = await apiClient.put(`/address-registration/${addressId}`, params);
    return data;
  },

  deleteAddress: async ({ addressId, ...params }: DeleteAddressParams) => {
    const { data } = await apiClient.delete(`/address-registration/${addressId}`, {
      data: params,
    });
    return data;
  },

  setDefaultAddress: async ({ addressId, ...params }: SetDefaultAddressParams) => {
    const { data } = await apiClient.put(`/address-registration/${addressId}/default`, params);
    return data;
  },

  getDeliveryArea: async () => {
    const { data } = await apiClient.get('/address-registration/delivery-area');
    return data;
  },

  // Send pre-order message
  sendPreOrderMessage: async (customerId: string, preOrderId: string) => {
    const { data } = await apiClient.post('/address-selection/send', {
      customerId,
      preOrderId,
    });
    return data;
  },
};