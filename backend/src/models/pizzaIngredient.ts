import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/db";
import Availability from "./availability";

interface PizzaIngredientAttributes {
  id: string;
  name: string;
  ingredientValue: number;
  productId: string;
  ingredients?: string;
  keywords?: object;
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
  public keywords?: object;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public Availability?: Availability;
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
    keywords: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "PizzaIngredient",
    timestamps: true,
  }
);

export default PizzaIngredient;
