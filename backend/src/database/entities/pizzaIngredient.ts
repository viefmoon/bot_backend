import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../db";
import Availability from "./availability";

interface PizzaIngredientAttributes {
  id: string;
  name: string;
  ingredientValue: number;
  productId: string;
  ingredients?: string;
}

interface PizzaIngredientCreationAttributes
  extends Optional<PizzaIngredientAttributes, "id"> {}

class PizzaIngredient
  extends Model<PizzaIngredientAttributes, PizzaIngredientCreationAttributes>
  implements PizzaIngredientAttributes
{
  public id!: string;
  public name!: string;
  public ingredientValue!: number;
  public productId!: string;
  public ingredients?: string;

  // Associations
  public piAv?: Availability;
}

PizzaIngredient.init(
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
  },
  {
    sequelize,
    modelName: "PizzaIngredient",
    tableName: "PizzaIngredients",
    timestamps: false,
  }
);

export default PizzaIngredient;
