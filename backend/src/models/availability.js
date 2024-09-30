const { DataTypes } = require("sequelize");
const { sequelize } = require("../lib/db");

const Availability = sequelize.define("Availability", {
  id: {
    type: DataTypes.STRING,
    primaryKey: true,
  },
  type: {
    type: DataTypes.ENUM(
      "product",
      "productVariant",
      "modifier",
      "pizzaIngredient"
    ),
    allowNull: false,
  },
  available: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
});

module.exports = Availability;
