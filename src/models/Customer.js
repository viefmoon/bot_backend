const { DataTypes } = require('sequelize');
const { sequelize } = require('../lib/db');

const Customer = sequelize.define('Customer', {
    phone_number: {
        type: DataTypes.STRING,
        allowNull: false,
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
    client_id: {
        type: DataTypes.STRING(6),
        allowNull: false,
        unique: true,
    },
}, {
    timestamps: true,
});

module.exports = Customer;