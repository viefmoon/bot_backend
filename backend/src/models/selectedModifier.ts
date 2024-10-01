import { DataTypes, Model } from "sequelize";
import { sequelize } from "../lib/db";
import OrderItem from "./orderItem";
import Modifier from "./modifier";

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

  // Asociaciones
  public readonly orderItem?: OrderItem;
  public readonly modifier?: Modifier;
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

// Definir las relaciones al final del archivo
SelectedModifier.belongsTo(OrderItem, { foreignKey: "orderItemId" });
SelectedModifier.belongsTo(Modifier, { foreignKey: "modifierId" });

export default SelectedModifier;
