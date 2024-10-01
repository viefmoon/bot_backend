import { sequelize } from "../lib/db";

// Importaciones individuales
import Customer from "./customer";
import Order from "./order";
import RestaurantConfig from "./restaurantConfig";
import OrderItem from "./orderItem";
import PizzaIngredient from "./pizzaIngredient";
import Product from "./product";
import ProductVariant from "./productVariant";
import PreOrder from "./preOrder";
import SelectedPizzaIngredient from "./selectedPizzaIngredient";
import Modifier from "./modifier";
import ModifierType from "./modifierType";
import SelectedModifier from "./selectedModifier";
import Availability from "./availability";
import MessageRateLimit from "./messageRateLimit";
import BannedCustomer from "./bannedCustomer";
import MessageLog from "./messageLog";
import NotificationPhone from "./notificationPhone";
import CustomerDeliveryInfo from "./customerDeliveryInfo";
import OrderDeliveryInfo from "./orderDeliveryInfo";

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
Customer.hasOne(CustomerDeliveryInfo, {
  foreignKey: "clientId",
  as: "customerDeliveryInfo",
});
CustomerDeliveryInfo.belongsTo(Customer, { foreignKey: "clientId" });

Order.hasOne(OrderDeliveryInfo, {
  foreignKey: "orderId",
  as: "orderDeliveryInfo",
});
OrderDeliveryInfo.belongsTo(Order, { foreignKey: "orderId" });

PreOrder.hasOne(OrderDeliveryInfo, {
  foreignKey: "preOrderId",
  as: "orderDeliveryInfo",
});
OrderDeliveryInfo.belongsTo(PreOrder, { foreignKey: "preOrderId" });

// Exportar todos los modelos y relaciones
export {
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
