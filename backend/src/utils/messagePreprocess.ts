import {
  ProductVariant,
  PizzaIngredient,
  Modifier,
} from "../models";
import OpenAI from "openai";
import { preprocessOrderTool, sendMenuTool } from "../aiTools/aiTools";
import * as dotenv from "dotenv";
import { SYSTEM_MESSAGE_PHASE_1 } from "../config/predefinedMessages";
import getFullMenu from "src/data/menu";
import * as stringSimilarity from "string-similarity";
import { removeScoreField, splitMessageIntoPhrases, detectActionAndHalf, generateNGrams, normalizeText } from "../utils/messageProcessUtils";
import { getMenuAvailability } from "./menuUtils";
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface MenuItem {
  productId?: string;
  name: string;
  productVariant?: ProductVariant;
  selectedModifiers?: Modifier[];
  selectedPizzaIngredients?: PizzaIngredient[];
  errors?: string[];
}

interface PreprocessedContent {
  orderItems: {
    description: string;
    menuItem?: MenuItem;
  }[];
}

const SIMILARITY_THRESHOLDS = {
  WORD: 0.8,
  PRODUCT: 0.8,
  VARIANT: 0.8,
  MODIFIER: 0.8,
  INGREDIENT: 0.8
};

function extractMentionedProduct(productMessage, menu) {
  const messageWords = normalizeText(productMessage);
  const errors = [];
  const productWordsSet = new Set<string>();

  const normalizedProducts = menu.map((product) => {
    const normalizedNameArray = normalizeText(product.name);
    normalizedNameArray.forEach((word) => productWordsSet.add(word));
    return {
      ...product,
      normalizedName: normalizedNameArray.join(" "),
      wordCount: normalizedNameArray.length,
    };
  });

  const productWordsArray = Array.from(productWordsSet);
  const filteredMessageWords = messageWords.filter((messageWord) =>
    productWordsArray.some((productWord) =>
      stringSimilarity.compareTwoStrings(messageWord, productWord) >= SIMILARITY_THRESHOLDS.WORD
    )
  );

  let bestProduct = null;
  let highestScore = 0;
  const maxProductNameWordCount = Math.max(...normalizedProducts.map((p) => p.wordCount));
  const messageNGrams = generateNGrams(filteredMessageWords, maxProductNameWordCount);

  for (const ngram of messageNGrams) {
    for (const product of normalizedProducts) {
      const similarity = stringSimilarity.compareTwoStrings(ngram, product.normalizedName);
      if (similarity >= SIMILARITY_THRESHOLDS.PRODUCT && similarity >= highestScore) {
        highestScore = similarity;
        bestProduct = { ...product, score: similarity };
      }
    }
  }

  if (bestProduct && bestProduct.score >= SIMILARITY_THRESHOLDS.PRODUCT) {
    bestProduct = findBestVariant(bestProduct, messageWords, errors);
    bestProduct = findModifiers(bestProduct, messageWords, errors);
    bestProduct = findPizzaIngredients(bestProduct, messageWords, productMessage, errors);
    if (errors.length > 0) bestProduct.errors = errors;
    delete bestProduct.productVariants;
    delete bestProduct.modifierTypes;
    delete bestProduct.pizzaIngredients;
    return removeScoreField(bestProduct);
  } else {
    errors.push(`Lo siento, no pude identificar dentro del menu un producto válido para "${productMessage}". 😕`);
    return { errors };
  }
}

function findBestVariant(bestProduct, messageWords, errors) {
  if (bestProduct.productVariants && bestProduct.productVariants.length > 0) {
    const productNameWords = new Set(normalizeText(bestProduct.name));
    const variantWordsSet = new Set<string>();
    const normalizedVariants = bestProduct.productVariants.map((variant) => {
      const normalizedNameArray = normalizeText(variant.name).filter((word) => !productNameWords.has(word));
      normalizedNameArray.forEach((word) => variantWordsSet.add(word));
      return {
        ...variant,
        normalizedName: normalizedNameArray.join(" "),
        wordCount: normalizedNameArray.length,
      };
    });

    const variantMessageWords = messageWords.filter((word) => !productNameWords.has(word));
    const filteredVariantMessageWords = variantMessageWords.filter((messageWord) =>
      Array.from(variantWordsSet).some((variantWord) =>
        stringSimilarity.compareTwoStrings(messageWord, variantWord) >= SIMILARITY_THRESHOLDS.WORD
      )
    );

    let bestVariant = null;
    let highestVariantScore = 0;
    const maxVariantNameWordCount = Math.max(...normalizedVariants.map((v) => v.wordCount));
    const variantMessageNGrams = generateNGrams(filteredVariantMessageWords, maxVariantNameWordCount);

    for (const ngram of variantMessageNGrams) {
      for (const variant of normalizedVariants) {
        const similarity = stringSimilarity.compareTwoStrings(ngram, variant.normalizedName);
        if (similarity >= SIMILARITY_THRESHOLDS.VARIANT && similarity >= highestVariantScore) {
          highestVariantScore = similarity;
          bestVariant = { ...variant, score: similarity };
        }
      }
    }

    if (bestVariant && bestVariant.score >= SIMILARITY_THRESHOLDS.VARIANT) {
      bestProduct.productVariant = bestVariant;
    } else {
      errors.push(`Lo siento, no pude identificar en el menu una variante (requerida) válida para el producto.`);
    }
  }
  return bestProduct;
}


function findModifiers(bestProduct, messageWords, errors) {
  if (bestProduct.modifierTypes && bestProduct.modifierTypes.length > 0) {
    const collectedModifiers = [];
    for (const modifierType of bestProduct.modifierTypes) {
      const { name: modifierTypeName, acceptsMultiple, required, modifiers } = modifierType;
      const modifierWordsSet = new Set<string>();
      const normalizedModifiers = modifiers.map((modifier) => {
        const normalizedNameArray = normalizeText(modifier.name);
        normalizedNameArray.forEach((word) => modifierWordsSet.add(word));
        return {
          ...modifier,
          normalizedName: normalizedNameArray.join(" "),
          wordCount: normalizedNameArray.length,
        };
      });

      const filteredModifierMessageWords = messageWords.filter((messageWord) =>
        Array.from(modifierWordsSet).some((modifierWord) =>
          stringSimilarity.compareTwoStrings(messageWord, modifierWord) >= SIMILARITY_THRESHOLDS.WORD
        )
      );

      let matchedModifiers = [];
      const maxModifierNameWordCount = Math.max(...normalizedModifiers.map((m) => m.wordCount));
      const modifierMessageNGrams = generateNGrams(filteredModifierMessageWords, maxModifierNameWordCount);

      for (const ngram of modifierMessageNGrams) {
        for (const modifier of normalizedModifiers) {
          const similarity = stringSimilarity.compareTwoStrings(ngram, modifier.normalizedName);
          if (similarity >= SIMILARITY_THRESHOLDS.MODIFIER) {
            matchedModifiers.push({ ...modifier, score: similarity });
          }
        }
      }

      const uniqueModifiersMap = new Map();
      for (const modifier of matchedModifiers) {
        if (!uniqueModifiersMap.has(modifier.modifierId) || uniqueModifiersMap.get(modifier.modifierId).score < modifier.score) {
          uniqueModifiersMap.set(modifier.modifierId, modifier);
        }
      }
      matchedModifiers = Array.from(uniqueModifiersMap.values());

      if (matchedModifiers.length === 0 && required) {
        errors.push(`Lo siento, no pude identificar en el menu modificadores para el grupo requerido '${modifierTypeName}'. 😕`);
      } else if (matchedModifiers.length > 0) {
        if (!acceptsMultiple) {
          const bestModifier = matchedModifiers.reduce((best, current) => current.score > best.score ? current : best, matchedModifiers[0]);
          collectedModifiers.push({ modifierId: bestModifier.modifierId, name: bestModifier.name });
        } else {
          collectedModifiers.push(...matchedModifiers.map((modifier) => ({ modifierId: modifier.modifierId, name: modifier.name })));
        }
      }
    }
    bestProduct.selectedModifiers = collectedModifiers;
  }
  return bestProduct;
}

function findPizzaIngredients(bestProduct, messageWords, productMessage, errors) {
  if (bestProduct.pizzaIngredients && bestProduct.pizzaIngredients.length > 0) {
    const productNameWords = new Set(normalizeText(bestProduct.name));
    const variantNameWords = new Set();
    if (bestProduct.productVariant) {
      normalizeText(bestProduct.productVariant.name).forEach((word) => variantNameWords.add(word));
    }

    const modifierWords = new Set();
    if (bestProduct.modifierTypes && bestProduct.modifierTypes.length > 0) {
      for (const modifierType of bestProduct.modifierTypes) {
        for (const modifier of modifierType.modifiers) {
          normalizeText(modifier.name).forEach((word) => modifierWords.add(word));
        }
      }
    }

    const pizzaIngredientMessageWords = messageWords.filter(
      (word) => !productNameWords.has(word) && !variantNameWords.has(word) && !modifierWords.has(word)
    );

    const pizzaIngredientWordsSet = new Set<string>();
    const normalizedPizzaIngredients = bestProduct.pizzaIngredients.map((ingredient) => {
      const normalizedNameArray = normalizeText(ingredient.name);
      normalizedNameArray.forEach((word) => pizzaIngredientWordsSet.add(word));
      return {
        ...ingredient,
        normalizedName: normalizedNameArray.join(" "),
        wordCount: normalizedNameArray.length,
      };
    });

    const filteredPizzaIngredientMessageWords = pizzaIngredientMessageWords.filter((messageWord) =>
      Array.from(pizzaIngredientWordsSet).some((ingredientWord) =>
        stringSimilarity.compareTwoStrings(messageWord, ingredientWord) >= SIMILARITY_THRESHOLDS.WORD
      )
    );

    const phrases = splitMessageIntoPhrases(productMessage);
    let matchedIngredients = [];

    for (const phrase of phrases) {
      const phraseWords = normalizeText(phrase);
      let { action, half } = detectActionAndHalf(phraseWords);
      if (!action) action = 'add';
      if (!half) half = 'full';

      const maxIngredientNameWordCount = Math.max(...normalizedPizzaIngredients.map((ing) => ing.wordCount));
      const ingredientPhraseNGrams = generateNGrams(phraseWords, maxIngredientNameWordCount);

      for (const ngram of ingredientPhraseNGrams) {
        for (const ingredient of normalizedPizzaIngredients) {
          const similarity = stringSimilarity.compareTwoStrings(ngram, ingredient.normalizedName);
          if (similarity >= SIMILARITY_THRESHOLDS.INGREDIENT) {
            matchedIngredients.push({ ...ingredient, action, half, score: similarity });
          }
        }
      }
    }

    const uniqueIngredientsMap = new Map();
    for (const ingredient of matchedIngredients) {
      const key = `${ingredient.pizzaIngredientId}-${ingredient.half}-${ingredient.action}`;
      if (!uniqueIngredientsMap.has(key) || uniqueIngredientsMap.get(key).score < ingredient.score) {
        uniqueIngredientsMap.set(key, ingredient);
      }
    }
    matchedIngredients = Array.from(uniqueIngredientsMap.values());

    if (matchedIngredients.length === 0) {
      errors.push(`Lo siento, no pude identificar en el menú ingredientes para el producto "${productMessage}". 😕`);
    } else {
      bestProduct.selectedPizzaIngredients = matchedIngredients;
    }
  }
  return bestProduct;
}

export async function preprocessMessages(messages: any[]): Promise<
  | PreprocessedContent
  | {
      text: string;
      isDirectResponse: boolean;
      isRelevant: boolean;
      confirmationMessage?: string;
    }
> {
  const systemMessageForPreprocessing = {
    role: "system",
    content: SYSTEM_MESSAGE_PHASE_1,
  };

  const preprocessingMessages = [systemMessageForPreprocessing, ...messages];

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: preprocessingMessages,
    tools: [...preprocessOrderTool, ...sendMenuTool] as any,
    temperature: 0.2,
    parallel_tool_calls: false,
  });


  if (response.choices[0].message.tool_calls) {
    const toolCall = response.choices[0].message.tool_calls[0];

    if (toolCall.function.name === "preprocess_order") {
      const preprocessedContent: PreprocessedContent = JSON.parse(toolCall.function.arguments);
      const fullMenu = await getMenuAvailability();

      for (const item of preprocessedContent.orderItems) {
        if (item && typeof item.description === "string") {
          const extractedProduct = await extractMentionedProduct(item.description, fullMenu);
          Object.assign(item, extractedProduct);
        }
      }

      const allErrors = preprocessedContent.orderItems
        .filter((item) => item.menuItem && item.menuItem.errors)
        .flatMap((item) => item.menuItem.errors);

      if (allErrors.length > 0) {
        return {
          text: `Se encontraron los siguientes problemas con tu pedido:\n${allErrors.join("\n")}\nRecuerda que puedes solicitarme el menú disponible o revisar el catálogo en WhatsApp para ver los productos disponibles.`,
          isDirectResponse: true,
          isRelevant: true,
        };
      }
      return preprocessedContent;
    } else if (toolCall.function.name === "send_menu") {
      const fullMenu = await getFullMenu();
      return {
        text: fullMenu,
        isDirectResponse: true,
        isRelevant: false,
        confirmationMessage: "El menú ha sido enviado. ¿Hay algo más en lo que pueda ayudarte?",
      };
    }
  } else if (response.choices[0].message.content) {
    return {
      text: response.choices[0].message.content,
      isDirectResponse: true,
      isRelevant: true,
    };
  } else {
    return {
      text: "Error al preprocesar el mensaje",
      isDirectResponse: true,
      isRelevant: true,
    };
  }

  throw new Error("No se pudo procesar la respuesta");
}