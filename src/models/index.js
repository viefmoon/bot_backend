const { sequelize } = require('../lib/db');
const Customer = require('./Customer');
const Item = require('./Item');
const Order = require('./Order');
const MenuItem = require('./MenuItem');
const RestaurantConfig = require('./RestaurantConfig'); // Import the new model

// Define relationships
Order.hasMany(Item, { foreignKey: 'orderId', as: 'items' });
Item.belongsTo(Order, { foreignKey: 'orderId' });

// Sync all models with the database
const syncModels = async (retries = 5) => {
    for (let i = 0; i < retries; i++) {
        try {
            await Customer.sync({ alter: true });
            await Item.sync({ alter: true });
            await Order.sync({ alter: true });
            await MenuItem.sync({ alter: true });
            await RestaurantConfig.sync({ alter: true }); // Sync the new model
            console.log('All models have been synchronized.');
            break; // Exit the loop if synchronization is successful
        } catch (error) {
            if (error.name === 'SequelizeDatabaseError' && error.parent && error.parent.code === 'ER_LOCK_DEADLOCK') {
                console.warn(`Deadlock detected. Retrying... (${i + 1}/${retries})`);
                await new Promise(res => setTimeout(res, 1000)); // Wait 1 second before retrying
            } else {
                console.error('Error synchronizing models:', error);
                break; // Exit the loop if the error is not a deadlock
            }
        }
    }
};

syncModels();

module.exports = { Customer, Item, Order, MenuItem, RestaurantConfig, sequelize, syncModels };