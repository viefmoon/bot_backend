const removeAccents = require("remove-accents");

function normalizeString(str) {
  return removeAccents(str).toLowerCase();
}

module.exports = {
  normalizeString,
};
