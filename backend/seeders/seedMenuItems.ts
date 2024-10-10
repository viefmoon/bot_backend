import * as dotenv from "dotenv";
dotenv.config();
import { sequelize } from "../src/lib/db";
import Product from "../src/models/product";
import ProductVariant from "../src/models/productVariant";
import PizzaIngredient from "../src/models/pizzaIngredient";
import ModifierType from "../src/models/modifierType";
import Modifier from "../src/models/modifier";
import Availability from "../src/models/availability";
import RestaurantConfig from "../src/models/restaurantConfig";
import NotificationPhone from "../src/models/notificationPhone";

const testConnection = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    console.log("Connection has been established successfully.");
  } catch (error) {
    console.error("Unable to connect to the database:", error);
  }
};

testConnection();

const menu: any[] = [
  {
    id: "A",
    name: "Alitas",
    category: "entradas",
    productVariants: [
      {
        id: "AV1",
        name: "Orden de Alitas BBQ",
        price: 135,
      },
      {
        id: "AV2",
        name: "Media Orden de Alitas BBQ",
        price: 70,
      },
      {
        id: "AV3",
        name: "Orden de Alitas Picosas",
        price: 135,
      },
      {
        id: "AV4",
        name: "Media Orden de Alitas Picosas",
        price: 70,
      },
      {
        id: "AV5",
        name: "Orden de Alitas Fritas",
        price: 135,
      },
      {
        id: "AV6",
        name: "Media Orden de Alitas Fritas",
        price: 70,
      },
      {
        id: "AV7",
        name: "Orden de Alitas Mango Habanero",
        price: 140,
      },
      {
        id: "AV8",
        name: "Media Orden de Alitas Mango Habanero",
        price: 75,
      },
      {
        id: "AV9",
        name: "Orden de Alitas Mixtas BBQ y picosas",
        price: 135,
      },
    ],
    modifierTypes: [
      {
        id: "AM1",
        name: "Observaciones Alitas",
        required: false,
        acceptsMultiple: true,
        modifiers: [
          {
            id: "AM1-1",
            name: "Extra doradas",
            price: 0,
          },
          {
            id: "AM1-2",
            name: "Menos doradas",
            price: 0,
          },
          {
            id: "AM1-3",
            name: "Extra salsa",
            price: 0,
          },
          {
            id: "AM1-4",
            name: "Arregladas con verdura y totopos",
            price: 0,
          },
          {
            id: "AM1-5",
            name: "Aderezo ranch",
            price: 0,
          },
          {
            id: "AM1-6",
            name: "Salsa picosa aparte",
            price: 0,
          },
          {
            id: "AM1-7",
            name: "Salsa BBQ aparte",
            price: 0,
          },
          {
            id: "AM1-8",
            name: "Extra chile de aceite",
            price: 0,
          },
        ],
      },
    ],
  },
  {
    id: "P",
    name: "Orden de Papas",
    category: "entradas",
    productVariants: [
      {
        id: "PV1",
        name: "Orden de Papas a la Francesa",
        price: 90,
      },
      {
        id: "PV2",
        name: "Media Orden de Papas a la Francesa",
        price: 50,
      },
      {
        id: "PV3",
        name: "Orden de Papas Gajo",
        price: 105,
      },
      {
        id: "PV4",
        name: "Media Orden de Papas Gajo",
        price: 65,
      },
      {
        id: "PV5",
        name: "Orden de Papas Mixtas francesa y gajo",
        price: 105,
      },
    ],
    modifierTypes: [
      {
        id: "PM1",
        name: "Papas observaciones",
        required: false,
        acceptsMultiple: true,
        modifiers: [
          {
            id: "PM1-1",
            name: "Sin queso",
            price: 0,
          },
          {
            id: "PM1-2",
            name: "Extra aderezo",
            price: 0,
          },
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
    id: "E",
    name: "Ensalada",
    category: "comida",
    productVariants: [
      {
        id: "EV1",
        name: "Ensalada de Pollo Chica",
        price: 90,
        ingredients:
          "Pollo a la plancha, Chile morron, Elote, Lechuga, Jitomate, Zanahoria, Queso parmesano, Aderezo, Betabel crujiente",
      },
      {
        id: "EV2",
        name: "Ensalada de Pollo Grande",
        price: 120,
        ingredients:
          "Pollo a la plancha, Chile morron, Elote, Lechuga, Jitomate, Zanahoria, Queso parmesano, Aderezo, Betabel crujiente",
      },
      {
        id: "EV3",
        name: "Ensalada de Jamon Chica",
        price: 80,
        ingredients:
          "Jamon, Lechuga, Chile morron, Elote, Jitomate, Zanahoria, Queso parmesano, Aderezo, Betabel crujiente",
      },
      {
        id: "EV4",
        name: "Ensalada de Jamon Grande",
        price: 100,
        ingredients:
          "Jamon, Lechuga, Chile morron, Elote, Jitomate, Zanahoria, Queso parmesano, Aderezo, Betabel crujiente",
      },
      {
        id: "EV5",
        name: "Ensalada Vegetal Chica",
        price: 70,
        ingredients:
          "Lechuga, Chile morron, Elote, Jitomate, Zanahoria, Queso parmesano, Aderezo, Betabel crujiente",
      },
      {
        id: "EV6",
        name: "Ensalada Vegetal Grande",
        price: 90,
        ingredients:
          "Lechuga, Chile morron, Elote, Jitomate, Zanahoria, Queso parmesano, Aderezo, Betabel crujiente",
      },
    ],
    modifierTypes: [
      {
        id: "EM1",
        name: "Extras Ensaladas",
        required: false,
        acceptsMultiple: true,
        modifiers: [
          {
            id: "EM1-1",
            name: "Vinagreta",
            price: 0,
          },
          {
            id: "EM1-2",
            name: "Doble pollo",
            price: 15,
          },
        ],
      },
    ],
  },
  {
    id: "H",
    name: "Hamburguesa",
    category: "comida",
    productVariants: [
      {
        id: "HV1",
        name: "Hamburguesa Tradicional",
        price: 85,
        ingredients:
          "Carne de res, tocino, queso amarillo, queso asadero, cebolla, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
      },
      {
        id: "HV2",
        name: "Hamburguesa Especial",
        price: 95,
        ingredients:
          "Carne de res, tocino, pierna, queso amarillo, queso asadero, cebolla, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
      },
      {
        id: "HV3",
        name: "Hamburguesa Hawaiana",
        price: 95,
        ingredients:
          "Carne de res, tocino, piña, jamon, queso amarillo, queso asadero, cebolla, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
      },
      {
        id: "HV4",
        name: "Hamburguesa Pollo",
        price: 100,
        ingredients:
          "Pollo a la plancha, tocino, queso amarillo, queso asadero, cebolla, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
      },
      {
        id: "HV5",
        name: "Hamburguesa BBQ",
        price: 100,
        ingredients:
          "Carne de res, salsa bbq, tocino, queso amarillo, queso asadero, cebolla guisada, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
      },
      {
        id: "HV6",
        name: "Hamburguesa Leñazo",
        price: 110,
        ingredients:
          "Doble carne de sirlon, tocino, queso amarillo, queso asadero, cebolla guisada, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
      },
      {
        id: "HV7",
        name: "Hamburguesa Cubana",
        price: 100,
        ingredients:
          "Carne de res, tocino, pierna, salchicha, jamon, queso amarillo, cebolla, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
      },
    ],
    modifierTypes: [
      {
        id: "HM1",
        name: "Hamburguesa con papas",
        required: false,
        acceptsMultiple: false,
        modifiers: [
          {
            id: "HM1-1",
            name: "Con papas francesa",
            price: 10,
          },
          {
            id: "HM1-2",
            name: "Con papas francesa gratinadas",
            price: 15,
          },
          {
            id: "HM1-3",
            name: "Con papas gajo",
            price: 15,
          },
          {
            id: "HM1-4",
            name: "Con papas gajo gratinadas",
            price: 20,
          },
          {
            id: "HM1-5",
            name: "Con papas mixtas",
            price: 15,
          },
          {
            id: "HM1-6",
            name: "Con papas mixtas gratinadas",
            price: 20,
          },
        ],
      },
      {
        id: "HM2",
        name: "Hamburguesa extras",
        required: false,
        acceptsMultiple: true,
        modifiers: [
          {
            id: "HM2-1",
            name: "Partida en mitad",
            price: 0,
          },
          {
            id: "HM2-2",
            name: "Doble carne o pollo",
            price: 15,
          },
          {
            id: "HM2-3",
            name: "Pollo en lugar de carne de res",
            price: 15,
          },
          {
            id: "HM2-4",
            name: "Con ensalada",
            price: 15,
          },
          {
            id: "HM2-5",
            name: "Carne dorada",
            price: 0,
          },
        ],
      },
    ],
  },
  {
    id: "AH",
    name: "Agua fresca de horchata",
    category: "bebidas",
    price: 35,
  },
  {
    id: "LIM",
    name: "Limonada",
    category: "bebidas",
    price: 35,
  },
  {
    id: "LIMM",
    name: "Limonada Mineral",
    category: "bebidas",
    price: 35,
  },
  {
    id: "RCC",
    name: "Refresco de Coca Cola",
    category: "bebidas",
    price: 30,
  },
  {
    id: "R7UP",
    name: "Refresco 7up",
    category: "bebidas",
    price: 30,
  },
  {
    id: "RMIR",
    name: "Refresco Mirinda",
    category: "bebidas",
    price: 30,
  },
  {
    id: "RSAN",
    name: "Refresco de Sangria",
    category: "bebidas",
    price: 30,
  },
  {
    id: "RAM",
    name: "Agua Mineral",
    category: "bebidas",
    price: 30,
  },
  {
    id: "RSQU",
    name: "Squirt",
    category: "bebidas",
    price: 30,
  },
  {
    id: "SANP",
    name: "Sangria preparada",
    category: "bebidas",
    price: 35,
  },
  {
    id: "MICH",
    name: "Michelada",
    category: "bebidas",
    productVariants: [
      {
        id: "MV1",
        name: "Michelada clara",
        price: 80,
      },
      {
        id: "MV2",
        name: "Michelada oscura",
        price: 80,
      },
    ],
  },
  {
    id: "CA",
    name: "Cafe Americano",
    category: "bebidas",
    price: 45,
  },
  {
    id: "CP",
    name: "Capuchino",
    category: "bebidas",
    price: 45,
  },
  {
    id: "CH",
    name: "Chocolate",
    category: "bebidas",
    price: 50,
  },
  {
    id: "MC",
    name: "Mocachino",
    category: "bebidas",
    price: 45,
  },
  {
    id: "LV",
    name: "Latte Vainilla",
    category: "bebidas",
    price: 45,
  },
  {
    id: "LC",
    name: "Latte Capuchino",
    category: "bebidas",
    price: 45,
  },
  {
    id: "F",
    name: "Frappe",
    category: "bebidas",
    productVariants: [
      {
        id: "FV1",
        name: "Frappe Capuchino",
        price: 70,
      },
      { id: "FV2", name: "Frappe Coco", price: 70 },
      { id: "FV3", name: "Frappe Caramelo", price: 70 },
      { id: "FV4", name: "Frappe Cajeta", price: 70 },
      {
        id: "FV5",
        name: "Frappe Mocaccino",
        price: 70,
      },
      { id: "FV6", name: "Frappe Galleta", price: 70 },
      { id: "FV7", name: "Frappe Bombon", price: 70 },
      { id: "FV8", name: "Frappe Rompope", price: 85 },
      { id: "FV9", name: "Frappe Mazapan", price: 85 },
      { id: "FV10", name: "Frappe Magnum", price: 85 },
    ],
  },
  {
    id: "CV",
    name: "Copa de vino",
    category: "cocteleria",
    price: 90,
  },
  {
    id: "SV",
    name: "Sangria con vino",
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
    id: "GMAR",
    name: "Gin de Maracuya",
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
    id: "RBL",
    name: "Ruso Blanco",
    category: "cocteleria",
    price: 85,
  },
  {
    id: "PSAN",
    name: "Palo santo",
    category: "cocteleria",
    price: 80,
  },
  {
    id: "GPEP",
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
    id: "PCOL",
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
    id: "CG",
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
    id: "TV",
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
      { id: "PZ-V-G", name: "Pizza Grande", price: 240 },
      {
        id: "PZ-V-M",
        name: "Pizza Mediana",
        price: 190,
      },
      { id: "PZ-V-CH", name: "Pizza Chica", price: 140 },
      {
        id: "PZ-V-GR",
        name: "Pizza Grande Con Orilla Rellena de Queso",
        price: 270,
      },
      {
        id: "PZ-V-MR",
        name: "Pizza Mediana Con Orilla Rellena de Queso",
        price: 220,
      },
      {
        id: "PZ-V-CHR",
        name: "Pizza Chica Con Orilla Rellena de Queso",
        price: 160,
      },
    ],
    pizzaIngredients: [
      {
        id: "PZ-I-1",
        name: "Especial",
        ingredientValue: 4,
        ingredients: "Pepperoni, Salchicha, Jamon, Salami, Chile morron",
      },
      {
        id: "PZ-I-2",
        name: "Carnes Frias",
        ingredientValue: 4,
        ingredients: "Pepperoni, Salchicha, Jamon, Salami",
      },
      {
        id: "PZ-I-3",
        name: "Carranza",
        ingredientValue: 4,
        ingredients: "Chorizo, Jamon, Chile jalapeño, Jitomate",
      },
      {
        id: "PZ-I-4",
        name: "Zapata",
        ingredientValue: 4,
        ingredients: "Salami, Jamon, Champiñon",
      },
      {
        id: "PZ-I-5",
        name: "Villa",
        ingredientValue: 4,
        ingredients: "Chorizo, Tocino, Piña, Chile jalapeño",
      },
      {
        id: "PZ-I-6",
        name: "Margarita",
        ingredientValue: 4,
        ingredients: "3 Quesos, Jitomate, Albahaca",
      },
      {
        id: "PZ-I-7",
        name: "Adelita",
        ingredientValue: 4,
        ingredients: "Jamon, Piña, Arandano",
      },
      {
        id: "PZ-I-8",
        name: "Hawaiana",
        ingredientValue: 4,
        ingredients: "Jamon, Piña",
      },
      {
        id: "PZ-I-9",
        name: "Mexicana",
        ingredientValue: 4,
        ingredients: "Chorizo, Cebolla, Chile jalapeño, Jitomate",
      },
      {
        id: "PZ-I-10",
        name: "Rivera",
        ingredientValue: 4,
        ingredients: "Elote, Champiñon, Chile morron",
      },
      {
        id: "PZ-I-11",
        name: "Kahlo",
        ingredientValue: 4,
        ingredients: "Calabaza, Elote, Champiñon, Jitomate, Chile morron",
      },
      {
        id: "PZ-I-12",
        name: "Lupita",
        ingredientValue: 4,
        ingredients: "Carne molida, Tocino, Cebolla, Chile morron",
      },
      {
        id: "PZ-I-13",
        name: "Pepperoni",
        ingredientValue: 4,
        ingredients: "Pepperoni",
      },
      {
        id: "PZ-I-14",
        name: "La Leña",
        ingredientValue: 6,
        ingredients: "Tocino, Pierna, Chorizo, Carne molida",
      },
      {
        id: "PZ-I-15",
        name: "La Maria",
        ingredientValue: 6,
        ingredients: "Pollo BBQ, Piña, Chile jalapeño",
      },
      {
        id: "PZ-I-16",
        name: "Malinche",
        ingredientValue: 6,
        ingredients:
          "3 Quesos, Queso de cabra, Champiñon, Jamon, Chile seco, Albahaca",
      },
      {
        id: "PZ-I-17",
        name: "Philadelphia",
        ingredientValue: 6,
        ingredients: "Queso philadelphia, Chile jalapeño, Jamon, Albahaca",
      },
      {
        id: "PZ-I-18",
        name: "3 Quesos",
        ingredientValue: 2,
      },
      {
        id: "PZ-I-19",
        name: "Albahaca",
        ingredientValue: 1,
      },
      {
        id: "PZ-I-20",
        name: "Arandano",
        ingredientValue: 1,
      },
      {
        id: "PZ-I-21",
        name: "Calabaza",
        ingredientValue: 1,
      },
      {
        id: "PZ-I-22",
        name: "Cebolla",
        ingredientValue: 1,
      },
      {
        id: "PZ-I-23",
        name: "Champiñon",
        ingredientValue: 1,
      },
      {
        id: "PZ-I-24",
        name: "Chile Seco",
        ingredientValue: 1,
      },
      {
        id: "PZ-I-25",
        name: "Chorizo",
        ingredientValue: 1,
      },
      { id: "PZ-I-26", name: "Elote", ingredientValue: 1 },
      {
        id: "PZ-I-27",
        name: "Chile Jalapeño",
        ingredientValue: 1,
      },
      { id: "PZ-I-28", name: "Jamon", ingredientValue: 1 },
      {
        id: "PZ-I-29",
        name: "Jitomate",
        ingredientValue: 1,
      },
      {
        id: "PZ-I-30",
        name: "Molida",
        ingredientValue: 1,
      },
      {
        id: "PZ-I-31",
        name: "Chile Morron",
        ingredientValue: 1,
      },
      {
        id: "PZ-I-32",
        name: "Pierna",
        ingredientValue: 2,
      },
      { id: "PZ-I-33", name: "Piña", ingredientValue: 1 },
      {
        id: "PZ-I-34",
        name: "Pollo BBQ",
        ingredientValue: 2,
      },
      {
        id: "PZ-I-35",
        name: "Queso de cabra",
        ingredientValue: 2,
      },
      {
        id: "PZ-I-36",
        name: "Salami",
        ingredientValue: 1,
      },
      {
        id: "PZ-I-37",
        name: "Salchicha",
        ingredientValue: 1,
      },
      {
        id: "PZ-I-38",
        name: "Tocino",
        ingredientValue: 1,
      },
      {
        id: "PZ-I-39",
        name: "Queso",
        ingredientValue: 0,
      },
      {
        id: "PZ-I-40",
        name: "Salsa de tomate",
        ingredientValue: 0,
      },
    ],
    modifierTypes: [
      {
        id: "PZ-M1",
        name: "Observaciones de Pizza",
        required: false,
        acceptsMultiple: true,
        modifiers: [
          {
            id: "PZ-M1-1",
            name: "Partida en 16 pedazos",
            price: 0,
          },
          {
            id: "PZ-M1-2",
            name: "Extra doradita",
            price: 0,
          },
          {
            id: "PZ-M1-3",
            name: "pizza con poco queso",
            price: 0,
          },
          {
            id: "PZ-M1-4",
            name: "extra salsa de tomate",
            price: 0,
          },
          { id: "PZ-M1-5", name: "con catsup", price: 0 },
          {
            id: "PZ-M1-6",
            name: "doble aderezo",
            price: 0,
          },
          {
            id: "PZ-M1-7",
            name: "doble chile de aceite",
            price: 0,
          },
          {
            id: "PZ-M1-8",
            name: "menos doradita",
            price: 0,
          },
        ],
      },
    ],
  },
];

const seedMenuItems = async (): Promise<void> => {
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

    // Crear la configuracion inicial del restaurante
    await RestaurantConfig.create({
      acceptingOrders: true,
      estimatedPickupTime: 20,
      estimatedDeliveryTime: 40,
    });

    // Añadir el número de teléfono de notificación por defecto
    await NotificationPhone.create({
      phoneNumber: "5213320407035",
      isActive: true,
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
