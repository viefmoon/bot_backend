import {
  Product,
  ProductVariant,
  Availability,
  PizzaIngredient,
  ModifierType,
  Modifier,
} from "../models";
import OpenAI from "openai";
import { ChatCompletionMessageParam } from "openai/resources/chat";
import { ratio } from "fuzzball";
import {
  preprocessOrderTool,
  sendMenuTool,
  verifyOrderItemsTool,
} from "../aiTools/aiTools";
import * as dotenv from "dotenv";
import {
  SYSTEM_MESSAGE_PHASE_1,
  SYSTEM_MESSAGE_PHASE_2,
} from "../config/predefinedMessages";
import getFullMenu from "src/data/menu";
const Fuse = require("fuse.js");

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface MenuItem {
  productId?: string;
  name: string;
  keywords?: object;
  products?: Product[];
  productVariants?: ProductVariant[];
  modifiers?: Modifier[];
  pizzaIngredients?: PizzaIngredient[];
}

interface PreprocessedContent {
  orderItems: {
    description: string;
    relevantMenuItems?: MenuItem[];
  }[];
}

interface ProductoInfo {
  productId: string;
  name: string;
  keywords: object;
  productVariants?: Array<{
    variantId: string;
    name: string;
    keywords: object;
  }>;
  modifiers?: Array<{
    modifierId: string;
    name: string;
    keywords: object;
  }>;
  pizzaIngredients?: Array<{
    pizzaIngredientId: string;
    name: string;
    keywords: object;
  }>;
}

interface MentionedProduct {
  productId: string;
  name: string;
  products?: Array<{ productId: string; name: string }>;
  variants?: Array<{ variantId: string; name: string }>;
  modifiers?: Array<{ modifierId: string; name: string }>;
  pizzaIngredients?: Array<{ pizzaIngredientId: string; name: string }>;
  ingredients?: string[];
}

async function getMenuAvailability(): Promise<any> {
  try {
    // Verificar si los modelos necesarios están definidos
    if (
      !Product ||
      !ProductVariant ||
      !PizzaIngredient ||
      !ModifierType ||
      !Modifier ||
      !Availability
    ) {
      console.error("Uno o más modelos no están definidos");
      return { error: "Error en la configuración de los modelos" };
    }

    const products = await Product.findAll({
      include: [
        {
          model: ProductVariant,
          as: "productVariants",
          include: [{ model: Availability, where: { available: true } }],
        },
        {
          model: PizzaIngredient,
          as: "pizzaIngredients",
          include: [{ model: Availability, where: { available: true } }],
        },
        {
          model: ModifierType,
          as: "modifierTypes",
          include: [
            {
              model: Modifier,
              as: "modifiers",
              include: [{ model: Availability, where: { available: true } }],
            },
          ],
        },
        { model: Availability, where: { available: true } },
      ],
      where: {
        "$Availability.available$": true,
      },
    });

    if (!products || products.length === 0) {
      console.error("No se encontraron productos");
      return { error: "No se encontraron productos en la base de datos" };
    }

    const menuSimplificado = products.map((producto) => {
      const productoInfo: ProductoInfo = {
        productId: producto.id.toString(),
        name: producto.name,
        keywords: producto.keywords,
      };

      if (producto.productVariants?.length > 0) {
        productoInfo.productVariants = producto.productVariants.map((v) => ({
          variantId: v.id,
          name: v.name,
          keywords: v.keywords,
        }));
      }

      // Agregar modificadores
      if (producto.modifierTypes?.length > 0) {
        productoInfo.modifiers = producto.modifierTypes.flatMap(
          (mt) =>
            mt.modifiers?.map((m) => ({
              modifierId: m.id,
              name: m.name,
              keywords: m.keywords || null,
            })) || []
        );
      }

      // Agregar ingredientes de pizza
      if (producto.pizzaIngredients?.length > 0) {
        productoInfo.pizzaIngredients = producto.pizzaIngredients.map((i) => ({
          pizzaIngredientId: i.id,
          name: i.name,
          keywords: i.keywords || null,
        }));
      }

      return productoInfo;
    });

    return menuSimplificado as ProductoInfo[];
  } catch (error: any) {
    console.error("Error al obtener la disponibilidad del menú:", error);
    return {
      error: "No se pudo obtener la disponibilidad del menú",
      detalles: error.message,
      stack: error.stack,
    };
  }
}

async function getRelevantMenuItems(
  preprocessedContent: PreprocessedContent
): Promise<MenuItem[]> {
  const fullMenu = await getMenuAvailability();
  if ("error" in fullMenu) {
    console.error("Error al obtener el menú completo:", fullMenu.error);
    return [];
  }

  let productos: MenuItem[] = [];

  for (const product of preprocessedContent.orderItems) {
    const productsInMessage = extractMentionedProducts(
      product.description,
      fullMenu
    );
    productos = [...productos, ...productsInMessage];
  }

  productos = Array.from(new Set(productos.map((p) => JSON.stringify(p)))).map(
    (p) => {
      const producto = JSON.parse(p);

      // Eliminar el campo keywords
      delete producto.keywords;

      // Procesar productVariants
      if (producto.productVariants?.length) {
        producto.productVariants = producto.productVariants.map((variant) => {
          delete variant.keywords;
          return variant;
        });
      } else {
        delete producto.productVariants;
      }

      // Procesar modifiers
      if (producto.modifiers?.length) {
        producto.modifiers = producto.modifiers.map((modifier) => {
          delete modifier.keywords;
          return modifier;
        });
      } else {
        delete producto.modifiers;
      }

      // Procesar pizzaIngredients
      if (producto.pizzaIngredients?.length) {
        producto.pizzaIngredients = producto.pizzaIngredients.map(
          (ingredient) => {
            delete ingredient.keywords;
            return ingredient;
          }
        );
      } else {
        delete producto.pizzaIngredients;
      }

      return producto;
    }
  );

  return productos;
}

function extractMentionedProducts(productMessage, menu) {
  const wordsToFilter = [
    "del",
    "los",
    "las",
    "una",
    "unos",
    "unas",
    "pero",
    "para",
    "con",
    "y",
    "o",
    "de",
    "en",
    "el",
    "la",
  ];

  function normalizeText(text) {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  const filteredWords = productMessage
    .split(/\s+/)
    .map(normalizeText)
    .filter((word) => word.length >= 3 && !wordsToFilter.includes(word));

  const filteredMessage = filteredWords.join(" ");

  // Preparar la lista de búsqueda para Fuse.js
  let searchList = [];

  for (const product of menu) {
    // Agregar el producto principal
    searchList.push({
      type: "product",
      id: product.productId,
      name: product.name,
      keywords: generateKeywordCombinations(product.keywords),
      item: product,
    });

    // Agregar variantes
    if (product.productVariants) {
      for (const variant of product.productVariants) {
        searchList.push({
          type: "variant",
          parentId: product.productId,
          id: variant.variantId,
          name: variant.name,
          keywords: generateKeywordCombinations(variant.keywords),
          item: variant,
        });
      }
    }

    // Agregar modifiers
    if (product.modifiers) {
      for (const modifier of product.modifiers) {
        searchList.push({
          type: "modifier",
          parentId: product.productId,
          id: modifier.modifierId,
          name: modifier.name,
          keywords: generateKeywordCombinations(modifier.keywords),
          item: modifier,
        });
      }
    }

    // Agregar ingredientes de pizza
    if (product.pizzaIngredients) {
      for (const ingredient of product.pizzaIngredients) {
        searchList.push({
          type: "pizzaIngredient",
          parentId: product.productId,
          id: ingredient.pizzaIngredientId,
          name: ingredient.name,
          keywords: generateKeywordCombinations(ingredient.keywords),
          item: ingredient,
        });
      }
    }
  }

  // Configurar Fuse.js
  const fuseOptions = {
    keys: ["keywords"],
    threshold: 0.3, // Ajusta este valor según tus necesidades
    includeScore: true,
    ignoreLocation: true,
  };

  console.log("searchList", searchList);

  const fuse = new Fuse(searchList, fuseOptions);

  // Realizar búsqueda
  const results = fuse.search(filteredMessage);

  // Agrupar resultados por producto
  const mentionedProductsMap = new Map();

  for (const result of results) {
    const { type, id, parentId, name } = result.item;

    if (type === "product") {
      if (!mentionedProductsMap.has(id)) {
        mentionedProductsMap.set(id, {
          productId: id,
          name: name,
          variants: [],
          modifiers: [],
          pizzaIngredients: [],
        });
      }
    } else {
      // Es variante, modificador o ingrediente
      const productId = parentId;
      if (!mentionedProductsMap.has(productId)) {
        // Añadir el producto padre si no está
        const parentProduct = menu.find((p) => p.id === productId);
        mentionedProductsMap.set(productId, {
          productId: productId,
          name: parentProduct.name,
          variants: [],
          modifiers: [],
          pizzaIngredients: [],
        });
      }

      const mentionedProduct = mentionedProductsMap.get(productId);

      if (type === "variant") {
        mentionedProduct.variants.push({
          id: id,
          name: name,
        });
      } else if (type === "modifier") {
        mentionedProduct.modifiers.push({
          id: id,
          name: name,
        });
      } else if (type === "ingredient") {
        mentionedProduct.pizzaIngredients.push({
          id: id,
          name: name,
        });
      }
    }
  }

  // Convertir Map a Array
  const mentionedProducts = Array.from(mentionedProductsMap.values());

  return mentionedProducts;
}

// Función para generar todas las combinaciones de keywords
function generateKeywordCombinations(keywords) {
  if (!keywords) return [];

  if (Array.isArray(keywords[0])) {
    // Es un array de arrays, generar combinaciones
    const combinations = getCombinations(keywords);
    return combinations.map(normalizeText);
  } else {
    // Es un array simple
    return keywords.map(normalizeText);
  }
}

// Función para obtener todas las combinaciones posibles de keywords
function getCombinations(arrays, prefix = "") {
  if (!arrays.length) return [prefix.trim()];

  const result = [];
  const firstArray = arrays[0];
  const restArrays = arrays.slice(1);

  for (const word of firstArray) {
    const newPrefix = `${prefix} ${word}`;
    result.push(...getCombinations(restArrays, newPrefix));
  }

  return result;
}

function normalizeText(text) {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

async function verifyOrderItems(
  preprocessedContent: PreprocessedContent
): Promise<string> {
  const transformedOrderItems = preprocessedContent.orderItems.map((item) => {
    const relevantItems =
      item.relevantMenuItems
        ?.map((menuItem) => {
          const names = [
            ...(menuItem.products?.map((p) => p.name) || []),
            ...(menuItem.productVariants?.map((v) => v.name) || []),
            ...(menuItem.modifiers?.map((m) => m.name) || []),
            ...(menuItem.pizzaIngredients?.map((i) => i.name) || []),
          ];
          return names.join(", ");
        })
        .join("; ") || "";

    return {
      "Producto solicitado": item.description,
      "Menu disponible para la creacion": relevantItems,
    };
  });

  const systemMessage: ChatCompletionMessageParam = {
    role: "system",
    content: SYSTEM_MESSAGE_PHASE_2,
  };

  const userMessage: ChatCompletionMessageParam = {
    role: "user",
    content: JSON.stringify(transformedOrderItems),
  };

  console.log("systemMessage", systemMessage);
  console.log("transformedOrderItems", transformedOrderItems);

  const response = await openai.chat.completions.create({
    model: "gpt-4o",
    messages: [systemMessage, userMessage],
    tools: [verifyOrderItemsTool] as any,
    parallel_tool_calls: false,
    tool_choice: { type: "function", function: { name: "verify_order_items" } },
  });

  const result = response.choices[0].message.tool_calls?.[0].function.arguments;

  if (result) {
    return result;
  } else {
    return JSON.stringify({
      success: false,
      message:
        "No se pudo verificar la disponibilidad de los productos del pedido.",
    });
  }
}

// Modificar la función preprocessMessages para incluir esta nueva verificación
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

  console.log("preprocessingMessages", preprocessingMessages);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: preprocessingMessages,
    tools: [...preprocessOrderTool, ...sendMenuTool] as any,
    parallel_tool_calls: false,
  });

  if (response.choices[0].message.tool_calls) {
    const toolCall = response.choices[0].message.tool_calls[0];

    if (toolCall.function.name === "preprocess_order") {
      console.log("toolCall", toolCall);
      const preprocessedContent: PreprocessedContent = JSON.parse(
        toolCall.function.arguments
      );

      for (const item of preprocessedContent.orderItems) {
        if (item && typeof item.description === "string") {
          item.relevantMenuItems = await getRelevantMenuItems({
            orderItems: [{ description: item.description }],
          });
        } else {
          console.error("Item inválido o sin descripción:", item);
        }
      }
      console.log("preprocessedContent", JSON.stringify(preprocessedContent));
      const verificationResult = await verifyOrderItems(preprocessedContent);
      const parsedResult = JSON.parse(verificationResult);

      if (parsedResult.success) {
        return preprocessedContent;
      } else {
        return {
          text: `${parsedResult.message} Recuerda que puedes solicitarme el menú disponible o revisar el catálogo en WhatsApp para revisar los productos disponibles.`,
          isDirectResponse: true,
          isRelevant: true,
        };
      }
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
    console.error("No se pudo preprocesar el mensaje");
    return {
      text: "Error al preprocesar el mensaje",
      isDirectResponse: true,
      isRelevant: true,
    };
  }

  throw new Error("No se pudo procesar la respuesta");
}
