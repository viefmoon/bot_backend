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
    name: "Alitas",
    category: "entradas",
    keywords: ["alitas", "alas"],
    productVariants: [
      {
        id: "AV1",
        name: "Orden de Alitas BBQ",
        price: 135,
        keywords: ["bbq", "barbecue"],
      },
      {
        id: "AV2",
        name: "Media Orden de Alitas BBQ",
        price: 70,
        keywords: [["bbq", "barbecue"], ["media"]],
      },
      {
        id: "AV3",
        name: "Orden de Alitas Picosas",
        price: 135,
        keywords: ["picosas", "picosa", "picositas", "buffalo"],
      },
      {
        id: "AV4",
        name: "Media Orden de Alitas Picosas",
        price: 70,
        keywords: [["picosas", "picosa", "picositas", "buffalo"], ["media"]],
      },
      {
        id: "AV5",
        name: "Orden de Alitas Fritas",
        price: 135,
        keywords: ["fritas"],
      },
      {
        id: "AV6",
        name: "Media Orden de Alitas Fritas",
        price: 70,
        keywords: [["fritas"], ["media"]],
      },
      {
        id: "AV7",
        name: "Orden de Alitas Mixtas BBQ y picosas",
        price: 135,
        keywords: [
          "bbq",
          "barbecue",
          "picosas",
          "picosa",
          "picositas",
          "buffalo",
          "mixtas",
          "mixta",
        ],
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
            name: "Mas doradas",
            price: 0,
            keywords: ["doradas"],
          },
          {
            id: "AM1-2",
            name: "Menos doradas",
            price: 0,
            keywords: ["doradas"],
          },
          {
            id: "AM1-3",
            name: "Extra salsa",
            price: 0,
            keywords: ["salsa", "mas"],
          },
          {
            id: "AM1-4",
            name: "Arregladas con verdura y totopos",
            price: 0,
            keywords: ["verdura", "totopos", "arregladas"],
          },
          { id: "AM1-5", name: "Aderezo ranch", price: 0, keywords: ["ranch"] },
          {
            id: "AM1-6",
            name: "Salsa picosa aparte",
            price: 0,
            keywords: ["aparte"],
          },
          {
            id: "AM1-7",
            name: "Salsa BBQ aparte",
            price: 0,
            keywords: ["aparte"],
          },
          {
            id: "AM1-8",
            name: "Extra chile de aceite",
            price: 0,
            keywords: ["aceite", "chile"],
          },
        ],
      },
    ],
  },
  {
    id: "P",
    name: "Papas gratinadas",
    keywords: ["papas", "gajos", "francesa"],
    category: "entradas",
    productVariants: [
      {
        id: "PV1",
        name: "Orden de Papas gratinadas a la Francesa",
        keywords: ["francesa"],
        price: 90,
      },
      {
        id: "PV2",
        name: "Media Orden de Papas a la Francesa",
        keywords: [["francesa"], ["media"]],
        price: 50,
      },
      {
        id: "PV3",
        name: "Orden de Papas gratinadas Gajos",
        keywords: ["gajo"],
        price: 100,
      },
      {
        id: "PV4",
        name: "Media Orden de Papas gratinadas Gajos",
        keywords: [["gajo"], ["media"]],
        price: 60,
      },
      {
        id: "PV5",
        name: "Orden de Papas gratinadas Mixtas francesa y gajos",
        keywords: ["mixtas", "mixta", "francesa", "gajo"],
        price: 100,
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
            keywords: [
              ["sin", "retirar", "quitar"],
              ["queso", "gratinar"],
            ],
            price: 0,
          },
          {
            id: "PM1-2",
            name: "Extra aderezo",
            keywords: ["aderezo"],
            price: 0,
          },
          {
            id: "PM1-3",
            name: "Con chile de aceite",
            keywords: ["aceite", "chile"],
            price: 0,
          },
        ],
      },
    ],
  },
  {
    id: "D",
    name: "Dedos de Queso",
    keywords: ["dedos"],
    category: "entradas",
    price: 90,
  },
  {
    id: "E",
    name: "Ensaladas",
    keywords: ["ensalada"],
    category: "comida",
    productVariants: [
      {
        id: "EV1",
        name: "Ensalada de Pollo Chica",
        keywords: [["pollo"], ["chica"]],
        price: 90,
        ingredients:
          "Pollo a la plancha, Chile morron, Elote, Lechuga, Jitomate, Zanahoria, Queso parmesano, Aderezo, Betabel crujiente",
      },
      {
        id: "EV2",
        name: "Ensalada de Pollo Grande",
        keywords: [["pollo"], ["grande"]],
        price: 120,
        ingredients:
          "Pollo a la plancha, Chile morron, Elote, Lechuga, Jitomate, Zanahoria, Queso parmesano, Aderezo, Betabel crujiente",
      },
      {
        id: "EV3",
        name: "Ensalada de Jamon Chica",
        keywords: [["jamon"], ["chica"]],
        price: 80,
        ingredients:
          "Jamon, Lechuga, Chile morron, Elote, Jitomate, Zanahoria, Queso parmesano, Aderezo, Betabel crujiente",
      },
      {
        id: "EV4",
        name: "Ensalada de Jamon Grande",
        keywords: [["jamon"], ["grande"]],
        price: 100,
        ingredients:
          "Jamon, Lechuga, Chile morron, Elote, Jitomate, Zanahoria, Queso parmesano, Aderezo, Betabel crujiente",
      },
      {
        id: "EV5",
        name: "Ensalada Vegetal Chica",
        keywords: [["vegetal"], ["chica"]],
        price: 70,
        ingredients:
          "Lechuga, Chile morron, Elote, Jitomate, Zanahoria, Queso parmesano, Aderezo, Betabel crujiente",
      },
      {
        id: "EV6",
        name: "Ensalada Vegetal Grande",
        keywords: [["vegetal"], ["grande"]],
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
            id: "EM1-3",
            name: "Con vinagreta",
            keywords: ["vinagreta"],
            price: 0,
          },
          {
            id: "EM1-4",
            name: "Doble pollo",
            keywords: [["doble", "con", "extra"], ["pollo"]],
            price: 15,
          },
          {
            id: "EM1-5",
            name: "Doble vinagreta",
            keywords: [["doble", "con", "extra"], ["vinagreta"]],
            price: 0,
          },
        ],
      },
    ],
  },
  {
    id: "H",
    name: "Hamburguesas",
    keywords: ["hamburguesa"],
    category: "comida",
    productVariants: [
      {
        id: "HV1",
        name: "Hamburgesa Tradicional",
        keywords: ["tradicional"],
        price: 85,
        ingredients:
          "Carne de res, tocino, queso amarillo, queso asadero, cebolla, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
      },
      {
        id: "HV2",
        name: "Hamburgesa Especial",
        keywords: ["especial"],
        price: 95,
        ingredients:
          "Carne de res, tocino, pierna, queso amarillo, queso asadero, cebolla, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
      },
      {
        id: "HV3",
        name: "Hamburgesa Hawaiana",
        keywords: ["hawaiana", "piña"],
        price: 95,
        ingredients:
          "Carne de res, tocino, piña, jamon, queso amarillo, queso asadero, cebolla, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
      },
      {
        id: "HV4",
        name: "Hamburgesa Pollo",
        keywords: ["pollo"],
        price: 100,
        ingredients:
          "Pollo a la plancha, tocino, queso amarillo, queso asadero, cebolla, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
      },
      {
        id: "HV5",
        name: "Hamburgesa BBQ",
        keywords: ["bbq", "barbecue"],
        price: 100,
        ingredients:
          "Carne de res, salsa bbq, tocino, queso amarillo, queso asadero, cebolla guisada, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
      },
      {
        id: "HV6",
        name: "Hamburgesa Leñazo",
        keywords: ["lenazo"],
        price: 110,
        ingredients:
          "Doble carne de sirlon, tocino, queso amarillo, queso asadero, cebolla guisada, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
      },
      {
        id: "HV7",
        name: "Hamburgesa Cubana",
        keywords: ["cubana"],
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
            keywords: ["papas", "francesa"],
            price: 10,
          },
          {
            id: "HM1-2",
            name: "Con papas francesa gratinadas",
            keywords: [
              ["gratinadas", "queso"],
              ["francesa", "papas"],
            ],
            price: 15,
          },
          { id: "HM1-3", name: "Con gajos", keywords: ["gajos"], price: 15 },
          {
            id: "HM1-4",
            name: "Con gajos gratinadas",
            keywords: [["gratinadas", "queso"], ["gajos"]],
            price: 20,
          },
          {
            id: "HM1-5",
            name: "Con papas mixtas",
            keywords: ["mixtas", "combinadas", "mixta", "francesa", "gajos"],
            price: 15,
          },
          {
            id: "HM1-6",
            name: "Con papas mixtas gratinadas",
            keywords: [
              ["gratinadas", "queso"],
              ["mixtas", "combinadas", "mixta", "francesa", "gajos"],
            ],
            price: 20,
          },
        ],
      },
      {
        id: "HM2",
        name: "Extras Hamburguesas",
        required: false,
        acceptsMultiple: true,
        modifiers: [
          {
            id: "HM2-1",
            name: "Partida en 2 mitades",
            keywords: ["mitad", "partida"],
            price: 0,
          },
          {
            id: "HM2-3",
            name: "Doble carne o pollo",
            keywords: ["doble", "carne", "pollo"],
            price: 15,
          },
          {
            id: "HM2-4",
            name: "Pollo en lugar de carne de res",
            keywords: ["pollo", "res"],
            price: 15,
          },
          {
            id: "HM2-5",
            name: "Con ensalada",
            keywords: ["ensalada"],
            price: 15,
          },
          {
            id: "HM2-6",
            name: "Carne bien dorada",
            keywords: ["dorada", "carne"],
            price: 0,
          },
        ],
      },
    ],
  },
  {
    id: "AH",
    name: "Agua fresca de horchata 1 Litro",
    keywords: ["Agua", "horchata", "Fresca"],
    category: "bebidas",
    price: 35,
  },
  {
    id: "LIM",
    name: "Limonada 1 Litro",
    keywords: ["limonada"],
    category: "bebidas",
    price: 35,
  },
  {
    id: "LIMM",
    name: "Limonada Mineral 1 Litro",
    keywords: ["mineral"],
    category: "bebidas",
    price: 35,
  },
  {
    id: "RCC",
    name: "Refresco de Coca Cola",
    keywords: ["coca"],
    category: "bebidas",
    price: 30,
  },
  {
    id: "R7UP",
    name: "Refresco 7up",
    keywords: ["7up", "seven"],
    category: "bebidas",
    price: 30,
  },
  {
    id: "RMIR",
    name: "Refresco Mirinda",
    keywords: ["mirinda"],
    category: "bebidas",
    price: 30,
  },
  {
    id: "RSAN",
    name: "Refresco de Sangria",
    keywords: ["sangria"],
    category: "bebidas",
    price: 30,
  },
  {
    id: "RAM",
    name: "Agua Mineral",
    keywords: ["mineral"],
    category: "bebidas",
    price: 30,
  },
  {
    id: "RSQU",
    name: "Squirt",
    keywords: ["squirt"],
    category: "bebidas",
    price: 30,
  },
  {
    id: "SANP",
    name: "Sangria preparada",
    keywords: ["sangria"],
    category: "bebidas",
    price: 35,
  },
  {
    id: "MICH",
    name: "Micheladas",
    keywords: ["michelada"],
    category: "bebidas",
    productVariants: [
      { id: "MV1", name: "Michelada clara", price: 80, keywords: ["clara"] },
      { id: "MV2", name: "Michelada oscura", price: 80, keywords: ["oscura"] },
    ],
  },
  {
    id: "CA",
    name: "Cafe Americano",
    keywords: ["cafe", "americano"],
    category: "bebidas",
    price: 45,
  },
  {
    id: "CP",
    name: "Capuchino",
    keywords: ["capuchino"],
    category: "bebidas",
    price: 45,
  },
  {
    id: "CH",
    name: "Chocolate",
    keywords: ["chocolate"],
    category: "bebidas",
    price: 50,
  },
  {
    id: "MC",
    name: "Mocachino",
    keywords: ["mocachino"],
    category: "bebidas",
    price: 45,
  },
  {
    id: "LV",
    name: "Latte Vainilla",
    keywords: ["latte", "vainilla"],
    category: "bebidas",
    price: 45,
  },
  {
    id: "LC",
    name: "Latte Capuchino",
    keywords: ["latte", "capuchino"],
    category: "bebidas",
    price: 45,
  },
  {
    id: "F",
    name: "Frappes",
    keywords: ["frappe"],
    category: "bebidas",
    productVariants: [
      {
        id: "FV1",
        name: "Frappe Capuchino",
        price: 70,
        keywords: ["capuchino"],
      },
      { id: "FV2", name: "Frappe Coco", price: 70, keywords: ["coco"] },
      { id: "FV3", name: "Frappe Caramelo", price: 70, keywords: ["caramelo"] },
      { id: "FV4", name: "Frappe Cajeta", price: 70, keywords: ["cajeta"] },
      {
        id: "FV5",
        name: "Frappe Mocaccino",
        price: 70,
        keywords: ["mocaccino"],
      },
      { id: "FV6", name: "Frappe Galleta", price: 70, keywords: ["galleta"] },
      { id: "FV7", name: "Frappe Bombon", price: 70, keywords: ["bombon"] },
      { id: "FV8", name: "Frappe Rompope", price: 85, keywords: ["rompope"] },
      { id: "FV9", name: "Frappe Mazapan", price: 85, keywords: ["mazapan"] },
      { id: "FV10", name: "Frappe Magnum", price: 85, keywords: ["magnum"] },
    ],
  },
  {
    id: "CV",
    name: "Copa de vino",
    keywords: ["vino"],
    category: "cocteleria",
    price: 90,
  },
  {
    id: "SV",
    name: "Sangria con vino",
    keywords: ["sangria", "vino"],
    category: "cocteleria",
    price: 80,
  },
  {
    id: "VAMP",
    name: "Vampiro",
    keywords: ["vampiro"],
    category: "cocteleria",
    price: 80,
  },
  {
    id: "GMAR",
    name: "Gin de Maracuya",
    keywords: ["maracuya", "gin"],
    category: "cocteleria",
    price: 90,
  },
  {
    id: "MAR",
    name: "Margarita",
    keywords: ["margarita"],
    category: "cocteleria",
    price: 85,
  },
  {
    id: "RBL",
    name: "Ruso Blanco",
    keywords: ["ruso", "blanco"],
    category: "cocteleria",
    price: 85,
  },
  {
    id: "PSAN",
    name: "Palo santo",
    keywords: ["palo", "santo"],
    category: "cocteleria",
    price: 80,
  },
  {
    id: "GPEP",
    name: "Gin de pepino",
    keywords: ["pepino", "gin"],
    category: "cocteleria",
    price: 90,
  },
  {
    id: "MOJ",
    name: "Mojito",
    keywords: ["mojito"],
    category: "cocteleria",
    price: 100,
  },
  {
    id: "PCOL",
    name: "Piña colada",
    keywords: ["colada"],
    category: "cocteleria",
    price: 75,
  },
  {
    id: "PINA",
    name: "Piñada",
    keywords: ["piñada"],
    category: "cocteleria",
    price: 70,
  },
  {
    id: "CG",
    name: "Conga",
    keywords: ["conga"],
    category: "cocteleria",
    price: 75,
  },
  {
    id: "DEST",
    name: "Destornillador",
    keywords: ["destornillador"],
    category: "cocteleria",
    price: 75,
  },
  {
    id: "PAL",
    name: "Paloma",
    keywords: ["paloma"],
    category: "cocteleria",
    price: 80,
  },
  {
    id: "CARAJ",
    name: "Carajillo",
    keywords: ["carajillo"],
    category: "cocteleria",
    price: 90,
  },
  {
    id: "TV",
    name: "Tinto de verano",
    keywords: ["tinto", "verano"],
    category: "cocteleria",
    price: 90,
  },
  {
    id: "CLERI",
    name: "Clericot",
    keywords: ["clericot"],
    category: "cocteleria",
    price: 80,
  },
  {
    id: "PZ",
    name: "Pizza",
    keywords: ["pizza"],
    category: "comida",
    productVariants: [
      { id: "PZ-V-G", name: "Pizza Grande", keywords: ["grande"], price: 240 },
      {
        id: "PZ-V-M",
        name: "Pizza Mediana",
        keywords: ["mediana"],
        price: 190,
      },
      { id: "PZ-V-CH", name: "Pizza Chica", keywords: ["chica"], price: 140 },
      {
        id: "PZ-V-GR",
        name: "Pizza Grande Con Orilla Rellena de Queso",
        keywords: [["grande"], ["orilla", "relleno", "rellena", "borde"]],
        price: 270,
      },
      {
        id: "PZ-V-MR",
        name: "Pizza Mediana Con Orilla Rellena de Queso",
        keywords: [["mediana"], ["orilla", "relleno", "rellena", "borde"]],
        price: 220,
      },
      {
        id: "PZ-V-CHR",
        name: "Pizza Chica Con Orilla Rellena de Queso",
        keywords: [["chica"], ["orilla", "relleno", "rellena", "borde"]],
        price: 160,
      },
    ],
    pizzaIngredients: [
      {
        id: "PZ-I-1",
        name: "Especial",
        keywords: ["especial"],
        ingredientValue: 4,
        ingredients: "Pepperoni, Salchicha, Jamon, Salami, Chile morron",
      },
      {
        id: "PZ-I-2",
        name: "Carnes Frias",
        keywords: ["carnes", "frias"],
        ingredientValue: 4,
        ingredients: "Pepperoni, Salchicha, Jamon, Salami",
      },
      {
        id: "PZ-I-3",
        name: "Carranza",
        keywords: ["carranza"],
        ingredientValue: 4,
        ingredients: "Chorizo, Jamon, Chile jalapeño, Jitomate",
      },
      {
        id: "PZ-I-4",
        name: "Zapata",
        keywords: ["zapata"],
        ingredientValue: 4,
        ingredients: "Salami, Jamon, Champiñon",
      },
      {
        id: "PZ-I-5",
        name: "Villa",
        keywords: ["villa"],
        ingredientValue: 4,
        ingredients: "Chorizo, Tocino, Piña, Chile jalapeño",
      },
      {
        id: "PZ-I-6",
        name: "Margarita",
        keywords: ["margarita"],
        ingredientValue: 4,
        ingredients: "3 Quesos, Jitomate, Albahaca",
      },
      {
        id: "PZ-I-7",
        name: "Adelita",
        keywords: ["adelita"],
        ingredientValue: 4,
        ingredients: "Jamon, Piña, Arandano",
      },
      {
        id: "PZ-I-8",
        name: "Hawaiana",
        keywords: ["hawaiana"],
        ingredientValue: 4,
        ingredients: "Jamon, Piña",
      },
      {
        id: "PZ-I-9",
        name: "Mexicana",
        keywords: ["mexicana"],
        ingredientValue: 4,
        ingredients: "Chorizo, Cebolla, Chile jalapeño, Jitomate",
      },
      {
        id: "PZ-I-10",
        name: "Rivera",
        keywords: ["rivera"],
        ingredientValue: 4,
        ingredients: "Elote, Champiñon, Chile morron",
      },
      {
        id: "PZ-I-11",
        name: "Kahlo",
        keywords: ["kahlo"],
        ingredientValue: 4,
        ingredients: "Calabaza, Elote, Champiñon, Jitomate, Chile morron",
      },
      {
        id: "PZ-I-12",
        name: "Lupita",
        keywords: ["lupita"],
        ingredientValue: 4,
        ingredients: "Carne molida, Tocino, Cebolla, Chile morron",
      },
      {
        id: "PZ-I-13",
        name: "Pepperoni",
        keywords: ["pepperoni"],
        ingredientValue: 4,
        ingredients: "Pepperoni",
      },
      {
        id: "PZ-I-14",
        name: "La Leña",
        keywords: ["leña"],
        ingredientValue: 6,
        ingredients: "Tocino, Pierna, Chorizo, Carne molida",
      },
      {
        id: "PZ-I-15",
        name: "La Maria",
        keywords: ["maria"],
        ingredientValue: 6,
        ingredients: "Pollo BBQ, Piña, Chile jalapeño",
      },
      {
        id: "PZ-I-16",
        name: "Malinche",
        keywords: ["malinche"],
        ingredientValue: 6,
        ingredients:
          "3 Quesos, Queso de cabra, Champiñon, Jamon, Chile seco, Albahaca",
      },
      {
        id: "PZ-I-17",
        name: "Philadelphia",
        keywords: ["philadelphia"],
        ingredientValue: 6,
        ingredients: "Queso philadelphia, Chile jalapeño, Jamon, Albahaca",
      },
      {
        id: "PZ-I-18",
        name: "3 Quesos",
        keywords: ["3", "tres"],
        ingredientValue: 2,
      },
      {
        id: "PZ-I-19",
        name: "Albahaca",
        keywords: ["albahaca"],
        ingredientValue: 1,
      },
      {
        id: "PZ-I-20",
        name: "Arandano",
        keywords: ["arandano"],
        ingredientValue: 1,
      },
      {
        id: "PZ-I-21",
        name: "Calabaza",
        keywords: ["calabaza"],
        ingredientValue: 1,
      },
      {
        id: "PZ-I-22",
        name: "Cebolla",
        keywords: ["cebolla"],
        ingredientValue: 1,
      },
      {
        id: "PZ-I-23",
        name: "Champiñon",
        keywords: ["champiñon"],
        ingredientValue: 1,
      },
      {
        id: "PZ-I-24",
        name: "Chile Seco",
        keywords: ["seco"],
        ingredientValue: 1,
      },
      {
        id: "PZ-I-25",
        name: "Chorizo",
        keywords: ["chorizo"],
        ingredientValue: 1,
      },
      { id: "PZ-I-26", name: "Elote", keywords: ["elote"], ingredientValue: 1 },
      {
        id: "PZ-I-27",
        name: "Chile Jalapeño",
        keywords: ["jalapeño"],
        ingredientValue: 1,
      },
      { id: "PZ-I-28", name: "Jamon", keywords: ["jamon"], ingredientValue: 1 },
      {
        id: "PZ-I-29",
        name: "Jitomate",
        keywords: ["jitomate"],
        ingredientValue: 1,
      },
      {
        id: "PZ-I-30",
        name: "Molida",
        keywords: ["molida"],
        ingredientValue: 1,
      },
      {
        id: "PZ-I-31",
        name: "Chile Morron",
        keywords: ["morron"],
        ingredientValue: 1,
      },
      {
        id: "PZ-I-32",
        name: "Pierna",
        keywords: ["pierna"],
        ingredientValue: 2,
      },
      { id: "PZ-I-33", name: "Piña", keywords: ["piña"], ingredientValue: 1 },
      {
        id: "PZ-I-34",
        name: "Pollo BBQ",
        keywords: ["bbq"],
        ingredientValue: 2,
      },
      {
        id: "PZ-I-35",
        name: "Queso de cabra",
        keywords: ["cabra"],
        ingredientValue: 2,
      },
      {
        id: "PZ-I-36",
        name: "Salami",
        keywords: ["salami"],
        ingredientValue: 1,
      },
      {
        id: "PZ-I-37",
        name: "Salchicha",
        keywords: ["salchicha"],
        ingredientValue: 1,
      },
      {
        id: "PZ-I-38",
        name: "Tocino",
        keywords: ["tocino"],
        ingredientValue: 1,
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
            keywords: ["pedazos"],
            price: 0,
          },
          {
            id: "PZ-M1-2",
            name: "mas doradita",
            keywords: ["doradita"],
            price: 0,
          },
          { id: "PZ-M1-3", name: "poco queso", keywords: ["queso"], price: 0 },
          { id: "PZ-M1-4", name: "sin queso", keywords: ["queso"], price: 0 },
          {
            id: "PZ-M1-5",
            name: "sin salsa de tomate",
            keywords: ["salsa"],
            price: 0,
          },
          {
            id: "PZ-M1-6",
            name: "extra salsa de tomate",
            keywords: ["salsa"],
            price: 0,
          },
          { id: "PZ-M1-7", name: "con catsup", keywords: ["catsup"], price: 0 },
          {
            id: "PZ-M1-8",
            name: "doble aderezo",
            keywords: ["aderezo"],
            price: 0,
          },
          {
            id: "PZ-M1-9",
            name: "doble chile de aceite",
            keywords: ["aceite"],
            price: 0,
          },
        ],
      },
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
        keywords: product.keywords || null,
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
            keywords: productVariant.keywords || null,
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
            keywords: ingredient.keywords || null,
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
                keywords: modifier.keywords || null,
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
