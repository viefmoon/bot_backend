require('dotenv').config();
const { sequelize } = require('../src/lib/db');
const MenuItem = require('../src/models/MenuItem');

const menuItems = [
  { code: "E001", available: true },
  { code: "E002", available: true },
  { code: "E002-V001", available: true },
  { code: "E002-V002", available: true },
  { code: "E002-V003", available: false },
  { code: "E003", available: true },
  { code: "E004-V001", available: true },
  { code: "E004-V001-T001", available: true },
  { code: "E004-V001-T002", available: true },
  { code: "I001", available: true },
  { code: "I002", available: true },
  { code: "I003", available: true },
  { code: "I004", available: true },
  { code: "I005", available: true },
  { code: "I006", available: true },
  { code: "I007", available: true },
  { code: "I008", available: true },
  { code: "I009", available: true },
  { code: "I010", available: true },
  { code: "I011", available: true },
  { code: "I012", available: true },
  { code: "I013", available: true },
  { code: "I014", available: true },
  { code: "I015", available: true },
  { code: "I016", available: true },
  { code: "I017", available: true },
  { code: "I018", available: true },
  { code: "I019", available: true },
  { code: "I020", available: true },
  { code: "I021", available: true },
  { code: "I022", available: true },
  { code: "I023", available: true },
  { code: "I024", available: true },
  { code: "I025", available: true },
  { code: "I026", available: true },
  { code: "I027", available: true },
  { code: "I028", available: true },
  { code: "I029", available: true },
  { code: "I030", available: true },
  { code: "I031", available: true },
  { code: "I032", available: true },
  { code: "I033", available: true },
  { code: "P001-T001", available: true },
  { code: "P001-T002", available: true },
  { code: "P001-T003", available: true },
  { code: "O001", available: true },
  { code: "O002", available: true },
  { code: "O003", available: true },
  { code: "P001", available: true },
  { code: "P002", available: true },
  { code: "P003", available: true },
  { code: "P004", available: true },
  { code: "P005", available: true },
  { code: "P006", available: true },
  { code: "P007", available: true },
  { code: "P008", available: true },
  { code: "P009", available: true },
  { code: "P010", available: true },
  { code: "P011", available: true },
  { code: "P012", available: true },
  { code: "P013", available: true },
  { code: "P014", available: true },
  { code: "P015", available: true },
  { code: "P016", available: true },
  { code: "P017", available: true },
];

const seedMenuItems = async () => {
  try {
    await sequelize.sync({ alter: true });
    await MenuItem.bulkCreate(menuItems, { ignoreDuplicates: true });
    console.log('Menu items have been seeded successfully.');
  } catch (error) {
    console.error('Error seeding menu items:', error);
  } finally {
    await sequelize.close();
  }
};

seedMenuItems();