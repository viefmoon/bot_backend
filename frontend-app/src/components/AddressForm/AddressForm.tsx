import React from 'react';
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { Input } from '@/components/ui';
import type { AddressFormData } from '@/types/customer.types';

const schema = yup.object({
  street: yup.string().required('La calle es obligatoria'),
  number: yup.string().required('El número es obligatorio'),
  interiorNumber: yup.string().nullable(),
  references: yup.string().nullable(),
  neighborhood: yup.string().nullable(),
  zipCode: yup.string().nullable(),
  city: yup.string().nullable(),
  state: yup.string().nullable(),
  country: yup.string().nullable(),
  latitude: yup.number().required('La ubicación es obligatoria'),
  longitude: yup.number().required('La ubicación es obligatoria'),
});

interface AddressFormProps {
  formData: AddressFormData;
  onSubmit: (data: AddressFormData) => Promise<void>;
  errors?: Record<string, string>;
  isUpdating?: boolean;
}

export const AddressForm: React.FC<AddressFormProps> = ({ 
  formData, 
  onSubmit,
  errors: externalErrors = {},
  isUpdating = false
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

  const fieldTranslations = {
    street: 'Calle',
    number: 'Número',
    interiorNumber: 'Número interior',
    neighborhood: 'Colonia',
    zipCode: 'Código postal',
    city: 'Ciudad',
    state: 'Estado',
    country: 'País',
    references: 'Referencias',
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {/* Dirección principal */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center">
          <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          Dirección Principal
        </h3>
        
        <div className="grid grid-cols-3 gap-3">
          <div className="col-span-2">
            <Input
              label={fieldTranslations.street}
              {...register('street')}
              error={errors.street?.message || externalErrors.street}
              required
              placeholder="Ej: Av. Principal"
            />
          </div>
          <div>
            <Input
              label={fieldTranslations.number}
              {...register('number')}
              error={errors.number?.message || externalErrors.number}
              required
              placeholder="123"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input
            label={fieldTranslations.interiorNumber}
            {...register('interiorNumber')}
            error={errors.interiorNumber?.message}
            placeholder="Depto 4B (Opcional)"
          />
        </div>
      </div>

      {/* Referencias */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center">
          <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Referencias
        </h3>
        
        <Input
          label=""
          {...register('references')}
          error={errors.references?.message}
          as="textarea"
          rows={3}
          placeholder="Entre calles, puntos de referencia, color de la casa, etc."
          className="resize-none"
        />
      </div>

      {/* Información adicional */}
      <div className="space-y-4">
        <h3 className="text-sm font-semibold text-gray-700 flex items-center justify-between">
          <span className="flex items-center">
            <svg className="w-4 h-4 mr-2 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            Información Geográfica
          </span>
          <span className="text-xs font-normal bg-gray-200 text-gray-600 px-2 py-1 rounded-full flex items-center">
            <svg className="w-3 h-3 mr-1" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
            </svg>
            Campos automáticos
          </span>
        </h3>
        
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          <div className="relative">
            <Input
              label={fieldTranslations.neighborhood}
              {...register('neighborhood')}
              readOnly
              className="bg-gray-100 cursor-not-allowed text-gray-600 border-gray-200"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none mt-7">
              <svg className="h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="relative">
            <Input
              label={fieldTranslations.zipCode}
              {...register('zipCode')}
              readOnly
              className="bg-gray-100 cursor-not-allowed text-gray-600 border-gray-200"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none mt-7">
              <svg className="h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="relative">
            <Input
              label={fieldTranslations.city}
              {...register('city')}
              readOnly
              className="bg-gray-100 cursor-not-allowed text-gray-600 border-gray-200"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none mt-7">
              <svg className="h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="relative">
            <Input
              label={fieldTranslations.state}
              {...register('state')}
              readOnly
              className="bg-gray-100 cursor-not-allowed text-gray-600 border-gray-200"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none mt-7">
              <svg className="h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          <div className="relative">
            <Input
              label={fieldTranslations.country}
              {...register('country')}
              readOnly
              className="bg-gray-100 cursor-not-allowed text-gray-600 border-gray-200"
            />
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none mt-7">
              <svg className="h-4 w-4 text-gray-400" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
        </div>

        <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
          <p className="text-xs text-amber-800 flex items-start font-medium">
            <svg className="w-4 h-4 mr-1.5 flex-shrink-0 mt-0.5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
            </svg>
            Estos campos se completan automáticamente cuando seleccionas tu ubicación en el mapa. No es necesario editarlos manualmente.
          </p>
        </div>
      </div>

      {/* Hidden fields for coordinates */}
      <input type="hidden" {...register('latitude')} />
      <input type="hidden" {...register('longitude')} />
    </form>
  );
};