import api from './api';
import { endpoints } from '@/config';
import type { 
  Customer, 
  Address, 
  AddressFormData, 
  OTPVerificationResponse, 
  AddressRegistrationResponse 
} from '@/types';

class CustomerService {
  async verifyOTP(whatsappPhoneNumber: string, otp: string): Promise<OTPVerificationResponse> {
    const response = await api.post<OTPVerificationResponse>(endpoints.addressRegistration.verifyOtp, {
      whatsappPhoneNumber,
      otp
    });
    return response.data;
  }

  async createAddress(
    whatsappPhoneNumber: string, 
    otp: string, 
    address: AddressFormData
  ): Promise<AddressRegistrationResponse> {
    const response = await api.post<AddressRegistrationResponse>(endpoints.addressRegistration.create, {
      whatsappPhoneNumber,
      otp,
      address
    });
    return response.data;
  }

  async updateAddress(
    addressId: number,
    whatsappPhoneNumber: string,
    otp: string,
    address: AddressFormData
  ): Promise<AddressRegistrationResponse> {
    const response = await api.put<AddressRegistrationResponse>(endpoints.addressRegistration.update(addressId.toString()), {
      whatsappPhoneNumber,
      otp,
      address
    });
    return response.data;
  }

  async getCustomerAddresses(whatsappPhoneNumber: string, otp: string): Promise<{ addresses: Address[] }> {
    const response = await api.get<{ addresses: Address[] }>(
      endpoints.addressRegistration.getAddresses(whatsappPhoneNumber),
      { params: { otp } }
    );
    return response.data;
  }

  async deleteAddress(
    addressId: number,
    whatsappPhoneNumber: string,
    otp: string
  ): Promise<void> {
    const response = await api.delete(
      endpoints.addressRegistration.delete(addressId.toString()),
      {
        data: { whatsappPhoneNumber, otp }
      }
    );
    
    if (!response.data.success) {
      throw new Error('Failed to delete address');
    }
  }

  async setDefaultAddress(
    addressId: number,
    whatsappPhoneNumber: string,
    otp: string
  ): Promise<Address> {
    const response = await api.put(
      endpoints.addressRegistration.setDefault(addressId.toString()),
      { whatsappPhoneNumber, otp }
    );
    return response.data.address;
  }

  async getDeliveryArea(): Promise<{ polygonCoords: any[], center?: { lat: number, lng: number } }> {
    try {
      const response = await api.get(endpoints.addressRegistration.getDeliveryArea);
      return response.data;
    } catch (error) {
      console.error('Error fetching delivery area:', error);
      return { polygonCoords: [] };
    }
  }
}

export default new CustomerService();