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
    id: "A",
    name: "Orden de Alitas",
    category: "entradas",
    productVariants: [
      { id: "A-V-BBQ", name: "Orden de Alitas BBQ", price: 135 },
      { id: "A-V-BBQ_MED", name: "Media Orden de Alitas BBQ", price: 70 },
      { id: "A-V-PIC", name: "Orden de Alitas Picosas", price: 135 },
      {
        id: "A-V-PIC_MED",
        name: "Media Orden de Alitas Picosas",
        price: 70,
      },
      { id: "A-V-FRI", name: "Orden de Alitas Fritas", price: 135 },
      { id: "A-V-FRI_MED", name: "Media Orden de Alitas Fritas", price: 70 },
      {
        id: "A-V-MIX",
        name: "Orden de Alitas Mixtas BBQ y picosas",
        price: 135,
      },
    ],
  },
  {
    id: "P",
    name: "Ordenes de Papas",
    category: "entradas",
    productVariants: [
      { id: "P-V-FRAN", name: "Orden de Papas a la Francesa", price: 90 },
      {
        id: "P-V-FRAN_MED",
        name: "Media Orden de Papas a la Francesa",
        price: 50,
      },
      { id: "P-V-GAJO", name: "Orden de Papas Gajos", price: 100 },
      { id: "P-V-GAJO_MED", name: "Media Orden de Papas Gajos", price: 60 },
      {
        id: "P-V-MIX",
        name: "Orden de Papas Mixtas francesa y gajos",
        price: 100,
      },
    ],
    modifierTypes: [
      {
        id: "P-MOD-QUESO",
        name: "Queso",
        required: true,
        acceptsMultiple: false,
        modifiers: [
          { id: "P-MOD-SQ", name: "Sin queso", price: 0 },
          { id: "P-MOD-CQ", name: "Con queso", price: 0 },
        ],
      },
    ],
  },
  {
    id: "DQ",
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
        id: "ENS-V-POLL_CH",
        name: "Ensalada de Pollo Chica",
        price: 90,
        ingredients:
          "Pollo a la plancha, Chile morrón, Elote, Lechuga, Jitomate, Zanahoria, Queso parmesano, Aderezo, Betabel crujiente",
      },
      {
        id: "ENS-V-POLL_GR",
        name: "Ensalada de Pollo Grande",
        price: 120,
        ingredients:
          "Pollo a la plancha, Chile morrón, Elote, Lechuga, Jitomate, Zanahoria, Queso parmesano, Aderezo, Betabel crujiente",
      },
      {
        id: "ENS-V-JAM_CH",
        name: "Ensalada de Jamón Chica",
        price: 80,
        ingredients:
          "Jamón, Lechuga, Chile morrón, Elote, Jitomate, Zanahoria, Queso parmesano, Aderezo, Betabel crujiente",
      },
      {
        id: "ENS-V-JAM_GR",
        name: "Ensalada de Jamón Grande",
        price: 100,
        ingredients:
          "Jamón, Lechuga, Chile morrón, Elote, Jitomate, Zanahoria, Queso parmesano, Aderezo, Betabel crujiente",
      },
    ],
    modifierTypes: [
      {
        id: "ENS-MOD-EX",
        name: "Extras",
        required: false,
        acceptsMultiple: true,
        modifiers: [
          { id: "ENS-MOD-JAM", name: "Con jamon", price: 10 },
          { id: "ENS-MOD-QGOUDA", name: "Con queso gouda", price: 15 },
          { id: "ENS-MOD-VINAG", name: "Con vinagreta", price: 0 },
          { id: "ENS-MOD-DPOLLO", name: "Doble pollo", price: 15 },
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
        id: "H-V-TRAD",
        name: "Hamburgesa Tradicional",
        price: 85,
        ingredients:
          "Carne de res, tocino, queso amarillo, queso asadero, cebolla, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
      },
      {
        id: "H-V-ESP",
        name: "Hamburgesa Especial",
        price: 95,
        ingredients:
          "Carne de res, tocino, pierna, queso amarillo, queso asadero, cebolla, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
      },
      {
        id: "H-V-HAW",
        name: "Hamburgesa Hawaiana",
        price: 95,
        ingredients:
          "Carne de res, tocino, piña, jamón, queso amarillo, queso asadero, cebolla, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
      },
      {
        id: "H-V-POLL",
        name: "Hamburgesa Pollo",
        price: 100,
        ingredients:
          "Pollo a la plancha, tocino, queso amarillo, queso asadero, cebolla, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
      },
      {
        id: "H-V-BBQ",
        name: "Hamburgesa BBQ",
        price: 100,
        ingredients:
          "Carne de res, salsa bbq, tocino, queso amarillo, queso asadero, cebolla guisada, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
      },
      {
        id: "H-V-LEN",
        name: "Hamburgesa Lenazo",
        price: 110,
        ingredients:
          "Doble carne de sirlón, tocino, queso amarillo, queso asadero, cebolla guisada, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
      },
      {
        id: "H-V-CUB",
        name: "Hamburgesa Cubana",
        price: 100,
        ingredients:
          "Carne de res, tocino, pierna, salchicha, jamón, queso amarillo, cebolla, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
      },
    ],
    modifierTypes: [
      {
        id: "H-MOD-PAPAS",
        name: "Papas",
        required: false,
        acceptsMultiple: false,
        modifiers: [
          { id: "H-MOD-PAP_FRAN", name: "Con papas francesa", price: 10 },
          { id: "H-MOD-PAP_GAJO", name: "Con gajos", price: 15 },
          { id: "H-MOD-PAP_MIX", name: "Con papas mixtas", price: 15 },
        ],
      },
      {
        id: "H-MOD-EX",
        name: "Extras",
        required: false,
        acceptsMultiple: true,
        modifiers: [
          { id: "H-MOD-PART", name: "Partida", price: 0 },
          { id: "H-MOD-QPAP", name: "Queso en la papas", price: 5 },
          { id: "H-MOD-DCARNE", name: "Doble carne", price: 10 },
          { id: "H-MOD-DPOLLO", name: "Doble pollo", price: 15 },
          { id: "H-MOD-QUESO", name: "Extra queso", price: 5 },
          { id: "H-MOD-TOC", name: "Extra tocino", price: 5 },
          { id: "H-MOD-RPOLLO", name: "Res -> Pollo", price: 15 },
          { id: "H-MOD-PIERNA", name: "Con pierna", price: 10 },
          { id: "H-MOD-PINA", name: "Con pina", price: 5 },
          { id: "H-MOD-JAM", name: "Con jamon", price: 5 },
          { id: "H-MOD-SALCH", name: "Con salchicha", price: 5 },
          { id: "H-MOD-ENSAL", name: "Con ensalada", price: 15 },
        ],
      },
    ],
  },
  {
    id: "AGUA_H",
    name: "Agua de horchata 1 Litro",
    category: "bebidas",
    price: 35,
  },
  {
    id: "LIM",
    name: "Limonada 1 Litro",
    category: "bebidas",
    price: 35,
  },
  {
    id: "LIM_MIN",
    name: "Limonada Mineral 1 Litro",
    category: "bebidas",
    price: 35,
  },
  {
    id: "REF",
    name: "Refrescos 500ml",
    category: "bebidas",
    productVariants: [
      { id: "REF-V-COCA", name: "Coca Cola", price: 30 },
      { id: "REF-V-7UP", name: "7up", price: 30 },
      { id: "REF-V-MIRINDA", name: "Mirinda", price: 30 },
      { id: "REF-V-SANGRIA", name: "Refresco de Sangría", price: 30 },
      { id: "REF-V-AGUA_MIN", name: "Agua Mineral", price: 30 },
      { id: "REF-V-SQUIRT", name: "Squirt", price: 30 },
    ],
  },
  {
    id: "SANG_PREP",
    name: "Sangría Preparada",
    category: "bebidas",
    price: 35,
  },
  {
    id: "MICH",
    name: "Micheladas",
    category: "bebidas",
    productVariants: [
      { id: "MICH-V-CL", name: "Michelada clara", price: 80 },
      { id: "MICH-V-OSC", name: "Michelada oscura", price: 80 },
    ],
  },
  {
    id: "CAF_CAL",
    name: "Café Caliente",
    category: "bebidas",
    productVariants: [
      { id: "CAF-V-AMER", name: "Cafe Americano", price: 45 },
      { id: "CAF-V-CAPUCH", name: "Capuchino", price: 45 },
      { id: "CAF-V-CHOCO", name: "Chocolate", price: 50 },
      { id: "CAF-V-MOCACH", name: "Mocachino", price: 45 },
      { id: "CAF-V-LATTE_VAI", name: "Latte Vainilla", price: 45 },
      { id: "CAF-V-LATTE_CAP", name: "Latte Capuchino", price: 45 },
    ],
  },
  {
    id: "FRAPPE",
    name: "Frappés",
    category: "bebidas",
    productVariants: [
      { id: "FRAPPE-V-CAPUCH", name: "Frappe Capuchino", price: 70 },
      { id: "FRAPPE-V-COCO", name: "Frappe Coco", price: 70 },
      { id: "FRAPPE-V-CARAMEL", name: "Frappe Caramelo", price: 70 },
      { id: "FRAPPE-V-CAJETA", name: "Frappe Cajeta", price: 70 },
      { id: "FRAPPE-V-MOCACH", name: "Frappe Mocaccino", price: 70 },
      { id: "FRAPPE-V-GALLET", name: "Frappe Galleta", price: 70 },
      { id: "FRAPPE-V-BOMBON", name: "Frappe Bombon", price: 70 },
      { id: "FRAPPE-V-ROMPOPE", name: "Frappe Rompope", price: 85 },
      { id: "FRAPPE-V-MAZAPAN", name: "Frappe Mazapan", price: 85 },
      { id: "FRAPPE-V-MAGNUM", name: "Frappe Magnum", price: 85 },
    ],
  },
  {
    id: "COP_V",
    name: "Copa de vino",
    category: "cocteleria",
    price: 90,
  },
  {
    id: "SANG_C_V",
    name: "Sangría con vino",
    category: "cocteleria",
    price: 80,
  },
  {
    id: "VAMP",
    name: "Vampiro",
    category: "cocteleria",
    price: 80,
  },
  {
    id: "GIN_MAR",
    name: "Gin de Maracuyá",
    category: "cocteleria",
    price: 90,
  },
  {
    id: "MAR",
    name: "Margarita",
    category: "cocteleria",
    price: 85,
  },
  {
    id: "RUSO_BL",
    name: "Ruso Blanco",
    category: "cocteleria",
    price: 85,
  },
  {
    id: "PAL_SAN",
    name: "Palo santo",
    category: "cocteleria",
    price: 80,
  },
  {
    id: "GIN_PEP",
    name: "Gin de pepino",
    category: "cocteleria",
    price: 90,
  },
  {
    id: "MOJ",
    name: "Mojito",
    category: "cocteleria",
    price: 100,
  },
  {
    id: "PINA_COL",
    name: "Piña colada",
    category: "cocteleria",
    price: 75,
  },
  {
    id: "PINA",
    name: "Piñada",
    category: "cocteleria",
    price: 70,
  },
  {
    id: "CONG",
    name: "Conga",
    category: "cocteleria",
    price: 75,
  },
  {
    id: "DEST",
    name: "Destornillador",
    category: "cocteleria",
    price: 75,
  },
  {
    id: "PAL",
    name: "Paloma",
    category: "cocteleria",
    price: 80,
  },
  {
    id: "CARAJ",
    name: "Carajillo",
    category: "cocteleria",
    price: 90,
  },
  {
    id: "TINTO_VER",
    name: "Tinto de verano",
    category: "cocteleria",
    price: 90,
  },
  {
    id: "CLERI",
    name: "Clericot",
    category: "cocteleria",
    price: 80,
  },
  {
    id: "PZ",
    name: "Pizza",
    category: "comida",
    productVariants: [
      { id: "PZ-V-GDE", name: "Pizza Grande", price: 240 },
      { id: "PZ-V-MED", name: "Pizza Mediana", price: 190 },
      { id: "PZ-V-CH", name: "Pizza Chica", price: 140 },
      {
        id: "PZ-V-GDE_RELL",
        name: "Pizza Grande Con Orilla Rellena de Queso",
        price: 270,
      },
      {
        id: "PZ-V-MED_RELL",
        name: "Pizza Mediana Con Orilla Rellena de Queso",
        price: 220,
      },
      {
        id: "PZ-V-CH_RELL",
        name: "Pizza Chica Con Orilla Rellena de Queso",
        price: 160,
      },
    ],
    pizzaIngredients: [
      {
        id: "PZ-ING-ESP",
        name: "Especial",
        ingredientValue: 4,
        ingredients: "Pepperoni, Salchicha, Jamón, Salami, Chile morrón",
      },
      {
        id: "PZ-ING-CARN",
        name: "Carnes Frías",
        ingredientValue: 4,
        ingredients: "Pepperoni, Salchicha, Jamón, Salami",
      },
      {
        id: "PZ-ING-CARR",
        name: "Carranza",
        ingredientValue: 4,
        ingredients: "Chorizo, Jamón, Chile jalapeño, Jitomate",
      },
      {
        id: "PZ-ING-ZAP",
        name: "Zapata",
        ingredientValue: 4,
        ingredients: "Salami, Jamón, Champiñón",
      },
      {
        id: "PZ-ING-VILLA",
        name: "Villa",
        ingredientValue: 4,
        ingredients: "Chorizo, Tocino, Piña, Chile jalapeño",
      },
      {
        id: "PZ-ING-MARG",
        name: "Margarita",
        ingredientValue: 4,
        ingredients: "3 Quesos, Jitomate, Albahaca",
      },
      {
        id: "PZ-ING-ADEL",
        name: "Adelita",
        ingredientValue: 4,
        ingredients: "Jamón, Piña, Arándano",
      },
      {
        id: "PZ-ING-HAW",
        name: "Hawaiana",
        ingredientValue: 4,
        ingredients: "Jamón, Piña",
      },
      {
        id: "PZ-ING-MEX",
        name: "Mexicana",
        ingredientValue: 4,
        ingredients: "Chorizo, Cebolla, Chile jalapeño, Jitomate",
      },
      {
        id: "PZ-ING-RIV",
        name: "Rivera",
        ingredientValue: 4,
        ingredients: "Elote, Champiñón, Chile morrón",
      },
      {
        id: "PZ-ING-KAH",
        name: "Kahlo",
        ingredientValue: 4,
        ingredients: "Calabaza, Elote, Champiñón, Jitomate, Chile morrón",
      },
      {
        id: "PZ-ING-LUP",
        name: "Lupita",
        ingredientValue: 4,
        ingredients: "Carne molida, Tocino, Cebolla, Chile morrón",
      },
      {
        id: "PZ-ING-PEPP",
        name: "Pepperoni",
        ingredientValue: 4,
        ingredients: "Pepperoni",
      },
      {
        id: "PZ-ING-LENA",
        name: "La Lena",
        ingredientValue: 6,
        ingredients: "Tocino, Pierna, Chorizo, Carne molida",
      },
      {
        id: "PZ-ING-MARIA",
        name: "La Maria",
        ingredientValue: 6,
        ingredients: "Pollo BBQ, Piña, Chile jalapeño",
      },
      {
        id: "PZ-ING-MALIN",
        name: "Malinche",
        ingredientValue: 6,
        ingredients:
          "3 Quesos, Queso de cabra, Champiñón, Jamón, Chile seco, Albahaca",
      },
      {
        id: "PZ-ING-PHILA",
        name: "Philadelphia",
        ingredientValue: 6,
        ingredients: "Queso philadelphia, Chile jalapeño, Jamon, Albahaca",
      },
      { id: "PZ-ING-3Q", name: "3 Quesos", ingredientValue: 2 },
      { id: "PZ-ING-ALB", name: "Albahaca", ingredientValue: 1 },
      { id: "PZ-ING-ARAN", name: "Arandano", ingredientValue: 1 },
      { id: "PZ-ING-CAL", name: "Calabaza", ingredientValue: 1 },
      { id: "PZ-ING-CEB", name: "Cebolla", ingredientValue: 1 },
      { id: "PZ-ING-CHAM", name: "Champinon", ingredientValue: 1 },
      { id: "PZ-ING-CH_SEC", name: "Chile Seco", ingredientValue: 1 },
      { id: "PZ-ING-CHOR", name: "Chorizo", ingredientValue: 1 },
      { id: "PZ-ING-ELO", name: "Elote", ingredientValue: 1 },
      { id: "PZ-ING-JAL", name: "Jalapeno", ingredientValue: 1 },
      { id: "PZ-ING-JAM", name: "Jamon", ingredientValue: 1 },
      { id: "PZ-ING-JIT", name: "Jitomate", ingredientValue: 1 },
      { id: "PZ-ING-MOL", name: "Molida", ingredientValue: 1 },
      { id: "PZ-ING-MOR", name: "Morron", ingredientValue: 1 },
      { id: "PZ-ING-PIER", name: "Pierna", ingredientValue: 2 },
      { id: "PZ-ING-PINA", name: "Pina", ingredientValue: 1 },
      { id: "PZ-ING-POBBQ", name: "Pollo BBQ", ingredientValue: 2 },
      { id: "PZ-ING-QCAB", name: "Queso de cabra", ingredientValue: 2 },
      { id: "PZ-ING-SALAM", name: "Salami", ingredientValue: 1 },
      { id: "PZ-ING-SALCH", name: "Salchicha", ingredientValue: 1 },
      { id: "PZ-ING-TOC", name: "Tocino", ingredientValue: 1 },
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

          if (modifierType.modifiers) {
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
