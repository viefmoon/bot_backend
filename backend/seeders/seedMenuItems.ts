import * as dotenv from "dotenv";
dotenv.config();
import { sequelize } from "../src/lib/db";
import Product from "../src/models/product";
import ProductVariant from "../src/models/productVariant";
import PizzaIngredient from "../src/models/pizzaIngredient"; 
import ModifierType from "../src/models/modifierType";
import Modifier from "../src/models/modifier";
import Subcategory from "../src/models/subcategory";
import Category from "../src/models/category";
import Availability from "../src/models/availability";
import RestaurantConfig from "../src/models/restaurantConfig";
import NotificationPhone from "../src/models/notificationPhone";
import logger from "../src/utils/logger";

const testConnection = async (): Promise<void> => {
  try {
    await sequelize.authenticate();
    logger.info("Conexión a la base de datos establecida con éxito.");
  } catch (error) {
    logger.error("No se pudo conectar a la base de datos:", error);
  }
};

testConnection();

const categories = [
  {
    id: "COM",
    name: "Comida",
    subcategories: [
      { id: "COM-S1", name: "Entradas" },
      { id: "COM-S2", name: "Pizzas" },
      { id: "COM-S3", name: "Hamburguesas" },
      { id: "COM-S4", name: "Ensaladas" },
    ],
  },
  {
    id: "BEB",
    name: "Bebida",
    subcategories: [
      { id: "BEB-S1", name: "Frappes y Postres" },
      { id: "BEB-S2", name: "Jarras" },
      { id: "BEB-S3", name: "Cocteleria" },
      { id: "BEB-S4", name: "Bebidas" },
      { id: "BEB-S5", name: "Cafe Caliente" },
      { id: "BEB-S6", name: "Refrescos" },
    ],
  },
];

const products = [
  {
    subcategoryName: "Bebidas",
    items: [
      { id: "AH", name: "Agua fresca de horchata", price: 35 },
      { id: "LIM", name: "Limonada", price: 35 },
      { id: "LIMM", name: "Limonada Mineral", price: 35 },
      { id: "BAC", name: "Botella agua chica", price: 15 },
      { id: "BAG", name: "Botella agua grande", price: 25 },
      { id: "SANP", name: "Sangria Preparada", price: 35 },
      {
        id: "CR",
        name: "Cerveza",
        productVariants: [
          { id: "CRV1", name: "Corona clara", price: 30 },
          { id: "CRV2", name: "Corona oscura", price: 30 },
          { id: "CRV3", name: "XX", price: 30 },
          { id: "CRV4", name: "Indio", price: 30 },
          { id: "CRV5", name: "Modelo", price: 30 },
          { id: "CRV6", name: "Heineken", price: 30 },
        ],
      },
      {
        id: "MICH",
        name: "Michelada",
        productVariants: [
          { id: "MV1", name: "Michelada clara", price: 80 },
          { id: "MV2", name: "Michelada oscura", price: 80 },
        ],
      },
      {
        id: "TE",
        name: "Te",
        productVariants: [
          { id: "TEV1", name: "Te Manzanilla", price: 30 },
          { id: "TEV2", name: "Te Limon", price: 30 },
          { id: "TEV3", name: "Te Verde", price: 30 },
        ],
      },
      { id: "BHA", name: "Hielo aparte", price: 0 },
      { id: "BSL", name: "Sal y limon", price: 0 },
    ],
  },
  {
    subcategoryName: "Refrescos",
    items: [
      { id: "SQU", name: "Squirt", price: 30 },
      { id: "MIR", name: "Mirinda", price: 30 },
      { id: "MAN", name: "Manzanita", price: 30 },
      { id: "7UP", name: "7up", price: 30 },
      { id: "CC", name: "Coca Cola", price: 30 },
      { id: "AGM", name: "Agua Mineral", price: 30 },
      { id: "SAN", name: "Sangria", price: 30 },
    ],
  },
  {
    subcategoryName: "Jarras",
    items: [
      { id: "JAQU", name: "Jarra Agua Fresca", price: 80 },
      { id: "JLIM", name: "Jarra Limonada", price: 80 },
      { id: "JMIC", name: "Jarra Michelada", price: 190 },
      { id: "JCLE", name: "Jarra Clericot", price: 250 },
      { id: "JSAN", name: "Jarra Sangria", price: 80 },
      { id: "JTVI", name: "Jarra Tinto de Verano", price: 250 },
      { id: "JHA", name: "Hielo aparte", price: 0 },
    ],
  },
  {
    subcategoryName: "Cafe Caliente",
    items: [
      { id: "CA", name: "Cafe Americano", price: 45 },
      { id: "CP", name: "Capuchino", price: 45 },
      { id: "CH", name: "Chocolate", price: 50 },
      { id: "LC", name: "Latte Capuchino", price: 50 },
      { id: "LV", name: "Latte Vainilla", price: 50 },
      { id: "MC", name: "Mocaccino", price: 50 },
    ],
  },
  {
    subcategoryName: "Frappes y Postres",
    items: [
      {
        id: "F",
        name: "Frappe",
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
        id: "PS",
        name: "Postre",
        price: 75,
        modifierTypes: [
          {
            id: "PS1",
            name: "Sabor",
            required: false,
            acceptsMultiple: false,
            modifiers: [
              { id: "PS1-1", name: "3 chocolates", price: 0 },
              { id: "PS1-2", name: "Mocaccino", price: 0 },
              { id: "PS1-3", name: "Tiramisu", price: 0 },
              { id: "PS1-4", name: "Flan rompope", price: 0 },
              { id: "PS1-5", name: "Chesecake", price: 0 },
            ],
          },
        ],
      },
    ],
  },
  {
    subcategoryName: "Cocteleria",
    items: [
      { id: "CARAJ", name: "Carajillo", price: 90 },
      { id: "CLERI", name: "Clericot", price: 80 },
      { id: "CG", name: "Conga", price: 75 },
      { id: "CV", name: "Copa Vino", price: 90 },
      { id: "DEST", name: "Destornillador", price: 75 },
      { id: "GMAR", name: "Gin Maracuya", price: 90 },
      { id: "GPEP", name: "Gin Pepino", price: 90 },
      { id: "MAR", name: "Margarita", price: 85 },
      { id: "MOJ", name: "Mojito", price: 100 },
      { id: "PAL", name: "Paloma", price: 80 },
      { id: "PSAN", name: "Palo Santo", price: 80 },
      { id: "PCOL", name: "Pina Colada", price: 75 },
      { id: "PINA", name: "Pinada", price: 70 },
      { id: "RBL", name: "Ruso Blanco", price: 85 },
      { id: "SV", name: "Sangria con Vino", price: 80 },
      { id: "TEQ", name: "Tequila", price: 90 },
      { id: "TV", name: "Tinto de Verano", price: 90 },
      { id: "VAMP", name: "Vampiro", price: 80 },
    ],
  },
  {
    subcategoryName: "Hamburguesas",
    items: [
      {
        id: "H",
        name: "Hamburguesa",
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
              "Carne de res, tocino, pierna, queso amarillo, queso blanco, cebolla, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
          },
          {
            id: "HV3",
            name: "Hamburguesa Hawaiana",
            price: 95,
            ingredients:
              "Carne de res, tocino, piña, jamon, queso amarillo, queso blanco, cebolla, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
          },
          {
            id: "HV4",
            name: "Hamburguesa Pollo",
            price: 100,
            ingredients:
              "Pollo a la plancha, tocino, queso amarillo, queso blanco, cebolla, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
          },
          {
            id: "HV5",
            name: "Hamburguesa BBQ",
            price: 100,
            ingredients:
              "Carne de res, salsa bbq, tocino, queso amarillo, queso blanco, cebolla guisada, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
          },
          {
            id: "HV6",
            name: "Hamburguesa Leñazo",
            price: 110,
            ingredients:
              "Doble carne de sirlon, tocino, queso amarillo, queso blanco, cebolla guisada, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
          },
          {
            id: "HV7",
            name: "Hamburguesa Cubana",
            price: 100,
            ingredients:
              "Carne de res, tocino, pierna, salchicha, jamon, queso amarillo, queso blanco, cebolla, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
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
                name: "Doble carne o pollo",
                price: 15,
              },
              {
                id: "HM2-2",
                name: "Pollo en lugar de carne de res",
                price: 15,
              },
            ],
          },
          {
            id: "HM3",
            name: "Quitar ingredientes Hamburguesa",
            required: false,
            acceptsMultiple: true,
            modifiers: [
              { id: "HM3-2", name: "Sin tocino", price: 0 },
              { id: "HM3-3", name: "Sin queso amarillo", price: 0 },
              { id: "HM3-4", name: "Sin queso blanco", price: 0 },
              { id: "HM3-5", name: "Sin cebolla", price: 0 },
              { id: "HM3-6", name: "Sin jitomate", price: 0 },
              { id: "HM3-7", name: "Sin lechuga", price: 0 },
              { id: "HM3-8", name: "Sin chile jalapeño", price: 0 },
              { id: "HM3-9", name: "Sin catsup", price: 0 },
              { id: "HM3-10", name: "Sin aderezo", price: 0 },
              { id: "HM3-11", name: "Sin crema", price: 0 },
              { id: "HM3-12", name: "Sin mostaza", price: 0 },
              { id: "HM3-13", name: "Sin pierna", price: 0 },
            ],
          },
        ],
      },
      { id: "DQ", name: "Dedos de queso", price: 90 },
    ],
  },
  {
    subcategoryName: "Entradas",
    items: [
      {
        id: "A",
        name: "Alitas",
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
            name: "Orden de Alitas Mixtas",
            price: 135,
          },
        ],
        modifierTypes: [
          {
            id: "AM1",
            name: "Modificadores Alitas",
            required: false,
            acceptsMultiple: true,
            modifiers: [
              {
                id: "AM1-1",
                name: "Extra salsa",
                price: 10,
              },
              {
                id: "AM1-2",
                name: "Con aderezo ranch",
                price: 10,
              },
              {
                id: "AM1-3",
                name: "Extra chile de aceite",
                price: 10,
              },
              {
                id: "AM1-4",
                name: "Extra doradas",
                price: 0,
              },
            ],
          },
        ],
      },
      {
        id: "P",
        name: "Orden de Papas",
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
                name: "Con queso",
                price: 0,
              },
              {
                id: "PM1-3",
                name: "Extra queso",
                price: 10,
              },
              {
                id: "PM1-4",
                name: "Extra aderezo",
                price: 0,
              },
            ],
          },
        ],
      },
    ],
  },
  {
    subcategoryName: "Ensaladas",
    items: [
      {
        id: "EN",
        name: "Ensalada",
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
                name: "Con vinagreta",
                price: 0,
              },
              {
                id: "EM1-2",
                name: "Extra pollo",
                price: 15,
              },
            ],
          },
          {
            id: "EM2",
            name: "Quitar ingredientes Ensalada",
            required: false,
            acceptsMultiple: true,
            modifiers: [
              { id: "EM2-1", name: "Sin pollo", price: 0 },
              { id: "EM2-2", name: "Sin chile morrón", price: 0 },
              { id: "EM2-3", name: "Sin elote", price: 0 },
              { id: "EM2-4", name: "Sin lechuga", price: 0 },
              { id: "EM2-5", name: "Sin jitomate", price: 0 },
              { id: "EM2-6", name: "Sin zanahoria", price: 0 },
              { id: "EM2-7", name: "Sin queso parmesano", price: 0 },
              { id: "EM2-8", name: "Sin aderezo", price: 0 },
              { id: "EM2-9", name: "Sin betabel crujiente", price: 0 },
              { id: "EM2-10", name: "Sin jamón", price: 0 },
            ],
          },
        ],
      },
    ],
  },
  {
    subcategoryName: "Pizzas",
    items: [
      {
        id: "PZ",
        name: "Pizza",
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
              { id: "PZ-M1-1", name: "Con catsup", price: 0 },
              {
                id: "PZ-M1-2",
                name: "Extra aderezo",
                price: 0,
              },
              {
                id: "PZ-M1-3",
                name: "Extra chile de aceite",
                price: 0,
              },
              {
                id: "PZ-M1-4",
                name: "Extra dorada",
                price: 0,
              },
              {
                id: "PZ-M1-5",
                name: "Menos dorada",
                price: 0,
              },
              {
                id: "PZ-M1-6",
                name: "Sin salsa",
                price: 0,
              },
            ],
          },
        ],
      },
      { id: "CHCH", name: "Chile chillon", price: 35 },
    ],
  },
];

const seedMenuItems = async (): Promise<void> => {
  try {
    // Crear categorías y subcategorías
    for (const category of categories) {
      const createdCategory = await Category.create({
        id: category.id,
        name: category.name,
      });
      for (const subcategory of category.subcategories) {
        await Subcategory.create({
          id: subcategory.id,
          name: subcategory.name,
          categoryId: createdCategory.id,
        });
      }
    }

    // Crear productos
    for (const productGroup of products) {
      const subcategory = await Subcategory.findOne({
        where: { name: productGroup.subcategoryName },
      });

      for (const item of productGroup.items) {
        const createdProduct = await Product.create({
          id: item.id,
          name: item.name,
          price: (item as any).price || null,
          subcategoryId: subcategory.id,
          ingredients: (item as any).ingredients || null,
        });

        // Crear disponibilidad para el producto
        await Availability.create({
          id: item.id,
          type: "product",
          available: true,
        });

        if ((item as any).productVariants) {
          for (const variant of (item as any).productVariants) {
            await ProductVariant.create({
              id: variant.id,
              name: variant.name,
              price: variant.price,
              productId: createdProduct.id,
              ingredients: (variant as any).ingredients || null,
            });

            // Crear disponibilidad para la variante del producto
            await Availability.create({
              id: variant.id,
              type: "productVariant",
              available: true,
            });
          }
        }

        if ((item as any).pizzaIngredients) {
          for (const ingredient of (item as any).pizzaIngredients) {
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

        if ((item as any).modifierTypes) {
          for (const modifierType of (item as any).modifierTypes) {
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

    logger.info("Los elementos del menú, la disponibilidad y la configuración del restaurante se han sembrado con éxito.");
  } catch (error) {
    logger.error("Error al sembrar los elementos del menú, la disponibilidad y la configuración del restaurante:", error);
  } finally {
    await sequelize.close();
  }
};

seedMenuItems();
