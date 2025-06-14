import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../db";
import Subcategory from "./subcategory";

interface CategoryAttributes {
  id: string;
  name: string;
}

interface CategoryCreationAttributes
  extends Optional<CategoryAttributes, "id"> {}

class Category
  extends Model<CategoryAttributes, CategoryCreationAttributes>
  implements CategoryAttributes
{
  public id!: string;
  public name!: string;

  // Associations
  public subcategories?: Subcategory[];
}

Category.init(
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
  },
  {
    sequelize,
    modelName: "Category",
    tableName: "Categories",
    timestamps: false,
  }
);

export default Category;
