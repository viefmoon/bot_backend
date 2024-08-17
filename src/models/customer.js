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
    lastDeliveryAddress: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    lastPickupName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = Customer;
