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
        await Customer.sync({ alter: true });
        await Item.sync({ alter: true });
        await Order.sync({ alter: true });
        console.log('Todos los modelos han sido sincronizados.');
    } catch (error) {
        console.error('Error al sincronizar los modelos:', error);
    }
};

syncModels();

module.exports = { Customer, Item, Order, sequelize };