# Frontend - Formulario de Dirección de Entrega

Aplicación frontend construida con Vite + React + TypeScript para el registro de direcciones de entrega.

## 🚀 Tecnologías

- **Vite** - Build tool ultra-rápido
- **React 18** - Biblioteca UI
- **TypeScript** - Type safety
- **Tailwind CSS** - Estilos utility-first
- **React Hook Form + Yup** - Manejo de formularios y validación
- **React Google Maps** - Integración con Google Maps
- **Axios** - Cliente HTTP
- **React Hot Toast** - Notificaciones

## 📦 Instalación

```bash
npm install
```

## 🔧 Configuración

1. Copia el archivo `.env.example` a `.env`:
```bash
cp .env.example .env
```

2. Configura las variables de entorno:
```env
VITE_API_URL=http://localhost:3001
VITE_GOOGLE_MAPS_API_KEY=tu-api-key
VITE_BOT_WHATSAPP_NUMBER=521234567890
VITE_POLYGON_COORDS='[{"lat": 20.54, "lng": -102.79}]'
```

## 🛠️ Scripts

```bash
# Desarrollo
npm run dev

# Build para producción
npm run build

# Preview de producción
npm run preview

# Type checking
npm run type-check

# Linting
npm run lint
```

## 📁 Estructura

```
src/
├── components/       # Componentes React
│   ├── AddressForm/  # Formulario de dirección
│   ├── Map/          # Componente de mapa
│   └── ui/           # Componentes UI reutilizables
├── services/         # Servicios API
├── types/            # Tipos TypeScript
├── hooks/            # Custom hooks
└── utils/            # Utilidades
```

## 🌐 Características

- ✅ Formulario de dirección con validación
- ✅ Integración con Google Maps
- ✅ Autocompletado de direcciones
- ✅ Geolocalización
- ✅ Validación de área de entrega
- ✅ Soporte para actualización de direcciones
- ✅ Notificaciones via WhatsApp
- ✅ Diseño responsive

## 🔗 URLs

La aplicación espera los siguientes parámetros en la URL:
- `from`: ID del cliente
- `otp`: Token de verificación
- `preOrderId`: (opcional) ID de preorden para actualizar

Ejemplo:
```
http://localhost:3000/?from=521234567890@c.us&otp=123456
```

## 🚀 Despliegue

1. Build de producción:
```bash
npm run build
```

2. Los archivos de producción estarán en `dist/`

3. Puedes servir los archivos estáticos con cualquier servidor web (Nginx, Apache, etc.)