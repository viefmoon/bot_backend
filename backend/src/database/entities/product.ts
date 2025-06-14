import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../db";
import ProductVariant from "./productVariant";
import ModifierType from "./modifierType";
import PizzaIngredient from "./pizzaIngredient";
import Availability from "./availability";

interface ProductAttributes {
  id: string;
  name: string;
  shortName?: string;
  price?: number;
  ingredients?: string;
  subcategoryId: string;
}

interface ProductCreationAttributes extends Optional<ProductAttributes, "id"> {}

class Product
  extends Model<ProductAttributes, ProductCreationAttributes>
  implements ProductAttributes
{
  public id!: string;
  public name!: string;
  public shortName?: string;
  public price?: number;
  public ingredients?: string;
  public subcategoryId: string;
  //associations
  public pAv?: Availability;
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
    shortName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    price: {
      type: DataTypes.FLOAT,
      allowNull: true,
    },
    ingredients: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    subcategoryId: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "Product",
    tableName: "Products",
    timestamps: false,
  }
);

export default Product;
