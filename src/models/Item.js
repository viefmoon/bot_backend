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

// Definir la asociación
Item.associate = function(models) {
    Item.belongsTo(models.Order, { foreignKey: 'orderId' });
};

module.exports = Item;