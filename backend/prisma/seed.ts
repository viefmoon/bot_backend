import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';

dotenv.config();

const prisma = new PrismaClient();

async function main() {
  console.log('Starting seed...');

  // Check if already seeded
  const existingCategories = await prisma.category.count();
  if (existingCategories > 0) {
    console.log('Database already seeded');
    return;
  }

  // Create restaurant config
  await prisma.restaurantConfig.create({
    data: {
      acceptingOrders: true,
      estimatedPickupTime: 20,
      estimatedDeliveryTime: 40
    }
  });

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
    // Entradas
    {
      id: "OMA",
      name: "Orden de Mozzarella Aros",
      price: 75,
      subcategoryId: "COM-S1",
    },
    {
      id: "P",
      name: "Papas",
      subcategoryId: "COM-S1",
      variants: [
        { id: "P-V1", name: "Papas Chicas", price: 35 },
        { id: "P-V2", name: "Papas Grandes", price: 50 },
      ],
    },
    // Pizzas
    {
      id: "PZ",
      name: "Pizza",
      subcategoryId: "COM-S2",
      variants: [
        { id: "PZ-V1", name: "Pizza Personal", price: 70 },
        { id: "PZ-V2", name: "Pizza Mediana", price: 140 },
        { id: "PZ-V3", name: "Pizza Grande", price: 180 },
      ],
      pizzaIngredients: [
        { id: "PZ-PI1", name: "Hawaiana", ingredientValue: 1 },
        { id: "PZ-PI2", name: "Salami", ingredientValue: 1 },
        { id: "PZ-PI3", name: "Pepperoni", ingredientValue: 1 },
        { id: "PZ-PI4", name: "Ranchera", ingredientValue: 1 },
        { id: "PZ-PI5", name: "Carnes Frías", ingredientValue: 1 },
        { id: "PZ-PI6", name: "Mexicana", ingredientValue: 1 },
        { id: "PZ-PI7", name: "Margarita", ingredientValue: 1 },
        { id: "PZ-PI8", name: "3 Quesos", ingredientValue: 1 },
        { id: "PZ-PI9", name: "Champiñones", ingredientValue: 1 },
        { id: "PZ-PI10", name: "Carne Molida", ingredientValue: 1 },
        { id: "PZ-PI11", name: "Pollo BBQ", ingredientValue: 1 },
        { id: "PZ-PI12", name: "Chistorra", ingredientValue: 1 },
        { id: "PZ-PI13", name: "Pastor", ingredientValue: 1 },
        { id: "PZ-PI14", name: "Mariscos", ingredientValue: 1 },
        { id: "PZ-PI15", name: "Chuleta Ahumada", ingredientValue: 1 },
        { id: "PZ-PI16", name: "Tocino", ingredientValue: 1 },
        { id: "PZ-PI17", name: "Atún", ingredientValue: 1 },
        { id: "PZ-PI18", name: "Chimichurri", ingredientValue: 1 },
        { id: "PZ-PI19", name: "Pesto", ingredientValue: 1 },
        { id: "PZ-PI20", name: "Cuernitos con Phila", ingredientValue: 1 },
      ],
    },
    // Hamburguesas
    {
      id: "HBS",
      name: "Hamburguesa Sencilla",
      price: 65,
      subcategoryId: "COM-S3",
      ingredients: "Carne, queso amarillo, jitomate, cebolla, lechuga y aderezos de la casa",
      modifierTypes: [
        {
          id: "HBS-MT1",
          name: "Extras",
          acceptsMultiple: true,
          required: false,
          modifiers: [
            { id: "HBS-M1", name: "Tocino", price: 12 },
            { id: "HBS-M2", name: "Champiñones", price: 12 },
            { id: "HBS-M3", name: "Chistorra", price: 16 },
            { id: "HBS-M4", name: "Chuleta Ahumada", price: 16 },
            { id: "HBS-M5", name: "Salami", price: 16 },
            { id: "HBS-M6", name: "Pepperoni", price: 16 },
            { id: "HBS-M7", name: "Salchicha", price: 16 },
            { id: "HBS-M8", name: "Piña", price: 12 },
            { id: "HBS-M9", name: "Pastor", price: 16 },
          ],
        },
      ],
    },
    // Bebidas
    {
      id: "RC",
      name: "Refresco de la Casa",
      price: 25,
      subcategoryId: "BEB-S4",
    },
    {
      id: "AJ",
      name: "Agua de Jamaica",
      subcategoryId: "BEB-S4",
      variants: [
        { id: "AJ-V1", name: "Agua de Jamaica Chica", price: 25 },
        { id: "AJ-V2", name: "Agua de Jamaica Grande", price: 30 },
      ],
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
          create: variants.map(v => ({ ...v, isActive: true }))
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

  console.log('Seed completed successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });