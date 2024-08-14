const { DataTypes } = require('sequelize');
const { sequelize } = require('../lib/db');

const Item = sequelize.define('Item', {
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    quantity: {
        type: DataTypes.INTEGER,
        allowNull: false,
    },
    price: {
        type: DataTypes.FLOAT,
        allowNull: false,
    },
    observations: {
        type: DataTypes.TEXT,
        allowNull: true,
    },
    orderId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'Orders',
            key: 'id',
        },
    },
}, {
    timestamps: true,
});

module.exports = Item;