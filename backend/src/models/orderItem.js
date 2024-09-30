const { DataTypes } = require("sequelize");
const { sequelize } = require("../lib/db");

const OrderItem = sequelize.define(
  "OrderItem",
  {
    quantity: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 1,
    },
    price: {
      type: DataTypes.FLOAT,
      allowNull: false,
    },
    comments: {
      type: DataTypes.STRING,
      allowNull: true,
    },
    orderId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      references: {
        model: "Orders",
        key: "id",
      },
    },
    productId: {
      type: DataTypes.STRING,
      allowNull: false,
      references: {
        model: "Products",
        key: "id",
      },
    },
    productVariantId: {
      type: DataTypes.STRING,
      allowNull: true,
      references: {
        model: "ProductVariants",
        key: "id",
      },
    },
  },
  {
    timestamps: true,
  }
);

module.exports = OrderItem;
