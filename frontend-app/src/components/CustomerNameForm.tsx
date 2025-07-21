import { useState } from 'react';
import toast from 'react-hot-toast';

interface CustomerNameFormProps {
  onSubmit: (firstName: string, lastName: string) => Promise<void>;
  isSubmitting?: boolean;
  initialFirstName?: string;
  initialLastName?: string;
  isEditing?: boolean;
  onCancel?: () => void;
  registrationMode?: 'full' | 'nameOnly';
}

export function CustomerNameForm({ 
  onSubmit, 
  isSubmitting = false,
  initialFirstName = '',
  initialLastName = '',
  isEditing = false,
  onCancel,
  registrationMode = 'full'
}: CustomerNameFormProps) {
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string }>({});

  const validateForm = () => {
    const newErrors: { firstName?: string; lastName?: string } = {};
    
    if (!firstName.trim()) {
      newErrors.firstName = 'El nombre es requerido';
    } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(firstName.trim())) {
      newErrors.firstName = 'El nombre solo puede contener letras';
    }
    
    if (!lastName.trim()) {
      newErrors.lastName = 'El apellido es requerido';
    } else if (!/^[a-zA-ZáéíóúÁÉÍÓÚñÑ\s]+$/.test(lastName.trim())) {
      newErrors.lastName = 'El apellido solo puede contener letras';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      return;
    }
    
    try {
      await onSubmit(firstName.trim(), lastName.trim());
    } catch {
      toast.error('Error al guardar tu nombre');
    }
  };

  return (
    <div className="bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 border-2 border-orange-200 rounded-2xl p-8 mb-6 shadow-lg">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-100 to-pink-100 rounded-full mb-4">
          <span className="text-3xl">👤</span>
        </div>
        <h3 className="text-2xl font-bold text-gray-800 mb-2">
          {isEditing ? 'Actualizar tu nombre' : '¡Casi listo! Solo falta tu nombre'}
        </h3>
        <p className="text-base text-gray-600 max-w-md mx-auto">
          {isEditing 
            ? 'Modifica tu información personal para mantener tus datos actualizados.'
            : registrationMode === 'nameOnly'
              ? <><span className="font-semibold text-orange-600">Es necesario completar tu información personal</span> para poder procesar tu pedido de recolección.</>
              : <><span className="font-semibold text-orange-600">Es necesario completar tu información personal</span> para poder registrar tus direcciones de entrega y procesar tus pedidos.</>
          }
        </p>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="firstName" className="block text-sm font-semibold text-gray-700 mb-2">
            Nombre <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="firstName"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-3 focus:ring-orange-500 focus:border-transparent transition-all ${
              errors.firstName ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-white'
            }`}
            placeholder="Ej: Juan"
            disabled={isSubmitting}
            maxLength={100}
          />
          {errors.firstName && (
            <p className="text-red-500 text-sm mt-1 flex items-center">
              <span className="mr-1">⚠️</span> {errors.firstName}
            </p>
          )}
        </div>
        
        <div>
          <label htmlFor="lastName" className="block text-sm font-semibold text-gray-700 mb-2">
            Apellido <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            id="lastName"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={`w-full px-4 py-3 border-2 rounded-xl focus:ring-3 focus:ring-orange-500 focus:border-transparent transition-all ${
              errors.lastName ? 'border-red-500 bg-red-50' : 'border-gray-300 bg-white'
            }`}
            placeholder="Ej: Pérez"
            disabled={isSubmitting}
            maxLength={100}
          />
          {errors.lastName && (
            <p className="text-red-500 text-sm mt-1 flex items-center">
              <span className="mr-1">⚠️</span> {errors.lastName}
            </p>
          )}
        </div>
        
        <div className="pt-4 space-y-3">
          <button
            type="submit"
            disabled={isSubmitting}
            className={`w-full px-6 py-4 font-bold text-white rounded-xl shadow-lg transform transition-all duration-200 ${
              isSubmitting
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-gradient-to-r from-orange-500 to-pink-600 hover:shadow-xl hover:scale-105'
            }`}
          >
            {isSubmitting ? (
              <div className="flex items-center justify-center">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                Guardando...
              </div>
            ) : (
              <span className="flex items-center justify-center">
                {isEditing 
                  ? 'Guardar cambios' 
                  : registrationMode === 'nameOnly' 
                    ? 'Completar registro' 
                    : 'Continuar al registro de dirección'}
                <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </span>
            )}
          </button>
          
          {isEditing && onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={isSubmitting}
              className="w-full px-6 py-3 font-semibold text-gray-700 bg-white border-2 border-gray-300 rounded-xl hover:bg-gray-50 transition-colors"
            >
              Cancelar
            </button>
          )}
        </div>
      </form>
    </div>
  );
}