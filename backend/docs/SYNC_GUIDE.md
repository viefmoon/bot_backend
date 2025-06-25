# Guía de Sincronización Backend Local ↔️ Backend Remoto

## Resumen del Sistema

Sistema de sincronización simple entre tu backend local (restaurante) y el backend remoto (WhatsApp).

### Principios de Diseño
- **Simple**: Sin auditoría compleja ni campos innecesarios
- **Robusto**: Maneja desconexiones y reintentos
- **Sin IP fija**: El local siempre inicia la conexión
- **IDs compartidos**: Usando UUID no necesitamos mapeo de IDs

## Dirección de Sincronización

| Entidad | Dirección | Descripción |
|---------|-----------|-------------|
| **Menú** | LOCAL → REMOTO | El menú se gestiona en LOCAL |
| **Configuración** | LOCAL → REMOTO | RestaurantConfig y BusinessHours |
| **Órdenes** | REMOTO → LOCAL | Se crean en WhatsApp, LOCAL asigna dailyNumber |
| **Customers** | Bidireccional | Con reglas de prioridad por campo |
| **Addresses** | Bidireccional | Similar a customers |

### Reglas de Conflicto para Datos Bidireccionales

**Customer**:
- Campos con prioridad LOCAL: `isBanned`, `banReason`, notas internas
- Campos con prioridad REMOTO: `firstName`, `lastName`, `email`
- Se resuelve por campo `modifiedBy`

**Address**:
- Campos con prioridad LOCAL: `latitude`, `longitude`, instrucciones precisas
- Campos con prioridad REMOTO: dirección básica ingresada por cliente

## Configuración Inicial

### 1. Backend Remoto - Configurar API Key

```bash
# En el archivo .env del backend remoto
SYNC_API_KEY=1234  # Cambia esto por un key seguro
```

### 2. Backend Local - Configuración

```env
# .env del backend local
REMOTE_API_URL=https://tu-backend-remoto.com
REMOTE_API_KEY=1234  # Mismo key configurado en el remoto
SYNC_INTERVAL_MINUTES=5
```

## Implementación en Backend Local

### Servicio de Sincronización Básico

```typescript
// src/services/RemoteSyncService.ts
import axios from 'axios';

export class RemoteSyncService {
  private apiUrl = process.env.REMOTE_API_URL;
  private apiKey = process.env.REMOTE_API_KEY;
  
  private get headers() {
    return {
      'X-API-Key': this.apiKey,
      'Content-Type': 'application/json'
    };
  }
  
  /**
   * Sincronizar menú completo (LOCAL → REMOTO)
   */
  async pushMenu() {
    const categories = await prisma.category.findMany({
      include: {
        subcategories: {
          include: {
            products: {
              include: {
                variants: true,
                modifierGroups: {
                  include: {
                    productModifiers: true
                  }
                },
                pizzaCustomizations: true,
                pizzaConfiguration: true
              }
            }
          }
        }
      }
    });
    
    await axios.post(
      `${this.apiUrl}/api/sync/menu`,
      { categories },
      { headers: this.headers }
    );
  }
  
  /**
   * Obtener órdenes pendientes (REMOTO → LOCAL)
   */
  async pullPendingOrders() {
    const response = await axios.get(
      `${this.apiUrl}/api/sync/orders/pending`,
      { headers: this.headers }
    );
    
    const orders = response.data.data;
    const orderUpdates = [];
    
    for (const remoteOrder of orders) {
      const dailyNumber = await this.getNextDailyNumber();
      
      // Crear orden en local con mismo ID
      await prisma.order.create({
        data: {
          id: remoteOrder.id,
          dailyNumber,
          // ... mapear otros campos
        }
      });
      
      orderUpdates.push({
        orderId: remoteOrder.id,
        dailyNumber
      });
    }
    
    // Confirmar sincronización
    await axios.post(
      `${this.apiUrl}/api/sync/orders/confirm`,
      { orderUpdates },
      { headers: this.headers }
    );
  }
  
  /**
   * Sincronizar customers con metadatos
   */
  async syncCustomers() {
    // 1. Obtener cambios del remoto
    const response = await axios.get(
      `${this.apiUrl}/api/sync/customers/changes?since=${lastSync}`,
      { headers: this.headers }
    );
    
    const remoteCustomers = response.data.data;
    
      // Los customers del remoto incluyen sus direcciones
    
    for (const customer of remoteCustomers) {
      // Actualizar o crear customer local
      await prisma.customer.upsert({
        where: { id: customer.id },
        create: customer,
        update: customer
      });
    }
  }
  
  /**
   * Ejecutar sincronización completa
   */
  async runFullSync() {
    // 1. Push menu
    await this.pushMenu();
    
    // 2. Pull orders
    await this.pullPendingOrders();
    
    // 3. Sync customers (bidireccional)
    await this.syncCustomers();
  }
}
```

### Programar Sincronización Automática

```typescript
// src/jobs/syncJob.ts
import cron from 'node-cron';

export function startSyncJob() {
  const interval = process.env.SYNC_INTERVAL_MINUTES || '5';
  
  cron.schedule(`*/${interval} * * * *`, async () => {
    const sync = new RemoteSyncService();
    await sync.runFullSync();
  });
}
```

## API Endpoints Disponibles

### En Backend Remoto

| Método | Endpoint | Descripción |
|--------|----------|-------------|
| POST | `/api/sync/menu` | Subir menú completo |
| GET | `/api/sync/orders/pending` | Órdenes no sincronizadas |
| POST | `/api/sync/orders/confirm` | Confirmar sincronización |
| GET | `/api/sync/customers/changes?since=` | Cambios desde fecha |
| POST | `/api/sync/customers/bulk` | Actualización masiva |
| POST | `/api/sync/config` | Subir configuración completa |
| GET | `/api/sync/status` | Estado de sincronización |

## Campos de Sincronización en el Schema

```prisma
// Modelos para sincronización

model SyncLog {
  id              String    @id @default(uuid())
  syncType        String    // MENU_PUSH | ORDERS_PULL | CUSTOMERS_PULL | etc
  recordsAffected Int       @default(0)
  status          String    // SUCCESS | FAILED
  error           String?
  startedAt       DateTime  @default(now())
  completedAt     DateTime?
}

model SyncMetadata {
  id              String    @id @default(uuid())
  entityType      String    // Order | Customer | Address
  entityId        String
  lastModifiedAt  DateTime  @default(now())
  modifiedBy      String    @default("REMOTE") // LOCAL | REMOTE
  syncPending     Boolean   @default(true)
  syncVersion     Int       @default(1)
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
  
  @@unique([entityType, entityId])
  @@index([syncPending, entityType])
}
```

## Casos de Uso Específicos

### Primera Sincronización

```typescript
async function initialSync() {
  // 1. Subir todo el menú
  await sync.pushMenu();
  
  // 2. Descargar todos los customers
  const customers = await sync.getAllCustomers();
  
  // 3. Crear/actualizar customers localmente
  for (const customer of customers) {
    await prisma.customer.upsert({
      where: { id: customer.id },
      create: customer,
      update: {} // No actualizar si ya existe
    });
  }
}
```

### Manejo de Desconexión

```typescript
// Reintentos automáticos con axios-retry
import axiosRetry from 'axios-retry';

axiosRetry(axios, {
  retries: 3,
  retryDelay: axiosRetry.exponentialDelay
});
```

### Notificaciones en Tiempo Real (WebSocket)

El backend REMOTO ahora soporta notificaciones instantáneas cuando se crean órdenes:

#### Backend LOCAL - Cliente WebSocket

```typescript
// src/services/RemoteSyncWebSocket.ts
import { io, Socket } from 'socket.io-client';

export class RemoteSyncWebSocket {
  private socket: Socket | null = null;
  
  connect() {
    const remoteUrl = process.env.REMOTE_API_URL;
    const apiKey = process.env.REMOTE_API_KEY;
    
    this.socket = io(`${remoteUrl}/sync`, {
      auth: { apiKey },
      reconnection: true,
      reconnectionDelay: 5000
    });
    
    this.socket.on('connect', () => {
      console.log('✅ Connected to remote backend via WebSocket');
    });
    
    this.socket.on('order:new', async (data) => {
      console.log('🆕 New order notification:', data);
      // Sincronizar esta orden inmediatamente
      const sync = new RemoteSyncService();
      await sync.pullSingleOrder(data.orderId);
    });
    
    this.socket.on('disconnect', () => {
      console.log('❌ Disconnected from remote backend');
    });
  }
  
  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
    }
  }
}

// En tu aplicación principal:
const wsSync = new RemoteSyncWebSocket();
wsSync.connect();
```

#### Flujo de Sincronización Híbrido

1. **Conexión persistente**: LOCAL mantiene conexión WebSocket con REMOTO
2. **Notificación instantánea**: Cuando se crea una orden, REMOTO notifica inmediatamente
3. **Sincronización inmediata**: LOCAL recibe la notificación y sincroniza solo esa orden
4. **Polling de respaldo**: Cada 5 minutos como respaldo si la conexión falla

```typescript
// Servicio completo con WebSocket + Polling
export class HybridSyncService {
  private ws: RemoteSyncWebSocket;
  private pollInterval: NodeJS.Timer;
  
  start() {
    // 1. Conectar WebSocket para notificaciones instantáneas
    this.ws = new RemoteSyncWebSocket();
    this.ws.connect();
    
    // 2. Polling cada 5 minutos como respaldo
    this.pollInterval = setInterval(async () => {
      await this.runFullSync();
    }, 5 * 60 * 1000);
    
    // 3. Sincronización inicial
    await this.runFullSync();
  }
  
  stop() {
    this.ws.disconnect();
    clearInterval(this.pollInterval);
  }
}
```

#### Ventajas de este Enfoque

- ✅ **Notificaciones instantáneas**: Las órdenes se sincronizan en segundos
- ✅ **Sin IP fija**: LOCAL sigue iniciando la conexión
- ✅ **Reconexión automática**: Si se cae la conexión, se reconecta
- ✅ **Polling de respaldo**: Si WebSocket falla, el polling asegura sincronización

## Monitoreo

```typescript
// Endpoint de estado
app.get('/sync/status', async (req, res) => {
  const lastSync = await getLastSyncTime();
  const pendingOrders = await prisma.order.count({
    where: { syncedWithLocal: false }
  });
  
  res.json({
    lastSync,
    pendingOrders,
    isConnected: await checkRemoteConnection()
  });
});
```

## Troubleshooting

### Problemas Comunes

1. **"Invalid API Key"**
   - Verifica que el API key sea el mismo en ambos .env (local y remoto)
   - El header debe ser `X-API-Key` (no `X-Sync-Api-Key`)

2. **Timeout en sincronización**
   - Aumenta el timeout: `axios.defaults.timeout = 30000`
   - Considera sincronizar en lotes más pequeños

3. **Conflictos de datos**
   - Revisa el campo `modifiedBy` para entender quién modificó último
   - Los campos `syncPending` indican cambios no sincronizados

### Debug Mode

```env
# Agregar al .env para logs detallados
SYNC_DEBUG=true
```

```typescript
if (process.env.SYNC_DEBUG === 'true') {
  axios.interceptors.request.use(request => {
    console.log('🔵 Sync Request:', request.method, request.url);
    return request;
  });
}
```

## Seguridad

- ✅ Siempre usa HTTPS
- ✅ Rota las API keys cada 90 días
- ✅ Valida todos los datos antes de insertar
- ✅ Limita el rate de sincronización
- ✅ No expongas el backend remoto directamente