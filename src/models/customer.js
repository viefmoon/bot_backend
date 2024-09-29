const { DataTypes } = require("sequelize");
const { sequelize } = require("../lib/db");

const Customer = sequelize.define(
  "Customer",
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
    timestamps: true,
  }
);

module.exports = Customer;
