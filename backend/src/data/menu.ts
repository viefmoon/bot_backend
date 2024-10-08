import {
  Product,
  ProductVariant,
  PizzaIngredient,
  ModifierType,
  Modifier,
  Availability,
} from "../models";

const menu: string = `
🍽️ ¡Este es nuestro menú! 🍽️

🥗 Entradas:
1. 🍗 Alitas
   - BBQ (orden completa $135 / media $70)
   - Picosas (orden completa $135 / media $70)
   - Fritas (orden completa $135 / media $70)
   - Mango habanero (orden completa $140 / media $75)
   - Mixtas BBQ y picosas ($135)
   Todas las alitas vienen acompañadas de chile de aceite.

2. 🍟 Papas:
   - A la Francesa (orden completa $90 / media $50)
   - Gajos (orden completa $105 / media $65)
   - Mixtas francesa y gajos ($100)
   🧀 Opción: Con queso y sin queso sin costo.
   Todas las papas vienen acompañadas de aderezo.

3. 🧀 Dedos de Queso ($90)
🍕 Pizzas:
Tamaños: Grande ($240), Mediana ($190), Chica ($140)
Opción de orilla rellena: Grande (+$30), Mediana (+$30), Chica (+$20)
Variedades:
1. Especial: Pepperoni, Salchicha, Jamón, Salami, Chile morrón
2. Carnes Frías: Pepperoni, Salchicha, Jamón, Salami
3. Carranza: Chorizo, Jamón, Chile jalapeño, Jitomate
4. Zapata: Salami, Jamón, Champiñón
5. Villa: Chorizo, Tocino, Piña, Chile jalapeño
6. Margarita: 3 Quesos, Jitomate, Albahaca
7. Adelita: Jamón, Piña, Arándano
8. Hawaiana: Jamón, Piña
9. Mexicana: Chorizo, Cebolla, Chile jalapeño, Jitomate
10. Rivera: Elote, Champiñón, Chile morrón
11. Kahlo: Calabaza, Elote, Champiñón, Jitomate, Chile morrón
12. Lupita: Carne molida, Tocino, Cebolla, Chile morrón
13. Pepperoni
14. La Leña: Tocino, Pierna, Chorizo, Carne molida (+$20)
15. La María: Pollo BBQ, Piña, Chile jalapeño (+$20)
16. Malinche: 3 Quesos, Queso de cabra, Champiñón, Jamón, Chile seco, Albahaca (+$20)
17. Philadelphia: Jamon, Queso philadelphia, Chile , Albahaca (+$20)
18. Personalizada con hasta 3 ingredientes de los disponibles sin costo extra.
-Ingrediente extra (+$10)
Opción de pizza mitad y mitad: Se puede armar una pizza mitad y mitad con dos variedades diferentes, sin costo adicional.
Todas las pizzas vienen acompañadas de chile de aceite y aderezo.

🍔 Hamburguesas:
Todas nuestras hamburguesas incluyen: cebolla, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema y mostaza.

1. Tradicional: Carne de res, tocino, queso amarillo, queso asadero ($85)
2. Especial: Carne de res, tocino, pierna, queso amarillo, queso asadero ($95)
3. Hawaiana: Carne de res, tocino, piña, jamón, queso amarillo, queso asadero ($95)
4. Pollo: Pechuga de pollo a la plancha, tocino, queso amarillo, queso asadero ($100)
5. BBQ: Carne de res, salsa BBQ, tocino, queso amarillo, queso asadero, cebolla guisada ($100)
6. Lenazo: Doble carne de sirlón, tocino, queso amarillo, queso asadero ($110)
7. Cubana: Carne de res, tocino, pierna, salchicha, jamón, queso amarillo ($100)
Todas nuestras hamburguesas vienen acompañadas de aderezo y salsa catsup.

🥔 Opción de hamburguesas con papas: 
   - Francesa (+$10)
   - Gajos (+$15)
   - Mixtas (+$15)

🥗 Ensaladas:
- De Pollo: 
  Chica ($90) / Grande ($120)
- De Jamón: 
  Chica ($80) / Grande ($100)

Incluyen: Pollo a la plancha o jamón, chile morrón, elote, lechuga, jitomate, zanahoria, queso parmesano, aderezo, betabel crujiente

➕ Extras disponibles:
   - Con vinagreta (sin costo adicional)
   
🥤 Bebidas:
- Agua de horchata (1 Litro) ($35)
- Limonada (1 Litro) ($35)
- Limonada Mineral (1 Litro) ($35)
- Refrescos 500ml: Coca Cola, 7up, Mirinda, Sangría, Agua Mineral, Squirt ($30 c/u)
- Sangría Preparada: Con limón y sal ($35)
- Micheladas: Clara u oscura ($80)
- Café Caliente: Americano ($45), Capuchino ($45), Chocolate ($50), Mocachino ($45), Latte Vainilla ($45), Latte Capuchino ($45)
- Frappés ($70): Capuchino, Coco, Caramelo, Cajeta, Mocaccino, Galleta, Bombón
- Frappés especiales ($85): Rompope, Mazapán, Magnum

🍹 Coctelería:
1. Copa de vino tinto ($90)
2. Sangría con vino ($80)
3. Vampiro ($80)
4. Gin de Maracuyá ($90)
5. Margarita ($85)
6. Ruso Blanco ($85)
7. Palo santo ($80)
8. Gin de pepino ($90)
9. Mojito ($100)
10. Piña colada ($75)
11. Piñada (sin alcohol) ($70)
12. Conga ($75)
13. Destornillador ($75)
14. Paloma ($80)
15. Carajillo ($90)
16. Tinto de verano ($90)
17. Clericot ($80)
`;

async function getUnavailableItems(): Promise<string> {
  try {
    const products = await Product.findAll({
      include: [
        { model: Availability },
        { model: ProductVariant, include: [{ model: Availability }] },
        { model: PizzaIngredient, include: [{ model: Availability }] },
        {
          model: ModifierType,
          include: [{ model: Modifier, include: [{ model: Availability }] }],
        },
      ],
    });

    let unavailableItemsText = "\n\n❌ Productos no disponibles:\n";
    let hasUnavailableItems = false;

    for (const product of products) {
      let productUnavailable = false;
      let unavailableDetails = "";

      if (product.availability && !product.availability.available) {
        unavailableDetails += "  • Producto completo\n";
        productUnavailable = true;
      }

      if (product.productVariants && product.productVariants.length > 0) {
        const unavailableVariants = product.productVariants.filter(
          (v) => v.availability && !v.availability.available
        );
        if (unavailableVariants.length > 0) {
          unavailableDetails +=
            "  • Variantes: " +
            unavailableVariants.map((v) => v.name).join(", ") +
            "\n";
          productUnavailable = true;
        }
      }

      if (product.pizzaIngredients && product.pizzaIngredients.length > 0) {
        const unavailableIngredients = product.pizzaIngredients.filter(
          (i) => i.availability && !i.availability.available
        );
        if (unavailableIngredients.length > 0) {
          unavailableDetails +=
            "  • Ingredientes: " +
            unavailableIngredients.map((i) => i.name).join(", ") +
            "\n";
          productUnavailable = true;
        }
      }

      if (product.modifierTypes) {
        for (const modifierType of product.modifierTypes) {
          if (modifierType.modifiers) {
            const unavailableModifiers = modifierType.modifiers.filter(
              (m) => m.availability && !m.availability.available
            );
            if (unavailableModifiers.length > 0) {
              unavailableDetails +=
                `  • ${modifierType.name}: ` +
                unavailableModifiers.map((m) => m.name).join(", ") +
                "\n";
              productUnavailable = true;
            }
          }
        }
      }

      if (productUnavailable) {
        unavailableItemsText += `- ${product.name}:\n${unavailableDetails}`;
        hasUnavailableItems = true;
      }
    }

    return hasUnavailableItems
      ? unavailableItemsText
      : "\n\nTodos los productos están disponibles.";
  } catch (error) {
    console.error("Error al obtener los productos no disponibles:", error);
    return "\n\nError al obtener los productos no disponibles.";
  }
}

async function getFullMenu(): Promise<string> {
  const unavailableItems = await getUnavailableItems();
  return menu + unavailableItems;
}

export default getFullMenu;
