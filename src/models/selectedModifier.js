const { DataTypes } = require("sequelize");
const { sequelize } = require("../lib/db");

const SelectedModifier = sequelize.define(
  "SelectedModifier",
  {
    orderItemId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "OrderItem",
        key: "id",
      },
    },
    modifierId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: "Modifiers",
        key: "id",
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = SelectedModifier;
