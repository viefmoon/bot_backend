import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/db";
import CustomerDeliveryInfo from "./customerDeliveryInfo";

// Definición de la interfaz para los atributos del Customer
interface CustomerAttributes {
  clientId: string;
  fullChatHistory?: object;
  relevantChatHistory?: object;
  stripeCustomerId?: string;
  lastInteraction?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

// Definición de los atributos opcionales para la creación
interface CustomerCreationAttributes
  extends Optional<
    CustomerAttributes,
    | "fullChatHistory"
    | "relevantChatHistory"
    | "stripeCustomerId"
    | "lastInteraction"
  > {}

// Definición del modelo Customer
class Customer
  extends Model<CustomerAttributes, CustomerCreationAttributes>
  implements CustomerAttributes
{
  public clientId!: string;
  public fullChatHistory!: object | null;
  public relevantChatHistory!: object | null;
  public stripeCustomerId!: string | null;
  public lastInteraction!: Date | null;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Asociaciones
  public readonly customerDeliveryInfo?: CustomerDeliveryInfo;
}

Customer.init(
  {
    clientId: {
      type: DataTypes.STRING,
      allowNull: false,
      primaryKey: true,
      unique: true,
    },
    fullChatHistory: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    relevantChatHistory: {
      type: DataTypes.JSON,
      allowNull: true,
    },
    stripeCustomerId: {
      type: DataTypes.STRING,
      allowNull: true,
      unique: true,
    },
    lastInteraction: {
      type: DataTypes.DATE,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "Customer",
    timestamps: true,
  }
);

// Definir relaciones
Customer.hasOne(CustomerDeliveryInfo, {
  foreignKey: "clientId",
  as: "customerDeliveryInfo",
});

export default Customer;
