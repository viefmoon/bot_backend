const { DataTypes } = require('sequelize');
const { sequelize } = require('../lib/db');

const SelectedPizzaFlavor = sequelize.define('SelectedPizzaFlavor', {
    pizzaFlavorId: {
        type: DataTypes.STRING,
        allowNull: false,
        references: {
            model: 'PizzaFlavors',
            key: 'id',
        },
    },
    orderItemId: {
        type: DataTypes.INTEGER,
        allowNull: false,
        references: {
            model: 'OrderItems',
            key: 'id',
        },
    },
}, {
    timestamps: true,
});

module.exports = SelectedPizzaFlavor;