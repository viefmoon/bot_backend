export interface CustomerDeliveryInfo {
  id?: number;
  customerId: string;
  pickupName: string;
  streetAddress: string;
  neighborhood: string;
  city: string;
  state: string;
  country: string;
  postalCode: string;
  latitude?: number;
  longitude?: number;
  additionalDetails?: string;
  geocodedAddress?: string;
}

export interface Location {
  lat: number;
  lng: number;
}

export interface AddressFormData extends Omit<CustomerDeliveryInfo, 'latitude' | 'longitude'> {
  latitude: string;
  longitude: string;
}

export interface OtpVerificationResponse {
  valid: boolean;
  message?: string;
}