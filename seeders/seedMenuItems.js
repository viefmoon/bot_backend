require("dotenv").config();
const { sequelize } = require("../src/lib/db");
const Product = require("../src/models/product");
const ProductVariant = require("../src/models/productVariant");
const PizzaIngredient = require("../src/models/pizzaIngredient");
const ModifierType = require("../src/models/modifierType");
const Modifier = require("../src/models/modifier");
const Availability = require("../src/models/availability");
const RestaurantConfig = require("../src/models/restaurantConfig");

const menu = [
  {
    id: "ALITAS",
    name: "Orden de Alitas",
    category: "entradas",
    productVariants: [
      { id: "ALITAS_BBQ", name: "Orden de Alitas BBQ", price: 135 },
      { id: "ALITAS_BBQ_MED", name: "Media Orden de Alitas BBQ", price: 70 },
      { id: "ALITAS_PIC", name: "Orden de Alitas Picosas", price: 135 },
      {
        id: "ALITAS_PIC_MED",
        name: "Media Orden de Alitas Picosas",
        price: 70,
      },
      { id: "ALITAS_FRI", name: "Orden de Alitas Fritas", price: 135 },
      { id: "ALITAS_FRI_MED", name: "Media Orden de Alitas Fritas", price: 70 },
      {
        id: "ALITAS_MIX",
        name: "Orden de Alitas Mixtas BBQ y picosas",
        price: 135,
      },
    ],
  },
  {
    id: "PAPAS",
    name: "Ordenes de Papas",
    category: "entradas",
    productVariants: [
      { id: "PAPAS_FRAN", name: "Orden de Papas a la Francesa", price: 90 },
      {
        id: "PAPAS_FRAN_MED",
        name: "Media Orden de Papas a la Francesa",
        price: 50,
      },
      { id: "PAPAS_GAJO", name: "Orden de Papas Gajos", price: 100 },
      { id: "PAPAS_GAJO_MED", name: "Media Orden de Papas Gajos", price: 60 },
      {
        id: "PAPAS_MIX",
        name: "Orden de Papas Mixtas francesa y gajos",
        price: 100,
      },
    ],
    modifierTypes: [
      {
        id: "PAPAS_QUESO",
        name: "Queso",
        required: true,
        acceptsMultiple: false,
        modifiers: [
          { id: "PAPAS_SIN_QUESO", name: "Sin queso", price: 0 },
          { id: "PAPAS_CON_QUESO", name: "Con queso", price: 0 },
        ],
      },
    ],
  },
  {
    id: "DEDOS_QUESO",
    name: "Dedos de Queso",
    category: "entradas",
    price: 90,
  },
  {
    id: "ENS",
    name: "Ensaladas",
    category: "comida",
    productVariants: [
      {
        id: "ENS_POLLO_CH",
        name: "Ensalada de Pollo Chica",
        price: 90,
        ingredients:
          "Pollo a la plancha, Chile morrón, Elote, Lechuga, Jitomate, Zanahoria, Queso parmesano, Aderezo, Betabel crujiente",
      },
      {
        id: "ENS_POLLO_GR",
        name: "Ensalada de Pollo Grande",
        price: 120,
        ingredients:
          "Pollo a la plancha, Chile morrón, Elote, Lechuga, Jitomate, Zanahoria, Queso parmesano, Aderezo, Betabel crujiente",
      },
      {
        id: "ENS_JAM_CH",
        name: "Ensalada de Jamón Chica",
        price: 80,
        ingredients:
          "Jamón, Lechuga, Chile morrón, Elote, Jitomate, Zanahoria, Queso parmesano, Aderezo, Betabel crujiente",
      },
      {
        id: "ENS_JAM_GR",
        name: "Ensalada de Jamón Grande",
        price: 100,
        ingredients:
          "Jamón, Lechuga, Chile morrón, Elote, Jitomate, Zanahoria, Queso parmesano, Aderezo, Betabel crujiente",
      },
    ],
    modifierTypes: [
      {
        id: "ENS_EXTRAS",
        name: "Extras",
        required: false,
        acceptsMultiple: true,
        modifiers: [
          { id: "ENS_EX_JAM", name: "Con jamon", price: 10 },
          { id: "ENS_EX_QGOUDA", name: "Con queso gouda", price: 15 },
          { id: "ENS_EX_VINAG", name: "Con vinagreta", price: 0 },
          { id: "ENS_EX_DPOLLO", name: "Doble pollo", price: 15 },
        ],
      },
    ],
  },
  {
    id: "HAMB",
    name: "Hamburguesas",
    category: "comida",
    productVariants: [
      {
        id: "HAMB_TRAD",
        name: "Hamburgesa Tradicional",
        price: 85,
        ingredients:
          "Carne de res, tocino, queso amarillo, queso asadero, cebolla, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
      },
      {
        id: "HAMB_ESP",
        name: "Hamburgesa Especial",
        price: 95,
        ingredients:
          "Carne de res, tocino, pierna, queso amarillo, queso asadero, cebolla, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
      },
      {
        id: "HAMB_HAW",
        name: "Hamburgesa Hawaiana",
        price: 95,
        ingredients:
          "Carne de res, tocino, piña, jamón, queso amarillo, queso asadero, cebolla, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
      },
      {
        id: "HAMB_POLLO",
        name: "Hamburgesa Pollo",
        price: 100,
        ingredients:
          "Pollo a la plancha, tocino, queso amarillo, queso asadero, cebolla, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
      },
      {
        id: "HAMB_BBQ",
        name: "Hamburgesa BBQ",
        price: 100,
        ingredients:
          "Carne de res, salsa bbq, tocino, queso amarillo, queso asadero, cebolla guisada, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
      },
      {
        id: "HAMB_LENAZO",
        name: "Hamburgesa Lenazo",
        price: 110,
        ingredients:
          "Doble carne de sirlón, tocino, queso amarillo, queso asadero, cebolla guisada, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
      },
      {
        id: "HAMB_CUBANA",
        name: "Hamburgesa Cubana",
        price: 100,
        ingredients:
          "Carne de res, tocino, pierna, salchicha, jamón, queso amarillo, cebolla, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
      },
    ],
    modifierTypes: [
      {
        id: "HAMB_PAPAS",
        name: "Papas",
        required: false,
        acceptsMultiple: false,
        modifiers: [
          { id: "HAMB_PAP_FRAN", name: "Con papas francesa", price: 10 },
          { id: "HAMB_PAP_GAJO", name: "Con gajos", price: 15 },
          { id: "HAMB_PAP_MIX", name: "Con papas mixtas", price: 15 },
        ],
      },
      {
        id: "HAMB_EXTRAS",
        name: "Extras",
        required: false,
        acceptsMultiple: true,
        modifiers: [
          { id: "HAMB_EX_PART", name: "Partida", price: 0 },
          { id: "HAMB_EX_QPAP", name: "Queso en la papas", price: 5 },
          { id: "HAMB_EX_DCARNE", name: "Doble carne", price: 10 },
          { id: "HAMB_EX_DPOLLO", name: "Doble pollo", price: 15 },
          { id: "HAMB_EX_QUESO", name: "Extra queso", price: 5 },
          { id: "HAMB_EX_TOC", name: "Extra tocino", price: 5 },
          { id: "HAMB_EX_RPOLLO", name: "Res -> Pollo", price: 15 },
          { id: "HAMB_EX_PIERNA", name: "Con pierna", price: 10 },
          { id: "HAMB_EX_PINA", name: "Con pina", price: 5 },
          { id: "HAMB_EX_JAM", name: "Con jamon", price: 5 },
          { id: "HAMB_EX_SALCH", name: "Con salchicha", price: 5 },
          { id: "HAMB_EX_ENSAL", name: "Con ensalada", price: 15 },
        ],
      },
    ],
  },
  {
    id: "AGUA_HORCH",
    name: "Agua de horchata 1 Litro",
    category: "bebidas",
    price: 35,
  },
  {
    id: "LIMONADA",
    name: "Limonada 1 Litro",
    category: "bebidas",
    price: 35,
  },
  {
    id: "LIMONADA_MIN",
    name: "Limonada Mineral 1 Litro",
    category: "bebidas",
    price: 35,
  },
  {
    id: "REFRESCOS",
    name: "Refrescos 500ml",
    category: "bebidas",
    productVariants: [
      { id: "REFRESCO_COCA", name: "Coca Cola", price: 30 },
      { id: "REFRESCO_7UP", name: "7up", price: 30 },
      { id: "REFRESCO_MIRINDA", name: "Mirinda", price: 30 },
      { id: "REFRESCO_SANGRIA", name: "Refresco de Sangría", price: 30 },
      { id: "REFRESCO_AGUA_MIN", name: "Agua Mineral", price: 30 },
      { id: "REFRESCO_SQUIRT", name: "Squirt", price: 30 },
    ],
  },
  {
    id: "SANGRIA_PREP",
    name: "Sangría Preparada",
    category: "bebidas",
    price: 35,
  },
  {
    id: "MICHELADAS",
    name: "Micheladas",
    category: "bebidas",
    productVariants: [
      { id: "MICH_CLARA", name: "Michelada clara", price: 80 },
      { id: "MICH_OSCURA", name: "Michelada oscura", price: 80 },
    ],
  },
  {
    id: "CAFE_CAL",
    name: "Café Caliente",
    category: "bebidas",
    productVariants: [
      { id: "CAFE_AMER", name: "Cafe Americano", price: 45 },
      { id: "CAFE_CAPUCH", name: "Capuchino", price: 45 },
      { id: "CAFE_CHOCO", name: "Chocolate", price: 50 },
      { id: "CAFE_MOCACH", name: "Mocachino", price: 45 },
      { id: "CAFE_LATTE_VAI", name: "Latte Vainilla", price: 45 },
      { id: "CAFE_LATTE_CAP", name: "Latte Capuchino", price: 45 },
    ],
  },
  {
    id: "FRAPPES",
    name: "Frappés",
    category: "bebidas",
    productVariants: [
      { id: "FRAPPE_CAPUCH", name: "Frappe Capuchino", price: 70 },
      { id: "FRAPPE_COCO", name: "Frappe Coco", price: 70 },
      { id: "FRAPPE_CARAMEL", name: "Frappe Caramelo", price: 70 },
      { id: "FRAPPE_CAJETA", name: "Frappe Cajeta", price: 70 },
      { id: "FRAPPE_MOCACH", name: "Frappe Mocaccino", price: 70 },
      { id: "FRAPPE_GALLET", name: "Frappe Galleta", price: 70 },
      { id: "FRAPPE_BOMBON", name: "Frappe Bombon", price: 70 },
      { id: "FRAPPE_ROMPOPE", name: "Frappe Rompope", price: 85 },
      { id: "FRAPPE_MAZAPAN", name: "Frappe Mazapan", price: 85 },
      { id: "FRAPPE_MAGNUM", name: "Frappe Magnum", price: 85 },
    ],
  },
  {
    id: "VINO_COPA",
    name: "Copa de vino",
    category: "cocteleria",
    price: 90,
  },
  {
    id: "SANGRIA_VINO",
    name: "Sangría con vino",
    category: "cocteleria",
    price: 80,
  },
  {
    id: "VAMPIRO",
    name: "Vampiro",
    category: "cocteleria",
    price: 80,
  },
  {
    id: "GIN_MARACUYA",
    name: "Gin de Maracuyá",
    category: "cocteleria",
    price: 90,
  },
  {
    id: "MARGARITA",
    name: "Margarita",
    category: "cocteleria",
    price: 85,
  },
  {
    id: "RUSO_BLANCO",
    name: "Ruso Blanco",
    category: "cocteleria",
    price: 85,
  },
  {
    id: "PALO_SANTO",
    name: "Palo santo",
    category: "cocteleria",
    price: 80,
  },
  {
    id: "GIN_PEPINO",
    name: "Gin de pepino",
    category: "cocteleria",
    price: 90,
  },
  {
    id: "MOJITO",
    name: "Mojito",
    category: "cocteleria",
    price: 100,
  },
  {
    id: "PINA_COLADA",
    name: "Piña colada",
    category: "cocteleria",
    price: 75,
  },
  {
    id: "PINADA",
    name: "Piñada",
    category: "cocteleria",
    price: 70,
  },
  {
    id: "CONGA",
    name: "Conga",
    category: "cocteleria",
    price: 75,
  },
  {
    id: "DESTORNILLADOR",
    name: "Destornillador",
    category: "cocteleria",
    price: 75,
  },
  {
    id: "PALOMA",
    name: "Paloma",
    category: "cocteleria",
    price: 80,
  },
  {
    id: "CARAJILLO",
    name: "Carajillo",
    category: "cocteleria",
    price: 90,
  },
  {
    id: "TINTO_VERANO",
    name: "Tinto de verano",
    category: "cocteleria",
    price: 90,
  },
  {
    id: "CLERICOT",
    name: "Clericot",
    category: "cocteleria",
    price: 80,
  },
  {
    id: "PIZZA",
    name: "Pizza",
    category: "comida",
    productVariants: [
      { id: "PZ_GDE", name: "Pizza Grande", price: 240 },
      { id: "PZ_MED", name: "Pizza Mediana", price: 190 },
      { id: "PZ_CH", name: "Pizza Chica", price: 140 },
      {
        id: "PZ_GDE_RELL",
        name: "Pizza Grande Con Orilla Rellena de Queso",
        price: 270,
      },
      {
        id: "PZ_MED_RELL",
        name: "Pizza Mediana Con Orilla Rellena de Queso",
        price: 220,
      },
      {
        id: "PZ_CH_RELL",
        name: "Pizza Chica Con Orilla Rellena de Queso",
        price: 160,
      },
    ],
    pizzaIngredients: [
      {
        id: "PZ_ESP",
        name: "Especial",
        ingredientValue: 4,
        ingredients: "Pepperoni, Salchicha, Jamón, Salami, Chile morrón",
      },
      {
        id: "PZ_CARN",
        name: "Carnes Frías",
        ingredientValue: 4,
        ingredients: "Pepperoni, Salchicha, Jamón, Salami",
      },
      {
        id: "PZ_CARR",
        name: "Carranza",
        ingredientValue: 4,
        ingredients: "Chorizo, Jamón, Chile jalapeño, Jitomate",
      },
      {
        id: "PZ_ZAP",
        name: "Zapata",
        ingredientValue: 4,
        ingredients: "Salami, Jamón, Champiñón",
      },
      {
        id: "PZ_VILLA",
        name: "Villa",
        ingredientValue: 4,
        ingredients: "Chorizo, Tocino, Piña, Chile jalapeño",
      },
      {
        id: "PZ_MARG",
        name: "Margarita",
        ingredientValue: 4,
        ingredients: "3 Quesos, Jitomate, Albahaca",
      },
      {
        id: "PZ_ADEL",
        name: "Adelita",
        ingredientValue: 4,
        ingredients: "Jamón, Piña, Arándano",
      },
      {
        id: "PZ_HAW",
        name: "Hawaiana",
        ingredientValue: 4,
        ingredients: "Jamón, Piña",
      },
      {
        id: "PZ_MEX",
        name: "Mexicana",
        ingredientValue: 4,
        ingredients: "Chorizo, Cebolla, Chile jalapeño, Jitomate",
      },
      {
        id: "PZ_RIV",
        name: "Rivera",
        ingredientValue: 4,
        ingredients: "Elote, Champiñón, Chile morrón",
      },
      {
        id: "PZ_KAHLO",
        name: "Kahlo",
        ingredientValue: 4,
        ingredients: "Calabaza, Elote, Champiñón, Jitomate, Chile morrón",
      },
      {
        id: "PZ_LUP",
        name: "Lupita",
        ingredientValue: 4,
        ingredients: "Carne molida, Tocino, Cebolla, Chile morrón",
      },
      {
        id: "PZ_PEPP",
        name: "Pepperoni",
        ingredientValue: 4,
        ingredients: "Pepperoni",
      },
      {
        id: "PZ_LENA",
        name: "La Lena",
        ingredientValue: 6,
        ingredients: "Tocino, Pierna, Chorizo, Carne molida",
      },
      {
        id: "PZ_MARIA",
        name: "La Maria",
        ingredientValue: 6,
        ingredients: "Pollo BBQ, Piña, Chile jalapeño",
      },
      {
        id: "PZ_MALIN",
        name: "Malinche",
        ingredientValue: 6,
        ingredients:
          "3 Quesos, Queso de cabra, Champiñón, Jamón, Chile seco, Albahaca",
      },
      {
        id: "PZ_PHILA",
        name: "Philadelphia",
        ingredientValue: 6,
        ingredients: "Queso philadelphia, Chile jalapeño, Jamon, Albahaca",
      },
      { id: "PZ_3Q", name: "3 Quesos", ingredientValue: 2 },
      { id: "PZ_ALB", name: "Albahaca", ingredientValue: 1 },
      { id: "PZ_ARAN", name: "Arandano", ingredientValue: 1 },
      { id: "PZ_CAL", name: "Calabaza", ingredientValue: 1 },
      { id: "PZ_CEB", name: "Cebolla", ingredientValue: 1 },
      { id: "PZ_CHAM", name: "Champinon", ingredientValue: 1 },
      { id: "PZ_CHSEC", name: "Chile Seco", ingredientValue: 1 },
      { id: "PZ_CHOR", name: "Chorizo", ingredientValue: 1 },
      { id: "PZ_ELO", name: "Elote", ingredientValue: 1 },
      { id: "PZ_JAL", name: "Jalapeno", ingredientValue: 1 },
      { id: "PZ_JAM", name: "Jamon", ingredientValue: 1 },
      { id: "PZ_JIT", name: "Jitomate", ingredientValue: 1 },
      { id: "PZ_MOL", name: "Molida", ingredientValue: 1 },
      { id: "PZ_MOR", name: "Morron", ingredientValue: 1 },
      { id: "PZ_PIER", name: "Pierna", ingredientValue: 2 },
      { id: "PZ_PINA", name: "Pina", ingredientValue: 1 },
      { id: "PZ_POBBQ", name: "Pollo BBQ", ingredientValue: 2 },
      { id: "PZ_QCAB", name: "Queso de cabra", ingredientValue: 2 },
      { id: "PZ_SALAM", name: "Salami", ingredientValue: 1 },
      { id: "PZ_SALCH", name: "Salchicha", ingredientValue: 1 },
      { id: "PZ_TOC", name: "Tocino", ingredientValue: 1 },
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

    // Crear la configuración inicial del restaurante
    await RestaurantConfig.create({
      acceptingOrders: true,
      estimatedPickupTime: 20,
      estimatedDeliveryTime: 40,
    });

    console.log(
      "Menu items, availability, and restaurant configuration have been seeded successfully."
    );
  } catch (error) {
    console.error(
      "Error seeding menu items, availability, and restaurant configuration:",
      error
    );
  } finally {
    await sequelize.close();
  }
};

seedMenuItems();
