import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import toast, { Toaster } from 'react-hot-toast';
import { useVerifyOtp, useUpdateCustomerName } from '@/hooks/useAddressQueries';

interface Customer {
  id: string;
  whatsappPhoneNumber: string;
  firstName?: string | null;
  lastName?: string | null;
}

export function NameRegistration() {
  const [searchParams] = useSearchParams();
  
  // Estado del componente
  const [customerId, setCustomerId] = useState<string>('');
  const [otp, setOtp] = useState<string>('');
  const [customer, setCustomer] = useState<Customer | null>(null);
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [errors, setErrors] = useState<{ firstName?: string; lastName?: string }>({});
  const [showSuccessScreen, setShowSuccessScreen] = useState(false);
  const [showOTPErrorScreen, setShowOTPErrorScreen] = useState(false);

  // Initialize session from URL params
  useEffect(() => {
    // Get customerId from URL path (e.g., /name-registration/5213320407035)
    const pathParts = window.location.pathname.split('/');
    const urlCustomerId = pathParts[pathParts.length - 1] || searchParams.get('from') || '';
    const urlOtp = searchParams.get('otp') || '';
    
    if (urlCustomerId && urlOtp) {
      setCustomerId(urlCustomerId);
      setOtp(urlOtp);
    }
  }, [searchParams]);

  // React Query hooks
  const { data: otpData, isLoading: isVerifying } = useVerifyOtp(
    customerId && otp ? { whatsappPhoneNumber: customerId, otp } : null
  );
  
  const updateCustomerNameMutation = useUpdateCustomerName();

  // Handle OTP verification response
  useEffect(() => {
    if (otpData) {
      if (otpData.valid && otpData.customer) {
        setCustomer(otpData.customer);
        // Pre-llenar si ya tiene nombre
        if (otpData.customer.firstName) {
          setFirstName(otpData.customer.firstName);
        }
        if (otpData.customer.lastName) {
          setLastName(otpData.customer.lastName);
        }
      } else {
        toast.error(
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v2m0 2h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-semibold text-gray-900">🕒 Enlace Expirado</p>
              <p className="text-xs text-gray-600">
                Por seguridad, los enlaces expiran después de 10 minutos.
              </p>
            </div>
          </div>,
          {
            duration: 5000,
            style: {
              background: '#fef2f2',
              border: '1px solid #fecaca',
              padding: '16px',
              maxWidth: '420px',
            },
          }
        );
      }
    }
  }, [otpData]);

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

    if (!customerId || !otp) {
      toast.error('Información de sesión no válida');
      return;
    }
    
    try {
      const result = await updateCustomerNameMutation.mutateAsync({
        whatsappPhoneNumber: customerId,
        otp,
        firstName: firstName.trim(),
        lastName: lastName.trim(),
      });
      
      if (result.success) {
        toast.success(
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-semibold text-gray-900">¡Registro completado!</p>
              <p className="text-xs text-gray-600">Tu nombre se ha guardado correctamente</p>
            </div>
          </div>,
          {
            duration: 2000,
            style: {
              background: '#f0fdf4',
              border: '1px solid #86efac',
              padding: '16px',
              maxWidth: '420px',
            },
          }
        );
        
        // Mostrar pantalla de éxito
        setTimeout(() => {
          setShowSuccessScreen(true);
          // Cerrar automáticamente después de 3 segundos
          setTimeout(() => {
            window.close();
          }, 3000);
        }, 1500);
      }
    } catch (error: any) {
      // Verificar si es un error de OTP expirado
      const isOTPError = error?.response?.data?.code === 'VAL006' || 
                        error?.response?.data?.error?.includes('OTP') ||
                        error?.message?.toLowerCase().includes('otp');
      
      if (isOTPError) {
        toast.error(
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <svg className="w-6 h-6 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v2m0 2h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm font-semibold text-gray-900">🕒 Enlace Expirado</p>
              <p className="text-xs text-gray-600">
                Tu enlace de registro ha expirado por seguridad.
                Por favor, solicita un nuevo enlace desde WhatsApp.
              </p>
            </div>
          </div>,
          {
            duration: 6000,
            style: {
              background: '#fef2f2',
              border: '1px solid #fecaca',
              padding: '16px',
              maxWidth: '420px',
            },
          }
        );
        
        // Mostrar pantalla de error
        setTimeout(() => {
          setShowOTPErrorScreen(true);
          setTimeout(() => {
            window.close();
          }, 5000);
        }, 2000);
      } else {
        const errorMessage = error?.response?.data?.error || 
                           error?.message || 
                           'Hubo un error al guardar tu información';
        
        toast.error(errorMessage);
      }
    }
  };

  // Loading state
  if (isVerifying) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-red-50 to-pink-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Verificando enlace...</p>
        </div>
      </div>
    );
  }

  // Invalid OTP or no customer
  if (!customer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-red-50 to-pink-50 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-lg text-center">
          <svg className="mx-auto h-12 w-12 text-red-500 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-2xl font-bold text-gray-900 mb-2">Enlace inválido</h2>
          <p className="text-gray-600">
            Este enlace ha expirado o no es válido. Por favor, solicita un nuevo enlace desde WhatsApp.
          </p>
        </div>
        <Toaster position="top-center" />
      </div>
    );
  }

  // Success screen
  if (showSuccessScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-emerald-100 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl text-center">
          <div className="mb-6">
            <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">¡Registro Completado!</h2>
            <p className="text-gray-600 mb-6">
              Tu información se ha registrado correctamente. Ya puedes continuar con tu pedido para recolección en WhatsApp.
            </p>
          </div>
          
          <div className="space-y-3">
            <button
              onClick={() => window.close()}
              className="w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl hover:shadow-lg transform hover:scale-105 transition-all duration-200"
            >
              Cerrar ventana
            </button>
          </div>
          
          <p className="text-xs text-gray-500 mt-6">
            Esta ventana se cerrará automáticamente en unos segundos...
          </p>
        </div>
      </div>
    );
  }

  // OTP Error screen
  if (showOTPErrorScreen) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-red-50 to-orange-100 p-4">
        <div className="max-w-md w-full bg-white p-8 rounded-2xl shadow-xl text-center">
          <div className="mb-6">
            <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-10 h-10 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">🕒 Enlace Expirado</h2>
            <p className="text-gray-600 mb-2">
              Tu enlace ha expirado por seguridad.
            </p>
            <p className="text-sm text-gray-500 mb-6">
              Los enlaces son válidos por 10 minutos para proteger tu información.
            </p>
          </div>
          
          <div className="space-y-3">
            <button
              onClick={() => {
                toast('📱 Por favor, solicita un nuevo enlace desde WhatsApp', {
                  duration: 4000,
                  icon: 'ℹ️',
                  style: {
                    background: '#f0f9ff',
                    border: '1px solid #3b82f6',
                    padding: '16px',
                  },
                });
              }}
              className="block w-full px-6 py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white font-semibold rounded-xl hover:shadow-lg transform hover:scale-105 transition-all duration-200"
            >
              <span className="flex items-center justify-center gap-2">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946.003-6.556 5.338-11.891 11.893-11.891 3.181.001 6.167 1.24 8.413 3.488 2.245 2.248 3.481 5.236 3.48 8.414-.003 6.557-5.338 11.892-11.893 11.892-1.99-.001-3.951-.5-5.688-1.448l-6.305 1.654zm6.597-3.807c1.676.995 3.276 1.591 5.392 1.592 5.448 0 9.886-4.434 9.889-9.885.002-5.462-4.415-9.89-9.881-9.892-5.452 0-9.887 4.434-9.889 9.884-.001 2.225.651 3.891 1.746 5.634l-.999 3.648 3.742-.981zm11.387-5.464c-.074-.124-.272-.198-.57-.347-.297-.149-1.758-.868-2.031-.967-.272-.099-.47-.149-.669.149-.198.297-.768.967-.941 1.165-.173.198-.347.223-.644.074-.297-.149-1.255-.462-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.297-.347.446-.521.151-.172.2-.296.3-.495.099-.198.05-.372-.025-.521-.075-.148-.669-1.611-.916-2.206-.242-.579-.487-.501-.669-.51l-.57-.01c-.198 0-.52.074-.792.372s-1.04 1.016-1.04 2.479 1.065 2.876 1.213 3.074c.149.198 2.095 3.2 5.076 4.487.709.306 1.263.489 1.694.626.712.226 1.36.194 1.872.118.571-.085 1.758-.719 2.006-1.413.248-.695.248-1.29.173-1.414z"/>
                </svg>
                Solicitar nuevo enlace
              </span>
            </button>
            
            <button
              onClick={() => {
                window.close();
                setTimeout(() => {
                  window.location.href = 'about:blank';
                }, 500);
              }}
              className="w-full px-6 py-3 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-all duration-200"
            >
              Cerrar ventana
            </button>
          </div>
          
          <p className="text-xs text-gray-500 mt-6">
            Esta ventana se cerrará automáticamente...
          </p>
        </div>
      </div>
    );
  }

  // Main form
  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-red-50 to-pink-50">
      <div className="max-w-md mx-auto p-4">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-orange-500 to-pink-600 p-6 text-white">
            <h1 className="text-2xl font-bold mb-2 drop-shadow-lg">
              📝 Registro para Recolección
            </h1>
            <p className="text-white/90">
              Registra tu nombre para identificar tu pedido cuando lo recojas
            </p>
          </div>
          
          {/* Form */}
          <div className="p-6">
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
                  disabled={updateCustomerNameMutation.isPending}
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
                  disabled={updateCustomerNameMutation.isPending}
                  maxLength={100}
                />
                {errors.lastName && (
                  <p className="text-red-500 text-sm mt-1 flex items-center">
                    <span className="mr-1">⚠️</span> {errors.lastName}
                  </p>
                )}
              </div>
              
              <div className="pt-4">
                <button
                  type="submit"
                  disabled={updateCustomerNameMutation.isPending}
                  className={`w-full px-6 py-4 font-bold text-white rounded-xl shadow-lg transform transition-all duration-200 ${
                    updateCustomerNameMutation.isPending
                      ? 'bg-gray-400 cursor-not-allowed'
                      : 'bg-gradient-to-r from-orange-500 to-pink-600 hover:shadow-xl hover:scale-105'
                  }`}
                >
                  {updateCustomerNameMutation.isPending ? (
                    <div className="flex items-center justify-center">
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2"></div>
                      Guardando...
                    </div>
                  ) : (
                    <span className="flex items-center justify-center">
                      Completar registro
                      <svg className="ml-2 w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  )}
                </button>
              </div>
            </form>
            
            <div className="mt-6 p-4 bg-orange-50 rounded-xl">
              <p className="text-sm text-gray-600 text-center">
                <span className="font-semibold text-orange-600">Nota:</span> Esta información es solo para identificar tu pedido al momento de recogerlo en el restaurante.
              </p>
            </div>
          </div>
        </div>
      </div>
      <Toaster position="top-center" />
    </div>
  );
}

export default NameRegistration;