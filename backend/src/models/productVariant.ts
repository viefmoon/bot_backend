import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/db";
import Product from "./product";

interface ProductVariantAttributes {
  id: string;
  name: string;
  price: number;
  productId: string;
  ingredients?: string;
  keywords?: string[];
  createdAt?: Date;
  updatedAt?: Date;
}

interface ProductVariantCreationAttributes
  extends Optional<ProductVariantAttributes, "id"> {}

class ProductVariant
  extends Model<ProductVariantAttributes, ProductVariantCreationAttributes>
  implements ProductVariantAttributes
{
  public id!: string;
  public name!: string;
  public price!: number;
  public productId!: string;
  public ingredients?: string;
  public keywords?: string[];

  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Asociaciones
  public readonly product?: Product;
}

ProductVariant.init(
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
      allowNull: false,
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
    modelName: "ProductVariant",
    timestamps: true,
  }
);

ProductVariant.belongsTo(Product, { foreignKey: "productId" });

export default ProductVariant;
