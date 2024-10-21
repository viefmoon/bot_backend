import { DataTypes, Model } from "sequelize";
import { sequelize } from "../lib/db";
import Modifier from "./modifier"; // Asegúrate de importar el modelo Modifier

interface SelectedModifierAttributes {
  orderItemId: number;
  modifierId: string;
}

class SelectedModifier
  extends Model<SelectedModifierAttributes>
  implements SelectedModifierAttributes
{
  public orderItemId!: number;
  public modifierId!: string;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Asociación
  public modifier?: Modifier;
}

SelectedModifier.init(
  {
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
    timestamps: true,
  }
);

export default SelectedModifier;
