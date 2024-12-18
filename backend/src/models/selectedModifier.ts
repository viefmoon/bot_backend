import { DataTypes, Model } from "sequelize";
import { sequelize } from "../lib/db";
import Modifier from "./modifier"; // Asegúrate de importar el modelo Modifier

interface SelectedModifierAttributes {
  id: number;
  orderItemId: number;
  modifierId: string;
}

class SelectedModifier
  extends Model<SelectedModifierAttributes>
  implements SelectedModifierAttributes
{
  public id!: number;
  public orderItemId!: number;
  public modifierId!: string;

  // Asociación
  public modifier?: Modifier;
}

SelectedModifier.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    orderItemId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "OrderItems",
        key: "id",
      },
    },
    modifierId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: "Modifiers",
        key: "id",
      },
    },
  },
  {
    sequelize,
    modelName: "SelectedModifier",
    tableName: "SelectedModifiers",
    timestamps: false,
  }
);

export default SelectedModifier;
