const { sequelize } = require('../lib/db');
const Customer = require('./Customer');
const Item = require('./Item');
const Order = require('./Order');

const models = {
    Customer,
    Item,
    Order,
};

// Registrar asociaciones
Object.keys(models).forEach(modelName => {
    if (models[modelName].associate) {
        models[modelName].associate(models);
    }
});

// Sincronizar todos los modelos con la base de datos
const syncModels = async () => {
    try {
        await sequelize.sync({ alter: true });  // Usa { force: true } si quieres eliminar datos existentes
        console.log('La base de datos ha sido sincronizada.');
    } catch (error) {
        console.error('Error al sincronizar la base de datos:', error);
    }
};

syncModels();

module.exports = { ...models, sequelize };