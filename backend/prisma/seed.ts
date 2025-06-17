import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from the correct path
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function main() {
  console.log('Starting complete seed...');

  // Check if already seeded
  const existingCategories = await prisma.category.count();
  if (existingCategories > 0) {
    console.log('Database already seeded. Cleaning up...');
    // Clean up existing data
    await prisma.modifier.deleteMany();
    await prisma.modifierType.deleteMany();
    await prisma.pizzaIngredient.deleteMany();
    await prisma.productVariant.deleteMany();
    await prisma.product.deleteMany();
    await prisma.subcategory.deleteMany();
    await prisma.category.deleteMany();
    await prisma.businessHours.deleteMany();
    await prisma.restaurantConfig.deleteMany();
  }

  // Create restaurant config with business hours
  const restaurantConfig = await prisma.restaurantConfig.create({
    data: {
      // Información básica del restaurante
      restaurantName: "La Leña",
      phoneMain: "3919160126",
      phoneSecondary: "3338423316",
      address: "C. Ogazón Sur 36, Centro",
      city: "Tototlán",
      state: "Jalisco",
      postalCode: "47730",
      
      // Configuración de operación
      acceptingOrders: true,
      estimatedPickupTime: 20,
      estimatedDeliveryTime: 40,
      openingGracePeriod: 30,
      closingGracePeriod: 30,
      timeZone: "America/Mexico_City",
      
      // Configuración de delivery (ejemplo para Tototlán, Jalisco)
      deliveryCoverageArea: [
        [20.5320, -102.8690],  // Norte
        [20.5280, -102.8650],  // Este
        [20.5240, -102.8690],  // Sur
        [20.5280, -102.8730],  // Oeste
        [20.5320, -102.8690]   // Cierre del polígono
      ],
      centerLatitude: 20.5280,
      centerLongitude: -102.8690
    }
  });

  // Create business hours for each day of the week
  const businessHours = [
    { dayOfWeek: 0, openingTime: "14:00", closingTime: "21:00", isClosed: false }, // Domingo
    { dayOfWeek: 1, openingTime: null, closingTime: null, isClosed: true },       // Lunes (cerrado)
    { dayOfWeek: 2, openingTime: "14:00", closingTime: "22:00", isClosed: false }, // Martes
    { dayOfWeek: 3, openingTime: "14:00", closingTime: "22:00", isClosed: false }, // Miércoles
    { dayOfWeek: 4, openingTime: "14:00", closingTime: "22:00", isClosed: false }, // Jueves
    { dayOfWeek: 5, openingTime: "14:00", closingTime: "22:00", isClosed: false }, // Viernes
    { dayOfWeek: 6, openingTime: "14:00", closingTime: "22:00", isClosed: false }, // Sábado
  ];

  for (const hours of businessHours) {
    await prisma.businessHours.create({
      data: {
        ...hours,
        restaurantConfigId: restaurantConfig.id
      }
    });
  }

  // Create categories and subcategories
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

  for (const cat of categories) {
    await prisma.category.create({
      data: {
        id: cat.id,
        name: cat.name,
        isActive: true,
        subcategories: {
          create: cat.subcategories.map(sub => ({
            id: sub.id,
            name: sub.name,
            isActive: true
          }))
        }
      }
    });
  }

  // Create products
  const products = [
    // BEBIDAS
    {
      id: "AH",
      name: "Agua fresca de horchata",
      shortName: "Horchata",
      price: 35,
      subcategoryId: "BEB-S4",
    },
    {
      id: "LIM",
      name: "Limonada",
      shortName: "Limonada", 
      price: 35,
      subcategoryId: "BEB-S4",
    },
    {
      id: "LIMM",
      name: "Limonada Mineral",
      shortName: "Lim. Mineral",
      price: 35,
      subcategoryId: "BEB-S4",
    },
    {
      id: "SANP",
      name: "Sangria Preparada",
      shortName: "Sang. Preparada",
      price: 35,
      subcategoryId: "BEB-S4",
    },
    {
      id: "MC",
      name: "Michelada",
      shortName: "Michelada",
      subcategoryId: "BEB-S4",
      variants: [
        { id: "MCV1", name: "Michelada clara", shortName: "Michelada clara", price: 80 },
        { id: "MCV2", name: "Michelada oscura", shortName: "Michelada oscura", price: 80 },
      ],
    },
    // REFRESCOS
    {
      id: "CC",
      name: "Coca Cola",
      shortName: "Coca",
      price: 30,
      subcategoryId: "BEB-S6",
    },
    {
      id: "SAN",
      name: "Sangria",
      shortName: "Sangria",
      price: 30,
      subcategoryId: "BEB-S6",
    },
    {
      id: "SQU",
      name: "Squirt",
      shortName: "Squirt",
      price: 30,
      subcategoryId: "BEB-S6",
    },
    {
      id: "MIR",
      name: "Mirinda",
      shortName: "Mirinda",
      price: 30,
      subcategoryId: "BEB-S6",
    },
    {
      id: "MAN",
      name: "Manzanita",
      shortName: "Manzanita",
      price: 30,
      subcategoryId: "BEB-S6",
    },
    {
      id: "7UP",
      name: "7up",
      shortName: "7up",
      price: 30,
      subcategoryId: "BEB-S6",
    },
    {
      id: "AGM",
      name: "Agua Mineral",
      shortName: "Agua Mineral",
      price: 30,
      subcategoryId: "BEB-S6",
    },
    // CAFE CALIENTE
    {
      id: "CA",
      name: "Cafe Americano",
      shortName: "Cafe Americano",
      price: 45,
      subcategoryId: "BEB-S5",
    },
    {
      id: "CP",
      name: "Capuchino",
      shortName: "Capuchino",
      price: 45,
      subcategoryId: "BEB-S5",
    },
    {
      id: "CH",
      name: "Chocolate",
      shortName: "Chocolate",
      price: 50,
      subcategoryId: "BEB-S5",
    },
    {
      id: "LC",
      name: "Latte Capuchino",
      shortName: "Latte Capuchino",
      price: 50,
      subcategoryId: "BEB-S5",
    },
    {
      id: "LV",
      name: "Latte Vainilla",
      shortName: "Latte Vainilla",
      price: 50,
      subcategoryId: "BEB-S5",
    },
    {
      id: "MCC",
      name: "Mocaccino",
      shortName: "Mocaccino",
      price: 50,
      subcategoryId: "BEB-S5",
    },
    // FRAPPES Y POSTRES
    {
      id: "F",
      name: "Frappe",
      shortName: "Frappe",
      subcategoryId: "BEB-S1",
      variants: [
        { id: "FV1", name: "Frappe Capuchino", shortName: "Frappe Capuchino", price: 70 },
        { id: "FV2", name: "Frappe Coco", shortName: "Frappe Coco", price: 70 },
        { id: "FV3", name: "Frappe Caramelo", shortName: "Frappe Caramelo", price: 70 },
        { id: "FV4", name: "Frappe Cajeta", shortName: "Frappe Cajeta", price: 70 },
        { id: "FV5", name: "Frappe Mocaccino", shortName: "Frappe Mocaccino", price: 70 },
        { id: "FV6", name: "Frappe Galleta", shortName: "Frappe Galleta", price: 70 },
        { id: "FV7", name: "Frappe Bombon", shortName: "Frappe Bombon", price: 70 },
        { id: "FV8", name: "Frappe Rompope", shortName: "Frappe Rompope", price: 85 },
        { id: "FV9", name: "Frappe Mazapan", shortName: "Frappe Mazapan", price: 85 },
        { id: "FV10", name: "Frappe Magnum", shortName: "Frappe Magnum", price: 85 },
      ],
    },
    // COCTELERIA
    {
      id: "CARAJ",
      name: "Carajillo",
      shortName: "Carajillo",
      price: 90,
      subcategoryId: "BEB-S3",
    },
    {
      id: "CLERI",
      name: "Clericot",
      shortName: "Clericot",
      price: 80,
      subcategoryId: "BEB-S3",
    },
    {
      id: "CG",
      name: "Conga",
      shortName: "Conga",
      price: 75,
      subcategoryId: "BEB-S3",
    },
    {
      id: "CV",
      name: "Copa Vino",
      shortName: "Copa Vino",
      price: 90,
      subcategoryId: "BEB-S3",
    },
    {
      id: "DEST",
      name: "Destornillador",
      shortName: "Destornillador",
      price: 75,
      subcategoryId: "BEB-S3",
    },
    {
      id: "GMAR",
      name: "Gin Maracuya",
      shortName: "Gin Maracuya",
      price: 90,
      subcategoryId: "BEB-S3",
    },
    {
      id: "GPEP",
      name: "Gin Pepino",
      shortName: "Gin Pepino",
      price: 90,
      subcategoryId: "BEB-S3",
    },
    {
      id: "MAR",
      name: "Margarita",
      shortName: "Margarita",
      price: 85,
      subcategoryId: "BEB-S3",
    },
    {
      id: "MOJ",
      name: "Mojito",
      shortName: "Mojito",
      price: 100,
      subcategoryId: "BEB-S3",
    },
    {
      id: "PAL",
      name: "Paloma",
      shortName: "Paloma",
      price: 80,
      subcategoryId: "BEB-S3",
    },
    {
      id: "PSAN",
      name: "Palo Santo",
      shortName: "Palo Santo",
      price: 80,
      subcategoryId: "BEB-S3",
    },
    {
      id: "PCOL",
      name: "Pina Colada",
      shortName: "Pina Colada",
      price: 75,
      subcategoryId: "BEB-S3",
    },
    {
      id: "PINA",
      name: "Pinada",
      shortName: "Pinada",
      price: 70,
      subcategoryId: "BEB-S3",
    },
    {
      id: "RBL",
      name: "Ruso Blanco",
      shortName: "Ruso Blanco",
      price: 85,
      subcategoryId: "BEB-S3",
    },
    {
      id: "SV",
      name: "Sangria con Vino",
      shortName: "Sangria con Vino",
      price: 80,
      subcategoryId: "BEB-S3",
    },
    {
      id: "TEQ",
      name: "Tequila",
      shortName: "Tequila",
      price: 90,
      subcategoryId: "BEB-S3",
    },
    {
      id: "TV",
      name: "Tinto de Verano",
      shortName: "Tinto de Verano",
      price: 90,
      subcategoryId: "BEB-S3",
    },
    {
      id: "VAMP",
      name: "Vampiro",
      shortName: "Vampiro",
      price: 80,
      subcategoryId: "BEB-S3",
    },
    // HAMBURGUESAS
    {
      id: "H",
      name: "Hamburguesa",
      shortName: "Hamburguesa",
      subcategoryId: "COM-S3",
      variants: [
        {
          id: "HV1",
          name: "Hamburguesa Tradicional",
          shortName: "H. Tradicional",
          price: 85,
          ingredients: "Carne de res, tocino, queso amarillo, queso asadero, cebolla, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
        },
        {
          id: "HV2",
          name: "Hamburguesa Especial",
          shortName: "H. Especial",
          price: 95,
          ingredients: "Carne de res, tocino, pierna, queso amarillo, queso blanco, cebolla, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
        },
        {
          id: "HV3",
          name: "Hamburguesa Hawaiana",
          shortName: "H. Hawaiana",
          price: 95,
          ingredients: "Carne de res, tocino, piña, jamon, queso amarillo, queso blanco, cebolla, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
        },
        {
          id: "HV4",
          name: "Hamburguesa Pollo",
          shortName: "H. Pollo",
          price: 100,
          ingredients: "Pollo a la plancha, tocino, queso amarillo, queso blanco, cebolla, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
        },
        {
          id: "HV5",
          name: "Hamburguesa BBQ",
          shortName: "H. BBQ",
          price: 100,
          ingredients: "Carne de res, salsa bbq, tocino, queso amarillo, queso blanco, cebolla guisada, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
        },
        {
          id: "HV6",
          name: "Hamburguesa Leñazo",
          shortName: "H. Leñazo",
          price: 110,
          ingredients: "Doble carne de sirlon, tocino, queso amarillo, queso blanco, cebolla guisada, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
        },
        {
          id: "HV7",
          name: "Hamburguesa Cubana",
          shortName: "H. Cubana",
          price: 100,
          ingredients: "Carne de res, tocino, pierna, salchicha, jamon, queso amarillo, queso blanco, cebolla, jitomate, lechuga, chile jalapeño, catsup, aderezo, crema, mostaza",
        },
      ],
      modifierTypes: [
        {
          id: "HM1",
          name: "Hamburguesa con papas",
          required: false,
          acceptsMultiple: false,
          modifiers: [
            { id: "HM1-1", name: "Con papas francesa", shortName: "C/Francesa", price: 10 },
            { id: "HM1-2", name: "Con papas gajo", shortName: "C/Gajo", price: 15 },
            { id: "HM1-3", name: "Con papas mixtas", shortName: "C/Mixtas", price: 15 },
            { id: "HM1-4", name: "Con papas francesa gratinadas", shortName: "C/Francesa Gratinadas", price: 15 },
            { id: "HM1-5", name: "Con papas gajo gratinadas", shortName: "C/Gajo Gratinadas", price: 20 },
            { id: "HM1-6", name: "Con papas mixtas gratinadas", shortName: "C/Papas Mixtas Gratinadas", price: 20 },
          ],
        },
        {
          id: "HM2",
          name: "Hamburguesa extras",
          required: false,
          acceptsMultiple: true,
          modifiers: [
            { id: "HM2-1", name: "Partida", shortName: "Partida", price: 0 },
            { id: "HM2-2", name: "Doble carne", shortName: "Doble carne", price: 15 },
            { id: "HM2-3", name: "Doble pollo", shortName: "Doble pollo", price: 20 },
            { id: "HM2-4", name: "Piña", shortName: "Piña", price: 5 },
            { id: "HM2-5", name: "Pollo en lugar de carne de res", shortName: "Res -> Pollo", price: 15 },
          ],
        },
        {
          id: "HM3",
          name: "Quitar ingredientes Hamburguesa",
          required: false,
          acceptsMultiple: true,
          modifiers: [
            { id: "HM3-1", name: "Sin aderezo", shortName: "S/aderezo", price: 0 },
            { id: "HM3-2", name: "Sin aderezos", shortName: "S/aderezos", price: 0 },
            { id: "HM3-3", name: "Sin catsup", shortName: "S/catsup", price: 0 },
            { id: "HM3-4", name: "Sin cebolla", shortName: "S/cebolla", price: 0 },
            { id: "HM3-5", name: "Sin chile jalapeño", shortName: "S/chile jalapeño", price: 0 },
            { id: "HM3-6", name: "Sin crema", shortName: "S/crema", price: 0 },
            { id: "HM3-7", name: "Sin jitomate", shortName: "S/jitomate", price: 0 },
            { id: "HM3-8", name: "Sin lechuga", shortName: "S/lechuga", price: 0 },
            { id: "HM3-9", name: "Sin mostaza", shortName: "S/mostaza", price: 0 },
            { id: "HM3-10", name: "Sin pierna", shortName: "S/pierna", price: 0 },
            { id: "HM3-11", name: "Sin queso amarillo", shortName: "S/queso amarillo", price: 0 },
            { id: "HM3-12", name: "Sin queso blanco", shortName: "S/queso blanco", price: 0 },
            { id: "HM3-13", name: "Sin tocino", shortName: "S/tocino", price: 0 },
            { id: "HM3-14", name: "Sin verduras", shortName: "S/verduras", price: 0 },
          ],
        },
      ],
    },
    {
      id: "DQ",
      name: "Dedos de queso",
      shortName: "Dedos queso",
      price: 90,
      subcategoryId: "COM-S3",
    },
    // ENTRADAS - ALITAS
    {
      id: "A",
      name: "Alitas",
      shortName: "Alitas",
      subcategoryId: "COM-S1",
      variants: [
        { id: "AV1", name: "Orden de Alitas BBQ", shortName: "A. BBQ", price: 135 },
        { id: "AV2", name: "Orden de Alitas Picosas", shortName: "A. Picosas", price: 135 },
        { id: "AV3", name: "Orden de Alitas Fritas", shortName: "A. Fritas", price: 135 },
        { id: "AV4", name: "Orden de Alitas Mango Habanero", shortName: "A. Mango Habanero", price: 140 },
        { id: "AV5", name: "Orden de Alitas Mixtas", shortName: "A. Mixtas", price: 135 },
        { id: "AV6", name: "Media Orden de Alitas BBQ", shortName: "1/2 A. BBQ", price: 70 },
        { id: "AV7", name: "Media Orden de Alitas Picosas", shortName: "1/2 A. Picosas", price: 70 },
        { id: "AV8", name: "Media Orden de Alitas Fritas", shortName: "1/2 A. Fritas", price: 70 },
        { id: "AV9", name: "Media Orden de Alitas Mango Habanero", shortName: "1/2 A. Mango Habanero", price: 75 },
      ],
      modifierTypes: [
        {
          id: "AM1",
          name: "Modificadores Alitas",
          required: false,
          acceptsMultiple: true,
          modifiers: [
            { id: "AM1-1", name: "Extra salsa", shortName: "Extra salsa", price: 10 },
            { id: "AM1-2", name: "Con aderezo ranch", shortName: "Aderezo ranch", price: 10 },
            { id: "AM1-3", name: "Extra chile de aceite", shortName: "Extra chile aceite", price: 10 },
            { id: "AM1-4", name: "Extra doradas", shortName: "Extra doradas", price: 0 },
          ],
        },
      ],
    },
    // ENTRADAS - PAPAS
    {
      id: "P",
      name: "Orden de Papas",
      shortName: "Papas",
      subcategoryId: "COM-S1",
      variants: [
        { id: "PV1", name: "Orden de Papas a la Francesa", shortName: "P. Francesa", price: 90 },
        { id: "PV2", name: "Orden de Papas Gajo", shortName: "P. Gajo", price: 105 },
        { id: "PV3", name: "Orden de Papas Mixtas francesa y gajo", shortName: "Papas Mixtas", price: 105 },
        { id: "PV4", name: "Media Orden de Papas a la Francesa", shortName: "1/2 Francesa", price: 50 },
        { id: "PV5", name: "Media Orden de Papas Gajo", shortName: "1/2 Gajo", price: 65 },
      ],
      modifierTypes: [
        {
          id: "PM1",
          name: "Papas queso",
          required: true,
          acceptsMultiple: true,
          modifiers: [
            { id: "PM1-1", name: "Sin queso", shortName: "Sin queso", price: 0 },
            { id: "PM1-2", name: "Con queso", shortName: "Con queso", price: 0 },
            { id: "PM1-3", name: "Extra queso", shortName: "Extra queso", price: 10 },
          ],
        },
        {
          id: "PM2",
          name: "Papas observaciones",
          required: false,
          acceptsMultiple: true,
          modifiers: [
            { id: "PM2-1", name: "Extra aderezo", shortName: "Extra aderezo", price: 0 },
          ],
        },
      ],
    },
    // ENSALADAS
    {
      id: "EN",
      name: "Ensalada",
      shortName: "Ensalada",
      subcategoryId: "COM-S4",
      variants: [
        {
          id: "EV1",
          name: "Ensalada de Pollo Chica",
          shortName: "Ens. Pollo Ch",
          price: 90,
          ingredients: "Pollo a la plancha, Chile morron, Elote, Lechuga, Jitomate, Zanahoria, Queso parmesano, Aderezo, Betabel crujiente",
        },
        {
          id: "EV2",
          name: "Ensalada de Pollo Grande",
          shortName: "Ens. Pollo Gde",
          price: 120,
          ingredients: "Pollo a la plancha, Chile morron, Elote, Lechuga, Jitomate, Zanahoria, Queso parmesano, Aderezo, Betabel crujiente",
        },
        {
          id: "EV3",
          name: "Ensalada de Jamon Chica",
          shortName: "Ens. Jamon Ch",
          price: 80,
          ingredients: "Jamon, Lechuga, Chile morron, Elote, Jitomate, Zanahoria, Queso parmesano, Aderezo, Betabel crujiente",
        },
        {
          id: "EV4",
          name: "Ensalada de Jamon Grande",
          shortName: "Ens. Jamon Gde",
          price: 100,
          ingredients: "Jamon, Lechuga, Chile morron, Elote, Jitomate, Zanahoria, Queso parmesano, Aderezo, Betabel crujiente",
        },
        {
          id: "EV5",
          name: "Ensalada Vegetal Chica",
          shortName: "Ens. Vegetal Ch",
          price: 70,
          ingredients: "Lechuga, Chile morron, Elote, Jitomate, Zanahoria, Queso parmesano, Aderezo, Betabel crujiente",
        },
        {
          id: "EV6",
          name: "Ensalada Vegetal Grande",
          shortName: "Ens. Vegetal Gde",
          price: 90,
          ingredients: "Lechuga, Chile morron, Elote, Jitomate, Zanahoria, Queso parmesano, Aderezo, Betabel crujiente",
        },
      ],
      modifierTypes: [
        {
          id: "EM1",
          name: "Extras Ensaladas",
          required: false,
          acceptsMultiple: true,
          modifiers: [
            { id: "EM1-1", name: "Con vinagreta", shortName: "Vinagreta", price: 0 },
            { id: "EM1-2", name: "Extra pollo", shortName: "Extra pollo", price: 15 },
          ],
        },
        {
          id: "EM2",
          name: "Quitar ingredientes Ensalada",
          required: false,
          acceptsMultiple: true,
          modifiers: [
            { id: "EM2-8", name: "Sin aderezo", shortName: "Sin aderezo", price: 0 },
            { id: "EM2-9", name: "Sin betabel crujiente", shortName: "Sin betabel crujiente", price: 0 },
            { id: "EM2-2", name: "Sin chile morrón", shortName: "Sin morrón", price: 0 },
            { id: "EM2-3", name: "Sin elote", shortName: "Sin elote", price: 0 },
            { id: "EM2-10", name: "Sin jamón", shortName: "Sin jamón", price: 0 },
            { id: "EM2-5", name: "Sin jitomate", shortName: "Sin jitomate", price: 0 },
            { id: "EM2-4", name: "Sin lechuga", shortName: "Sin lechuga", price: 0 },
            { id: "EM2-1", name: "Sin pollo", shortName: "Sin pollo", price: 0 },
            { id: "EM2-7", name: "Sin queso parmesano", shortName: "Sin parmesano", price: 0 },
            { id: "EM2-6", name: "Sin zanahoria", shortName: "Sin zanahoria", price: 0 },
          ],
        },
      ],
    },
    // PIZZAS
    {
      id: "PZ",
      name: "Pizza",
      shortName: "Pizza",
      subcategoryId: "COM-S2",
      variants: [
        { id: "PZ-V-1", name: "Pizza Grande", shortName: "Pizza GDE", price: 240 },
        { id: "PZ-V-2", name: "Pizza Mediana", shortName: "Pizza MED.", price: 190 },
        { id: "PZ-V-3", name: "Pizza Chica", shortName: "Pizza CH.", price: 140 },
        { id: "PZ-V-4", name: "Pizza Grande Con Orilla Rellena de Queso", shortName: "Pizza GDE C/R.", price: 270 },
        { id: "PZ-V-5", name: "Pizza Mediana Con Orilla Rellena de Queso", shortName: "Pizza MED. C/R.", price: 220 },
        { id: "PZ-V-6", name: "Pizza Chica Con Orilla Rellena de Queso", shortName: "Pizza CH. C/R.", price: 160 },
      ],
      pizzaIngredients: [
        // Pizzas especiales (completas)
        { id: "PZ-I-1", name: "Adelita", ingredientValue: 4 },
        { id: "PZ-I-2", name: "Carnes Frias", ingredientValue: 4 },
        { id: "PZ-I-3", name: "Carranza", ingredientValue: 4 },
        { id: "PZ-I-4", name: "Especial", ingredientValue: 4 },
        { id: "PZ-I-5", name: "Hawaiana", ingredientValue: 4 },
        { id: "PZ-I-6", name: "Kahlo", ingredientValue: 4 },
        { id: "PZ-I-7", name: "La Leña", ingredientValue: 6 },
        { id: "PZ-I-8", name: "La Maria", ingredientValue: 6 },
        { id: "PZ-I-9", name: "Lupita", ingredientValue: 4 },
        { id: "PZ-I-10", name: "Malinche", ingredientValue: 6 },
        { id: "PZ-I-11", name: "Margarita", ingredientValue: 4 },
        { id: "PZ-I-12", name: "Mexicana", ingredientValue: 4 },
        { id: "PZ-I-13", name: "Pepperoni", ingredientValue: 4 },
        { id: "PZ-I-14", name: "Rivera", ingredientValue: 4 },
        { id: "PZ-I-15", name: "Villa", ingredientValue: 4 },
        { id: "PZ-I-16", name: "Zapata", ingredientValue: 4 },
        { id: "PZ-I-17", name: "3 Quesos", ingredientValue: 2 },
        // Ingredientes individuales
        { id: "PZ-I-18", name: "Albahaca", ingredientValue: 1 },
        { id: "PZ-I-19", name: "Arandano", ingredientValue: 1 },
        { id: "PZ-I-20", name: "Calabaza", ingredientValue: 1 },
        { id: "PZ-I-21", name: "Cebolla", ingredientValue: 1 },
        { id: "PZ-I-22", name: "Champiñon", ingredientValue: 1 },
        { id: "PZ-I-23", name: "Chile Jalapeño", ingredientValue: 1 },
        { id: "PZ-I-24", name: "Chile Morron", ingredientValue: 1 },
        { id: "PZ-I-25", name: "Chile Seco", ingredientValue: 1 },
        { id: "PZ-I-26", name: "Chorizo", ingredientValue: 1 },
        { id: "PZ-I-27", name: "Elote", ingredientValue: 1 },
        { id: "PZ-I-28", name: "Jamon", ingredientValue: 1 },
        { id: "PZ-I-29", name: "Jitomate", ingredientValue: 1 },
        { id: "PZ-I-30", name: "Molida", ingredientValue: 1 },
        { id: "PZ-I-31", name: "Pierna", ingredientValue: 2 },
        { id: "PZ-I-32", name: "Piña", ingredientValue: 1 },
        { id: "PZ-I-33", name: "Pollo BBQ", ingredientValue: 2 },
        { id: "PZ-I-34", name: "Queso", ingredientValue: 0 },
        { id: "PZ-I-35", name: "Queso de cabra", ingredientValue: 2 },
        { id: "PZ-I-36", name: "Salami", ingredientValue: 1 },
        { id: "PZ-I-37", name: "Salchicha", ingredientValue: 1 },
        { id: "PZ-I-38", name: "Salsa de tomate", ingredientValue: 0 },
        { id: "PZ-I-39", name: "Tocino", ingredientValue: 1 },
        { id: "PZ-I-40", name: "Pepperoni", ingredientValue: 1 },
      ],
      modifierTypes: [
        {
          id: "PZ-M1",
          name: "Observaciones de Pizza",
          required: false,
          acceptsMultiple: true,
          modifiers: [
            { id: "PZ-M1-1", name: "Con catsup", shortName: "Con catsup", price: 0 },
            { id: "PZ-M1-2", name: "Extra aderezo", shortName: "Extra aderezo", price: 0 },
            { id: "PZ-M1-3", name: "Extra chile de aceite", shortName: "Extra chile aceite", price: 0 },
            { id: "PZ-M1-4", name: "Extra dorada", shortName: "Extra dorada", price: 0 },
            { id: "PZ-M1-5", name: "Menos dorada", shortName: "Menos dorada", price: 0 },
            { id: "PZ-M1-6", name: "Sin salsa", shortName: "Sin salsa", price: 0 },
          ],
        },
      ],
    },
    {
      id: "CHCH",
      name: "Chile chillon",
      shortName: "Chile chillon",
      price: 35,
      subcategoryId: "COM-S2",
    },
  ];

  // Create products with their variants and modifiers
  for (const product of products) {
    const { variants, modifierTypes, pizzaIngredients, ...productData } = product;
    
    await prisma.product.create({
      data: {
        ...productData,
        isActive: true,
        variants: variants ? {
          create: variants.map(v => ({ 
            ...v, 
            isActive: true,
            ingredients: (v as any).ingredients || null 
          }))
        } : undefined,
        modifierTypes: modifierTypes ? {
          create: modifierTypes.map(mt => ({
            id: mt.id,
            name: mt.name,
            acceptsMultiple: mt.acceptsMultiple,
            required: mt.required,
            modifiers: {
              create: mt.modifiers.map(m => ({ ...m, isActive: true }))
            }
          }))
        } : undefined,
        pizzaIngredients: pizzaIngredients ? {
          create: pizzaIngredients.map(pi => ({ ...pi, isActive: true }))
        } : undefined
      }
    });
  }

  console.log('Complete seed finished successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });