import Availability from "./availability";
import Customer from "./customer";
import CustomerDeliveryInfo from "./customerDeliveryInfo";
import Modifier from "./modifier";
import ModifierType from "./modifierType";
import Order from "./order";
import OrderDeliveryInfo from "./orderDeliveryInfo";
import OrderItem from "./orderItem";
import PizzaIngredient from "./pizzaIngredient";
import PreOrder from "./preOrder";
import Product from "./product";
import ProductVariant from "./productVariant";
import SelectedModifier from "./selectedModifier";
import SelectedPizzaIngredient from "./selectedPizzaIngredient";
import Category from "./category";
import Subcategory from "./subcategory";

// Customer associations
Customer.hasOne(CustomerDeliveryInfo, {
  foreignKey: "clientId",
  as: "customerDeliveryInfo",
});
CustomerDeliveryInfo.belongsTo(Customer, { foreignKey: "clientId" });

// Product associations
Product.hasMany(ProductVariant, {
  foreignKey: "productId",
  as: "productVariants",
});
Product.hasMany(PizzaIngredient, {
  foreignKey: "productId",
  as: "pizzaIngredients",
});
Product.hasMany(ModifierType, { foreignKey: "productId", as: "modifierTypes" });

// ProductVariant associations
ProductVariant.belongsTo(Product, { foreignKey: "productId" });

// ModifierType associations
ModifierType.hasMany(Modifier, {
  foreignKey: "modifierTypeId",
  as: "modifiers",
});
ModifierType.belongsTo(Product, { foreignKey: "productId" });

// Modifier associations
Modifier.belongsTo(ModifierType, { foreignKey: "modifierTypeId" });

// PizzaIngredient associations
PizzaIngredient.belongsTo(Product, { foreignKey: "productId" });
PizzaIngredient.hasMany(SelectedPizzaIngredient, {
  foreignKey: "pizzaIngredientId",
  as: "selectedPizzaIngredients",
});

// Order associations
Order.hasMany(OrderItem, { foreignKey: "orderId", as: "orderItems" });
Order.hasOne(OrderDeliveryInfo, {
  foreignKey: "orderId",
  as: "orderDeliveryInfo",
});

// OrderItem associations
OrderItem.belongsTo(Order, { foreignKey: "orderId" });
OrderItem.belongsTo(Product, { foreignKey: "productId" });
OrderItem.belongsTo(ProductVariant, {
  foreignKey: "productVariantId",
  as: "productVariant",
});
OrderItem.hasMany(SelectedPizzaIngredient, {
  foreignKey: "orderItemId",
  as: "selectedPizzaIngredients",
});
OrderItem.hasMany(SelectedModifier, {
  foreignKey: "orderItemId",
  as: "selectedModifiers",
});
// OrderDeliveryInfo associations
OrderDeliveryInfo.belongsTo(Order, { foreignKey: "orderId" });
OrderDeliveryInfo.belongsTo(PreOrder, { foreignKey: "preOrderId" });

// PreOrder associations
PreOrder.hasOne(OrderDeliveryInfo, {
  foreignKey: "preOrderId",
  as: "orderDeliveryInfo",
});
// SelectedModifier associations
SelectedModifier.belongsTo(OrderItem, { foreignKey: "orderItemId" });
SelectedModifier.belongsTo(Modifier, { foreignKey: "modifierId" });

// SelectedPizzaIngredient associations
SelectedPizzaIngredient.belongsTo(OrderItem, { foreignKey: "orderItemId" });
SelectedPizzaIngredient.belongsTo(PizzaIngredient, {
  foreignKey: "pizzaIngredientId",
});

// Availability associations
Availability.belongsTo(Product, {
  foreignKey: "id",
  constraints: false,
  scope: { type: "product" },
});

Product.hasOne(Availability, {
  foreignKey: "id",
  constraints: false,
  scope: { type: "product" },
});

Availability.belongsTo(ProductVariant, {
  foreignKey: "id",
  constraints: false,
  scope: { type: "productVariant" },
});

ProductVariant.hasOne(Availability, {
  foreignKey: "id",
  constraints: false,
  scope: { type: "productVariant" },
});

Availability.belongsTo(PizzaIngredient, {
  foreignKey: "id",
  constraints: false,
  scope: { type: "pizzaIngredient" },
});

PizzaIngredient.hasOne(Availability, {
  foreignKey: "id",
  constraints: false,
  scope: { type: "pizzaIngredient" },
});

Availability.belongsTo(ModifierType, {
  foreignKey: "id",
  constraints: false,
  scope: { type: "modifierType" },
});

ModifierType.hasOne(Availability, {
  foreignKey: "id",
  constraints: false,
  scope: { type: "modifierType" },
});

Availability.belongsTo(Modifier, {
  foreignKey: "id",
  constraints: false,
  scope: { type: "modifier" },
});

Modifier.hasOne(Availability, {
  foreignKey: "id",
  constraints: false,
  scope: { type: "modifier" },
});

// Nuevas asociaciones para Category y Subcategory
Category.hasMany(Subcategory, {
  foreignKey: "categoryId",
  as: "subcategories",
});

Subcategory.belongsTo(Category, {
  foreignKey: "categoryId",
  as: "category",
});

Subcategory.hasMany(Product, {
  foreignKey: "subcategoryId",
  as: "products",
});

Product.belongsTo(Subcategory, {
  foreignKey: "subcategoryId",
  as: "subcategory",
});
