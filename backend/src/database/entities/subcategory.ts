import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../db";
import Category from "./category";
import Product from "./product";

interface SubcategoryAttributes {
  id: string;
  name: string;
  categoryId: string;
}

interface SubcategoryCreationAttributes
  extends Optional<SubcategoryAttributes, "id"> {}

class Subcategory
  extends Model<SubcategoryAttributes, SubcategoryCreationAttributes>
  implements SubcategoryAttributes
{
  public id!: string;
  public name!: string;
  public categoryId!: string;

  // Associations
  public category?: Category;
  public products?: Product[];
}

Subcategory.init(
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
      allowNull: false,
    },
    name: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    categoryId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: "Categories",
        key: "id",
      },
    },
  },
  {
    sequelize,
    modelName: "Subcategory",
    tableName: "Subcategories",
    timestamps: false,
  }
);

export default Subcategory;
