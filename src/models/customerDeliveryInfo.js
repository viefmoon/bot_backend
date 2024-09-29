const { DataTypes } = require("sequelize");
const { sequelize } = require("../lib/db");

const CustomerDeliveryInfo = sequelize.define(
  "CustomerDeliveryInfo",
  {
    streetAddress: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    neighborhood: {
     type: DataTypes.STRING,
      allowNull: false,
    },
    postalCode: {
        type: DataTypes.STRING,
        allowNull: false,
      },
    city: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    state: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    country: {
      type: DataTypes.STRING,
      allowNull: false,
    },
    latitude: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    longitude: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    pickupName: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    geocodedAddress: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    additionalDetails: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    timestamps: true,
  }
);

module.exports = CustomerDeliveryInfo;