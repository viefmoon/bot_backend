const { DataTypes } = require("sequelize");
const { sequelize } = require("../lib/db");

const NotificationPhone = sequelize.define(
  "NotificationPhone",
  {
    phoneNumber: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = NotificationPhone;
