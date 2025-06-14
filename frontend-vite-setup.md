# Configuración de Frontend con Vite

## 1. Crear nuevo proyecto Vite

```bash
cd /home/leo/bot_backend
npm create vite@latest frontend-vite -- --template react
cd frontend-vite
npm install
```

## 2. Instalar dependencias necesarias

```bash
npm install axios react-hook-form @react-google-maps/api
npm install -D tailwindcss postcss autoprefixer
npx tailwindcss init -p
```

## 3. Estructura básica del formulario

```jsx
// src/components/AddressForm.jsx
import { useState } from 'react';
import axios from 'axios';

const AddressForm = ({ customerId }) => {
  const [formData, setFormData] = useState({
    streetAddress: '',
    neighborhood: '',
    city: '',
    postalCode: '',
    references: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await axios.post(`${import.meta.env.VITE_API_URL}/customer-delivery-info`, {
        ...formData,
        customerId
      });
      alert('Dirección guardada exitosamente');
    } catch (error) {
      console.error('Error:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md mx-auto p-6">
      <h2 className="text-2xl font-bold mb-6">Información de Entrega</h2>
      
      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Calle y Número</label>
        <input
          type="text"
          value={formData.streetAddress}
          onChange={(e) => setFormData({...formData, streetAddress: e.target.value})}
          className="w-full p-2 border rounded"
          required
        />
      </div>

      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Colonia</label>
        <input
          type="text"
          value={formData.neighborhood}
          onChange={(e) => setFormData({...formData, neighborhood: e.target.value})}
          className="w-full p-2 border rounded"
          required
        />
      </div>

      <div className="mb-4">
        <label className="block text-gray-700 mb-2">Ciudad</label>
        <input
          type="text"
          value={formData.city}
          onChange={(e) => setFormData({...formData, city: e.target.value})}
          className="w-full p-2 border rounded"
          required
        />
      </div>

      <button
        type="submit"
        className="w-full bg-blue-500 text-white py-2 px-4 rounded hover:bg-blue-600"
      >
        Guardar Dirección
      </button>
    </form>
  );
};

export default AddressForm;
```

## 4. Configuración de variables de entorno

```bash
# .env
VITE_API_URL=http://localhost:3001
```

## 5. Configuración de Vite para proxy (vite.config.js)

```javascript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      }
    }
  }
})
```

## Ventajas de esta configuración:

1. **Ultra ligero**: Solo ~50MB vs ~300MB con Next.js
2. **Desarrollo rápido**: Inicio en <500ms
3. **Build optimizado**: ~100KB vs ~500KB con Next.js
4. **Mantenimiento simple**: Menos configuración y complejidad
5. **Moderno**: Usa ESM nativo y las últimas optimizaciones

## Comandos:

```bash
npm run dev    # Desarrollo
npm run build  # Producción
npm run preview # Preview de producción
```