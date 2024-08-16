const { DataTypes } = require("sequelize");
const { sequelize } = require("../lib/db");

const PizzaFlavor = sequelize.define(
  "PizzaFlavor",
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    price: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    productId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: "Products",
        key: "id",
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = PizzaFlavor;
