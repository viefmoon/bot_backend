import { Model, DataTypes } from "sequelize";
import { sequelize } from "../lib/db";

class SeederControl extends Model {
  public id!: string;
  public lastRun!: Date;
}

SeederControl.init(
  {
    id: {
      type: DataTypes.STRING,
      primaryKey: true,
    },
    lastRun: {
      type: DataTypes.DATE,
      allowNull: false,
    },
  },
  {
    sequelize,
    modelName: "SeederControl",
    timestamps: false,
  }
);

export default SeederControl;
