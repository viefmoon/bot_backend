const { DataTypes } = require("sequelize");
const { sequelize } = require("../lib/db");

const ModifierType = sequelize.define(
  "ModifierType",
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
    timestamps: true,
  }
);

module.exports = ModifierType;
