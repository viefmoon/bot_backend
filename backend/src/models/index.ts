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
import CustomerDeliveryInfo from "./customerDeliveryInfo";
import OrderDeliveryInfo from "./orderDeliveryInfo";
import Category from "./category";
import Subcategory from "./subcategory";

// Importar las asociaciones
import "./modelAssociations";

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
  CustomerDeliveryInfo,
  OrderDeliveryInfo,
  Category,
  Subcategory,
};
