const { DataTypes } = require('sequelize');
const { sequelize } = require('../lib/db');

const Order = sequelize.define('Order', {
    items: {
        type: DataTypes.JSON,
        allowNull: false,
    },
    phone_number: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    delivery_address: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    total_price: {
        type: DataTypes.FLOAT,
        allowNull: false,
    },
}, {
    timestamps: true,
});

module.exports = Order;