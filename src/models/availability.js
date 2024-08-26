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
      "variant",
      "modifier",
      "pizzaIngredient",
      "modifierType"
    ),
    allowNull: false,
  },
  available: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
});

module.exports = Availability;
