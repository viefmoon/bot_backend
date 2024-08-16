const { DataTypes } = require("sequelize");
const { sequelize } = require("../lib/db");

const Modifier = sequelize.define(
  "Modifier",
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
        model: "ModifierType",
        key: "id",
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = Modifier;
