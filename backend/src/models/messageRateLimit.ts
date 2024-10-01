import { DataTypes, Model } from "sequelize";
import { sequelize } from "../lib/db";

interface MessageRateLimitAttributes {
  clientId: string;
  messageCount: number;
  lastMessageTime: Date;
}

class MessageRateLimit
  extends Model<MessageRateLimitAttributes>
  implements MessageRateLimitAttributes
{
  public clientId!: string;
  public messageCount!: number;
  public lastMessageTime!: Date;
}

MessageRateLimit.init(
  {
    clientId: {
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
  }
);

export default MessageRateLimit;
