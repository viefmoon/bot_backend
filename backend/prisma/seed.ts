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
    // Clean up existing data in reverse dependency order
    await prisma.selectedPizzaIngredient.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.orderDeliveryInfo.deleteMany();
    await prisma.order.deleteMany();
    await prisma.preOrder.deleteMany();
    await prisma.pizzaIngredient.deleteMany();
    await prisma.productModifier.deleteMany();
    await prisma.modifierGroup.deleteMany();
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
      country: "México",
      
      // Configuración de operación
      acceptingOrders: true,
      estimatedPickupTime: 20,
      estimatedDeliveryTime: 40,
      openingGracePeriod: 30,
      closingGracePeriod: 30,
      timeZone: "America/Mexico_City",
      
      // Configuración de delivery (ejemplo para Tototlán, Jalisco)
      // Formato Google Maps: {lat: number, lng: number}
      deliveryCoverageArea: [
        { lat: 20.5320, lng: -102.8690 },  // Norte
        { lat: 20.5280, lng: -102.8650 },  // Este
        { lat: 20.5240, lng: -102.8690 },  // Sur
        { lat: 20.5280, lng: -102.8730 },  // Oeste
        { lat: 20.5320, lng: -102.8690 }   // Cierre del polígono
      ]
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
      description: "Platos principales y entradas",
      subcategories: [
        { id: "COM-S1", name: "Entradas", description: "Alitas, papas y más" },
        { id: "COM-S2", name: "Pizzas", description: "Pizzas artesanales" },
        { id: "COM-S3", name: "Hamburguesas", description: "Hamburguesas gourmet" },
        { id: "COM-S4", name: "Ensaladas", description: "Ensaladas frescas" },
      ],
    },
    {
      id: "BEB",
      name: "Bebida",
      description: "Bebidas y coctelería",
      subcategories: [
        { id: "BEB-S1", name: "Frappes y Postres", description: "Bebidas frías y postres" },
        { id: "BEB-S2", name: "Jarras", description: "Bebidas para compartir" },
        { id: "BEB-S3", name: "Cocteleria", description: "Cocteles y bebidas con alcohol" },
        { id: "BEB-S4", name: "Bebidas", description: "Aguas frescas y bebidas naturales" },
        { id: "BEB-S5", name: "Cafe Caliente", description: "Café y bebidas calientes" },
        { id: "BEB-S6", name: "Refrescos", description: "Refrescos embotellados" },
      ],
    },
  ];

  for (const cat of categories) {
    await prisma.category.create({
      data: {
        id: cat.id,
        name: cat.name,
        description: cat.description,
        isActive: true,
        subcategories: {
          create: cat.subcategories.map(sub => ({
            id: sub.id,
            name: sub.name,
            description: sub.description,
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
      description: "Refrescante agua de horchata natural",
      price: 35,
      subcategoryId: "BEB-S4",
    },
    {
      id: "LIM",
      name: "Limonada",
      description: "Limonada natural recién preparada",
      price: 35,
      subcategoryId: "BEB-S4",
    },
    {
      id: "LIMM",
      name: "Limonada Mineral",
      description: "Limonada con agua mineral",
      price: 35,
      subcategoryId: "BEB-S4",
    },
    {
      id: "SANP",
      name: "Sangria Preparada",
      description: "Sangría sin alcohol con frutas naturales",
      price: 35,
      subcategoryId: "BEB-S4",
    },
    {
      id: "MC",
      name: "Michelada",
      description: "Michelada preparada con nuestra receta especial",
      hasVariants: true,
      subcategoryId: "BEB-S4",
      variants: [
        { id: "MCV1", name: "Michelada clara", price: 80 },
        { id: "MCV2", name: "Michelada oscura", price: 80 },
      ],
    },
    // REFRESCOS
    {
      id: "CC",
      name: "Coca Cola",
      description: "Refresco Coca Cola 355ml",
      price: 30,
      subcategoryId: "BEB-S6",
    },
    {
      id: "SAN",
      name: "Sangria",
      description: "Refresco Sangría Señorial",
      price: 30,
      subcategoryId: "BEB-S6",
    },
    {
      id: "SQU",
      name: "Squirt",
      description: "Refresco Squirt toronja",
      price: 30,
      subcategoryId: "BEB-S6",
    },
    {
      id: "MIR",
      name: "Mirinda",
      description: "Refresco Mirinda naranja",
      price: 30,
      subcategoryId: "BEB-S6",
    },
    {
      id: "MAN",
      name: "Manzanita",
      description: "Refresco Manzanita Sol",
      price: 30,
      subcategoryId: "BEB-S6",
    },
    {
      id: "7UP",
      name: "7up",
      description: "Refresco 7up lima-limón",
      price: 30,
      subcategoryId: "BEB-S6",
    },
    {
      id: "AGM",
      name: "Agua Mineral",
      description: "Agua mineral Peñafiel",
      price: 30,
      subcategoryId: "BEB-S6",
    },
    // CAFE CALIENTE
    {
      id: "CA",
      name: "Cafe Americano",
      description: "Café americano recién preparado",
      price: 45,
      subcategoryId: "BEB-S5",
    },
    {
      id: "CP",
      name: "Capuchino",
      description: "Capuchino con espuma de leche",
      price: 45,
      subcategoryId: "BEB-S5",
    },
    {
      id: "CH",
      name: "Chocolate",
      description: "Chocolate caliente cremoso",
      price: 50,
      subcategoryId: "BEB-S5",
    },
    {
      id: "LC",
      name: "Latte Capuchino",
      description: "Latte con toque de capuchino",
      price: 50,
      subcategoryId: "BEB-S5",
    },
    {
      id: "LV",
      name: "Latte Vainilla",
      description: "Latte con jarabe de vainilla",
      price: 50,
      subcategoryId: "BEB-S5",
    },
    {
      id: "MCC",
      name: "Mocaccino",
      description: "Café con chocolate y crema",
      price: 50,
      subcategoryId: "BEB-S5",
    },
    // FRAPPES Y POSTRES
    {
      id: "F",
      name: "Frappe",
      description: "Frappes preparados con ingredientes premium",
      hasVariants: true,
      subcategoryId: "BEB-S1",
      variants: [
        { id: "FV1", name: "Frappe Capuchino", price: 70 },
        { id: "FV2", name: "Frappe Coco", price: 70 },
        { id: "FV3", name: "Frappe Caramelo", price: 70 },
        { id: "FV4", name: "Frappe Cajeta", price: 70 },
        { id: "FV5", name: "Frappe Mocaccino", price: 70 },
        { id: "FV6", name: "Frappe Galleta", price: 70 },
        { id: "FV7", name: "Frappe Bombon", price: 70 },
        { id: "FV8", name: "Frappe Rompope", price: 85 },
        { id: "FV9", name: "Frappe Mazapan", price: 85 },
        { id: "FV10", name: "Frappe Magnum", price: 85 },
      ],
    },
    // COCTELERIA (sin detalles de ingredientes para simplificar)
    {
      id: "CARAJ",
      name: "Carajillo",
      description: "Café con licor 43",
      price: 90,
      subcategoryId: "BEB-S3",
    },
    {
      id: "CLERI",
      name: "Clericot",
      description: "Vino tinto con frutas",
      price: 80,
      subcategoryId: "BEB-S3",
    },
    {
      id: "MOJ",
      name: "Mojito",
      description: "Ron, hierbabuena, limón y soda",
      price: 100,
      subcategoryId: "BEB-S3",
    },
    {
      id: "MAR",
      name: "Margarita",
      description: "Tequila, triple sec y limón",
      price: 85,
      subcategoryId: "BEB-S3",
    },
    // HAMBURGUESAS
    {
      id: "H",
      name: "Hamburguesa",
      description: "Hamburguesas artesanales con carne de res premium",
      hasVariants: true,
      subcategoryId: "COM-S3",
      variants: [
        {
          id: "HV1",
          name: "Hamburguesa Tradicional",
          price: 85,
          description: "Carne de res, tocino, queso amarillo, queso asadero, vegetales frescos y aderezos",
        },
        {
          id: "HV2",
          name: "Hamburguesa Especial",
          price: 95,
          description: "Carne de res, tocino, pierna, doble queso, vegetales frescos y aderezos",
        },
        {
          id: "HV3",
          name: "Hamburguesa Hawaiana",
          price: 95,
          description: "Carne de res, tocino, piña, jamón, doble queso, vegetales y aderezos",
        },
        {
          id: "HV4",
          name: "Hamburguesa Pollo",
          price: 100,
          description: "Pollo a la plancha, tocino, doble queso, vegetales y aderezos",
        },
        {
          id: "HV5",
          name: "Hamburguesa BBQ",
          price: 100,
          description: "Carne de res, salsa BBQ, tocino, doble queso, cebolla guisada y aderezos",
        },
        {
          id: "HV6",
          name: "Hamburguesa Leñazo",
          price: 110,
          description: "Doble carne de sirloin, tocino, doble queso, cebolla guisada y aderezos",
        },
        {
          id: "HV7",
          name: "Hamburguesa Cubana",
          price: 100,
          description: "Carne de res, tocino, pierna, salchicha, jamón, doble queso y aderezos",
        },
      ],
      modifierGroups: [
        {
          id: "HM1",
          name: "Hamburguesa con papas",
          isRequired: false,
          allowMultipleSelections: false,
          modifiers: [
            { id: "HM1-1", name: "Con papas francesa", price: 10 },
            { id: "HM1-2", name: "Con papas gajo", price: 15 },
            { id: "HM1-3", name: "Con papas mixtas", price: 15 },
            { id: "HM1-4", name: "Con papas francesa gratinadas", price: 15 },
            { id: "HM1-5", name: "Con papas gajo gratinadas", price: 20 },
            { id: "HM1-6", name: "Con papas mixtas gratinadas", price: 20 },
          ],
        },
        {
          id: "HM2",
          name: "Hamburguesa extras",
          isRequired: false,
          allowMultipleSelections: true,
          modifiers: [
            { id: "HM2-1", name: "Partida", price: 0 },
            { id: "HM2-2", name: "Doble carne", price: 15 },
            { id: "HM2-3", name: "Doble pollo", price: 20 },
            { id: "HM2-4", name: "Piña", price: 5 },
            { id: "HM2-5", name: "Pollo en lugar de carne de res", price: 15 },
          ],
        },
        {
          id: "HM3",
          name: "Quitar ingredientes Hamburguesa",
          isRequired: false,
          allowMultipleSelections: true,
          modifiers: [
            { id: "HM3-1", name: "Sin aderezo", price: 0 },
            { id: "HM3-2", name: "Sin aderezos", price: 0 },
            { id: "HM3-3", name: "Sin catsup", price: 0 },
            { id: "HM3-4", name: "Sin cebolla", price: 0 },
            { id: "HM3-5", name: "Sin chile jalapeño", price: 0 },
            { id: "HM3-6", name: "Sin crema", price: 0 },
            { id: "HM3-7", name: "Sin jitomate", price: 0 },
            { id: "HM3-8", name: "Sin lechuga", price: 0 },
            { id: "HM3-9", name: "Sin mostaza", price: 0 },
            { id: "HM3-10", name: "Sin pierna", price: 0 },
            { id: "HM3-11", name: "Sin queso amarillo", price: 0 },
            { id: "HM3-12", name: "Sin queso blanco", price: 0 },
            { id: "HM3-13", name: "Sin tocino", price: 0 },
            { id: "HM3-14", name: "Sin verduras", price: 0 },
          ],
        },
      ],
    },
    {
      id: "DQ",
      name: "Dedos de queso",
      description: "Dedos de queso mozzarella empanizados",
      price: 90,
      subcategoryId: "COM-S3",
    },
    // ENTRADAS - ALITAS
    {
      id: "A",
      name: "Alitas",
      description: "Alitas de pollo preparadas al momento",
      hasVariants: true,
      subcategoryId: "COM-S1",
      variants: [
        { id: "AV1", name: "Orden de Alitas BBQ", price: 135 },
        { id: "AV2", name: "Orden de Alitas Picosas", price: 135 },
        { id: "AV3", name: "Orden de Alitas Fritas", price: 135 },
        { id: "AV4", name: "Orden de Alitas Mango Habanero", price: 140 },
        { id: "AV5", name: "Orden de Alitas Mixtas", price: 135 },
        { id: "AV6", name: "Media Orden de Alitas BBQ", price: 70 },
        { id: "AV7", name: "Media Orden de Alitas Picosas", price: 70 },
        { id: "AV8", name: "Media Orden de Alitas Fritas", price: 70 },
        { id: "AV9", name: "Media Orden de Alitas Mango Habanero", price: 75 },
      ],
      modifierGroups: [
        {
          id: "AM1",
          name: "Modificadores Alitas",
          isRequired: false,
          allowMultipleSelections: true,
          modifiers: [
            { id: "AM1-1", name: "Extra salsa", price: 10 },
            { id: "AM1-2", name: "Con aderezo ranch", price: 10 },
            { id: "AM1-3", name: "Extra chile de aceite", price: 10 },
            { id: "AM1-4", name: "Extra doradas", price: 0 },
          ],
        },
      ],
    },
    // ENTRADAS - PAPAS
    {
      id: "P",
      name: "Orden de Papas",
      description: "Papas preparadas con nuestra receta especial",
      hasVariants: true,
      subcategoryId: "COM-S1",
      variants: [
        { id: "PV1", name: "Orden de Papas a la Francesa", price: 90 },
        { id: "PV2", name: "Orden de Papas Gajo", price: 105 },
        { id: "PV3", name: "Orden de Papas Mixtas francesa y gajo", price: 105 },
        { id: "PV4", name: "Media Orden de Papas a la Francesa", price: 50 },
        { id: "PV5", name: "Media Orden de Papas Gajo", price: 65 },
      ],
      modifierGroups: [
        {
          id: "PM1",
          name: "Papas queso",
          isRequired: true,
          allowMultipleSelections: true,
          modifiers: [
            { id: "PM1-1", name: "Sin queso", price: 0 },
            { id: "PM1-2", name: "Con queso", price: 0 },
            { id: "PM1-3", name: "Extra queso", price: 10 },
          ],
        },
        {
          id: "PM2",
          name: "Papas observaciones",
          isRequired: false,
          allowMultipleSelections: true,
          modifiers: [
            { id: "PM2-1", name: "Extra aderezo", price: 0 },
          ],
        },
      ],
    },
    // ENSALADAS
    {
      id: "EN",
      name: "Ensalada",
      description: "Ensaladas frescas preparadas al momento",
      hasVariants: true,
      subcategoryId: "COM-S4",
      variants: [
        {
          id: "EV1",
          name: "Ensalada de Pollo Chica",
          price: 90,
          description: "Pollo a la plancha, vegetales frescos, queso parmesano y aderezo",
        },
        {
          id: "EV2",
          name: "Ensalada de Pollo Grande",
          price: 120,
          description: "Pollo a la plancha, vegetales frescos, queso parmesano y aderezo",
        },
        {
          id: "EV3",
          name: "Ensalada de Jamon Chica",
          price: 80,
          description: "Jamón, vegetales frescos, queso parmesano y aderezo",
        },
        {
          id: "EV4",
          name: "Ensalada de Jamon Grande",
          price: 100,
          description: "Jamón, vegetales frescos, queso parmesano y aderezo",
        },
        {
          id: "EV5",
          name: "Ensalada Vegetal Chica",
          price: 70,
          description: "Vegetales frescos, queso parmesano y aderezo",
        },
        {
          id: "EV6",
          name: "Ensalada Vegetal Grande",
          price: 90,
          description: "Vegetales frescos, queso parmesano y aderezo",
        },
      ],
      modifierGroups: [
        {
          id: "EM1",
          name: "Extras Ensaladas",
          isRequired: false,
          allowMultipleSelections: true,
          modifiers: [
            { id: "EM1-1", name: "Con vinagreta", price: 0 },
            { id: "EM1-2", name: "Extra pollo", price: 15 },
          ],
        },
        {
          id: "EM2",
          name: "Quitar ingredientes Ensalada",
          isRequired: false,
          allowMultipleSelections: true,
          modifiers: [
            { id: "EM2-8", name: "Sin aderezo", price: 0 },
            { id: "EM2-9", name: "Sin betabel crujiente", price: 0 },
            { id: "EM2-2", name: "Sin chile morrón", price: 0 },
            { id: "EM2-3", name: "Sin elote", price: 0 },
            { id: "EM2-10", name: "Sin jamón", price: 0 },
            { id: "EM2-5", name: "Sin jitomate", price: 0 },
            { id: "EM2-4", name: "Sin lechuga", price: 0 },
            { id: "EM2-1", name: "Sin pollo", price: 0 },
            { id: "EM2-7", name: "Sin queso parmesano", price: 0 },
            { id: "EM2-6", name: "Sin zanahoria", price: 0 },
          ],
        },
      ],
    },
    // PIZZAS
    {
      id: "PZ",
      name: "Pizza",
      description: "Pizzas artesanales horneadas en horno de leña",
      hasVariants: true,
      isPizza: true,
      subcategoryId: "COM-S2",
      variants: [
        { id: "PZ-V-1", name: "Pizza Grande", price: 240 },
        { id: "PZ-V-2", name: "Pizza Mediana", price: 190 },
        { id: "PZ-V-3", name: "Pizza Chica", price: 140 },
        { id: "PZ-V-4", name: "Pizza Grande Con Orilla Rellena de Queso", price: 270 },
        { id: "PZ-V-5", name: "Pizza Mediana Con Orilla Rellena de Queso", price: 220 },
        { id: "PZ-V-6", name: "Pizza Chica Con Orilla Rellena de Queso", price: 160 },
      ],
      modifierGroups: [
        {
          id: "PZ-M1",
          name: "Observaciones de Pizza",
          isRequired: false,
          allowMultipleSelections: true,
          modifiers: [
            { id: "PZ-M1-1", name: "Con catsup", price: 0 },
            { id: "PZ-M1-2", name: "Extra aderezo", price: 0 },
            { id: "PZ-M1-3", name: "Extra chile de aceite", price: 0 },
            { id: "PZ-M1-4", name: "Extra dorada", price: 0 },
            { id: "PZ-M1-5", name: "Menos dorada", price: 0 },
            { id: "PZ-M1-6", name: "Sin salsa", price: 0 },
          ],
        },
      ],
    },
    {
      id: "CHCH",
      name: "Chile chillon",
      description: "Chile jalapeño relleno de queso",
      price: 35,
      subcategoryId: "COM-S2",
    },
  ];

  // Create pizza ingredients separately
  const pizzaIngredients = [
    // Pizzas especiales (completas)
    { id: "PZ-I-1", name: "Adelita", ingredientValue: 4, productIds: ["PZ"] },
    { id: "PZ-I-2", name: "Carnes Frias", ingredientValue: 4, productIds: ["PZ"] },
    { id: "PZ-I-3", name: "Carranza", ingredientValue: 4, productIds: ["PZ"] },
    { id: "PZ-I-4", name: "Especial", ingredientValue: 4, productIds: ["PZ"] },
    { id: "PZ-I-5", name: "Hawaiana", ingredientValue: 4, productIds: ["PZ"] },
    { id: "PZ-I-6", name: "Kahlo", ingredientValue: 4, productIds: ["PZ"] },
    { id: "PZ-I-7", name: "La Leña", ingredientValue: 6, productIds: ["PZ"] },
    { id: "PZ-I-8", name: "La Maria", ingredientValue: 6, productIds: ["PZ"] },
    { id: "PZ-I-9", name: "Lupita", ingredientValue: 4, productIds: ["PZ"] },
    { id: "PZ-I-10", name: "Malinche", ingredientValue: 6, productIds: ["PZ"] },
    { id: "PZ-I-11", name: "Margarita", ingredientValue: 4, productIds: ["PZ"] },
    { id: "PZ-I-12", name: "Mexicana", ingredientValue: 4, productIds: ["PZ"] },
    { id: "PZ-I-13", name: "Pepperoni", ingredientValue: 4, productIds: ["PZ"] },
    { id: "PZ-I-14", name: "Rivera", ingredientValue: 4, productIds: ["PZ"] },
    { id: "PZ-I-15", name: "Villa", ingredientValue: 4, productIds: ["PZ"] },
    { id: "PZ-I-16", name: "Zapata", ingredientValue: 4, productIds: ["PZ"] },
    { id: "PZ-I-17", name: "3 Quesos", ingredientValue: 2, productIds: ["PZ"] },
    // Ingredientes individuales
    { id: "PZ-I-18", name: "Albahaca", ingredientValue: 1, productIds: ["PZ"] },
    { id: "PZ-I-19", name: "Arandano", ingredientValue: 1, productIds: ["PZ"] },
    { id: "PZ-I-20", name: "Calabaza", ingredientValue: 1, productIds: ["PZ"] },
    { id: "PZ-I-21", name: "Cebolla", ingredientValue: 1, productIds: ["PZ"] },
    { id: "PZ-I-22", name: "Champiñon", ingredientValue: 1, productIds: ["PZ"] },
    { id: "PZ-I-23", name: "Chile Jalapeño", ingredientValue: 1, productIds: ["PZ"] },
    { id: "PZ-I-24", name: "Chile Morron", ingredientValue: 1, productIds: ["PZ"] },
    { id: "PZ-I-25", name: "Chile Seco", ingredientValue: 1, productIds: ["PZ"] },
    { id: "PZ-I-26", name: "Chorizo", ingredientValue: 1, productIds: ["PZ"] },
    { id: "PZ-I-27", name: "Elote", ingredientValue: 1, productIds: ["PZ"] },
    { id: "PZ-I-28", name: "Jamon", ingredientValue: 1, productIds: ["PZ"] },
    { id: "PZ-I-29", name: "Jitomate", ingredientValue: 1, productIds: ["PZ"] },
    { id: "PZ-I-30", name: "Molida", ingredientValue: 1, productIds: ["PZ"] },
    { id: "PZ-I-31", name: "Pierna", ingredientValue: 2, productIds: ["PZ"] },
    { id: "PZ-I-32", name: "Piña", ingredientValue: 1, productIds: ["PZ"] },
    { id: "PZ-I-33", name: "Pollo BBQ", ingredientValue: 2, productIds: ["PZ"] },
    { id: "PZ-I-34", name: "Queso", ingredientValue: 0, productIds: ["PZ"] },
    { id: "PZ-I-35", name: "Queso de cabra", ingredientValue: 2, productIds: ["PZ"] },
    { id: "PZ-I-36", name: "Salami", ingredientValue: 1, productIds: ["PZ"] },
    { id: "PZ-I-37", name: "Salchicha", ingredientValue: 1, productIds: ["PZ"] },
    { id: "PZ-I-38", name: "Salsa de tomate", ingredientValue: 0, productIds: ["PZ"] },
    { id: "PZ-I-39", name: "Tocino", ingredientValue: 1, productIds: ["PZ"] },
    { id: "PZ-I-40", name: "Pepperoni", ingredientValue: 1, productIds: ["PZ"] },
  ];

  // Create all pizza ingredients first
  for (const ingredient of pizzaIngredients) {
    await prisma.pizzaIngredient.create({
      data: {
        id: ingredient.id,
        name: ingredient.name,
        ingredientValue: ingredient.ingredientValue,
        productIds: ingredient.productIds,
        isActive: true
      }
    });
  }

  // Create products with their variants and modifiers
  for (const product of products) {
    const { variants, modifierGroups, ...productData } = product;
    
    await prisma.product.create({
      data: {
        ...productData,
        isActive: true,
        hasVariants: productData.hasVariants || false,
        isPizza: productData.isPizza || false,
        variants: variants ? {
          create: variants.map(v => {
            const { description, ...variantData } = v as any;
            return { 
              ...variantData, 
              isActive: true
            };
          })
        } : undefined,
        modifierGroups: modifierGroups ? {
          create: modifierGroups.map(mg => ({
            id: mg.id,
            name: mg.name,
            allowMultipleSelections: mg.allowMultipleSelections,
            isRequired: mg.isRequired,
            productModifiers: {
              create: mg.modifiers.map(m => ({ 
                ...m, 
                isActive: true 
              }))
            }
          }))
        } : undefined,
        // Connect pizza ingredients to pizza product
        pizzaIngredients: productData.isPizza ? {
          connect: pizzaIngredients.map(pi => ({ id: pi.id }))
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