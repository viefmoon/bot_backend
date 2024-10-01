import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/db";

interface PreOrderAttributes {
  id: number;
  orderItems: any; // Considera usar un tipo más específico si es posible
  orderType: "delivery" | "pickup";
  scheduledDeliveryTime?: Date;
  clientId: string;
  messageId: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface PreOrderCreationAttributes
  extends Optional<PreOrderAttributes, "id"> {}

class PreOrder
  extends Model<PreOrderAttributes, PreOrderCreationAttributes>
  implements PreOrderAttributes
{
  public id!: number;
  public orderItems!: any;
  public orderType!: "delivery" | "pickup";
  public scheduledDeliveryTime?: Date;
  public clientId!: string;
  public messageId!: string;

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

PreOrder.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    orderItems: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    orderType: {
      type: DataTypes.ENUM("delivery", "pickup"),
      allowNull: false,
    },
    scheduledDeliveryTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    clientId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    messageId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "PreOrder",
    timestamps: true,
  }
);

export default PreOrder;