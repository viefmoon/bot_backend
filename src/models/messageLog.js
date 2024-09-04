import { DataTypes } from "sequelize";
import sequelize from "../config/database";

const MessageLog = sequelize.define("MessageLog", {
  messageId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  processed: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
});

export default MessageLog;
