import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/db";
import Modifier from "./modifier";

interface ModifierTypeAttributes {
  id: string;
  name: string;
  acceptsMultiple: boolean;
  required: boolean;
  productId: string;
}

interface ModifierTypeCreationAttributes
  extends Optional<ModifierTypeAttributes, "id"> {}

class ModifierType
  extends Model<ModifierTypeAttributes, ModifierTypeCreationAttributes>
  implements ModifierTypeAttributes
{
  public id!: string;
  public name!: string;
  public acceptsMultiple!: boolean;
  public required!: boolean;
  public productId!: string;

  // Associations
  public modifiers?: Modifier[];
}

ModifierType.init(
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
    acceptsMultiple: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    required: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
    },
    productId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: "Products",
        key: "id",
      },
    },
  },
  {
    sequelize,
    modelName: "ModifierType",
    tableName: "ModifierTypes",
    timestamps: false,
  }
);

export default ModifierType;
