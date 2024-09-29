const { sequelize } = require("../lib/db");

// Importaciones individuales
const Customer = require("./customer");
const Order = require("./order");
const RestaurantConfig = require("./restaurantConfig");
const OrderItem = require("./orderItem");
const PizzaIngredient = require("./pizzaIngredient");
const Product = require("./product");
const ProductVariant = require("./productVariant");
const PreOrder = require("./preOrder");
const SelectedPizzaIngredient = require("./selectedPizzaIngredient");
const Modifier = require("./modifier");
const ModifierType = require("./modifierType");
const SelectedModifier = require("./selectedModifier");
const Availability = require("./availability");
const MessageRateLimit = require("./messageRateLimit");
const BannedCustomer = require("./bannedCustomer");
const MessageLog = require("./messageLog");
const NotificationPhone = require("./notificationPhone");
const CustomerDeliveryInfo = require("./customerDeliveryInfo");
const OrderDeliveryInfo = require("./orderDeliveryInfo");

// Define relationships
Order.hasMany(OrderItem, { foreignKey: "orderId", as: "orderItems" });
OrderItem.belongsTo(Order, { foreignKey: "orderId" });

Product.hasMany(ProductVariant, {
  foreignKey: "productId",
  as: "productVariants",
});
ProductVariant.belongsTo(Product, { foreignKey: "productId" });

Product.hasMany(PizzaIngredient, {
  foreignKey: "productId",
  as: "pizzaIngredients",
});
PizzaIngredient.belongsTo(Product, { foreignKey: "productId" });

OrderItem.hasMany(SelectedPizzaIngredient, {
  foreignKey: "orderItemId",
  as: "selectedPizzaIngredients",
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
SelectedModifier.belongsTo(Modifier, { foreignKey: "modifierId" });

Product.hasMany(ModifierType, { foreignKey: "productId", as: "modifierTypes" });
ModifierType.belongsTo(Product, { foreignKey: "productId" });

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

// Definir relaciones one-to-one
Customer.hasOne(CustomerDeliveryInfo, { foreignKey: 'customerId', as: 'customerDeliveryInfo' });
CustomerDeliveryInfo.belongsTo(Customer, { foreignKey: 'customerId' });

Order.hasOne(OrderDeliveryInfo, { foreignKey: 'orderId', as: 'orderDeliveryInfo' });
OrderDeliveryInfo.belongsTo(Order, { foreignKey: 'orderId' });

PreOrder.hasOne(OrderDeliveryInfo, { foreignKey: 'preOrderId', as: 'orderDeliveryInfo' });
OrderDeliveryInfo.belongsTo(PreOrder, { foreignKey: 'preOrderId' });

// Exportar todos los modelos y relaciones
module.exports = {
  sequelize,
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
  Availability,
  MessageRateLimit,
  BannedCustomer,
  MessageLog,
  PreOrder,
  NotificationPhone,
  CustomerDeliveryInfo,
  OrderDeliveryInfo,
};
