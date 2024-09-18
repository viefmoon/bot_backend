const { DataTypes } = require("sequelize");
const { sequelize } = require("../lib/db");

const PizzaIngredient = sequelize.define(
  "PizzaIngredient",
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
    ingredientValue: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    productId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: "Products",
        key: "id",
      },
    },
    ingredients: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    keywords: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = PizzaIngredient;
