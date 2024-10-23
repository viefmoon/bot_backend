import OpenAI from "openai";
import Anthropic from "@anthropic-ai/sdk";
import { preprocessOrderToolGPT, sendMenuToolGPT } from "../aiTools/aiTools";
import * as dotenv from "dotenv";
import { SYSTEM_MESSAGE_PHASE_1 } from "../config/predefinedMessages";
import getFullMenu from "src/data/menu";
import * as stringSimilarity from "string-similarity";
import {
  removeScoreField,
  generateNGrams,
  normalizeText,
  normalizeTextForIngredients,
} from "../utils/messageProcessUtils";
import { getMenuAvailability } from "./menuUtils";
import logger from "./logger";
import { Modifier, PizzaIngredient, ProductVariant } from "src/models";
import { AgentType, Agent } from "../types/agents";
import { AGENTS } from "../config/agents";
dotenv.config();
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
  defaultHeaders: {
    "anthropic-beta": "prompt-caching-2024-07-31",
  },
});

interface MenuItem {
  productId?: string;
  name: string;
  productVariant?: ProductVariant;
  selectedModifiers?: Modifier[];
  selectedPizzaIngredients?: PizzaIngredient[];
}

interface PreprocessedContent {
  orderItems: {
    description: string;
    menuItem?: MenuItem;
    errors?: string[];
    warnings?: string[];
  }[];
  orderType: string;
  scheduledDeliveryTime?: string | Date;
  warnings?: string[];
}

const SIMILARITY_THRESHOLDS = {
  WORD: 0.8,
  PRODUCT: 0.8,
  VARIANT: 0.8,
  MODIFIER: 0.8,
  INGREDIENT: 0.8,
};

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

// Función para detectar palabras desconocidas en el mensaje del producto
function detectUnknownWords(productMessage, bestProduct, warnings) {
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

  const pizzaIngredientWords = new Set();
  if (
    bestProduct.selectedPizzaIngredients &&
    bestProduct.selectedPizzaIngredients.length > 0
  ) {
    for (const ingredient of bestProduct.selectedPizzaIngredients) {
      normalizeText(ingredient.name).forEach((word) =>
        pizzaIngredientWords.add(word)
      );
    }
  }

  const knownWords = new Set([
    ...productNameWords,
    ...variantNameWords,
    ...selectedModifierWords,
    ...pizzaIngredientWords,
  ]);

  const messageWords = normalizeText(productMessage);

  logger.info("knownWords", knownWords);
  logger.info("messageWords", messageWords);
  const unknownWords = messageWords.filter((word) => {
    return !Array.from(knownWords).some(
      (knownWord) =>
        stringSimilarity.compareTwoStrings(word, knownWord as string) >=
        SIMILARITY_THRESHOLDS.WORD
    );
  });
  logger.info("unknownWords", unknownWords);

  if (unknownWords.length > 0) {
    warnings.push(
      `No encontre los siguientes ingredientes: ${unknownWords.join(", ")}.`
    );
  }
}

interface AIResponse {
  text?: string;
  isDirectResponse: boolean;
  isRelevant: boolean;
  confirmationMessage?: string;
  preprocessedContent?: PreprocessedContent;
}

export async function preprocessMessagesGPT(messages: any[]): Promise<
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
    model: "gpt-4o",
    messages: preprocessingMessages,
    tools: [...preprocessOrderToolGPT, ...sendMenuToolGPT] as any,
    temperature: 0.2,
    parallel_tool_calls: false,
  });

  if (response.choices[0].message.tool_calls) {
    const toolCall = response.choices[0].message.tool_calls[0];

    if (toolCall.function.name === "preprocess_order") {
      const preprocessedContent: PreprocessedContent = JSON.parse(
        toolCall.function.arguments
      );
      const fullMenu = await getMenuAvailability();

      for (const item of preprocessedContent.orderItems) {
        if (item && typeof item.description === "string") {
          const extractedProduct = await extractMentionedProduct(
            item.description,
            fullMenu
          );
          Object.assign(item, extractedProduct);
        }
      }
      logger.info(
        "preprocessedContent",
        JSON.stringify(preprocessedContent, null, 2)
      );

      const allErrors = preprocessedContent.orderItems
        .filter((item) => item.errors && item.errors.length > 0)
        .map((item) => `Para "${item.description}": ${item.errors.join("")}`);

      const allWarnings = preprocessedContent.orderItems
        .filter((item) => item.warnings && item.warnings.length > 0)
        .map((item) => `Para "${item.description}": ${item.warnings.join("")}`);

      if (allErrors.length > 0) {
        let message = `❗ Hay algunos problemas con tu solicitud:\n${allErrors.join(
          ", "
        )}`;

        if (allWarnings.length > 0) {
          message += `\n\n⚠️ Además, ten en cuenta lo siguiente:\n${allWarnings.join(
            ", "
          )}`;
        }

        return {
          text: message,
          isDirectResponse: true,
          isRelevant: true,
        };
      }

      if (allWarnings.length > 0) {
        preprocessedContent.warnings = allWarnings;
      }

      return preprocessedContent;
    } else if (toolCall.function.name === "send_menu") {
      const fullMenu = await getFullMenu();
      return {
        text: fullMenu,
        isDirectResponse: true,
        isRelevant: false,
        confirmationMessage:
          "El menú ha sido enviado. ¿Hay algo más en lo que pueda ayudarte?",
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

export async function preprocessMessagesClaude(
  messages: any[],
  currentAgent: AgentType = AgentType.GENERAL,
  orderSummary?: string
): Promise<AIResponse[]> {
  try {
    const agent = AGENTS[currentAgent];

    // Si es el agente de órdenes, solo usar el resumen del pedido
    const processedMessages =
      currentAgent === AgentType.ORDER && orderSummary
        ? [
            {
              role: "user",
              content: orderSummary,
              cache_control: { type: "ephemeral" },
            },
          ]
        : messages.map((msg) => ({
            ...msg,
            content: Array.isArray(msg.content)
              ? msg.content.map((c) => ({
                  ...c,
                  cache_control: { type: "ephemeral" },
                }))
              : [
                  {
                    type: "text",
                    text: msg.content,
                    cache_control: { type: "ephemeral" },
                  },
                ],
          }));

    const requestPayload = {
      model: agent.model,
      system: agent.systemMessage,
      tools: agent.tools,
      max_tokens: agent.maxTokens,
      messages: processedMessages,
      tool_choice: { type: "auto" } as any,
    };

    logger.info("requestPayload", requestPayload);

    // Agregar un log más detallado
    // logger.info("Anthropic Request Details", {
    //   clientConfig: {
    //     headers: anthropic.headers,
    //     baseURL: anthropic.baseURL,
    //   },
    //   requestPayload: requestPayload,
    // });

    const response = await anthropic.beta.messages.create(requestPayload);
    const responses: AIResponse[] = [];

    // Registrar el uso de tokens
    logger.info("Token usage:", {
      input_tokens: response.usage.input_tokens,
      output_tokens: response.usage.output_tokens,
      total_tokens: response.usage.input_tokens + response.usage.output_tokens,
      cache_creation_input_tokens: response.usage.cache_creation_input_tokens,
      cache_read_input_tokens: response.usage.cache_read_input_tokens,
    });

    logger.info("response.content", response.content);

    // Procesar cada contenido de la respuesta
    for (const content of response.content) {
      if (content.type === "text") {
        responses.push({
          text: content.text,
          isDirectResponse: true,
          isRelevant: true,
        });
      } else if (content.type === "tool_use") {
        const toolCall = content;

        if (toolCall.name === "transfer_to_agent") {
          const { targetAgent, orderSummary } =
            typeof toolCall.input === "string"
              ? JSON.parse(toolCall.input)
              : toolCall.input;

          // Pasar el resumen del pedido al agente de órdenes
          const targetResponses = await preprocessMessagesClaude(
            messages,
            targetAgent as AgentType,
            orderSummary
          );

          responses.push(...targetResponses);
          return responses;
        } else if (toolCall.name === "preprocess_order") {
          const preprocessedContent: PreprocessedContent =
            typeof toolCall.input === "string"
              ? JSON.parse(toolCall.input)
              : (toolCall.input as PreprocessedContent);

          const fullMenu = await getMenuAvailability();

          for (const item of preprocessedContent.orderItems) {
            if (item && typeof item.description === "string") {
              const extractedProduct = await extractMentionedProduct(
                item.description,
                fullMenu
              );
              Object.assign(item, extractedProduct);
            }
          }
          logger.info(
            "preprocessedContent",
            JSON.stringify(preprocessedContent, null, 2)
          );

          const allErrors = preprocessedContent.orderItems
            .filter((item) => item.errors && item.errors.length > 0)
            .map(
              (item) => `Para "${item.description}": ${item.errors.join("")}`
            );

          const allWarnings = preprocessedContent.orderItems
            .filter((item) => item.warnings && item.warnings.length > 0)
            .map(
              (item) => `Para "${item.description}": ${item.warnings.join("")}`
            );

          if (allErrors.length > 0) {
            let message = `❗ Hay algunos problemas con tu solicitud:\n${allErrors.join(
              ", "
            )}`;
            if (allWarnings.length > 0) {
              message += `\n\n⚠️ Además, ten en cuenta lo siguiente:\n${allWarnings.join(
                ", "
              )}`;
            }

            responses.push({
              text: message,
              isDirectResponse: true,
              isRelevant: true,
            });
          } else {
            if (allWarnings.length > 0) {
              preprocessedContent.warnings = allWarnings;
            }
            responses.push({
              isDirectResponse: false,
              isRelevant: true,
              preprocessedContent,
            });
          }
        } else if (toolCall.name === "send_menu") {
          const fullMenu = await getFullMenu();
          responses.push({
            text: fullMenu,
            isDirectResponse: true,
            isRelevant: false,
            confirmationMessage:
              "El menú ha sido enviado. ¿Hay algo más en lo que pueda ayudarte?",
          });
        }
      }
    }

    return responses;
  } catch (error) {
    logger.error(
      `Error en preprocessMessagesClaude con agente ${currentAgent}:`,
      error
    );
    return [
      {
        text: "Error al procesar el mensaje",
        isDirectResponse: true,
        isRelevant: true,
      },
    ];
  }
}
