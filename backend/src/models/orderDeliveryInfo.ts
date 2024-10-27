import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/db";

export interface OrderDeliveryInfoAttributes {
  id: number;
  streetAddress?: string;
  neighborhood?: string;
  postalCode?: string;
  city?: string;
  state?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  pickupName?: string;
  geocodedAddress?: string;
  additionalDetails?: string;
  createdAt?: Date;
  updatedAt?: Date;
  preOrderId?: number; // Añadir este campo
  orderId?: number; // Añadir este campo si es necesario
}

export interface OrderDeliveryInfoCreationAttributes
  extends Optional<OrderDeliveryInfoAttributes, "id"> {}

class OrderDeliveryInfo
  extends Model<
    OrderDeliveryInfoAttributes,
    OrderDeliveryInfoCreationAttributes
  >
  implements OrderDeliveryInfoAttributes
{
  public id!: number;
  public streetAddress!: string | null;
  public neighborhood!: string | null;
  public postalCode!: string | null;
  public city!: string | null;
  public state!: string | null;
  public country!: string | null;
  public latitude!: number | null;
  public longitude!: number | null;
  public pickupName!: string | null;
  public geocodedAddress!: string | null;
  public additionalDetails!: string | null;
  public preOrderId!: number | null; // Añadir este campo
  public orderId!: number | null; // Añadir este campo si es necesario

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

OrderDeliveryInfo.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    streetAddress: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    neighborhood: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    postalCode: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    city: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    state: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    country: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    latitude: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    longitude: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    pickupName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    geocodedAddress: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    additionalDetails: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    preOrderId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
    orderId: {
      type: DataTypes.INTEGER.UNSIGNED,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "OrderDeliveryInfo",
    tableName: "OrderDeliveryInfos",
    timestamps: true,
  }
);

export default OrderDeliveryInfo;
