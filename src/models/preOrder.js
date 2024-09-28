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
    deliveryInfo: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    scheduledDeliveryTime: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    clientId: {
      type: DataTypes.STRING,
      allowNull: false,
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
