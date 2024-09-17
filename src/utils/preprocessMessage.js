const { partial_ratio } = require("fuzzball");
const { getMenuAvailability } = require("../pages/api/chat");
const { normalizeString } = require("./stringUtils");
const { tokenizeMessage, findEntityMentions } = require("./nlp");

async function preprocessMessage(message) {
  const menu = await getMenuAvailability();
  const normalizedMessage = normalizeString(message);
  const tokens = tokenizeMessage(normalizedMessage);

  const allEntities = menu.flatMap((producto) => [
    { type: "producto", ...producto },
    ...(producto.productVariants || []).map((v) => ({
      type: "variante",
      productId: producto.id,
      ...v,
    })),
    ...(producto.modifierTypes || []).flatMap((mt) =>
      mt.modifiers.map((m) => ({
        type: "modificador",
        productId: producto.id,
        ...m,
      }))
    ),
    ...(producto.pizzaIngredients || []).map((i) => ({
      type: "ingrediente",
      productId: producto.id,
      ...i,
    })),
  ]);

  const mentions = findEntityMentions(tokens, allEntities);
  mentions.push(...findFuzzyMentions(tokens, allEntities));

  const productosMencionados = processMentions(mentions, message, menu);
  const domicilio = extractDomicilio(message);

  return { productos: productosMencionados, domicilio };
}

function findFuzzyMentions(tokens, allEntities) {
  const fuzzyMentions = [];
  tokens.forEach((token, index) => {
    allEntities.forEach((entity) => {
      if (partial_ratio(token, normalizeString(entity.name)) > 80) {
        fuzzyMentions.push({ entity, index });
      }
    });
  });
  return fuzzyMentions;
}

function processMentions(mentions, message, menu) {
  const productosMencionadosMap = new Map();

  mentions.forEach((mention) => {
    const { entity } = mention;
    const producto = menu.find((p) => p.id === entity.productId);

    if (producto) {
      if (producto.name.toLowerCase().includes("pizza")) {
        processPizza(entity, productosMencionadosMap, message, producto);
      } else {
        processOtherProduct(entity, productosMencionadosMap, message, producto);
      }
    }
  });

  return Array.from(productosMencionadosMap.values());
}

function processPizza(entity, productosMencionadosMap, message, producto) {
  if (!productosMencionadosMap.has(entity.productId)) {
    productosMencionadosMap.set(entity.productId, {
      productId: entity.productId,
      name: entity.name,
      variantes: [],
      pizzaIngredients: [
        { half: "full", add: [], remove: [] },
        { half: "left", add: [], remove: [] },
        { half: "right", add: [], remove: [] },
      ],
      modificadores: [],
      comentarios: [],
    });
  }

  const pizza = productosMencionadosMap.get(entity.productId);
  const pizzaContext = extractPizzaContext(message, entity.name);

  processPizzaHalves(pizza, pizzaContext);
  processPizzaIngredients(pizza, pizzaContext, producto.pizzaIngredients);
  processVariants(pizza, pizzaContext, producto.productVariants);
  processModifiers(pizza, pizzaContext, producto.modifierTypes);

  pizza.comentarios.push(pizzaContext);
}

function processPizzaHalves(pizza, context) {
  if (context.includes("mitad")) {
    const halves = context.split("mitad");
    if (halves.length > 1) {
      processPizzaHalf(pizza, "left", halves[0]);
      processPizzaHalf(pizza, "right", halves[1]);
    }
  } else {
    processPizzaHalf(pizza, "full", context);
  }
}

function processPizzaHalf(pizza, half, context) {
  const halfIndex = half === "full" ? 0 : half === "left" ? 1 : 2;
  const ingredients = pizza.pizzaIngredients[halfIndex];

  // Procesar ingredientes para esta mitad
  const addKeywords = ["con", "agregar", "añadir"];
  const removeKeywords = ["sin", "quitar", "remover"];

  addKeywords.forEach((keyword) => {
    if (context.includes(keyword)) {
      const addIngredients = context
        .split(keyword)[1]
        .split(/[,y]/)
        .map((i) => i.trim())
        .filter((word) => word.length > 2);
      ingredients.add.push(...addIngredients);
    }
  });

  removeKeywords.forEach((keyword) => {
    if (context.includes(keyword)) {
      const removeIngredients = context
        .split(keyword)[1]
        .split(/[,y]/)
        .map((i) => i.trim())
        .filter((word) => word.length > 2);
      ingredients.remove.push(...removeIngredients);
    }
  });
}

function processPizzaIngredients(pizza, context, availableIngredients) {
  const specialties = availableIngredients
    .filter((i) => i.ingredientValue >= 4)
    .map((i) => ({ id: i.id, name: i.name }));

  specialties.forEach((specialty) => {
    if (context.toLowerCase().includes(specialty.name.toLowerCase())) {
      pizza.pizzaIngredients[0].add.push(specialty);
    }
  });

  availableIngredients.forEach((ingredient) => {
    if (context.toLowerCase().includes(ingredient.name.toLowerCase())) {
      pizza.pizzaIngredients[0].add.push({
        id: ingredient.id,
        name: ingredient.name,
      });
    }
  });
}

function processVariants(product, context, availableVariants) {
  availableVariants.forEach((variant) => {
    if (context.toLowerCase().includes(variant.name.toLowerCase())) {
      product.variantes.push({ id: variant.id, name: variant.name });
    }
  });
}

function processModifiers(product, context, availableModifierTypes) {
  availableModifierTypes.forEach((modifierType) => {
    modifierType.modifiers.forEach((modifier) => {
      if (context.toLowerCase().includes(modifier.name.toLowerCase())) {
        product.modificadores.push({ id: modifier.id, name: modifier.name });
      }
    });
  });
}

function processOtherProduct(
  entity,
  productosMencionadosMap,
  message,
  producto
) {
  if (!productosMencionadosMap.has(entity.productId)) {
    productosMencionadosMap.set(entity.productId, {
      productId: entity.productId,
      name: entity.name,
      variantes: [],
      modificadores: [],
      comentarios: [],
    });
  }

  const product = productosMencionadosMap.get(entity.productId);
  const productContext = extractProductContext(message, entity.name);

  processVariants(product, productContext, producto.productVariants);
  processModifiers(product, productContext, producto.modifierTypes);

  product.comentarios.push(productContext);
}

function extractPizzaContext(message, pizzaName) {
  const index = message.toLowerCase().indexOf(pizzaName.toLowerCase());
  if (index !== -1) {
    return message
      .slice(index + pizzaName.length)
      .split(",")[0]
      .trim();
  }
  return "";
}

function extractProductContext(message, productName) {
  const index = message.toLowerCase().indexOf(productName.toLowerCase());
  if (index !== -1) {
    return message
      .slice(index + productName.length)
      .split(",")[0]
      .trim();
  }
  return "";
}

function extractDomicilio(message) {
  const keywords = ["a", "en", "para", "dirección"];
  for (const keyword of keywords) {
    const index = message.toLowerCase().lastIndexOf(keyword);
    if (index !== -1) {
      return message.slice(index + keyword.length).trim();
    }
  }
  return "";
}

module.exports = {
  preprocessMessage,
};
