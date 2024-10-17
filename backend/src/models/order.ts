import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/db";
import OrderItem from "./orderItem";

interface OrderAttributes {
  id: number;
  dailyOrderNumber: number;
  orderType: "delivery" | "pickup";
  status:
    | "created"
    | "accepted"
    | "in_preparation"
    | "prepared"
    | "in_delivery"
    | "finished"
    | "canceled";
  paymentStatus?: "pending" | "paid";
  totalCost: number;
  clientId: string;
  estimatedTime: number;
  scheduledDeliveryTime?: Date;
  messageId?: string;
  stripeSessionId?: string;
  finishedAt?: Date; // Nuevo campo
  createdAt: Date; // Añadido
  updatedAt: Date; // Añadido
  syncedWithLocal: boolean; // Nueva bandera
  localId?: number; // Nuevo campo para ID local
}

interface OrderCreationAttributes extends Optional<OrderAttributes, "id"> {}

class Order
  extends Model<OrderAttributes, OrderCreationAttributes>
  implements OrderAttributes
{
  public id!: number;
  public dailyOrderNumber!: number;
  public orderType!: "delivery" | "pickup";
  public status!:
    | "created"
    | "accepted"
    | "in_preparation"
    | "prepared"
    | "in_delivery"
    | "finished"
    | "canceled";
  public paymentStatus?: "pending" | "paid";
  public totalCost!: number;
  public clientId!: string;
  public estimatedTime!: number;
  public scheduledDeliveryTime?: Date;
  public messageId?: string;
  public stripeSessionId?: string;
  public finishedAt?: Date; // Nuevo campo

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  //associations
  public orderItems?: OrderItem[];

  public syncedWithLocal!: boolean; // Nueva bandera
  public localId?: number; // Nuevo campo para ID local
}

Order.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    dailyOrderNumber: {
      type: DataTypes.INTEGER,
      allowNull: false,
    },
    orderType: {
      type: DataTypes.ENUM("delivery", "pickup"),
      allowNull: false,
    },
    status: {
      type: DataTypes.ENUM(
        "created",
        "accepted",
        "in_preparation",
        "prepared",
        "in_delivery",
        "finished",
        "canceled"
      ),
      allowNull: false,
      defaultValue: "created",
    },
    paymentStatus: {
      type: DataTypes.ENUM("pending", "paid"),
      allowNull: true,
    },
    totalCost: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    clientId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    estimatedTime: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    scheduledDeliveryTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    messageId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    stripeSessionId: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    finishedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    syncedWithLocal: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    localId: {
      type: DataTypes.INTEGER,
      allowNull: true,
    },
    createdAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    updatedAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "Order",
    timestamps: true,
  }
);

export default Order;
