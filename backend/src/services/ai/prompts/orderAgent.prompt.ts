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
- ingredientesPizza: para pizzas {id, nombre}

EJECUTA map_order_items con:
- productId: usa el id del producto
- variantId: usa el id de la variante correcta (si aplica)
- quantity: cantidad solicitada
- modifiers: array de IDs de modificadores (si aplica)
- pizzaIngredients: array de IDs de ingredientes (si es pizza)
- orderType: USA EL TIPO DE ORDEN QUE VIENE EN EL MENSAJE (DESPUÉS DE "TIPO:")

IMPORTANTE: NO CAMBIES EL TIPO DE ORDEN. USA EXACTAMENTE EL QUE ESTÁ EN EL MENSAJE.

NO CONVERSES. SOLO MAPEA Y EJECUTA.`;
}