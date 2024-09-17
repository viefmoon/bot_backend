// bot_backend/src/utils/nlp.js
const natural = require("natural");
const tokenizer = new natural.WordTokenizer();
const { normalizeString } = require("./stringUtils");

function tokenizeMessage(message) {
  return tokenizer.tokenize(normalizeString(message));
}

function findEntityMentions(tokens, entities) {
  const mentions = [];
  for (const entity of entities) {
    const normalizedEntity = normalizeString(entity.name);
    const entityTokens = tokenizer.tokenize(normalizedEntity);

    for (let i = 0; i <= tokens.length - entityTokens.length; i++) {
      const slice = tokens.slice(i, i + entityTokens.length);
      if (slice.join(" ") === entityTokens.join(" ")) {
        mentions.push({
          entity: entity,
          index: i,
        });
      }
    }
  }
  return mentions;
}

module.exports = {
  tokenizeMessage,
  findEntityMentions,
};
