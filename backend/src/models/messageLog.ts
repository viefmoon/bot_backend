import { DataTypes, Model } from "sequelize";
import { sequelize } from "../lib/db";

interface MessageLogAttributes {
  messageId: string;
  processed: boolean;
}

class MessageLog
  extends Model<MessageLogAttributes>
  implements MessageLogAttributes
{
  public messageId!: string;
  public processed!: boolean;
}

MessageLog.init(
  {
    messageId: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    processed: {
      type: DataTypes.BOOLEAN,
      defaultValue: false,
    },
  },
  {
    sequelize,
    modelName: "MessageLog",
    tableName: "MessageLogs",
    timestamps: false,
  }
);

export default MessageLog;
