import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../db";

interface RestaurantConfigAttributes {
  id: number;
  acceptingOrders: boolean;
  estimatedPickupTime: number;
  estimatedDeliveryTime: number;
}

interface RestaurantConfigCreationAttributes
  extends Optional<RestaurantConfigAttributes, "id"> {}

class RestaurantConfig
  extends Model<RestaurantConfigAttributes, RestaurantConfigCreationAttributes>
  implements RestaurantConfigAttributes
{
  public id!: number;
  public acceptingOrders!: boolean;
  public estimatedPickupTime!: number;
  public estimatedDeliveryTime!: number;
}

RestaurantConfig.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    acceptingOrders: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
    estimatedPickupTime: {
      type: DataTypes.INTEGER,
      defaultValue: 20,
      comment: "Tiempo estimado de recolección en minutos",
    },
    estimatedDeliveryTime: {
      type: DataTypes.INTEGER,
      defaultValue: 40,
      comment: "Tiempo estimado de entrega a domicilio en minutos",
    },
  },
  {
    sequelize,
    modelName: "RestaurantConfig",
    tableName: "RestaurantConfigs",
    timestamps: false,
  }
);

export default RestaurantConfig;
