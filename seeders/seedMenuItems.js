require("dotenv").config();
const { sequelize } = require("../src/lib/db");
const Product = require("../src/models/product");
const ProductVariant = require("../src/models/productVariant");
const PizzaIngredient = require("../src/models/pizzaIngredient");
const ModifierType = require("../src/models/modifierType");
const Modifier = require("../src/models/modifier");

const menu = [
  {
    id: "A",
    name: "Orden de Alitas",
    variants: [
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
    variants: [
      { id: "PV1", name: "Orden de Papas a la Francesa", price: 90 },
      { id: "PV2", name: "Media Orden de Papas a la Francesa", price: 50 },
      { id: "PV3", name: "Orden de Papas Gajos", price: 100 },
      { id: "PV4", name: "Media Orden de Papas Gajos", price: 60 },
      { id: "PV5", name: "Orden de Papas Mixtas francesa y gajos", price: 100 },
    ],
    modifiers: [
      {
        id: "P-Q",
        typeName: "Queso",
        acceptsMultiple: false,
        options: [
          { id: "P-Q-V1", name: "Sin queso", price: 0 },
          { id: "P-Q-V2", name: "Con queso", price: 0 },
        ],
      },
    ],
  },
  {
    id: "D",
    name: "Dedos de Queso",
    price: 90,
  },
  {
    id: "EN",
    name: "Ensaladas",
    variants: [
      { id: "ENV1", name: "Ensalada de Pollo Chica", price: 90 },
      { id: "ENV2", name: "Ensalada de Pollo Grande", price: 120 },
      { id: "ENV3", name: "Ensalada de Jamón Chica", price: 80 },
      { id: "ENV4", name: "Ensalada de Jamón Grande", price: 100 },
    ],
    modifiers: [
      {
        id: "E-E",
        typeName: "Extras",
        acceptsMultiple: true,
        options: [
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
    variants: [
      { id: "HV1", name: "H. Tradicional", price: 85 },
      { id: "HV2", name: "H. Especial", price: 95 },
      { id: "HV3", name: "H. Hawaiana", price: 95 },
      { id: "HV4", name: "H. Pollo", price: 100 },
      { id: "HV5", name: "H. BBQ", price: 100 },
      { id: "HV6", name: "H. Lenazo", price: 110 },
      { id: "HV7", name: "H. Cubana", price: 100 },
    ],
    modifiers: [
      {
        id: "H-P",
        typeName: "Papas",
        acceptsMultiple: false,
        options: [
          { id: "H-P-V1", name: "Con papas francesa", price: 10 },
          { id: "H-P-V2", name: "Con gajos", price: 15 },
          { id: "H-P-V3", name: "Con papas mixtas", price: 15 },
        ],
      },
      {
        id: "H-E",
        typeName: "Extras",
        acceptsMultiple: true,
        options: [
          { name: "Partida", price: 0 },
          { id: "H-E-V1", name: "Queso en la papas", price: 5 },
          { id: "H-E-V2", name: "Doble carne", price: 10 },
          { id: "H-E-V3", name: "Doble pollo", price: 15 },
          { id: "H-E-V4", name: "Extra queso", price: 5 },
          { id: "H-E-V5", name: "Extra tocino", price: 5 },
          { id: "H-E-V6", name: "Res -> Pollo", price: 15 },
          { id: "H-E-V7", name: "Con pierna", price: 10 },
          { id: "H-E-V8", name: "Con pina", price: 5 },
          { id: "H-E-V9", name: "Con jamon", price: 5 },
          { id: "H-E-V10", name: "Con salchicha", price: 5 },
          { id: "H-E-V11", name: "Con ensalada", price: 15 },
        ],
      },
    ],
  },
  {
    id: "BEB1",
    name: "Agua de horchata 1 Litro",
    price: 35,
  },
  {
    id: "BEB2",
    name: "Limonada 1 Litro",
    price: 35,
  },
  {
    id: "BEB3",
    name: "Refrescos 500ml",
    variants: [
      { id: "BEB3-V1", name: "Coca Cola", price: 30 },
      { id: "BEB3-V2", name: "7up", price: 30 },
      { id: "BEB3-V3", name: "Mirinda", price: 30 },
      { id: "BEB3-V4", name: "Refresco de Sangría", price: 30 },
    ],
  },
  {
    id: "BEB4",
    name: "Sangría Preparada",
    price: 35,
  },
  {
    id: "BEB5",
    name: "Micheladas",
    variants: [
      { id: "BEB5-V1", name: "Michelada clara", price: 80 },
      { id: "BEB5-V2", name: "Michelada oscura", price: 80 },
    ],
  },
  {
    id: "BEB6",
    name: "Café Caliente",
    variants: [
      { id: "BEB6-V1", name: "Cafe Americano", price: 45 },
      { id: "BEB6-V2", name: "Capuchino", price: 45 },
      { id: "BEB6-V3", name: "Chocolate", price: 50 },
    ],
  },
  {
    id: "BEB7",
    name: "Frappés",
    variants: [
      { id: "BEB7-V1", name: "Frappe Capuchino", price: 70 },
      { id: "BEB7-V2", name: "Frappe Coco", price: 70 },
      { id: "BEB7-V3", name: "Frappe Caramelo", price: 70 },
      { id: "BEB7-V4", name: "Frappe Cajeta", price: 70 },
      { id: "BEB7-V5", name: "Frappe Mocaccino", price: 70 },
      { id: "BEB7-V6", name: "Frappe Galleta", price: 70 },
      { id: "BEB7-V7", name: "Frappe Bombon", price: 70 },
      { id: "BEB7-V8", name: "Frappe Rompope", price: 85 },
      { id: "BEB7-V9", name: "Frappe Mazapan", price: 85 },
      { id: "BEB7-V10", name: "Frappe Magnum", price: 85 },
    ],
  },
  {
    id: "COC1",
    name: "Copa de vino",
    price: 90,
  },
  {
    id: "COC2",
    name: "Sangría con vino",
    price: 80,
  },
  {
    id: "COC3",
    name: "Vampiro",
    price: 80,
  },
  {
    id: "COC4",
    name: "Gin de Maracuyá",
    price: 90,
  },
  {
    id: "COC5",
    name: "Margarita",
    price: 85,
  },
  {
    id: "COC6",
    name: "Ruso Blanco",
    price: 85,
  },
  {
    id: "COC7",
    name: "Palo santo",
    price: 80,
  },
  {
    id: "COC8",
    name: "Gin de pepino",
    price: 90,
  },
  {
    id: "COC9",
    name: "Mojito",
    price: 100,
  },
  {
    id: "COC10",
    name: "Piña colada",
    price: 75,
  },
  {
    id: "COC11",
    name: "Piñada",
    price: 70,
  },
  {
    id: "COC12",
    name: "Conga",
    price: 75,
  },
  {
    id: "COC13",
    name: "Destornillador",
    price: 75,
  },
  {
    id: "COC14",
    name: "Paloma",
    price: 80,
  },
  {
    id: "COC15",
    name: "Carajillo",
    price: 90,
  },
  {
    id: "COC16",
    name: "Tinto de verano",
    price: 90,
  },
  {
    id: "COC17",
    name: "Clericot",
    price: 80,
  },
  {
    id: "PZ",
    name: "Pizza",
    variants: [
      { id: "PZV1", name: "Pizza Grande", price: 240 },
      { id: "PZV2", name: "Pizza Mediana", price: 190 },
      { id: "PZV3", name: "Pizza Chica", price: 140 },
      { id: "PZV4", name: "Pizza Grande C/R", price: 270 },
      { id: "PZV5", name: "Pizza Mediana C/R", price: 220 },
      { id: "PZV6", name: "Pizza Chica C/R", price: 160 },
    ],
    pizzaIngredients: [
      { id: "PZI1", name: "Especial", ingredientValue: 4 },
      { id: "PZI2", name: "Carnes Frias", ingredientValue: 4 },
      { id: "PZI3", name: "Carranza", ingredientValue: 4 },
      { id: "PZI4", name: "Zapata", ingredientValue: 4 },
      { id: "PZI5", name: "Villa", ingredientValue: 4 },
      { id: "PZI6", name: "Margarita", ingredientValue: 4 },
      { id: "PZI7", name: "Adelita", ingredientValue: 4 },
      { id: "PZI8", name: "Hawaiana", ingredientValue: 4 },
      { id: "PZI9", name: "Mexicana", ingredientValue: 4 },
      { id: "PZI10", name: "Rivera", ingredientValue: 4 },
      { id: "PZI11", name: "Kahlo", ingredientValue: 4 },
      { id: "PZI12", name: "Lupita", ingredientValue: 4 },
      { id: "PZI13", name: "Pepperoni", ingredientValue: 4 },
      { id: "PZI14", name: "La Lena", ingredientValue: 6 },
      { id: "PZI15", name: "La Maria", ingredientValue: 6 },
      { id: "PZI16", name: "Malinche", ingredientValue: 6 },
      { id: "PZI17", name: "Philadelphia", ingredientValue: 6 },
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
    await sequelize.sync({ alter: true });

    for (const product of menu) {
      const createdProduct = await Product.create({
        id: product.id,
        name: product.name,
        price: product.price || null,
      });

      if (product.variants) {
        for (const variant of product.variants) {
          await ProductVariant.create({
            id: variant.id,
            name: variant.name,
            price: variant.price,
            productId: createdProduct.id,
          });
        }
      }

      if (product.pizzaIngredients) {
        for (const ingredient of product.pizzaIngredients) {
          await PizzaIngredient.create({
            id: ingredient.id,
            name: ingredient.name,
            ingredientValue: ingredient.ingredientValue,
            productId: createdProduct.id,
          });
        }
      }

      if (product.modifiers) {
        for (const modifierType of product.modifiers) {
          const createdModifierType = await ModifierType.create({
            id: modifierType.id,
            name: modifierType.typeName,
            acceptsMultiple: modifierType.acceptsMultiple,
            productId: createdProduct.id,
          });

          for (const option of modifierType.options) {
            await Modifier.create({
              id: option.id,
              name: option.name,
              price: option.price,
              modifierTypeId: createdModifierType.id,
            });
          }
        }
      }
    }
    console.log("Menu items have been seeded successfully.");
  } catch (error) {
    console.error("Error seeding menu items:", error);
  } finally {
    await sequelize.close();
  }
};

seedMenuItems();
