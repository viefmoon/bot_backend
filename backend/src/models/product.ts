import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/db";

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

export default Product;