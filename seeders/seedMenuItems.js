require("dotenv").config();
const { sequelize } = require("../src/lib/db");
const Product = require("../src/models/product");
const ProductVariant = require("../src/models/productVariant");
const PizzaIngredient = require("../src/models/pizzaIngredient");
const ModifierType = require("../src/models/modifierType");
const Modifier = require("../src/models/modifier");
const Availability = require("../src/models/availability");

const menu = [
  {
    id: "A",
    name: "Orden de Alitas",
    category: "entradas",
    productVariants: [
      { id: "AV1", name: "Orden de Alitas BBQ", price: 135 },
      { id: "AV2", name: "Media Orden de Alitas BBQ", price: 70 },
      { id: "AV3", name: "Orden de Alitas Picosas", price: 135 },
      { id: "AV4", name: "Media Orden de Alitas Picosas", price: 70 },
      { id: "AV5", name: "Orden de Alitas Fritas", price: 135 },
      { id: "AV6", name: "Media Orden de Alitas Fritas", price: 70 },
      { id: "AV7", name: "Orden de Alitas Mixtas BBQ y picosas", price: 135 },
    ],
  },
  {
    id: "P",
    name: "Ordenes de Papas",
    category: "entradas",
    productVariants: [
      { id: "PV1", name: "Orden de Papas a la Francesa", price: 90 },
      { id: "PV2", name: "Media Orden de Papas a la Francesa", price: 50 },
      { id: "PV3", name: "Orden de Papas Gajos", price: 100 },
      { id: "PV4", name: "Media Orden de Papas Gajos", price: 60 },
      { id: "PV5", name: "Orden de Papas Mixtas francesa y gajos", price: 100 },
    ],
    modifierTypes: [
      {
        id: "P-Q",
        name: "Queso",
        required: true,
        acceptsMultiple: false,
        modifiers: [
          { id: "P-Q-V1", name: "Sin queso", price: 0 },
          { id: "P-Q-V2", name: "Con queso", price: 0 },
        ],
      },
    ],
  },
  {
    id: "D",
    name: "Dedos de Queso",
    category: "entradas",
    price: 90,
  },
  {
    id: "EN",
    name: "Ensaladas",
    category: "comida",
    productVariants: [
      {
        id: "ENV1",
        name: "Ensalada de Pollo Chica",
        price: 90,
        ingredients: [
          "Pollo a la plancha",
          "Chile morrón",
          "Elote",
          "Lechuga",
          "Jitomate",
          "Zanahoria",
          "Queso parmesano",
          "Aderezo",
          "Betabel crujiente",
        ],
      },
      {
        id: "ENV2",
        name: "Ensalada de Pollo Grande",
        price: 120,
        ingredients: [
          "Pollo a la plancha",
          "Chile morrón",
          "Elote",
          "Lechuga",
          "Jitomate",
          "Zanahoria",
          "Queso parmesano",
          "Aderezo",
          "Betabel crujiente",
        ],
      },
      {
        id: "ENV3",
        name: "Ensalada de Jamón Chica",
        price: 80,
        ingredients: [
          "Jamón",
          "Lechuga",
          "Chile morrón",
          "Elote",
          "Jitomate",
          "Zanahoria",
          "Queso parmesano",
          "Aderezo",
          "Betabel crujiente",
        ],
      },
      {
        id: "ENV4",
        name: "Ensalada de Jamón Grande",
        price: 100,
        ingredients: [
          "Jamón",
          "Lechuga",
          "Chile morrón",
          "Elote",
          "Jitomate",
          "Zanahoria",
          "Queso parmesano",
          "Aderezo",
          "Betabel crujiente",
        ],
      },
    ],
    modifierTypes: [
      {
        id: "E-E",
        name: "Extras",
        required: false,
        acceptsMultiple: true,
        modifiers: [
          { id: "E-E-V1", name: "Con jamon", price: 10 },
          { id: "E-E-V2", name: "Con queso gouda", price: 15 },
          { id: "E-E-V3", name: "Con vinagreta", price: 0 },
          { id: "E-E-V4", name: "Doble pollo", price: 15 },
        ],
      },
    ],
  },
  {
    id: "H",
    name: "Hamburguesas",
    category: "comida",
    productVariants: [
      {
        id: "HV1",
        name: "Hamburgesa Tradicional",
        price: 85,
        ingredients: [
          "Carne de res",
          "tocino",
          "queso amarillo",
          "queso asadero",
          "cebolla",
          "jitomate",
          "lechuga",
          "chile jalapeño",
          "catsup",
          "aderezo",
          "crema",
          "mostaza",
        ],
      },
      {
        id: "HV2",
        name: "Hamburgesa Especial",
        price: 95,
        ingredients: [
          "Carne de res",
          "tocino",
          "pierna",
          "queso amarillo",
          "queso asadero",
          "cebolla",
          "jitomate",
          "lechuga",
          "chile jalapeño",
          "catsup",
          "aderezo",
          "crema",
          "mostaza",
        ],
      },
      {
        id: "HV3",
        name: "Hamburgesa Hawaiana",
        price: 95,
        ingredients: [
          "Carne de res",
          "tocino",
          "piña",
          "jamón",
          "queso amarillo",
          "queso asadero",
          "cebolla",
          "jitomate",
          "lechuga",
          "chile jalapeño",
          "catsup",
          "aderezo",
          "crema",
          "mostaza",
        ],
      },
      {
        id: "HV4",
        name: "Hamburgesa Pollo",
        price: 100,
        ingredients: [
          "Pollo a la plancha",
          "tocino",
          "queso amarillo",
          "queso asadero",
          "cebolla",
          "jitomate",
          "lechuga",
          "chile jalapeño",
          "catsup",
          "aderezo",
          "crema",
          "mostaza",
        ],
      },
      {
        id: "HV5",
        name: "Hamburgesa BBQ",
        price: 100,
        ingredients: [
          "Carne de res",
          "salsa bbq",
          "tocino",
          "queso amarillo",
          "queso asadero",
          "cebolla guisada",
          "jitomate",
          "lechuga",
          "chile jalapeño",
          "catsup",
          "aderezo",
          "crema",
          "mostaza",
        ],
      },
      {
        id: "HV6",
        name: "Hamburgesa Lenazo",
        price: 110,
        ingredients: [
          "Doble carne de sirlón",
          "tocino",
          "queso amarillo",
          "queso asadero",
          "cebolla guisada",
          "jitomate",
          "lechuga",
          "chile jalapeño",
          "catsup",
          "aderezo",
          "crema",
          "mostaza",
        ],
      },
      {
        id: "HV7",
        name: "Hamburgesa Cubana",
        price: 100,
        ingredients: [
          "Carne de res",
          "tocino",
          "pierna",
          "salchicha",
          "jamón",
          "queso amarillo",
          "cebolla",
          "jitomate",
          "lechuga",
          "chile jalapeño",
          "catsup",
          "aderezo",
          "crema",
          "mostaza",
        ],
      },
    ],
    modifierTypes: [
      {
        id: "H-P",
        name: "Papas",
        required: false,
        acceptsMultiple: false,
        modifiers: [
          { id: "H-P-V1", name: "Con papas francesa", price: 10 },
          { id: "H-P-V2", name: "Con gajos", price: 15 },
          { id: "H-P-V3", name: "Con papas mixtas", price: 15 },
        ],
      },
      {
        id: "H-E",
        name: "Extras",
        required: false,
        acceptsMultiple: true,
        modifiers: [
          { id: "H-E-V1", name: "Partida", price: 0 },
          { id: "H-E-V2", name: "Queso en la papas", price: 5 },
          { id: "H-E-V3", name: "Doble carne", price: 10 },
          { id: "H-E-V4", name: "Doble pollo", price: 15 },
          { id: "H-E-V5", name: "Extra queso", price: 5 },
          { id: "H-E-V6", name: "Extra tocino", price: 5 },
          { id: "H-E-V7", name: "Res -> Pollo", price: 15 },
          { id: "H-E-V8", name: "Con pierna", price: 10 },
          { id: "H-E-V9", name: "Con pina", price: 5 },
          { id: "H-E-V10", name: "Con jamon", price: 5 },
          { id: "H-E-V11", name: "Con salchicha", price: 5 },
          { id: "H-E-V12", name: "Con ensalada", price: 15 },
        ],
      },
    ],
  },
  {
    id: "BEB1",
    name: "Agua de horchata 1 Litro",
    category: "bebidas",
    price: 35,
  },
  {
    id: "BEB2",
    name: "Limonada 1 Litro",
    category: "bebidas",
    price: 35,
  },
  {
    id: "BEB3",
    name: "Limonada Mineral 1 Litro",
    category: "bebidas",
    price: 35,
  },
  {
    id: "BEB4",
    name: "Refrescos 500ml",
    category: "bebidas",
    productVariants: [
      { id: "BEB4-V1", name: "Coca Cola", price: 30 },
      { id: "BEB4-V2", name: "7up", price: 30 },
      { id: "BEB4-V3", name: "Mirinda", price: 30 },
      { id: "BEB4-V4", name: "Refresco de Sangría", price: 30 },
      { id: "BEB4-V5", name: "Agua Mineral", price: 30 },
      { id: "BEB4-V6", name: "Squirt", price: 30 },
    ],
  },
  {
    id: "BEB5",
    name: "Sangría Preparada",
    category: "bebidas",
    price: 35,
  },
  {
    id: "BEB6",
    name: "Micheladas",
    category: "bebidas",
    productVariants: [
      { id: "BEB6-V1", name: "Michelada clara", price: 80 },
      { id: "BEB6-V2", name: "Michelada oscura", price: 80 },
    ],
  },
  {
    id: "BEB7",
    name: "Café Caliente",
    category: "bebidas",
    productVariants: [
      { id: "BEB7-V1", name: "Cafe Americano", price: 45 },
      { id: "BEB7-V2", name: "Capuchino", price: 45 },
      { id: "BEB7-V3", name: "Chocolate", price: 50 },
      { id: "BEB7-V4", name: "Mocachino", price: 45 },
      { id: "BEB7-V5", name: "Latte Vainilla", price: 45 },
      { id: "BEB7-V6", name: "Latte Capuchino", price: 45 },
    ],
  },
  {
    id: "BEB8",
    name: "Frappés",
    category: "bebidas",
    productVariants: [
      { id: "BEB8-V1", name: "Frappe Capuchino", price: 70 },
      { id: "BEB8-V2", name: "Frappe Coco", price: 70 },
      { id: "BEB8-V3", name: "Frappe Caramelo", price: 70 },
      { id: "BEB8-V4", name: "Frappe Cajeta", price: 70 },
      { id: "BEB8-V5", name: "Frappe Mocaccino", price: 70 },
      { id: "BEB8-V6", name: "Frappe Galleta", price: 70 },
      { id: "BEB8-V7", name: "Frappe Bombon", price: 70 },
      { id: "BEB8-V8", name: "Frappe Rompope", price: 85 },
      { id: "BEB8-V9", name: "Frappe Mazapan", price: 85 },
      { id: "BEB8-V10", name: "Frappe Magnum", price: 85 },
    ],
  },
  {
    id: "COC1",
    name: "Copa de vino",
    category: "cocteleria",
    price: 90,
  },
  {
    id: "COC2",
    name: "Sangría con vino",
    category: "cocteleria",
    price: 80,
  },
  {
    id: "COC3",
    name: "Vampiro",
    category: "cocteleria",
    price: 80,
  },
  {
    id: "COC4",
    name: "Gin de Maracuyá",
    category: "cocteleria",
    price: 90,
  },
  {
    id: "COC5",
    name: "Margarita",
    category: "cocteleria",
    price: 85,
  },
  {
    id: "COC6",
    name: "Ruso Blanco",
    category: "cocteleria",
    price: 85,
  },
  {
    id: "COC7",
    name: "Palo santo",
    category: "cocteleria",
    price: 80,
  },
  {
    id: "COC8",
    name: "Gin de pepino",
    category: "cocteleria",
    price: 90,
  },
  {
    id: "COC9",
    name: "Mojito",
    category: "cocteleria",
    price: 100,
  },
  {
    id: "COC10",
    name: "Piña colada",
    category: "cocteleria",
    price: 75,
  },
  {
    id: "COC11",
    name: "Piñada",
    category: "cocteleria",
    price: 70,
  },
  {
    id: "COC12",
    name: "Conga",
    category: "cocteleria",
    price: 75,
  },
  {
    id: "COC13",
    name: "Destornillador",
    category: "cocteleria",
    price: 75,
  },
  {
    id: "COC14",
    name: "Paloma",
    category: "cocteleria",
    price: 80,
  },
  {
    id: "COC15",
    name: "Carajillo",
    category: "cocteleria",
    price: 90,
  },
  {
    id: "COC16",
    name: "Tinto de verano",
    category: "cocteleria",
    price: 90,
  },
  {
    id: "COC17",
    name: "Clericot",
    category: "cocteleria",
    price: 80,
  },
  {
    id: "PZ",
    name: "Pizza",
    category: "comida",
    productVariants: [
      { id: "PZV1", name: "Pizza Grande", price: 240 },
      { id: "PZV2", name: "Pizza Mediana", price: 190 },
      { id: "PZV3", name: "Pizza Chica", price: 140 },
      {
        id: "PZV4",
        name: "Pizza Grande Con Orilla Rellena de Queso",
        price: 270,
      },
      {
        id: "PZV5",
        name: "Pizza Mediana Con Orilla Rellena de Queso",
        price: 220,
      },
      {
        id: "PZV6",
        name: "Pizza Chica Con Orilla Rellena de Queso",
        price: 160,
      },
    ],
    pizzaIngredients: [
      {
        id: "PZI1",
        name: "Especial",
        ingredientValue: 4,
        ingredients: "Pepperoni, Salchicha, Jamón, Salami, Chile morrón",
      },
      {
        id: "PZI2",
        name: "Carnes Frías",
        ingredientValue: 4,
        ingredients: "Pepperoni, Salchicha, Jamón, Salami",
      },
      {
        id: "PZI3",
        name: "Carranza",
        ingredientValue: 4,
        ingredients: "Chorizo, Jamón, Chile jalapeño, Jitomate",
      },
      {
        id: "PZI4",
        name: "Zapata",
        ingredientValue: 4,
        ingredients: "Salami, Jamón, Champiñón",
      },
      {
        id: "PZI5",
        name: "Villa",
        ingredientValue: 4,
        ingredients: "Chorizo, Tocino, Piña, Chile jalapeño",
      },
      {
        id: "PZI6",
        name: "Margarita",
        ingredientValue: 4,
        ingredients: "3 Quesos, Jitomate, Albahaca",
      },
      {
        id: "PZI7",
        name: "Adelita",
        ingredientValue: 4,
        ingredients: "Jamón, Piña, Arándano",
      },
      {
        id: "PZI8",
        name: "Hawaiana",
        ingredientValue: 4,
        ingredients: "Jamón, Piña",
      },
      {
        id: "PZI9",
        name: "Mexicana",
        ingredientValue: 4,
        ingredients: "Chorizo, Cebolla, Chile jalapeño, Jitomate",
      },
      {
        id: "PZI10",
        name: "Rivera",
        ingredientValue: 4,
        ingredients: "Elote, Champiñón, Chile morrón",
      },
      {
        id: "PZI11",
        name: "Kahlo",
        ingredientValue: 4,
        ingredients: "Calabaza, Elote, Champiñón, Jitomate, Chile morrón",
      },
      {
        id: "PZI12",
        name: "Lupita",
        ingredientValue: 4,
        ingredients: "Carne molida, Tocino, Cebolla, Chile morrón",
      },
      {
        id: "PZI13",
        name: "Pepperoni",
        ingredientValue: 4,
        ingredients: "Pepperoni",
      },
      {
        id: "PZI14",
        name: "La Lena",
        ingredientValue: 6,
        ingredients: "Tocino, Pierna, Chorizo, Carne molida",
      },
      {
        id: "PZI15",
        name: "La Maria",
        ingredientValue: 6,
        ingredients: "Pollo BBQ, Piña, Chile jalapeño",
      },
      {
        id: "PZI16",
        name: "Malinche",
        ingredientValue: 6,
        ingredients:
          "3 Quesos, Queso de cabra, Champiñón, Jamón, Chile seco, Albahaca",
      },
      {
        id: "PZI17",
        name: "Philadelphia",
        ingredientValue: 6,
        ingredients: "Queso philadelphia, Chile jalapeño, Jamon, Albahaca",
      },
      { id: "PZI18", name: "3 Quesos", ingredientValue: 2 },
      { id: "PZI19", name: "Albahaca", ingredientValue: 1 },
      { id: "PZI20", name: "Arandano", ingredientValue: 1 },
      { id: "PZI21", name: "Calabaza", ingredientValue: 1 },
      { id: "PZI22", name: "Cebolla", ingredientValue: 1 },
      { id: "PZI23", name: "Champinon", ingredientValue: 1 },
      { id: "PZI24", name: "Chile Seco", ingredientValue: 1 },
      { id: "PZI25", name: "Chorizo", ingredientValue: 1 },
      { id: "PZI26", name: "Elote", ingredientValue: 1 },
      { id: "PZI27", name: "Jalapeno", ingredientValue: 1 },
      { id: "PZI28", name: "Jamon", ingredientValue: 1 },
      { id: "PZI29", name: "Jitomate", ingredientValue: 1 },
      { id: "PZI30", name: "Molida", ingredientValue: 1 },
      { id: "PZI31", name: "Morron", ingredientValue: 1 },
      { id: "PZI32", name: "Pierna", ingredientValue: 2 },
      { id: "PZI33", name: "Pina", ingredientValue: 1 },
      { id: "PZI34", name: "Pollo BBQ", ingredientValue: 2 },
      { id: "PZI35", name: "Queso de cabra", ingredientValue: 2 },
      { id: "PZI36", name: "Salami", ingredientValue: 1 },
      { id: "PZI37", name: "Salchicha", ingredientValue: 1 },
      { id: "PZI38", name: "Tocino", ingredientValue: 1 },
    ],
  },
];

const seedMenuItems = async () => {
  try {
    for (const product of menu) {
      const createdProduct = await Product.create({
        id: product.id,
        name: product.name,
        price: product.price || null,
        category: product.category,
        ingredients: product.ingredients || null,
      });

      // Crear disponibilidad para el producto
      await Availability.create({
        id: product.id,
        type: "product",
        available: true,
      });

      if (product.productVariants) {
        for (const productVariant of product.productVariants) {
          await ProductVariant.create({
            id: productVariant.id,
            name: productVariant.name,
            price: productVariant.price,
            productId: createdProduct.id,
            ingredients: productVariant.ingredients || null,
          });

          // Crear disponibilidad para la product variant
          await Availability.create({
            id: productVariant.id,
            type: "productVariant",
            available: true,
          });
        }
      }

      if (product.pizzaIngredients) {
        for (const ingredient of product.pizzaIngredients) {
          await PizzaIngredient.create({
            id: ingredient.id,
            name: ingredient.name,
            ingredientValue: ingredient.ingredientValue,
            ingredients: ingredient.ingredients || null,
            productId: createdProduct.id,
          });

          // Crear disponibilidad para el ingrediente de pizza
          await Availability.create({
            id: ingredient.id,
            type: "pizzaIngredient",
            available: true,
          });
        }
      }

      if (product.modifierTypes) {
        for (const modifierType of product.modifierTypes) {
          const createdModifierType = await ModifierType.create({
            id: modifierType.id,
            name: modifierType.name,
            acceptsMultiple: modifierType.acceptsMultiple,
            required: modifierType.required,
            productId: createdProduct.id,
          });

          // Crear disponibilidad para el tipo de modificador
          await Availability.create({
            id: modifierType.id,
            type: "modifierType",
            available: true,
          });

          for (const modifier of modifierType.modifiers) {
            await Modifier.create({
              id: modifier.id,
              name: modifier.name,
              price: modifier.price,
              modifierTypeId: createdModifierType.id,
            });

            // Crear disponibilidad para el modificador
            await Availability.create({
              id: modifier.id,
              type: "modifier",
              available: true,
            });
          }
        }
      }
    }
    console.log("Menu items and availability have been seeded successfully.");
  } catch (error) {
    console.error("Error seeding menu items and availability:", error);
  } finally {
    await sequelize.close();
  }
};

seedMenuItems();
