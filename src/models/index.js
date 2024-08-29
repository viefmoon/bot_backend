const { sequelize } = require("../lib/db");
const Customer = require("./customer");
const Order = require("./order");
const RestaurantConfig = require("./restaurantConfig");
const OrderItem = require("./orderItem");
const PizzaIngredient = require("./pizzaIngredient");
const Product = require("./product");
const ProductVariant = require("./productVariant");
const { SelectedPizzaIngredient } = require("./selectedPizzaIngredient");
const Modifier = require("./modifier");
const ModifierType = require("./modifierType");
const SelectedModifier = require("./selectedModifier");
const Availability = require("./availability"); // Añade esta línea

// Define relationships
Order.hasMany(OrderItem, { foreignKey: "orderId", as: "orderItems" });
OrderItem.belongsTo(Order, { foreignKey: "orderId" });

Product.hasMany(ProductVariant, {
  foreignKey: "productId",
  as: "ProductVariants",
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

// Añade esta nueva relación
Product.hasMany(ModifierType, { foreignKey: "productId", as: "modifierTypes" });
ModifierType.belongsTo(Product, { foreignKey: "productId" });

// Añade estas nuevas relaciones
PizzaIngredient.hasMany(SelectedPizzaIngredient, {
  foreignKey: "pizzaIngredientId",
  as: "selectedPizzaIngredients",
});
SelectedPizzaIngredient.belongsTo(PizzaIngredient, {
  foreignKey: "pizzaIngredientId",
});

// Añade relaciones para Availability si es necesario
Product.hasOne(Availability, {
  foreignKey: "id",
  constraints: false,
  scope: { type: "product" },
});
ProductVariant.hasOne(Availability, {
  foreignKey: "id",
  constraints: false,
  scope: { type: "productVariant" },
});
PizzaIngredient.hasOne(Availability, {
  foreignKey: "id",
  constraints: false,
  scope: { type: "pizzaIngredient" },
});
ModifierType.hasOne(Availability, {
  foreignKey: "id",
  constraints: false,
  scope: { type: "modifierType" },
});
Modifier.hasOne(Availability, {
  foreignKey: "id",
  constraints: false,
  scope: { type: "modifier" },
});

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
  Availability, // Añade esta línea
  sequelize,
};
