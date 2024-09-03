const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

const MessageLog = sequelize.define("MessageLog", {
  messageId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  from: {
    type: DataTypes.STRING,
    allowNull: false,
  },
});

module.exports = MessageLog;
