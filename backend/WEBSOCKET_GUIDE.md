# Guía de Conexión WebSocket para Sincronización

## 1. Configuración del Cliente

### Instalación de Socket.IO Client
```bash
npm install socket.io-client
```

### Código de Conexión

```javascript
import { io } from 'socket.io-client';

// Configuración del cliente
const BACKEND_URL = 'http://localhost:5000'; // O tu URL de producción
const CLOUD_API_KEY = 'tu-cloud-api-key'; // Debe coincidir con CLOUD_API_KEY en .env del backend

// Conectar al namespace /sync con autenticación
const socket = io(`${BACKEND_URL}/sync`, {
  auth: {
    apiKey: CLOUD_API_KEY
  },
  transports: ['websocket', 'polling'], // Intentar WebSocket primero, luego polling
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
});

// Eventos de conexión
socket.on('connect', () => {
  console.log('✅ Conectado al WebSocket de sincronización');
  console.log('Socket ID:', socket.id);
});

socket.on('connect_error', (error) => {
  console.error('❌ Error de conexión:', error.message);
  if (error.message === 'API key required') {
    console.error('Debes proporcionar el API key en la autenticación');
  } else if (error.message === 'Invalid API key') {
    console.error('El API key proporcionado no es válido');
  }
});

socket.on('disconnect', (reason) => {
  console.log('🔌 Desconectado:', reason);
});

// IMPORTANTE: Suscribirse al evento changes:pending
socket.on('changes:pending', async () => {
  console.log('📨 Notificación recibida: Hay cambios pendientes de sincronizar');
  
  // Aquí debes llamar a tu función de sincronización
  await syncPendingChanges();
});

// Función para sincronizar cambios pendientes
async function syncPendingChanges() {
  try {
    const response = await fetch(`${BACKEND_URL}/sync/pull-changes`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CLOUD_API_KEY}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`Error ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    console.log('Cambios pendientes recibidos:', data);
    
    // Procesar los cambios...
    // Confirmar sincronización cuando termines
    
  } catch (error) {
    console.error('Error al sincronizar:', error);
  }
}

// Opcional: Solicitar sincronización manual
function requestSync() {
  socket.emit('sync:orders');
}
```

## 2. Verificación de la Configuración del Backend

### Variables de entorno necesarias en `.env`:
```env
CLOUD_API_KEY=tu-clave-secreta-aqui
REDIS_HOST=localhost
REDIS_PORT=6380
```

### Verificar que el servidor está escuchando WebSocket:
```bash
# En los logs del servidor deberías ver:
# "WebSocket sync notification service initialized"
```

## 3. Flujo de Sincronización

1. **Cliente se conecta** → Proporciona `apiKey` en la autenticación
2. **Servidor valida** → Compara con `CLOUD_API_KEY` del .env
3. **Si es válido** → Cliente agregado a la lista de clientes conectados
4. **Cuando hay nueva orden** → Servidor emite `changes:pending`
5. **Cliente recibe evento** → Llama a `/sync/pull-changes`
6. **Cliente procesa datos** → Confirma sincronización

## 4. Troubleshooting

### El cliente no recibe notificaciones:

1. **Verificar autenticación:**
   ```javascript
   // En el cliente, verificar que el socket está conectado
   console.log('Socket conectado?', socket.connected);
   console.log('Socket ID:', socket.id);
   ```

2. **Verificar namespace:**
   - Debe conectarse a `/sync`, no a la raíz `/`
   - URL correcta: `http://localhost:5000/sync`

3. **Verificar API Key:**
   - El `CLOUD_API_KEY` en el cliente debe ser idéntico al del servidor
   - Verificar en el backend: `echo $CLOUD_API_KEY`

4. **Verificar eventos:**
   ```javascript
   // Agregar listeners para debug
   socket.onAny((eventName, ...args) => {
     console.log('Evento recibido:', eventName, args);
   });
   ```

### Ejemplo de prueba manual:

```javascript
// 1. Conectar
const testConnection = async () => {
  // Esperar a que se conecte
  await new Promise(resolve => {
    if (socket.connected) {
      resolve();
    } else {
      socket.once('connect', resolve);
    }
  });
  
  console.log('✅ Conectado correctamente');
  
  // 2. Verificar que recibe eventos
  socket.on('changes:pending', () => {
    console.log('✅ Evento changes:pending recibido!');
  });
  
  // 3. Solicitar órdenes pendientes manualmente
  socket.emit('sync:orders');
  
  socket.on('orders:pending', (data) => {
    console.log('📦 Órdenes pendientes:', data);
  });
};

testConnection();
```

## 5. Ejemplo Completo de Cliente

```javascript
import { io } from 'socket.io-client';

class SyncClient {
  constructor(backendUrl, apiKey) {
    this.backendUrl = backendUrl;
    this.apiKey = apiKey;
    this.socket = null;
    this.isProcessing = false;
  }
  
  connect() {
    this.socket = io(`${this.backendUrl}/sync`, {
      auth: {
        apiKey: this.apiKey
      }
    });
    
    this.setupEventListeners();
  }
  
  setupEventListeners() {
    this.socket.on('connect', () => {
      console.log('✅ Conectado al servidor de sincronización');
    });
    
    this.socket.on('changes:pending', async () => {
      console.log('📨 Cambios pendientes detectados');
      
      if (!this.isProcessing) {
        this.isProcessing = true;
        await this.syncChanges();
        this.isProcessing = false;
      }
    });
    
    this.socket.on('connect_error', (error) => {
      console.error('❌ Error de conexión:', error.message);
    });
  }
  
  async syncChanges() {
    try {
      const response = await fetch(`${this.backendUrl}/sync/pull-changes`, {
        headers: {
          'Authorization': `Bearer ${this.apiKey}`
        }
      });
      
      const data = await response.json();
      console.log('Datos sincronizados:', data);
      
      // Procesar datos...
      
      // Confirmar sincronización
      await this.confirmSync(data);
      
    } catch (error) {
      console.error('Error en sincronización:', error);
    }
  }
  
  async confirmSync(data) {
    // Implementar confirmación según tu lógica
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

// Uso
const client = new SyncClient('http://localhost:5000', 'tu-api-key');
client.connect();
```

## Notas Importantes

1. **El API Key es obligatorio** - Sin él, la conexión será rechazada
2. **Usa el namespace correcto** - `/sync`, no la raíz
3. **El evento es `changes:pending`** - Sin datos adicionales
4. **Debes implementar la lógica de sincronización** - El WebSocket solo notifica