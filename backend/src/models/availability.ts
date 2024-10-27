import { DataTypes, Model } from "sequelize";
import { sequelize } from "../lib/db";

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
    tableName: "Availabilities",
    timestamps: false,
  }
);

export default Availability;
