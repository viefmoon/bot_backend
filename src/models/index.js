const { sequelize } = require('../lib/db');
const Customer = require('./Customer');
const Item = require('./Item');
const Order = require('./Order');

// Definir relaciones
Order.hasMany(Item, { foreignKey: 'orderId', as: 'items' });
Item.belongsTo(Order, { foreignKey: 'orderId' });

// Sincronizar todos los modelos con la base de datos
const syncModels = async (retries = 5) => {
    for (let i = 0; i < retries; i++) {
        try {
            await Customer.sync({ alter: true });
            await Item.sync({ alter: true });
            await Order.sync({ alter: true });
            console.log('Todos los modelos han sido sincronizados.');
            break; // Salir del bucle si la sincronización es exitosa
        } catch (error) {
            if (error.name === 'SequelizeDatabaseError' && error.parent && error.parent.code === 'ER_LOCK_DEADLOCK') {
                console.warn(`Deadlock detectado. Reintentando... (${i + 1}/${retries})`);
                await new Promise(res => setTimeout(res, 1000)); // Esperar 1 segundo antes de reintentar
            } else {
                console.error('Error al sincronizar los modelos:', error);
                break; // Salir del bucle si el error no es un deadlock
            }
        }
    }
};

syncModels();

module.exports = { Customer, Item, Order, sequelize, syncModels };