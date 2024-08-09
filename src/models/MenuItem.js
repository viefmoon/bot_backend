const { DataTypes } = require('sequelize');
const { sequelize } = require('../lib/db');

const MenuItem = sequelize.define('MenuItem', {
    code: {
        type: DataTypes.STRING,
        allowNull: false,
        primaryKey: true,
    },
    name: {
        type: DataTypes.STRING,
        allowNull: false,
    },
    available: {
        type: DataTypes.BOOLEAN,
        allowNull: false,
        defaultValue: true,
    },
}, {
    timestamps: true,
});

module.exports = MenuItem;