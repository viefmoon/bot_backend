const { DataTypes } = require("sequelize");
const { sequelize } = require("../lib/db");

const PizzaHalf = {
  left: "left",
  right: "right",
  full: "full",
};

const IngredientAction = {
  add: "add",
  remove: "remove",
};

const SelectedPizzaIngredient = sequelize.define(
  "SelectedPizzaIngredient",
  {
    half: {
      type: DataTypes.ENUM(...Object.values(PizzaHalf)),
      allowNull: false,
      defaultValue: PizzaHalf.full,
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
    action: {
      type: DataTypes.ENUM(...Object.values(IngredientAction)),
      allowNull: false,
      defaultValue: IngredientAction.add,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = { SelectedPizzaIngredient, PizzaHalf, IngredientAction };
