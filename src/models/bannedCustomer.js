const { DataTypes } = require("sequelize");
const { sequelize } = require("../lib/db");

const BannedCustomer = sequelize.define("BannedCustomer", {
  clientId: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
  },
  bannedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

module.exports = BannedCustomer;
