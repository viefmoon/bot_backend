const { DataTypes } = require('sequelize');
const { sequelize } = require('../lib/db');

const Order = sequelize.define('Order', {
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
}, {
    timestamps: true,
});

// Sincronizar el modelo con la base de datos
sequelize.sync({ alter: true })
    .then(() => {
        console.log('La tabla Orders ha sido actualizada.');
    })
    .catch(error => {
        console.error('Error al sincronizar la tabla Orders:', error);
    });

module.exports = Order;