import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/db";

interface CustomerDeliveryInfoAttributes {
  id: number;
  customerId: string;
  streetAddress: string;
  neighborhood: string;
  postalCode: string;
  city: string;
  state: string;
  country: string;
  latitude: number;
  longitude: number;
  pickupName?: string;
  geocodedAddress?: string;
  additionalDetails?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

interface CustomerDeliveryInfoCreationAttributes
  extends Optional<CustomerDeliveryInfoAttributes, "id"> {}

class CustomerDeliveryInfo
  extends Model<
    CustomerDeliveryInfoAttributes,
    CustomerDeliveryInfoCreationAttributes
  >
  implements CustomerDeliveryInfoAttributes
{
  public id!: number;
  public customerId!: string;
  public streetAddress!: string;
  public neighborhood!: string;
  public postalCode!: string;
  public city!: string;
  public state!: string;
  public country!: string;
  public latitude!: number;
  public longitude!: number;
  public pickupName?: string;
  public geocodedAddress?: string;
  public additionalDetails?: string;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
}

CustomerDeliveryInfo.init(
  {
    id: {
      type: DataTypes.INTEGER.UNSIGNED,
      autoIncrement: true,
      primaryKey: true,
    },
    customerId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    streetAddress: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    neighborhood: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    postalCode: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    city: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    state: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    country: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    latitude: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    longitude: {
      type: DataTypes.FLOAT,
      allowNull: false,
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
  },
  {
    sequelize,
    modelName: "CustomerDeliveryInfo",
    tableName: "CustomerDeliveryInfos",
    timestamps: true,
  }
);

export default CustomerDeliveryInfo;
