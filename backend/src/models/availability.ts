import { DataTypes, Model } from "sequelize";
import { sequelize } from "../lib/db";
import Product from "./product";
import ProductVariant from "./productVariant";
import PizzaIngredient from "./pizzaIngredient";
import ModifierType from "./modifierType";
import Modifier from "./modifier";

// Definimos una interfaz para los atributos de Availability
interface AvailabilityAttributes {
  id: string;
  type: "product" | "productVariant" | "modifier" | "pizzaIngredient";
  available: boolean;
}

// Extendemos Model con los atributos de Availability
class Availability
  extends Model<AvailabilityAttributes>
  implements AvailabilityAttributes
{
  public id!: string;
  public type!: "product" | "productVariant" | "modifier" | "pizzaIngredient";
  public available!: boolean;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  //asociaciones
  public readonly product?: Product;
  public readonly productVariant?: ProductVariant;
  public readonly pizzaIngredient?: PizzaIngredient;
  public readonly modifierType?: ModifierType;
  public readonly modifier?: Modifier;
}

Availability.init(
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    type: {
      type: DataTypes.ENUM(
        "product",
        "productVariant",
        "modifier",
        "pizzaIngredient"
      ),
      allowNull: false,
    },
    available: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    sequelize,
    modelName: "Availability",
  }
);

// Definir las relaciones
Availability.belongsTo(Product, {
  foreignKey: "id",
  constraints: false,
  scope: { type: "product" },
});

Availability.belongsTo(ProductVariant, {
  foreignKey: "id",
  constraints: false,
  scope: { type: "productVariant" },
});

Availability.belongsTo(PizzaIngredient, {
  foreignKey: "id",
  constraints: false,
  scope: { type: "pizzaIngredient" },
});

Availability.belongsTo(ModifierType, {
  foreignKey: "id",
  constraints: false,
  scope: { type: "modifierType" },
});

Availability.belongsTo(Modifier, {
  foreignKey: "id",
  constraints: false,
  scope: { type: "modifier" },
});

export default Availability;
