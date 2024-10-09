import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/db";
import ProductVariant from "./productVariant";
import ModifierType from "./modifierType";
import PizzaIngredient from "./pizzaIngredient";
import Availability from "./availability";

interface ProductAttributes {
  id: string;
  name: string;
  price?: number;
  category: string;
  ingredients?: string;
}

interface ProductCreationAttributes extends Optional<ProductAttributes, "id"> {}

class Product
  extends Model<ProductAttributes, ProductCreationAttributes>
  implements ProductAttributes
{
  public id!: string;
  public name!: string;
  public price?: number;
  public category!: string;
  public ingredients?: string;
  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  //associations
  public Availability?: Availability;
  public productVariants?: ProductVariant[];
  public modifierTypes?: ModifierType[];
  public pizzaIngredients?: PizzaIngredient[];
}

Product.init(
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
      allowNull: true,
    },
    category: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    ingredients: {
      type: DataTypes.STRING,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "Product",
    timestamps: true,
  }
);

export default Product;
