import React from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Input } from '@/components/ui';
import type { AddressFormData, CustomerDeliveryInfo } from '@/types/customer.types';

const schema = yup.object({
  pickupName: yup.string().required('El nombre del cliente es obligatorio'),
  streetAddress: yup.string().required('La dirección es obligatoria'),
  additionalDetails: yup.string().nullable(),
  neighborhood: yup.string().nullable(),
  postalCode: yup.string().nullable(),
  city: yup.string().nullable(),
  state: yup.string().nullable(),
  country: yup.string().nullable(),
});

interface AddressFormProps {
  formData: AddressFormData;
  onSubmit: (data: CustomerDeliveryInfo) => Promise<void>;
  errors?: Record<string, string>;
}

export const AddressForm: React.FC<AddressFormProps> = ({ 
  formData, 
  onSubmit,
  errors: externalErrors = {} 
}) => {
  const {
    register,
    handleSubmit,
    formState: { errors },
    setValue,
    watch,
  } = useForm<AddressFormData>({
    resolver: yupResolver(schema),
    defaultValues: formData,
  });

  React.useEffect(() => {
    // Update form when formData changes
    Object.entries(formData).forEach(([key, value]) => {
      setValue(key as keyof AddressFormData, value);
    });
  }, [formData, setValue]);

  const onFormSubmit = (data: AddressFormData) => {
    const deliveryInfo: CustomerDeliveryInfo = {
      ...data,
      latitude: data.latitude ? parseFloat(data.latitude) : undefined,
      longitude: data.longitude ? parseFloat(data.longitude) : undefined,
    };
    onSubmit(deliveryInfo);
  };

  const fieldTranslations = {
    streetAddress: 'Dirección',
    neighborhood: 'Colonia',
    postalCode: 'Código postal',
    city: 'Ciudad',
    state: 'Estado',
    country: 'País',
  };

  return (
    <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-2 bg-white p-2 rounded-lg shadow-md">
      <div className="grid grid-cols-1 gap-1">
        {/* Nombre del cliente */}
        <Input
          label="Nombre del cliente"
          {...register('pickupName')}
          error={errors.pickupName?.message || externalErrors.pickupName}
          required
          placeholder="Ej: Juan Pérez"
        />

        {/* Dirección completa */}
        <div>
          <Input
            label={fieldTranslations.streetAddress}
            {...register('streetAddress')}
            error={errors.streetAddress?.message || externalErrors.streetAddress}
            required
            placeholder="Ej: Av. Principal 123"
            hint="Importante: Incluya la orientación de la calle si aplica (ej. Norte, Sur, etc.)"
          />
        </div>

        {/* Detalles adicionales */}
        <Input
          label="Detalles adicionales"
          {...register('additionalDetails')}
          error={errors.additionalDetails?.message}
          as="textarea"
          rows={2}
          placeholder="ej. entre calles, puntos de referencia"
          hint="Agregue información extra para ubicar su dirección más fácilmente"
        />

        {/* Campos de ubicación */}
        <div className="grid grid-cols-2 md:grid-cols-3 gap-1">
          <Input
            label={fieldTranslations.neighborhood}
            {...register('neighborhood')}
            readOnly
            className="bg-gray-100"
          />
          <Input
            label={fieldTranslations.postalCode}
            {...register('postalCode')}
            readOnly
            className="bg-gray-100"
          />
          <Input
            label={fieldTranslations.city}
            {...register('city')}
            readOnly
            className="bg-gray-100"
          />
          <Input
            label={fieldTranslations.state}
            {...register('state')}
            readOnly
            className="bg-gray-100"
          />
          <Input
            label={fieldTranslations.country}
            {...register('country')}
            readOnly
            className="bg-gray-100"
          />
        </div>

        {/* Hidden fields for coordinates */}
        <input type="hidden" {...register('latitude')} />
        <input type="hidden" {...register('longitude')} />
      </div>
    </form>
  );
};