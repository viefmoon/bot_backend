const { DataTypes } = require('sequelize');
const { sequelize } = require('../lib/db');

const Order = sequelize.define('Order', {
    id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
    },
    order_type: {
        type: DataTypes.ENUM('delivery', 'pickup'),
        allowNull: false,
    },
    phone_number: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    delivery_address: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    pickup_name: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    total_price: {
        type: DataTypes.FLOAT,
        allowNull: false, 
    },
    status: {
        type: DataTypes.ENUM('created', 'accepted', 'preparing', 'delivering', 'completed', 'canceled'),
        allowNull: false,
        defaultValue: 'created',
    },
    client_id: {
        type: DataTypes.STRING,
        allowNull: false,
    },
}, {
    timestamps: true,
});

module.exports = Order;