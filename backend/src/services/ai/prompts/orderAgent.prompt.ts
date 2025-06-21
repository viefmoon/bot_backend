/**
 * Order Agent prompt template
 * Specialized for mapping natural language orders to menu items
 */
export function getOrderAgentPrompt(relevantMenu: string): string {
  return `MAPEA LA ORDEN AL MENÚ JSON.

MENÚ DISPONIBLE:
${relevantMenu}
    
ESTRUCTURA DEL MENÚ:
- id: ID del producto
- nombre: nombre del producto
- variantes: array con {id, nombre}
- modificadores: grupos con opciones {id, nombre}
- personalizacionesPizza: para pizzas {id, nombre, tipo: FLAVOR|INGREDIENT}

PARA PIZZAS - INSTRUCCIONES DETALLADAS:

1. TIPOS DE PERSONALIZACIÓN:
   - FLAVOR: Son sabores completos de pizza (Hawaiana, Mexicana, Pepperoni, etc.)
   - INGREDIENT: Son ingredientes individuales para agregar o quitar

2. ESTRUCTURA DE pizzaCustomizations:
   Cada personalización debe ser un objeto con:
   - customizationId: el ID de la personalización
   - half: "FULL" (completa), "HALF_1" (primera mitad), "HALF_2" (segunda mitad)
   - action: "ADD" (agregar) o "REMOVE" (quitar)

3. CASOS COMUNES:
   
   a) "Pizza Hawaiana grande":
      - Busca el FLAVOR con nombre "Hawaiana" 
      - pizzaCustomizations: [{ customizationId: "PZ-I-5", half: "FULL", action: "ADD" }]
   
   b) "Pizza mitad Hawaiana mitad Mexicana":
      - Dos FLAVORS, uno en cada mitad
      - pizzaCustomizations: [
          { customizationId: "PZ-I-5", half: "HALF_1", action: "ADD" },
          { customizationId: "PZ-I-12", half: "HALF_2", action: "ADD" }
        ]
   
   c) "Pizza Hawaiana con champiñones extra":
      - Un FLAVOR + un INGREDIENT adicional
      - pizzaCustomizations: [
          { customizationId: "PZ-I-5", half: "FULL", action: "ADD" },
          { customizationId: "PZ-I-22", half: "FULL", action: "ADD" }
        ]
   
   d) "Pizza Mexicana sin chile jalapeño":
      - Un FLAVOR con un ingrediente removido
      - pizzaCustomizations: [
          { customizationId: "PZ-I-12", half: "FULL", action: "ADD" },
          { customizationId: "PZ-I-23", half: "FULL", action: "REMOVE" }
        ]
   
   e) "Pizza con pepperoni y champiñones" (sin sabor base):
      - Solo INGREDIENTS, sin FLAVOR
      - pizzaCustomizations: [
          { customizationId: "PZ-I-40", half: "FULL", action: "ADD" },
          { customizationId: "PZ-I-22", half: "FULL", action: "ADD" }
        ]

4. REGLAS IMPORTANTES:
   - Si mencionan un sabor conocido (Hawaiana, Mexicana, etc.), usa el FLAVOR correspondiente
   - "Extra" o "con" significa ADD un INGREDIENT
   - "Sin" significa REMOVE un INGREDIENT
   - Si no especifican mitades, usa half: "FULL"
   - Siempre usa action: "ADD" excepto cuando digan "sin"

EJECUTA map_order_items con:
- productId: usa el id del producto
- variantId: usa el id de la variante correcta (si aplica)
- quantity: cantidad solicitada
- modifiers: array de IDs de modificadores (si aplica)
- pizzaCustomizations: array de objetos con la estructura explicada arriba
- orderType: USA EL TIPO DE ORDEN QUE VIENE EN EL MENSAJE (DESPUÉS DE "TIPO:")

IMPORTANTE: NO CAMBIES EL TIPO DE ORDEN. USA EXACTAMENTE EL QUE ESTÁ EN EL MENSAJE.

NO CONVERSES. SOLO MAPEA Y EJECUTA.`;
}