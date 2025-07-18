import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import type { Customer, AddressFormData } from '@/types';

interface CustomerData extends Customer {
  id: string;
}

type FormData = AddressFormData;

interface AddressRegistrationState {
  // Estado de la sesión
  customerId: string | null;
  otp: string | null;
  preOrderId: string | null;
  
  // Datos del cliente
  customer: CustomerData | null;
  
  // Estado del formulario
  formData: FormData;
  
  // Estados de UI
  isLoading: boolean;
  isValidating: boolean;
  isSaving: boolean;
  error: string | null;
  showSuccess: boolean;
  editingAddressId: string | null;
  
  // Área de entrega
  deliveryArea: google.maps.LatLngLiteral[] | null;
  
  // Acciones
  setSession: (customerId: string, otp: string, preOrderId?: string) => void;
  setCustomer: (customer: CustomerData) => void;
  setFormData: (data: Partial<FormData>) => void;
  updateFormField: <K extends keyof FormData>(field: K, value: FormData[K]) => void;
  setLoading: (isLoading: boolean) => void;
  setValidating: (isValidating: boolean) => void;
  setSaving: (isSaving: boolean) => void;
  setError: (error: string | null) => void;
  setShowSuccess: (show: boolean) => void;
  setEditingAddressId: (id: string | null) => void;
  setDeliveryArea: (area: google.maps.LatLngLiteral[] | null) => void;
  resetForm: () => void;
  resetAll: () => void;
}

const initialFormData: FormData = {
  name: '',
  street: '',
  number: '',
  interiorNumber: '',
  neighborhood: '',
  city: '',
  state: '',
  country: 'México',
  zipCode: '',
  deliveryInstructions: '',
  latitude: 0,
  longitude: 0,
};

export const useAddressRegistrationStore = create<AddressRegistrationState>()(
  devtools(
    persist(
      (set) => ({
        // Estado inicial
        customerId: null,
        otp: null,
        preOrderId: null,
        customer: null,
        formData: initialFormData,
        isLoading: false,
        isValidating: false,
        isSaving: false,
        error: null,
        showSuccess: false,
        editingAddressId: null,
        deliveryArea: null,
        
        // Acciones
        setSession: (customerId, otp, preOrderId) => 
          set({ customerId, otp, preOrderId }, false, 'setSession'),
        
        setCustomer: (customer) => 
          set({ customer }, false, 'setCustomer'),
        
        setFormData: (data) => 
          set((state) => ({ 
            formData: { ...state.formData, ...data } 
          }), false, 'setFormData'),
        
        updateFormField: (field, value) =>
          set((state) => ({
            formData: { ...state.formData, [field]: value }
          }), false, 'updateFormField'),
        
        setLoading: (isLoading) => 
          set({ isLoading }, false, 'setLoading'),
        
        setValidating: (isValidating) => 
          set({ isValidating }, false, 'setValidating'),
        
        setSaving: (isSaving) => 
          set({ isSaving }, false, 'setSaving'),
        
        setError: (error) => 
          set({ error }, false, 'setError'),
        
        setShowSuccess: (showSuccess) => 
          set({ showSuccess }, false, 'setShowSuccess'),
        
        setEditingAddressId: (editingAddressId) => 
          set({ editingAddressId }, false, 'setEditingAddressId'),
        
        setDeliveryArea: (deliveryArea) => 
          set({ deliveryArea }, false, 'setDeliveryArea'),
        
        resetForm: () => 
          set({ 
            formData: initialFormData, 
            editingAddressId: null,
            error: null 
          }, false, 'resetForm'),
        
        resetAll: () => 
          set({
            customerId: null,
            otp: null,
            preOrderId: null,
            customer: null,
            formData: initialFormData,
            isLoading: false,
            isValidating: false,
            isSaving: false,
            error: null,
            showSuccess: false,
            editingAddressId: null,
            deliveryArea: null,
          }, false, 'resetAll'),
      }),
      {
        name: 'address-registration-storage',
        // Solo persistir datos de sesión, no estados de UI
        partialize: (state) => ({
          customerId: state.customerId,
          otp: state.otp,
          preOrderId: state.preOrderId,
        }),
      }
    )
  )
);