import api from './api';
import { endpoints } from '@/config';
import type { 
  Customer, 
  Address, 
  AddressFormData, 
  OTPVerificationResponse, 
  AddressRegistrationResponse 
} from '../types/customer.types';

class CustomerService {
  /**
   * Verify OTP for address registration
   */
  async verifyOTP(customerId: string, otp: string): Promise<OTPVerificationResponse> {
    const response = await api.post<OTPVerificationResponse>(endpoints.addressRegistration.verifyOtp, {
      customerId,
      otp
    });
    return response.data;
  }

  /**
   * Create new address for customer
   */
  async createAddress(
    customerId: string, 
    otp: string, 
    address: AddressFormData
  ): Promise<AddressRegistrationResponse> {
    const response = await api.post<AddressRegistrationResponse>(endpoints.addressRegistration.create, {
      customerId,
      otp,
      address
    });
    return response.data;
  }

  /**
   * Update existing address
   */
  async updateAddress(
    addressId: number,
    customerId: string,
    otp: string,
    address: AddressFormData
  ): Promise<AddressRegistrationResponse> {
    const response = await api.put<AddressRegistrationResponse>(endpoints.addressRegistration.update(addressId.toString()), {
      customerId,
      otp,
      address
    });
    return response.data;
  }

  /**
   * Get customer addresses
   */
  async getCustomerAddresses(customerId: string, otp: string): Promise<{ addresses: Address[] }> {
    const response = await api.get<{ addresses: Address[] }>(
      endpoints.addressRegistration.getAddresses(customerId),
      { params: { otp } }
    );
    return response.data;
  }

  /**
   * Get delivery area polygon
   */
  async getDeliveryArea(): Promise<{ polygonCoords: any[], center?: { lat: number, lng: number } }> {
    try {
      const response = await api.get(endpoints.addressRegistration.getDeliveryArea);
      return response.data;
    } catch (error) {
      console.error('Error fetching delivery area:', error);
      return { polygonCoords: [] };
    }
  }

  /**
   * Legacy methods for backward compatibility
   */
  async getCustomerByPhoneNumber(phoneNumber: string): Promise<Customer | null> {
    // This is now handled by OTP verification
    return null;
  }

  async getCustomerDeliveryInfo(customerId: string): Promise<any> {
    // Legacy method - no longer used
    return null;
  }

  async createCustomerDeliveryInfo(data: any): Promise<any> {
    // Convert legacy format to new format
    const addressData: AddressFormData = {
      street: data.streetAddress?.split(' ')[0] || '',
      number: data.streetAddress?.split(' ')[1] || '',
      neighborhood: data.neighborhood,
      city: data.city,
      state: data.state,
      zipCode: data.postalCode,
      country: data.country,
      references: data.additionalDetails,
      latitude: data.latitude,
      longitude: data.longitude
    };

    // Extract customerId from the data (assuming it's passed)
    const customerId = data.customerId || data.customer?.customerId;
    const otp = data.otp;

    if (!customerId || !otp) {
      throw new Error('Customer ID and OTP are required');
    }

    const response = await this.createAddress(customerId, otp, addressData);
    
    // Convert back to legacy format
    return {
      ...response.address,
      streetAddress: `${response.address.street} ${response.address.number}`,
      postalCode: response.address.zipCode,
      additionalDetails: response.address.references,
      pickupName: data.pickupName
    };
  }

  async updateCustomerDeliveryInfo(customerId: string, data: any): Promise<any> {
    // Convert legacy format to new format
    const addressData: AddressFormData = {
      street: data.streetAddress?.split(' ')[0] || '',
      number: data.streetAddress?.split(' ')[1] || '',
      neighborhood: data.neighborhood,
      city: data.city,
      state: data.state,
      zipCode: data.postalCode,
      country: data.country,
      references: data.additionalDetails,
      latitude: data.latitude,
      longitude: data.longitude
    };

    const otp = data.otp;
    const addressId = data.id || data.addressId;

    if (!otp || !addressId) {
      throw new Error('OTP and Address ID are required');
    }

    const response = await this.updateAddress(addressId, customerId, otp, addressData);
    
    // Convert back to legacy format
    return {
      ...response.address,
      streetAddress: `${response.address.street} ${response.address.number}`,
      postalCode: response.address.zipCode,
      additionalDetails: response.address.references
    };
  }
}

export default new CustomerService();