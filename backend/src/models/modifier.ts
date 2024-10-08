import { DataTypes, Model, Optional } from "sequelize";
import { sequelize } from "../lib/db";
import ModifierType from "./modifierType";
import Availability from "./availability";

interface ModifierAttributes {
  id: string;
  name: string;
  price: number;
  modifierTypeId: string;
  keywords?: object;
}

interface ModifierCreationAttributes
  extends Optional<ModifierAttributes, "id"> {}

class Modifier
  extends Model<ModifierAttributes, ModifierCreationAttributes>
  implements ModifierAttributes
{
  public id!: string;
  public name!: string;
  public price!: number;
  public modifierTypeId!: string;
  public keywords?: object;

  // Timestamps
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  // Associations
  public modifierType?: ModifierType;
  public Availability?: Availability;
}

Modifier.init(
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
    modifierTypeId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: "ModifierTypes",
        key: "id",
      },
    },
    keywords: {
      type: DataTypes.JSON,
      allowNull: true,
    },
  },
  {
    sequelize,
    modelName: "Modifier",
    timestamps: true,
  }
);

export default Modifier;
