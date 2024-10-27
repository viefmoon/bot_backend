import { DataTypes, Model } from "sequelize";
import { sequelize } from "../lib/db";
import PizzaIngredient from "./pizzaIngredient";

export enum PizzaHalf {
  left = "left",
  right = "right",
  full = "full",
}

export enum IngredientAction {
  add = "add",
  remove = "remove",
}

interface SelectedPizzaIngredientAttributes {
  half: PizzaHalf;
  pizzaIngredientId: string;
  orderItemId: number;
  action: IngredientAction;
}

class SelectedPizzaIngredient
  extends Model<SelectedPizzaIngredientAttributes>
  implements SelectedPizzaIngredientAttributes
{
  public half!: PizzaHalf;
  public pizzaIngredientId!: string;
  public orderItemId!: number;
  public action!: IngredientAction;

  public PizzaIngredient?: PizzaIngredient;
}

SelectedPizzaIngredient.init(
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
    sequelize,
    tableName: "SelectedPizzaIngredients",
    timestamps: false,
  }
);

export default SelectedPizzaIngredient;
