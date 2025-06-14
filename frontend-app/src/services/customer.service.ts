import apiService from './api';
import type { 
  CustomerDeliveryInfo, 
  OtpVerificationResponse 
} from '@/types/customer.types';
import type { ApiResponse } from '@/types/api.types';

export const customerService = {
  async verifyOtp(
    customerId: string, 
    otp: string
  ): Promise<boolean> {
    const { data } = await apiService.instance.post<OtpVerificationResponse>(
      '/otp/verify',
      { customerId, otp }
    );
    return data.valid;
  },

  async getDeliveryInfo(customerId: string): Promise<CustomerDeliveryInfo | null> {
    try {
      const { data } = await apiService.instance.get<CustomerDeliveryInfo>(
        `/customer-delivery-info/${customerId}`
      );
      return data;
    } catch (error: any) {
      if (error.statusCode === 404) {
        return null;
      }
      throw error;
    }
  },

  async saveDeliveryInfo(
    deliveryInfo: CustomerDeliveryInfo
  ): Promise<CustomerDeliveryInfo> {
    const { data } = await apiService.instance.post<CustomerDeliveryInfo>(
      '/customer-delivery-info',
      deliveryInfo
    );
    return data;
  },

  async updateDeliveryInfo(
    customerId: string,
    deliveryInfo: Partial<CustomerDeliveryInfo>
  ): Promise<CustomerDeliveryInfo> {
    const { data } = await apiService.instance.put<CustomerDeliveryInfo>(
      `/customer-delivery-info/${customerId}`,
      deliveryInfo
    );
    return data;
  },

  async updatePreOrderDeliveryInfo(
    preOrderId: string,
    deliveryInfo: CustomerDeliveryInfo
  ): Promise<CustomerDeliveryInfo> {
    const { data } = await apiService.instance.put<CustomerDeliveryInfo>(
      `/pre-orders/${preOrderId}/delivery-info`,
      deliveryInfo
    );
    return data;
  },

  async sendWhatsAppMessage(
    to: string,
    message: string
  ): Promise<ApiResponse<any>> {
    const { data } = await apiService.instance.post<ApiResponse<any>>(
      '/whatsapp/send-message',
      { to, message }
    );
    return data;
  },
};