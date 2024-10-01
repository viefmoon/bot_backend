import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/db";
import ProductVariant from "./productVariant";
import PizzaIngredient from "./pizzaIngredient";
import ModifierType from "./modifierType";

interface ProductAttributes {
  id: string;
  name: string;
  price?: number;
  category: string;
  ingredients?: string;
  keywords?: object;
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
  public keywords?: object;

  // Relaciones
  public readonly productVariants?: ProductVariant[];
  public readonly pizzaIngredients?: PizzaIngredient[];
  public readonly modifierTypes?: ModifierType[];

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;
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
    keywords: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "Product",
    timestamps: true,
  }
);

// Definición de relaciones
Product.hasMany(ProductVariant, {
  foreignKey: "productId",
  as: "productVariants",
});

Product.hasMany(PizzaIngredient, {
  foreignKey: "productId",
  as: "pizzaIngredients",
});

Product.hasMany(ModifierType, { foreignKey: "productId", as: "modifierTypes" });

export default Product;
