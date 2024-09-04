const { DataTypes } = require("sequelize");
const { sequelize } = require("../lib/db");

const PreOrder = sequelize.define(
  "PreOrder",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    orderItems: {
      type: DataTypes.JSON,
      allowNull: false,
    },
    orderType: {
      type: DataTypes.ENUM("delivery", "pickup"),
      allowNull: false,
    },
    deliveryAddress: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    customerName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    messageId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = PreOrder;