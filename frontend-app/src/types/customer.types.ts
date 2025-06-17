export interface Customer {
  customerId: string;
  firstName?: string | null;
  lastName?: string | null;
  hasAddresses: boolean;
  addresses: Address[];
}

export interface Address {
  id: number;
  localId?: string | null;
  customerId: string;
  street: string;
  number: string;
  interiorNumber?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  zipCode?: string | null;
  country?: string | null;
  references?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  geocodedAddress?: string | null;
  isDefault: boolean;
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

export interface AddressFormData {
  street: string;
  number: string;
  interiorNumber?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  zipCode?: string;
  country?: string;
  references?: string;
  latitude: number;
  longitude: number;
  geocodedAddress?: string;
  isDefault?: boolean;
}

export interface OTPVerificationResponse {
  valid: boolean;
  customer?: Customer;
}

export interface AddressRegistrationResponse {
  success: boolean;
  address: Address;
}

// Legacy types for backward compatibility
export interface CustomerDeliveryInfo {
  customerId?: string;
  pickupName?: string;
  streetAddress?: string;
  neighborhood?: string | null;
  postalCode?: string | null;
  city?: string | null;
  state?: string | null;
  country?: string | null;
  latitude?: string | number;
  longitude?: string | number;
  additionalDetails?: string | null;
  geocodedAddress?: string | null;
}

// Location type
export interface Location {
  lat: number;
  lng: number;
}