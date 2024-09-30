const { DataTypes } = require("sequelize");
const { sequelize } = require("../lib/db");

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

module.exports = MessageLog;
