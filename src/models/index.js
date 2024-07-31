const { Sequelize } = require('sequelize');
const sequelize = new Sequelize('app', 'tu_usuario', 'tu_contraseña', {
    host: 'localhost',
    dialect: 'mysql',
});

const Customer = require('./Customer');
const Item = require('./Item');
const Order = require('./Order');

// Definir relaciones si es necesario
Order.hasMany(Item, { foreignKey: 'orderId' });
Item.belongsTo(Order, { foreignKey: 'orderId' });

// Sincronizar todos los modelos con la base de datos
sequelize.sync({ force: true })
    .then(() => {
        console.log('La base de datos ha sido sincronizada.');
    })
    .catch(error => {
        console.error('Error al sincronizar la base de datos:', error);
    });

module.exports = { Customer, Item, Order, sequelize };