# Frontend con Vite + React + TypeScript

## 1. Crear proyecto con TypeScript

```bash
cd /home/leo/bot_backend
npm create vite@latest frontend-app -- --template react-ts
cd frontend-app
npm install
```

## 2. Instalar dependencias

```bash
# Dependencias principales
npm install axios react-hook-form @react-google-maps/api
npm install @hookform/resolvers yup

# Tailwind CSS
npm install -D tailwindcss postcss autoprefixer @types/google.maps
npx tailwindcss init -p

# Utilidades adicionales
npm install clsx react-hot-toast
```

## 3. Configuración de TypeScript (tsconfig.json)

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

## 4. Estructura del proyecto

```
frontend-app/
├── src/
│   ├── components/
│   │   ├── AddressForm/
│   │   │   ├── AddressForm.tsx
│   │   │   ├── AddressForm.types.ts
│   │   │   └── index.ts
│   │   └── ui/
│   │       ├── Button.tsx
│   │       ├── Input.tsx
│   │       └── index.ts
│   ├── services/
│   │   ├── api.ts
│   │   └── customer.service.ts
│   ├── types/
│   │   ├── customer.types.ts
│   │   └── api.types.ts
│   ├── hooks/
│   │   ├── useApi.ts
│   │   └── useCustomer.ts
│   ├── utils/
│   │   └── validators.ts
│   ├── App.tsx
│   ├── main.tsx
│   └── vite-env.d.ts
├── .env
├── .env.example
├── index.html
├── package.json
├── tsconfig.json
├── vite.config.ts
└── tailwind.config.js
```

## 5. Tipos TypeScript

```typescript
// src/types/customer.types.ts
export interface CustomerDeliveryInfo {
  id?: number;
  customerId: string;
  streetAddress: string;
  neighborhood: string;
  city: string;
  postalCode?: string;
  references?: string;
  latitude?: number;
  longitude?: number;
}

export interface Customer {
  customerId: string;
  name: string;
  phone: string;
  deliveryInfo?: CustomerDeliveryInfo;
}

// src/types/api.types.ts
export interface ApiResponse<T> {
  data: T;
  message?: string;
  error?: string;
}

export interface ApiError {
  message: string;
  statusCode: number;
  error?: any;
}
```

## 6. Servicio API con TypeScript

```typescript
// src/services/api.ts
import axios, { AxiosInstance, AxiosError } from 'axios';
import { ApiError } from '@/types/api.types';

class ApiService {
  private api: AxiosInstance;

  constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Interceptor para manejo de errores
    this.api.interceptors.response.use(
      (response) => response,
      (error: AxiosError<ApiError>) => {
        const apiError: ApiError = {
          message: error.response?.data?.message || error.message,
          statusCode: error.response?.status || 500,
          error: error.response?.data?.error,
        };
        return Promise.reject(apiError);
      }
    );
  }

  get instance() {
    return this.api;
  }
}

export default new ApiService();
```

```typescript
// src/services/customer.service.ts
import apiService from './api';
import { CustomerDeliveryInfo, Customer } from '@/types/customer.types';
import { ApiResponse } from '@/types/api.types';

export const customerService = {
  async getCustomer(customerId: string): Promise<Customer> {
    const { data } = await apiService.instance.get<ApiResponse<Customer>>(
      `/customers/${customerId}`
    );
    return data.data;
  },

  async saveDeliveryInfo(
    deliveryInfo: CustomerDeliveryInfo
  ): Promise<CustomerDeliveryInfo> {
    const { data } = await apiService.instance.post<
      ApiResponse<CustomerDeliveryInfo>
    >('/customer-delivery-info', deliveryInfo);
    return data.data;
  },

  async updateDeliveryInfo(
    customerId: string,
    deliveryInfo: Partial<CustomerDeliveryInfo>
  ): Promise<CustomerDeliveryInfo> {
    const { data } = await apiService.instance.put<
      ApiResponse<CustomerDeliveryInfo>
    >(`/customer-delivery-info/${customerId}`, deliveryInfo);
    return data.data;
  },
};
```

## 7. Componente AddressForm con TypeScript

```typescript
// src/components/AddressForm/AddressForm.types.ts
export interface AddressFormProps {
  customerId: string;
  onSuccess?: () => void;
  onError?: (error: Error) => void;
}

// src/components/AddressForm/AddressForm.tsx
import { useForm } from 'react-hook-form';
import { yupResolver } from '@hookform/resolvers/yup';
import * as yup from 'yup';
import { useState } from 'react';
import toast from 'react-hot-toast';
import { customerService } from '@/services/customer.service';
import { CustomerDeliveryInfo } from '@/types/customer.types';
import { Button, Input } from '@/components/ui';
import { AddressFormProps } from './AddressForm.types';

const schema = yup.object({
  streetAddress: yup.string().required('La calle es requerida'),
  neighborhood: yup.string().required('La colonia es requerida'),
  city: yup.string().required('La ciudad es requerida'),
  postalCode: yup.string().matches(/^\d{5}$/, 'Código postal inválido').nullable(),
  references: yup.string().nullable(),
});

type FormData = yup.InferType<typeof schema>;

export const AddressForm: React.FC<AddressFormProps> = ({
  customerId,
  onSuccess,
  onError,
}) => {
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormData>({
    resolver: yupResolver(schema),
    defaultValues: {
      streetAddress: '',
      neighborhood: '',
      city: '',
      postalCode: '',
      references: '',
    },
  });

  const onSubmit = async (data: FormData) => {
    setIsLoading(true);
    try {
      const deliveryInfo: CustomerDeliveryInfo = {
        ...data,
        customerId,
      };
      
      await customerService.saveDeliveryInfo(deliveryInfo);
      toast.success('Dirección guardada exitosamente');
      onSuccess?.();
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Error al guardar';
      toast.error(errorMessage);
      onError?.(error as Error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="max-w-md mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Información de Entrega</h2>

      <Input
        label="Calle y Número"
        {...register('streetAddress')}
        error={errors.streetAddress?.message}
        placeholder="Ej: Av. Principal 123"
      />

      <Input
        label="Colonia"
        {...register('neighborhood')}
        error={errors.neighborhood?.message}
        placeholder="Ej: Centro"
      />

      <Input
        label="Ciudad"
        {...register('city')}
        error={errors.city?.message}
        placeholder="Ej: Guadalajara"
      />

      <Input
        label="Código Postal"
        {...register('postalCode')}
        error={errors.postalCode?.message}
        placeholder="Ej: 44100"
        maxLength={5}
      />

      <Input
        label="Referencias"
        {...register('references')}
        error={errors.references?.message}
        placeholder="Ej: Entre calle X y calle Y"
        as="textarea"
        rows={3}
      />

      <Button
        type="submit"
        isLoading={isLoading}
        className="w-full mt-6"
      >
        Guardar Dirección
      </Button>
    </form>
  );
};
```

## 8. Componentes UI reutilizables

```typescript
// src/components/ui/Input.tsx
import { forwardRef } from 'react';
import { clsx } from 'clsx';

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  as?: 'input' | 'textarea';
  rows?: number;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ label, error, className, as = 'input', ...props }, ref) => {
    const Component = as;
    
    return (
      <div className="mb-4">
        {label && (
          <label className="block text-gray-700 text-sm font-bold mb-2">
            {label}
          </label>
        )}
        <Component
          ref={ref as any}
          className={clsx(
            'w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2',
            error
              ? 'border-red-500 focus:ring-red-500'
              : 'border-gray-300 focus:ring-blue-500',
            className
          )}
          {...props}
        />
        {error && (
          <p className="text-red-500 text-sm mt-1">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';
```

## 9. Hook personalizado

```typescript
// src/hooks/useApi.ts
import { useState, useCallback } from 'react';
import { ApiError } from '@/types/api.types';

interface UseApiState<T> {
  data: T | null;
  error: ApiError | null;
  isLoading: boolean;
}

export function useApi<T>() {
  const [state, setState] = useState<UseApiState<T>>({
    data: null,
    error: null,
    isLoading: false,
  });

  const execute = useCallback(async (promise: Promise<T>) => {
    setState({ data: null, error: null, isLoading: true });
    
    try {
      const data = await promise;
      setState({ data, error: null, isLoading: false });
      return data;
    } catch (error) {
      setState({ 
        data: null, 
        error: error as ApiError, 
        isLoading: false 
      });
      throw error;
    }
  }, []);

  return { ...state, execute };
}
```

## 10. Variables de entorno

```bash
# .env
VITE_API_URL=http://localhost:3001
VITE_GOOGLE_MAPS_API_KEY=your-api-key
```

## 11. Configuración de Vite

```typescript
// vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
});
```

## Ventajas de esta configuración:

1. **Type Safety completo**: Todo está tipado
2. **Validación robusta**: Con react-hook-form + yup
3. **Manejo de errores**: Centralizado y tipado
4. **Componentes reutilizables**: UI components tipados
5. **Developer Experience**: Autocompletado, refactoring seguro
6. **Escalable**: Estructura lista para crecer

## Scripts package.json:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "lint": "eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0",
    "preview": "vite preview",
    "type-check": "tsc --noEmit"
  }
}
```