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
import * as stringSimilarity from "string-similarity";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface MenuItem {
  productId?: string;
  name: string;
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
  productVariants?: Array<{
    variantId: string;
    name: string;
  }>;
  modifiers?: Array<{
    modifierId: string;
    name: string;
  }>;
  pizzaIngredients?: Array<{
    pizzaIngredientId: string;
    name: string;
  }>;
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
      };

      if (producto.productVariants?.length > 0) {
        productoInfo.productVariants = producto.productVariants.map((v) => ({
          variantId: v.id,
          name: v.name,
        }));
      }

      // Agregar modificadores
      if (producto.modifierTypes?.length > 0) {
        productoInfo.modifiers = producto.modifierTypes.flatMap(
          (mt) =>
            mt.modifiers?.map((m) => ({
              modifierId: m.id,
              name: m.name,
            })) || []
        );
      }

      // Agregar ingredientes de pizza
      if (producto.pizzaIngredients?.length > 0) {
        productoInfo.pizzaIngredients = producto.pizzaIngredients.map((i) => ({
          pizzaIngredientId: i.id,
          name: i.name,
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

      // Procesar productVariants
      if (producto.productVariants?.length) {
        producto.productVariants = producto.productVariants.map((variant) => {
          return variant;
        });
      } else {
        delete producto.productVariants;
      }

      // Procesar modifiers
      if (producto.modifiers?.length) {
        producto.modifiers = producto.modifiers.map((modifier) => {
          return modifier;
        });
      } else {
        delete producto.modifiers;
      }

      // Procesar pizzaIngredients
      if (producto.pizzaIngredients?.length) {
        producto.pizzaIngredients = producto.pizzaIngredients.map(
          (ingredient) => {
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

function mapSynonym(normalizedWord: string): string | null {
  const synonyms: { [key: string]: string[] } = {
    grande: ["grandes"],
    mediana: ["medianas"],
    chica: ["chicas"],
    orden: ["ordenes"],
    media: ["1/2", "medias", "medio"],
    bbq: ["barbacoa", "barbicue"],
    picosas: ["picositas"],
    alitas: ["alas"],
    extra: ["adicional", "mas"],
    doradas: ["doraditas"],
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
    "y",
    "o",
    "de",
    "en",
    "el",
    "la",
    "con",
  ];

  function normalizeText(text: string): string[] {
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

  function generateNGrams(words: string[], maxN: number): string[] {
    const ngrams = [];
    const len = words.length;
    for (let n = 1; n <= maxN; n++) {
      for (let i = 0; i <= len - n; i++) {
        ngrams.push(words.slice(i, i + n).join(" "));
      }
    }
    return ngrams;
  }

  const messageWords = normalizeText(productMessage);
  console.log("productMessage:", productMessage);
  console.log("messageWords:", messageWords);

  // Obtener los nombres de productos normalizados y su longitud en palabras
  const normalizedProducts = menu.map((product) => {
    const normalizedName = normalizeText(product.name).join(" ");
    const nameWords = normalizedName.split(" ");
    return {
      productId: product.productId,
      name: product.name,
      normalizedName,
      wordCount: nameWords.length,
    };
  });

  let mentionedProducts = [];

  // Obtener el máximo número de palabras en los nombres de los productos
  const maxProductNameWordCount = Math.max(
    ...normalizedProducts.map((p) => p.wordCount)
  );

  // Generar n-gramas del mensaje hasta el tamaño máximo de palabras en los nombres de los productos
  const messageNGrams = generateNGrams(messageWords, maxProductNameWordCount);

  // Establecer un umbral de similitud
  const SIMILARITY_THRESHOLD = 0.6; // Ajusta este valor según sea necesario

  // Comparar cada n-grama con los nombres de los productos
  for (const ngram of messageNGrams) {
    for (const product of normalizedProducts) {
      console.log("comparando ngram con normalizedName");
      console.log("ngram:", ngram);
      console.log("normalizedName:", product.normalizedName);
      const similarity = stringSimilarity.compareTwoStrings(
        ngram,
        product.normalizedName
      );
      console.log("similarity:", similarity);

      if (similarity >= SIMILARITY_THRESHOLD) {
        mentionedProducts.push({
          productId: product.productId,
          name: product.name,
          score: similarity,
        });
      }
    }
  }

  // Eliminar duplicados y mantener el mayor puntaje para cada producto
  const productsMap = new Map();
  for (const product of mentionedProducts) {
    if (
      !productsMap.has(product.productId) ||
      productsMap.get(product.productId).score < product.score
    ) {
      productsMap.set(product.productId, product);
    }
  }

  // Convertir el mapa a una lista y ordenar por puntuación
  mentionedProducts = Array.from(productsMap.values());
  mentionedProducts.sort((a, b) => b.score - a.score);

  console.log("mentionedProducts", JSON.stringify(mentionedProducts, null, 2));

  return mentionedProducts;
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
    temperature: 0.2,
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
