import { DataTypes, Model } from "sequelize";
import { sequelize } from "../lib/db";

interface MessageRateLimitAttributes {
  id: number;
  customerId: string;
  messageCount: number;
  lastMessageTime: Date;
}

class MessageRateLimit
  extends Model<MessageRateLimitAttributes>
  implements MessageRateLimitAttributes
{
  public id!: number;
  public customerId!: string;
  public messageCount!: number;
  public lastMessageTime!: Date;
}

MessageRateLimit.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    customerId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    messageCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
    },
    lastMessageTime: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "MessageRateLimit",
    tableName: "MessageRateLimits",
    timestamps: false,
  }
);

export default MessageRateLimit;
