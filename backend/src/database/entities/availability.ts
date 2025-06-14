import { DataTypes, Model } from "sequelize";
import { sequelize } from "../db";

// Definimos una interfaz para los atributos de Availability
interface AvailabilityAttributes {
  id: number;
  entityId: string;
  entityType: "product" | "productVariant" | "modifier" | "pizzaIngredient";
  available: boolean;
}

// Extendemos Model con los atributos de Availability
class Availability
  extends Model<AvailabilityAttributes>
  implements AvailabilityAttributes
{
  public id!: number;
  public entityId!: string;
  public entityType!: "product" | "productVariant" | "modifier" | "pizzaIngredient";
  public available!: boolean;
}

Availability.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    entityId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    entityType: {
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
    }
  },
  {
    sequelize,
    modelName: "Availability",
    tableName: "Availabilities",
    timestamps: false,
  }
);

export default Availability;
