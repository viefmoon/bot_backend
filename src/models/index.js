const { sequelize } = require("../lib/db");
const Customer = require("./Customer");
const Order = require("./Order");
const RestaurantConfig = require("./RestaurantConfig");
const OrderItem = require("./orderItem");
const PizzaIngredient = require("./pizzaIngredient");
const Product = require("./product");
const ProductVariant = require("./productVariant");
const { SelectedPizzaIngredient } = require("./selectedPizzaIngredient");
const Modifier = require("./modifier");
const ModifierType = require("./modifierType");
const SelectedModifier = require("./selectedModifier");

// Define relationships
Order.hasMany(OrderItem, { foreignKey: "orderId", as: "orderItems" });
OrderItem.belongsTo(Order, { foreignKey: "orderId" });

Product.hasMany(ProductVariant, { foreignKey: "productId", as: "variants" });
ProductVariant.belongsTo(Product, { foreignKey: "productId" });

Product.hasMany(PizzaIngredient, {
  foreignKey: "productId",
  as: "pizzaIngredients",
});
PizzaIngredient.belongsTo(Product, { foreignKey: "productId" });

OrderItem.hasMany(SelectedPizzaIngredient, {
  foreignKey: "orderItemId",
  as: "selectedIngredients",
});
SelectedPizzaIngredient.belongsTo(OrderItem, { foreignKey: "orderItemId" });

OrderItem.belongsTo(Product, { foreignKey: "productId" });
OrderItem.belongsTo(ProductVariant, { foreignKey: "productVariantId" });

ModifierType.hasMany(Modifier, {
  foreignKey: "modifierTypeId",
  as: "modifiers",
});
Modifier.belongsTo(ModifierType, { foreignKey: "modifierTypeId" });

OrderItem.hasMany(SelectedModifier, {
  foreignKey: "orderItemId",
  as: "selectedModifiers",
});
SelectedModifier.belongsTo(OrderItem, { foreignKey: "orderItemId" });

// Sync all models with the database
const syncModels = async (retries = 5) => {
  for (let i = 0; i < retries; i++) {
    try {
      await sequelize.query("SET FOREIGN_KEY_CHECKS = 0");

      // Paso 1: Crear todas las tablas sin restricciones de clave foránea
      const models = [
        RestaurantConfig,
        Customer,
        Product,
        ProductVariant,
        ModifierType,
        Modifier,
        Order,
        OrderItem,
        PizzaIngredient,
        SelectedPizzaIngredient,
        SelectedModifier,
      ];

      for (const model of models) {
        await model.sync({ alter: true, force: false });
      }

      // Paso 2: Añadir restricciones de clave foránea
      await sequelize.query("SET FOREIGN_KEY_CHECKS = 1");

      // Definir relaciones
      Order.hasMany(OrderItem, { foreignKey: "orderId", as: "orderItems" });
      OrderItem.belongsTo(Order, { foreignKey: "orderId" });
      Product.hasMany(ProductVariant, {
        foreignKey: "productId",
        as: "variants",
      });
      ProductVariant.belongsTo(Product, { foreignKey: "productId" });
      Product.hasMany(PizzaIngredient, {
        foreignKey: "productId",
        as: "pizzaIngredients",
      });
      PizzaIngredient.belongsTo(Product, { foreignKey: "productId" });
      OrderItem.hasMany(SelectedPizzaIngredient, {
        foreignKey: "orderItemId",
        as: "selectedIngredients",
      });
      SelectedPizzaIngredient.belongsTo(OrderItem, {
        foreignKey: "orderItemId",
      });
      OrderItem.belongsTo(Product, { foreignKey: "productId" });
      OrderItem.belongsTo(ProductVariant, { foreignKey: "productVariantId" });
      ModifierType.hasMany(Modifier, {
        foreignKey: "modifierTypeId",
        as: "modifiers",
      });
      Modifier.belongsTo(ModifierType, { foreignKey: "modifierTypeId" });
      OrderItem.hasMany(SelectedModifier, {
        foreignKey: "orderItemId",
        as: "selectedModifiers",
      });
      SelectedModifier.belongsTo(OrderItem, { foreignKey: "orderItemId" });

      // Aplicar las relaciones
      await sequelize.sync({ alter: true });

      console.log("Todos los modelos han sido sincronizados.");
      break; // Salir del bucle si la sincronización es exitosa
    } catch (error) {
      console.error("Error al sincronizar modelos:", error);
      if (i === retries - 1) {
        throw error; // Lanzar el error si hemos agotado todos los intentos
      }
      await new Promise((res) => setTimeout(res, 1000)); // Esperar 1 segundo antes de reintentar
    }
  }
};

syncModels();

module.exports = {
  Customer,
  Order,
  RestaurantConfig,
  OrderItem,
  PizzaIngredient,
  Product,
  ProductVariant,
  SelectedPizzaIngredient,
  Modifier,
  ModifierType,
  SelectedModifier,
  sequelize,
  syncModels,
};
