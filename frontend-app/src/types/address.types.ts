export interface AddressFormData {
  name: string;
  street: string;
  number: string;
  interiorNumber?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  deliveryInstructions?: string;
  latitude: number;
  longitude: number;
}

export interface Address {
  id: string;
  name: string;
  street: string;
  number: string;
  interiorNumber?: string | null;
  neighborhood?: string | null;
  city: string;
  state: string;
  country: string;
  zipCode?: string | null;
  deliveryInstructions?: string | null;
  latitude: number;
  longitude: number;
  isDefault: boolean;
  customerId: string;
  createdAt: Date;
  updatedAt: Date;
}