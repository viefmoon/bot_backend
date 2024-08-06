const { sequelize } = require('../lib/db');
const Customer = require('./Customer');
const Item = require('./Item');
const Order = require('./Order');

// Definir relaciones
Order.hasMany(Item, { foreignKey: 'orderId', as: 'items' });
Item.belongsTo(Order, { foreignKey: 'orderId' });

// Sincronizar todos los modelos con la base de datos
const syncModels = async () => {
    try {
        await sequelize.sync({ force: true });  // Cambia esto de vuelta a { alter: true } después de la sincronización
        console.log('La base de datos ha sido sincronizada.');
    } catch (error) {
        console.error('Error al sincronizar la base de datos:', error);
    }
};

syncModels();

module.exports = { Customer, Item, Order, sequelize };