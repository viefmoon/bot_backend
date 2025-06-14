import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../db";
import Availability from "./availability";
interface ProductVariantAttributes {
  id: string;
  name: string;
  shortName?: string;
  price: number;
  productId: string;
  ingredients?: string;
}

interface ProductVariantCreationAttributes
  extends Optional<ProductVariantAttributes, "id"> {}

class ProductVariant
  extends Model<ProductVariantAttributes, ProductVariantCreationAttributes>
  implements ProductVariantAttributes
{
  public id!: string;
  public name!: string;
  public shortName?: string;
  public price!: number;
  public productId!: string;
  public ingredients?: string;

  public pvAv?: Availability;
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
    shortName: {
      type: DataTypes.STRING,
      allowNull: true,
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
  },
  {
    sequelize,
    modelName: "ProductVariant",
    tableName: "ProductVariants",
    timestamps: false,
  }
);

export default ProductVariant;
