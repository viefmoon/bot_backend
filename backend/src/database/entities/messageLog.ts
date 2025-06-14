import { DataTypes, Model } from "sequelize";
import { sequelize } from "../db";

interface MessageLogAttributes {
  id: number;
  messageId: string;
  processed: boolean;
}

class MessageLog
  extends Model<MessageLogAttributes>
  implements MessageLogAttributes
{
  public id!: number;
  public messageId!: string;
  public processed!: boolean;
}

MessageLog.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
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
