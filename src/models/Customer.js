const { DataTypes } = require('sequelize');
const { sequelize } = require('../lib/db');

const Customer = sequelize.define('Customer', {
    client_id: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true,
        unique: true,
    },
    last_delivery_address: {
        type: DataTypes.STRING,
        allowNull: true,
    },
    last_pickup_name: {
        type: DataTypes.STRING,
        allowNull: true,
    },
}, {
    timestamps: true,
});

module.exports = Customer;