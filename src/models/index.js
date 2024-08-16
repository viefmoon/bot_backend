const { sequelize } = require("../lib/db");
const Customer = require("./Customer");
const Order = require("./Order");
const RestaurantConfig = require("./RestaurantConfig");
const OrderItem = require("./orderItem");
const PizzaFlavor = require("./pizzaFlavor");
const PizzaIngredient = require("./pizzaIngredient");
const Product = require("./product");
const ProductVariant = require("./productVariant");
const SelectedPizzaFlavor = require("./selectedPizzaFlavor");
const { SelectedPizzaIngredient } = require("./selectedPizzaIngredient");
const Modifier = require("./modifier");
const ModifierType = require("./modifierType");
const SelectedModifier = require("./selectedModifier");

// Define relationships
Order.hasMany(OrderItem, { foreignKey: "orderId", as: "orderItems" });
OrderItem.belongsTo(Order, { foreignKey: "orderId" });

Product.hasMany(ProductVariant, { foreignKey: "productId", as: "variants" });
ProductVariant.belongsTo(Product, { foreignKey: "productId" });

Product.hasMany(PizzaFlavor, { foreignKey: "productId", as: "pizzaFlavors" });
PizzaFlavor.belongsTo(Product, { foreignKey: "productId" });

Product.hasMany(PizzaIngredient, {
  foreignKey: "productId",
  as: "pizzaIngredients",
});
PizzaIngredient.belongsTo(Product, { foreignKey: "productId" });

OrderItem.hasMany(SelectedPizzaFlavor, {
  foreignKey: "orderItemId",
  as: "selectedFlavors",
});
SelectedPizzaFlavor.belongsTo(OrderItem, { foreignKey: "orderItemId" });

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
      await Customer.sync({ alter: true });
      await Order.sync({ alter: true });
      await RestaurantConfig.sync({ alter: true });
      await OrderItem.sync({ alter: true });
      await PizzaFlavor.sync({ alter: true });
      await PizzaIngredient.sync({ alter: true });
      await Product.sync({ alter: true });
      await ProductVariant.sync({ alter: true });
      await SelectedPizzaFlavor.sync({ alter: true });
      await SelectedPizzaIngredient.sync({ alter: true });
      await Modifier.sync({ alter: true });
      await ModifierType.sync({ alter: true });
      await SelectedModifier.sync({ alter: true });
      console.log("All models have been synchronized.");
      break; // Exit the loop if synchronization is successful
    } catch (error) {
      if (
        error.name === "SequelizeDatabaseError" &&
        error.parent &&
        error.parent.code === "ER_LOCK_DEADLOCK"
      ) {
        console.warn(`Deadlock detected. Retrying... (${i + 1}/${retries})`);
        await new Promise((res) => setTimeout(res, 1000)); // Wait 1 second before retrying
      } else {
        console.error("Error synchronizing models:", error);
        break; // Exit the loop if the error is not a deadlock
      }
    }
  }
};

syncModels();

module.exports = {
  Customer,
  Item,
  Order,
  RestaurantConfig,
  OrderItem,
  PizzaFlavor,
  PizzaIngredient,
  Product,
  ProductVariant,
  SelectedPizzaFlavor,
  SelectedPizzaIngredient,
  Modifier,
  ModifierType,
  SelectedModifier,
  sequelize,
  syncModels,
};
