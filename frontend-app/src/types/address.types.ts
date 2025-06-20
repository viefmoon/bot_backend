export interface AddressFormData {
  street: string;
  number: string;
  interiorNumber?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
  references?: string;
  latitude: number;
  longitude: number;
}

export interface Address {
  id: string;
  street: string;
  number: string;
  interiorNumber?: string | null;
  neighborhood?: string | null;
  city: string;
  state: string;
  country: string;
  zipCode?: string | null;
  references?: string | null;
  latitude: number;
  longitude: number;
  isDefault: boolean;
  customerId: string;
  createdAt: Date;
  updatedAt: Date;
}