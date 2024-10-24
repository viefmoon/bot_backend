import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import * as dotenv from "dotenv";
import getFullMenu from "src/data/menu";
import * as stringSimilarity from "string-similarity";
import {
  removeScoreField,
  generateNGrams,
  normalizeText,
  normalizeTextForIngredients,
  getErrorsAndWarnings,
  logTokenUsageClaude,
  PreprocessedContent,
  MenuItem,
  SIMILARITY_THRESHOLDS,
  AIResponse,
  prepareRequestPayloadClaude,
  detectUnknownWords,
  prepareModelGemini,
} from "../utils/messageProcessUtils";
import { getMenuAvailability } from "./menuUtils";
import logger from "./logger";
import { AgentType } from "../types/agents";
import { AGENTS_CLAUDE } from "../config/agents";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { AGENTS_GEMINI } from "../config/agents";
dotenv.config();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

// Inicializa el cliente de Gemini
const googleAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

function extractMentionedProduct(productMessage, menu) {
  logger.info("productMessage", productMessage);
  const messageWords = normalizeText(productMessage);
  const errors = [];
  const warnings = [];
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
    productWordsArray.some(
      (productWord) =>
        stringSimilarity.compareTwoStrings(messageWord, productWord) >=
        SIMILARITY_THRESHOLDS.WORD
    )
  );

  let bestProduct = null;
  let highestScore = 0;
  const maxProductNameWordCount = Math.max(
    ...normalizedProducts.map((p) => p.wordCount)
  );
  const messageNGrams = generateNGrams(
    filteredMessageWords,
    maxProductNameWordCount
  );

  for (const ngram of messageNGrams) {
    for (const product of normalizedProducts) {
      const similarity = stringSimilarity.compareTwoStrings(
        ngram,
        product.normalizedName
      );
      if (
        similarity >= SIMILARITY_THRESHOLDS.PRODUCT &&
        similarity >= highestScore
      ) {
        highestScore = similarity;
        bestProduct = { ...product, score: similarity };
      }
    }
  }

  if (bestProduct && bestProduct.score >= SIMILARITY_THRESHOLDS.PRODUCT) {
    bestProduct = findBestVariant(bestProduct, messageWords, errors);
    bestProduct = findModifiers(bestProduct, messageWords, errors);
    bestProduct = findPizzaIngredients(bestProduct, productMessage, errors);
    detectUnknownWords(productMessage, bestProduct, warnings);
    if (errors.length > 0) {
      bestProduct.errors = errors;
    }
    if (warnings.length > 0) {
      bestProduct.warnings = warnings;
    }
    delete bestProduct.productVariants;
    delete bestProduct.modifierTypes;
    delete bestProduct.pizzaIngredients;
    logger.info("bestProduct", bestProduct);
    return removeScoreField(bestProduct);
  } else {
    errors.push(
      `Lo siento, no pude identificar dentro del menu disponible. 😕`
    );
    return { errors };
  }
}

function findBestVariant(bestProduct, messageWords, errors) {
  if (bestProduct.productVariants && bestProduct.productVariants.length > 0) {
    const productNameWords = new Set(normalizeText(bestProduct.name));
    const variantWordsSet = new Set<string>();
    const normalizedVariants = bestProduct.productVariants.map((variant) => {
      const normalizedNameArray = normalizeText(variant.name).filter(
        (word) => !productNameWords.has(word)
      );
      normalizedNameArray.forEach((word) => variantWordsSet.add(word));
      return {
        ...variant,
        normalizedName: normalizedNameArray.join(" "),
        wordCount: normalizedNameArray.length,
      };
    });

    const variantMessageWords = messageWords.filter(
      (word) => !productNameWords.has(word)
    );
    const filteredVariantMessageWords = variantMessageWords.filter(
      (messageWord) =>
        Array.from(variantWordsSet).some(
          (variantWord) =>
            stringSimilarity.compareTwoStrings(messageWord, variantWord) >=
            SIMILARITY_THRESHOLDS.WORD
        )
    );

    let bestVariant = null;
    let highestVariantScore = 0;
    const maxVariantNameWordCount = Math.max(
      ...normalizedVariants.map((v) => v.wordCount)
    );
    const variantMessageNGrams = generateNGrams(
      filteredVariantMessageWords,
      maxVariantNameWordCount
    );

    for (const ngram of variantMessageNGrams) {
      for (const variant of normalizedVariants) {
        const similarity = stringSimilarity.compareTwoStrings(
          ngram,
          variant.normalizedName
        );
        if (
          similarity >= SIMILARITY_THRESHOLDS.VARIANT &&
          similarity >= highestVariantScore
        ) {
          highestVariantScore = similarity;
          bestVariant = { ...variant, score: similarity };
        }
      }
    }

    if (bestVariant && bestVariant.score >= SIMILARITY_THRESHOLDS.VARIANT) {
      bestProduct.productVariant = bestVariant;
    } else {
      const variantesDisponibles = bestProduct.productVariants
        .map((v) => v.name)
        .join(", ");
      errors.push(
        `No identifico una variante válida" 😕. Las variantes disponibles son: ${variantesDisponibles} 📋.`
      );
    }
  }
  return bestProduct;
}

function findModifiers(bestProduct, messageWords, errors) {
  if (bestProduct.modifierTypes && bestProduct.modifierTypes.length > 0) {
    const collectedModifiers = [];
    for (const modifierType of bestProduct.modifierTypes) {
      const {
        name: modifierTypeName,
        acceptsMultiple,
        required,
        modifiers,
      } = modifierType;
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
        Array.from(modifierWordsSet).some(
          (modifierWord) =>
            stringSimilarity.compareTwoStrings(messageWord, modifierWord) >=
            SIMILARITY_THRESHOLDS.WORD
        )
      );

      let matchedModifiers = [];
      const maxModifierNameWordCount = Math.max(
        ...normalizedModifiers.map((m) => m.wordCount)
      );
      const modifierMessageNGrams = generateNGrams(
        filteredModifierMessageWords,
        maxModifierNameWordCount
      );

      for (const ngram of modifierMessageNGrams) {
        for (const modifier of normalizedModifiers) {
          const similarity = stringSimilarity.compareTwoStrings(
            ngram,
            modifier.normalizedName
          );
          if (similarity >= SIMILARITY_THRESHOLDS.MODIFIER) {
            matchedModifiers.push({ ...modifier, score: similarity });
          }
        }
      }

      const uniqueModifiersMap = new Map();
      for (const modifier of matchedModifiers) {
        if (
          !uniqueModifiersMap.has(modifier.modifierId) ||
          uniqueModifiersMap.get(modifier.modifierId).score < modifier.score
        ) {
          uniqueModifiersMap.set(modifier.modifierId, modifier);
        }
      }
      matchedModifiers = Array.from(uniqueModifiersMap.values());

      if (matchedModifiers.length === 0 && required) {
        errors.push(
          `No pude identificar en el menu modificadores para el grupo requerido '${modifierTypeName}'. 😕`
        );
      } else if (matchedModifiers.length > 0) {
        if (!acceptsMultiple) {
          const bestModifier = matchedModifiers.reduce(
            (best, current) => (current.score > best.score ? current : best),
            matchedModifiers[0]
          );
          collectedModifiers.push({
            modifierId: bestModifier.modifierId,
            name: bestModifier.name,
          });
        } else {
          collectedModifiers.push(
            ...matchedModifiers.map((modifier) => ({
              modifierId: modifier.modifierId,
              name: modifier.name,
            }))
          );
        }
      }
    }
    bestProduct.selectedModifiers = collectedModifiers;
  }
  return bestProduct;
}

function findPizzaIngredients(bestProduct, productMessage, errors) {
  if (bestProduct.pizzaIngredients && bestProduct.pizzaIngredients.length > 0) {
    const productNameWords = new Set(normalizeText(bestProduct.name));
    const variantNameWords = new Set();
    if (bestProduct.productVariant) {
      normalizeText(bestProduct.productVariant.name).forEach((word) =>
        variantNameWords.add(word)
      );
    }

    const selectedModifierWords = new Set();
    if (
      bestProduct.selectedModifiers &&
      bestProduct.selectedModifiers.length > 0
    ) {
      for (const modifier of bestProduct.selectedModifiers) {
        normalizeText(modifier.name).forEach((word) =>
          selectedModifierWords.add(word)
        );
      }
    }

    const pizzaIngredientMessageWords = normalizeTextForIngredients(
      productMessage
    ).filter(
      (word) =>
        !productNameWords.has(word) &&
        !variantNameWords.has(word) &&
        !selectedModifierWords.has(word)
    );

    // Console log
    logger.info("pizzaIngredientMessageWords", pizzaIngredientMessageWords);

    const pizzaIngredientWordsSet = new Set();
    const normalizedPizzaIngredients = bestProduct.pizzaIngredients.map(
      (ingredient) => {
        const normalizedNameArray = normalizeText(ingredient.name);
        normalizedNameArray.forEach((word) =>
          pizzaIngredientWordsSet.add(word)
        );
        return {
          ...ingredient,
          normalizedName: normalizedNameArray.join(" "),
          wordCount: normalizedNameArray.length,
        };
      }
    );

    // Palabras de acción y mitad
    const actionWords = new Map([
      ["sin", "remove"],
      ["quitar", "remove"],
      ["no", "remove"],
      ["extra", "add"],
      ["agregar", "add"],
      ["con", "add"],
    ]);

    const halfWords = new Map([
      ["mitad", "half"],
      ["otra", "other_half"],
      ["la otra", "other_half"],
      ["izquierda", "left"],
      ["derecha", "right"],
      ["entera", "full"],
      ["completa", "full"],
    ]);

    // Procesar mensaje secuencialmente
    const words = pizzaIngredientMessageWords;
    let actionState = "add";
    let currentHalf = "full";
    let halfCounter = 0;
    let matchedIngredients = [];
    let i = 0;

    // Variables para asignar automáticamente left y right
    let autoAssignHalf = false;
    let assignedHalves = {
      left: false,
      right: false,
    };

    while (i < words.length) {
      const word = words[i];

      // Actualizar acción
      if (actionWords.has(word)) {
        actionState = actionWords.get(word);
        i++;
        continue;
      }

      // Actualizar mitad
      if (halfWords.has(word)) {
        const halfValue = halfWords.get(word);
        if (halfValue === "half") {
          halfCounter++;
          if (halfCounter === 1) {
            currentHalf = "left"; // Asignar automáticamente a 'left' la primera mitad
            autoAssignHalf = true;
            assignedHalves.left = true;
          } else if (halfCounter === 2) {
            currentHalf = "right"; // Asignar automáticamente a 'right' la segunda mitad
            assignedHalves.right = true;
            autoAssignHalf = false;
          } else {
            currentHalf = "full"; // Por defecto si se mencionan más de dos mitades
            autoAssignHalf = false;
          }
          i++;
          continue;
        } else if (halfValue === "other_half") {
          if (!assignedHalves.left) {
            currentHalf = "left";
            assignedHalves.left = true;
          } else if (!assignedHalves.right) {
            currentHalf = "right";
            assignedHalves.right = true;
          } else {
            currentHalf = "full"; // Por defecto si ya ambas mitades estn asignadas
          }
          i++;
          continue;
        } else {
          currentHalf = halfValue; // 'left', 'right', 'full'
          i++;
          continue;
        }
      }

      // Buscar ingredientes
      let foundIngredient = false;
      for (const ingredient of normalizedPizzaIngredients) {
        const ingredientWords = ingredient.normalizedName.split(" ");
        const messageSegment = words
          .slice(i, i + ingredientWords.length)
          .join(" ");
        const similarity = stringSimilarity.compareTwoStrings(
          messageSegment,
          ingredient.normalizedName
        );
        if (similarity >= SIMILARITY_THRESHOLDS.INGREDIENT) {
          matchedIngredients.push({
            ...ingredient,
            action: actionState,
            half: currentHalf,
            score: similarity,
          });
          i += ingredientWords.length;
          foundIngredient = true;
          break;
        }
      }

      if (!foundIngredient) {
        i++;
      }

      // Resetear estados después de procesar un ingrediente
      actionState = "add";
    }

    // Si se mencionaron dos mitades pero solo una está asignada, asignar la otra automáticamente
    if (halfCounter === 2) {
      const missingHalf = !assignedHalves.left ? "left" : "right";
      // Opcional: agregar lógica para manejar la mitad faltante si es necesario
    }

    // Eliminar duplicados y mantener el de mayor puntuación
    const uniqueIngredientsMap = new Map();
    for (const ingredient of matchedIngredients) {
      const key = `${ingredient.pizzaIngredientId}-${ingredient.half}-${ingredient.action}`;
      if (
        !uniqueIngredientsMap.has(key) ||
        uniqueIngredientsMap.get(key).score < ingredient.score
      ) {
        uniqueIngredientsMap.set(key, ingredient);
      }
    }
    matchedIngredients = Array.from(uniqueIngredientsMap.values());

    if (matchedIngredients.length === 0) {
      errors.push(`No pude identificar ingredientes validos para tu pizza. 😕`);
    } else {
      bestProduct.selectedPizzaIngredients = matchedIngredients;
    }
  }
  return bestProduct;
}

// Manejar respuesta de texto simple
const handleTextResponse = (text: string): AIResponse => ({
  text,
  isDirectResponse: true,
  isRelevant: true,
});

// Manejar transferencia a otro agente
const handleAgentTransfer = async (
  toolCall: any,
  messages: any[]
): Promise<AIResponse[]> => {
  const { targetAgent, orderSummary } =
    typeof toolCall.input === "string"
      ? JSON.parse(toolCall.input)
      : toolCall.input;

  return await preProcessMessagesClaude(
    messages,
    targetAgent as AgentType,
    orderSummary
  );
};

// Manejar preprocesamiento de orden
const handleOrderPreprocess = async (toolCall: any): Promise<AIResponse> => {
  const preprocessedContent: PreprocessedContent =
    typeof toolCall.input === "string"
      ? JSON.parse(toolCall.input)
      : toolCall.input;

  const fullMenu = await getMenuAvailability();

  // Procesar cada item del pedido
  for (const item of preprocessedContent.orderItems) {
    if (item?.description) {
      const extractedProduct = await extractMentionedProduct(
        item.description,
        fullMenu
      );
      Object.assign(item, extractedProduct);
    }
  }

  const { errorMessage, hasErrors } = getErrorsAndWarnings(preprocessedContent);

  if (hasErrors) {
    return handleTextResponse(errorMessage);
  }

  return {
    isDirectResponse: false,
    isRelevant: true,
    preprocessedContent,
  };
};

// Manejar envío de menú
const handleMenuSend = async (): Promise<AIResponse> => ({
  text: await getFullMenu(),
  isDirectResponse: true,
  isRelevant: false,
  confirmationMessage:
    "El menú ha sido enviado. ¿Hay algo más en lo que pueda ayudarte?",
});

// Función principal
export async function preProcessMessagesClaude(
  messages: any[],
  currentAgent: AgentType = AgentType.GENERAL_CLAUDE,
  orderSummary?: string
): Promise<AIResponse[]> {
  try {
    const agent = AGENTS_CLAUDE[currentAgent];
    const processedMessages =
      currentAgent === AgentType.ORDER_CLAUDE && orderSummary
        ? [{ role: "user", content: orderSummary }]
        : messages;

    const response = await anthropic.beta.promptCaching.messages.create({
      ...(await prepareRequestPayloadClaude(agent, processedMessages)),
      tool_choice: { type: "auto", disable_parallel_tool_use: false },
    });

    logTokenUsageClaude(response.usage);

    const responses: AIResponse[] = [];

    for (const content of response.content) {
      if (content.type === "text") {
        responses.push(handleTextResponse(content.text));
        continue;
      }

      if (content.type === "tool_use") {
        switch (content.name) {
          case "transfer_to_agent":
            return await handleAgentTransfer(content, messages);
          case "preprocess_order":
            responses.push(await handleOrderPreprocess(content));
            break;
          case "send_menu":
            responses.push(await handleMenuSend());
            break;
        }
      }
    }

    return responses;
  } catch (error) {
    logger.error(
      `Error en preprocessMessagesClaude con agente ${currentAgent}:`,
      error
    );
    return [handleTextResponse("Error al procesar el mensaje")];
  }
}

export async function preProcessMessagesGemini(
  messages: any[],
  currentAgent: AgentType = AgentType.GENERAL_GEMINI,
  orderSummary?: string
): Promise<AIResponse[]> {
  try {
    const agent = AGENTS_GEMINI[currentAgent];
    const processedMessages =
      currentAgent === AgentType.ORDER_GEMINI && orderSummary
        ? [{ role: "user", parts: [{ text: orderSummary }] }]
        : messages.map((message) => ({
            role: message.role === "assistant" ? "model" : message.role,
            parts: [{ text: message.content }],
          }));

    const model = googleAI.getGenerativeModel(await prepareModelGemini(agent));

    const response = await model.generateContent(processedMessages as any);
    //logTokenUsageGemini(response.usage);

    console.log("response gemini", JSON.stringify(response, null, 2));

    const responses: AIResponse[] = [];

    for (const part of response.response.candidates[0].content.parts) {
      if (part.text) {
        responses.push(handleTextResponse(part.text));
      } else if (part.functionCall) {
        switch (part.functionCall.name) {
          case "transfer_to_agent":
            return await handleAgentTransfer(part.functionCall, messages);
          case "preprocess_order":
            responses.push(await handleOrderPreprocess(part.functionCall));
            break;
          case "send_menu":
            responses.push(await handleMenuSend());
            break;
        }
      }
    }

    return responses;
  } catch (error) {
    logger.error(
      `Error en preProcessMessagesGemini con agente ${currentAgent}:`,
      error
    );
    return [handleTextResponse("Error al procesar el mensaje")];
  }
}

// Función para elegir qué API usar
export async function preProcessMessages(
  messages: any[],
  currentAgent: AgentType,
  orderSummary?: string,
  apiChoice: "claude" | "gemini" = "gemini"
): Promise<AIResponse[]> {
  if (apiChoice === "gemini") {
    return preProcessMessagesGemini(messages, currentAgent, orderSummary);
  } else {
    return preProcessMessagesClaude(messages, currentAgent, orderSummary);
  }
}
