const { DataTypes } = require("sequelize");
const { sequelize } = require("../lib/db");

const PizzaHalf = {
  left: "left",
  right: "right",
  none: "none",
};

const SelectedPizzaIngredient = sequelize.define(
  "SelectedPizzaIngredient",
  {
    half: {
      type: DataTypes.ENUM(...Object.values(PizzaHalf)),
      allowNull: false,
      defaultValue: PizzaHalf.none,
    },
    pizzaIngredientId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: "PizzaIngredients",
        key: "id",
      },
    },
    orderItemId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "OrderItems",
        key: "id",
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = { SelectedPizzaIngredient, PizzaHalf };
