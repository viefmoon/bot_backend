import { Modifier, PizzaIngredient, ProductVariant } from "src/models";
import logger from "./logger";
import * as stringSimilarity from "string-similarity";
import { AgentClaude, AgentGemini } from "src/types/agents";
import { FunctionCallingMode } from "@google/generative-ai";

export function mapSynonym(normalizedWord: string): string | null {
  const synonyms: { [key: string]: string[] } = {
    grande: ["grandes"],
    mediana: ["medianas"],
    chica: ["chicas"],
    orden: ["ordenes"],
    media: ["1/2", "medias", "medio"],
    bbq: ["barbacoa", "barbicue"],
    picosas: ["picositas"],
    alitas: ["alas"],
    gajo: ["gajos"],
    mixtas: ["mixtas"],
    extra: ["adicional", "mas", "extras", "doble"],
    doradas: ["doraditas"],
    queso: ["gratinadas", "gratinado", "quesos"],
    hamburguesa: ["hamburguesas", "burger"],
    pizza: ["pizzas", "pizaa", "pozza"],
    capuchino: ["cappuccino"],
    frappe: ["frape"],
  };

  for (const [mainWord, synonymList] of Object.entries(synonyms)) {
    if (synonymList.includes(normalizedWord)) {
      return mainWord;
    }
  }

  return null;
}

export function removeScoreField(obj) {
  if (Array.isArray(obj)) {
    return obj.map(removeScoreField);
  } else if (typeof obj === "object" && obj !== null) {
    const newObj = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key !== "score") {
        newObj[key] = removeScoreField(value);
      }
    }
    return newObj;
  }
  return obj;
}

const wordsToFilter = [
  "del",
  "los",
  "las",
  "una",
  "unos",
  "unas",
  "pero",
  "para",
  "y",
  "o",
  "de",
  "en",
  "el",
  "la",
  "con",
  "adicional",
  "mas",
  "por",
  "al",
];

export function normalizeText(text) {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const words = normalized.split(/\s+/);
  const filteredWords = words
    .filter((word) => !wordsToFilter.includes(word))
    .map((word) => mapSynonym(word) || word);

  return filteredWords;
}

export function normalizeTextForIngredients(text) {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const words = normalized.split(/\s+/);
  const filteredWords = words.map((word) => mapSynonym(word) || word);

  return filteredWords;
}

export function generateNGrams(words: string[], maxN: number): string[] {
  const ngrams = [];
  const len = words.length;
  for (let n = 1; n <= maxN; n++) {
    for (let i = 0; i <= len - n; i++) {
      ngrams.push(words.slice(i, i + n).join(" "));
    }
  }
  return ngrams;
}

export function getErrorsAndWarnings(preprocessedContent: PreprocessedContent) {
  const allErrors = preprocessedContent.orderItems
    .filter((item) => item.errors?.length > 0)
    .map((item) => `Para "${item.description}": ${item.errors.join("")}`);

  const allWarnings = preprocessedContent.orderItems
    .filter((item) => item.warnings?.length > 0)
    .map((item) => `Para "${item.description}": ${item.warnings.join("")}`);

  let errorMessage = "";
  if (allErrors.length > 0) {
    errorMessage = `❗ Hay algunos problemas con tu solicitud:\n${allErrors.join(
      ", "
    )}`;
    if (allWarnings.length > 0) {
      errorMessage += `\n\n⚠️ Además, ten en cuenta lo siguiente:\n${allWarnings.join(
        ", "
      )}`;
    }
  }

  if (allWarnings.length > 0) {
    preprocessedContent.warnings = allWarnings;
  }

  return { errorMessage, hasErrors: allErrors.length > 0 };
}

export interface PreprocessedContent {
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

export interface MenuItem {
  productId?: string;
  name: string;
  productVariant?: ProductVariant;
  selectedModifiers?: Modifier[];
  selectedPizzaIngredients?: PizzaIngredient[];
}

export const SIMILARITY_THRESHOLDS = {
  WORD: 0.8,
  PRODUCT: 0.8,
  VARIANT: 0.8,
  MODIFIER: 0.8,
  INGREDIENT: 0.8,
};

export function detectUnknownWords(productMessage, bestProduct, warnings) {
  const productNameWords = new Set(normalizeText(bestProduct.name));
  const variantNameWords = new Set();
  if (bestProduct.productVariant) {
    normalizeText(bestProduct.productVariant.name).forEach((word) =>
      variantNameWords.add(word)
    );
  }

  const selectedModifierWords = new Set();
  if (bestProduct.selectedModifiers?.length > 0) {
    for (const modifier of bestProduct.selectedModifiers) {
      normalizeText(modifier.name).forEach((word) =>
        selectedModifierWords.add(word)
      );
    }
  }

  const pizzaIngredientWords = new Set();
  if (bestProduct.selectedPizzaIngredients?.length > 0) {
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
  const unknownWords = messageWords.filter((word) => {
    return !Array.from(knownWords).some(
      (knownWord) =>
        stringSimilarity.compareTwoStrings(word, knownWord as string) >=
        SIMILARITY_THRESHOLDS.WORD
    );
  });

  if (unknownWords.length > 0) {
    warnings.push(
      `No encontre los siguientes ingredientes: ${unknownWords.join(", ")}.`
    );
  }
}

export interface AIResponse {
  text?: string;
  isRelevant: boolean;
  confirmationMessage?: string;
  preprocessedContent?: PreprocessedContent;
}

export const prepareRequestPayloadClaude = async (
  agent: AgentClaude,
  messages: any[]
) => ({
  model: agent.model,
  system:
    typeof agent.systemMessage === "function"
      ? await agent.systemMessage()
      : agent.systemMessage,
  tools: agent.tools,
  max_tokens: agent.maxTokens,
  temperature: agent.temperature,
  messages,
});

export const prepareModelGemini = async (agent: AgentGemini) => ({
  model: agent.model,
  systemInstruction:
    typeof agent.systemMessage === "function"
      ? await agent.systemMessage()
      : agent.systemMessage,
  generationConfig: {
    candidateCount: 1,
    stopSequences: ["x"],
    maxOutputTokens: 1024,
    temperature: 1.0,
  },
  tools: agent.tools,
  toolConfig: {
    functionCallingConfig: {
      mode: agent.functionCallingMode,
      ...(agent.functionCallingMode === "ANY" && {
        allowedFunctionNames: agent.allowedFunctionNames,
      }),
    },
  },
});
