import { DataTypes, Model } from "sequelize";
import { sequelize } from "../lib/db";

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
