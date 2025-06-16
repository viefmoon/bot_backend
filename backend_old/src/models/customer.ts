import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/db";
import CustomerDeliveryInfo from "./customerDeliveryInfo";

// Definición de la interfaz para los atributos del Customer
export interface ChatMessage {
  role: string;
  content: string;
  timestamp: Date;
}

interface CustomerAttributes {
  customerId: string;
  fullChatHistory?: ChatMessage[] | string | null;
  relevantChatHistory?: ChatMessage[] | string | null;
  stripeCustomerId?: string | null;
  lastInteraction?: Date | null;
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
  public customerId!: string;
  public fullChatHistory!: ChatMessage[] | string | null;
  public relevantChatHistory!: ChatMessage[] | string | null;
  public stripeCustomerId!: string | null;
  public lastInteraction!: Date | null;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public customerDeliveryInfo?: CustomerDeliveryInfo;
}

Customer.init(
  {
    customerId: {
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
    tableName: "Customers",
    timestamps: true,
  }
);

export default Customer;
