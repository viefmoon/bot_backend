const { DataTypes } = require("sequelize");
const { sequelize } = require("../lib/db");

const MessageRateLimit = sequelize.define('MessageRateLimit', {
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
});

module.exports = MessageRateLimit;