# Refactorización del Modelo de Pizzas

## Modelo Propuesto: PizzaCustomization

### 1. Nueva Estructura de Datos

```prisma
model PizzaCustomization {
  id                String              @id
  name              String              // Nombre: "Hawaiana", "Pepperoni", "Champiñones"
  type              CustomizationType   // FLAVOR | INGREDIENT
  ingredients       String?             // Para FLAVOR: lista de ingredientes (ej: "Jamón, piña, queso")
  
  // Valor para cálculo de límites
  toppingValue      Int @default(1)     // Cuánto cuenta para el límite de ingredientes
  
  // Control de disponibilidad
  isActive          Boolean @default(true)
  
  // Relaciones
  products          Product[] @relation("ProductCustomizations")
  
  // Metadatos
  sortOrder         Int @default(0)
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
}

enum CustomizationType {
  FLAVOR       // Sabor completo (Hawaiana, Mexicana)
  INGREDIENT   // Ingrediente individual (pepperoni, champiñones)
}

// Actualización del modelo Product
model Product {
  id                     String              @id
  name                   String
  description            String?
  price                  Float?
  hasVariants            Boolean @default(false)
  isActive               Boolean @default(true)
  isPizza                Boolean @default(false)
  
  // Nueva configuración para pizzas
  pizzaConfiguration     PizzaConfiguration?
  pizzaCustomizations    PizzaCustomization[] @relation("ProductCustomizations")
  
  // ... resto de campos existentes
}

// Actualización del modelo OrderItem
model OrderItem {
  // ... campos existentes
  
  // Relación con las personalizaciones de pizza seleccionadas
  selectedPizzaCustomizations SelectedPizzaCustomization[]
}

// Nueva tabla de configuración de pizza
model PizzaConfiguration {
  id                    String  @id @default(uuid())
  productId             String  @unique
  product               Product @relation(fields: [productId], references: [id])
  
  // Límites y costos
  includedToppings      Int     @default(4)      // Valor de toppings incluidos en precio base
  extraToppingCost      Float   @default(20)     // Costo por topping adicional
}

// Tabla de selección mejorada
model SelectedPizzaCustomization {
  id                    String @id @default(uuid())
  orderItemId           String
  pizzaCustomizationId  String
  half                  PizzaHalf @default(FULL)
  action                CustomizationAction @default(ADD)
  
  orderItem             OrderItem @relation(fields: [orderItemId], references: [id])
  pizzaCustomization    PizzaCustomization @relation(fields: [pizzaCustomizationId], references: [id])
  
  @@unique([orderItemId, pizzaCustomizationId, half, action])
}

enum CustomizationAction {
  ADD      // Agregar
  REMOVE   // Quitar
}

enum PizzaHalf {
  FULL     // Pizza completa
  HALF_1   // Primera mitad
  HALF_2   // Segunda mitad
}
```

### 2. Ejemplos de Datos

```typescript
// Ingredientes base
const pepperoni = {
  id: "PEPPERONI",
  name: "Pepperoni",
  type: "INGREDIENT",
  toppingValue: 1,
}

const ham = {
  id: "HAM",
  name: "Jamón",
  type: "INGREDIENT",
  toppingValue: 1,
}

const pineapple = {
  id: "PINEAPPLE",
  name: "Piña",
  type: "INGREDIENT",
  toppingValue: 1,
}

// Sabor con sus ingredientes
const hawaiian = {
  id: "HAWAIIAN",
  name: "Hawaiana",
  type: "FLAVOR",
  ingredients: "Jamón, piña, queso mozzarella",
  toppingValue: 3,  // Definido manualmente basado en la complejidad del sabor
}
```

### 3. Cálculo de Precios

#### Reglas Generales para OrderItems:
1. **Productos con variantes**: Se usa el precio de la variante + modificadores
2. **Productos sin variantes**: Se usa el precio del producto + modificadores
3. **Pizzas**: Caso especial con cálculo adicional de ingredientes

#### Cálculo para Pizzas:

```typescript
interface OrderItemPriceCalculation {
  orderItem: {
    product: Product;
    productVariant?: ProductVariant;
    productModifiers: ProductModifier[];
    selectedPizzaCustomizations: SelectedPizzaCustomization[];
  };
}

function calculateOrderItemPrice(orderItem: OrderItemPriceCalculation): number {
  // 1. Precio base
  let basePrice = 0;
  
  if (orderItem.productVariant) {
    // REGLA: Si hay variante, usar precio de variante
    basePrice = orderItem.productVariant.price;
  } else if (orderItem.product.hasVariants) {
    // REGLA: No se puede crear OrderItem sin variante si el producto tiene variantes
    throw new Error('Producto con variantes requiere selección de variante');
  } else {
    // REGLA: Si no hay variantes, usar precio del producto
    basePrice = orderItem.product.price || 0;
  }
  
  // 2. Sumar modificadores (aplica a todos los productos)
  const modifiersPrice = orderItem.productModifiers
    .reduce((sum, modifier) => sum + (modifier.price || 0), 0);
  
  let totalPrice = basePrice + modifiersPrice;
  
  // 3. Si es pizza, calcular ingredientes adicionales
  if (orderItem.product.isPizza && orderItem.product.pizzaConfiguration) {
    const pizzaExtraCost = calculatePizzaExtraCost(
      orderItem.product.pizzaConfiguration,
      orderItem.selectedPizzaCustomizations
    );
    totalPrice += pizzaExtraCost;
  }
  
  return totalPrice;
}

function calculatePizzaExtraCost(
  config: PizzaConfiguration,
  customizations: SelectedPizzaCustomization[]
): number {
  let totalToppingValue = 0;
  
  // REGLA: Solo contar customizaciones con action = ADD
  const addedCustomizations = customizations.filter(c => c.action === 'ADD');
  
  for (const selected of addedCustomizations) {
    const customization = selected.pizzaCustomization;
    
    if (selected.half === 'FULL') {
      // REGLA: Pizza completa suma el toppingValue completo
      totalToppingValue += customization.toppingValue;
    } else {
      // REGLA: Media pizza suma la mitad del toppingValue
      totalToppingValue += customization.toppingValue / 2;
    }
  }
  
  // REGLA: Solo cobrar por toppings que excedan los incluidos
  if (totalToppingValue > config.includedToppings) {
    const extraToppings = totalToppingValue - config.includedToppings;
    return extraToppings * config.extraToppingCost;
  }
  
  return 0;
}

// Ejemplo de cálculo:
// Pizza Grande Hawaiana ($200) + Pepperoni extra en mitad ($10)
// - Precio base (variante grande): $200
// - Modificadores: $0
// - Hawaiana FLAVOR (toppingValue: 3): incluido en precio base
// - Pepperoni HALF_1 (toppingValue: 1): 0.5 valor = 0.5
// - Total toppingValue: 3.5
// - Incluidos: 4 (no hay cargo extra)
// - Precio final: $200
```

### 4. Ventajas del Nuevo Modelo

1. **Claridad Conceptual**
   - Distinción clara entre sabores (FLAVOR) e ingredientes (INGREDIENT)
   - Todo tipo de ingrediente (carnes, vegetales, salsas, quesos) bajo un mismo tipo
   - Descripción simple de ingredientes en sabores mediante campo de texto

2. **Flexibilidad de Configuración**
   - Cada pizza puede tener sus propios límites
   - Costos configurables por producto
   - Los sabores pueden reutilizar ingredientes existentes

3. **Mejor UX**
   - Campo ingredients muestra claramente qué contiene cada sabor
   - Facilita la comunicación con el cliente
   - Todo se puede pedir extra automáticamente

4. **Escalabilidad**
   - Fácil agregar nuevos tipos de customización
   - Reglas de negocio en la base de datos
   - Consultas más eficientes con relaciones proper
   - Reutilización de ingredientes entre diferentes sabores

### 5. Plan de Migración

1. **Fase 1**: Crear nuevas tablas sin eliminar las antiguas
2. **Fase 2**: Migrar datos existentes
   - PizzaIngredient con `ingredients` != null → FLAVOR
   - PizzaIngredient con `ingredients` == null → INGREDIENT
3. **Fase 3**: Actualizar código para usar nuevo modelo
4. **Fase 4**: Eliminar tablas antiguas

### 6. Impacto en el Sistema

- **OrderService**: Actualizar cálculo de precios
- **AI Agent**: Actualizar mapeo de ingredientes
- **WhatsApp Formatter**: Ya compatible con el formato actual
- **Frontend**: Necesitará actualización para mostrar sabores vs ingredientes