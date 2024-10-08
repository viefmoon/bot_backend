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

dotenv.config();

const menu = require("../data/menu");

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface MenuItem {
  productId?: string;
  name: string;
  keywords?: object;
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
          include: [{ model: Availability }],
        },
        {
          model: PizzaIngredient,
          as: "pizzaIngredients",
          include: [{ model: Availability }],
        },
        {
          model: ModifierType,
          as: "modifierTypes",
          include: [
            { model: Availability },
            {
              model: Modifier,
              as: "modifiers",
              include: [{ model: Availability }],
            },
          ],
        },
        { model: Availability },
      ],
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
        //active: m.Availability?.available || false,
      };

      if (producto.productVariants?.length > 0) {
        productoInfo.productVariants = producto.productVariants.map((v) => ({
          variantId: v.id,
          name: v.name,
          keywords: v.keywords,
          //active: m.Availability?.available || false,
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
              //active: m.Availability?.available || false,
            })) || []
        );
      }

      // Agregar ingredientes de pizza
      if (producto.pizzaIngredients?.length > 0) {
        productoInfo.pizzaIngredients = producto.pizzaIngredients.map((i) => ({
          pizzaIngredientId: i.id,
          name: i.name,
          keywords: i.keywords || null,
          //active: i.Availability?.available || false,
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

function extractMentionedProducts(
  productMessage: string,
  menu: ProductoInfo[]
): MenuItem[] {
  const mentionedProducts = [];
  const wordsToFilter = [
    "del",
    "los",
    "las",
    "una",
    "unos",
    "unas",
    "pero",
    "para",
  ];
  function normalizeWord(word) {
    return word
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  const words = productMessage
    .split(/\s+/)

    .map(normalizeWord)
    .filter((word) => word.length >= 3 && !wordsToFilter.includes(word));

  function checkKeywords(keywords, filteredWords) {
    if (!keywords) return false;

    function compareWords(keyword, word) {
      const similarity = ratio(normalizeWord(keyword), word);
      const lengthDifference = Math.abs(keyword.length - word.length);

      // Ajustamos los umbrales según la longitud de las palabras
      if (keyword.length <= 3) {
        return similarity === 100 && lengthDifference === 0;
      } else if (keyword.length <= 5) {
        return similarity >= 90 && lengthDifference <= 1;
      } else {
        return similarity >= 85 && lengthDifference <= 2;
      }
    }

    if (Array.isArray(keywords[0])) {
      return keywords.every((group) =>
        group.some((keyword) =>
          filteredWords.some((word) => compareWords(keyword, word))
        )
      );
    } else {
      return keywords.some((keyword) =>
        filteredWords.some((word) => compareWords(keyword, word))
      );
    }
  }

  for (const product of menu) {
    let isProductMentioned = checkKeywords(product.keywords, words);

    if (isProductMentioned) {
      let mentionedProduct: Partial<MentionedProduct> = {};

      // Verificar variantes
      if (product.productVariants) {
        const matchedVariants = product.productVariants.filter((variant) =>
          checkKeywords(variant.keywords, words)
        );

        if (matchedVariants.length > 0) {
          mentionedProduct.products = matchedVariants.map((variant) => ({
            productId: variant.variantId,
            name: variant.name,
          }));
        } else {
          continue; // Si no hay variantes coincidentes, saltamos este producto
        }
      } else {
        // Si no hay variantes, incluimos el productId y name del producto principal
        mentionedProduct.productId = product.productId;
        mentionedProduct.name = product.name;
      }

      // Verificar modificadores
      if (product.modifiers) {
        mentionedProduct.modifiers = product.modifiers.filter((modifier) =>
          checkKeywords(modifier.keywords, words)
        );
      }

      // Verificar ingredientes de pizza
      if (product.pizzaIngredients) {
        mentionedProduct.pizzaIngredients = product.pizzaIngredients.filter(
          (ingredient) => checkKeywords(ingredient.keywords, words)
        );
      }

      console.log("Producto mencionado:", mentionedProduct);
      mentionedProducts.push(mentionedProduct);
    }
  }
  return mentionedProducts;
}

async function verifyOrderItems(
  preprocessedContent: PreprocessedContent
): Promise<string> {
  const systemMessage: ChatCompletionMessageParam = {
    role: "system",
    content: JSON.stringify({
      instructions: [
        "Analiza detalladamente cada orderItem y verifica si se puede construir con los IDs de relevantMenuItems.",
        "Permite modificaciones que eliminen ingredientes estándar (por ejemplo, 'sin jitomate', 'sin cebolla').",
        "Considera estas modificaciones como válidas y no las marques como errores.",
        "Solo marca como error si se intenta añadir ingredientes que no están en relevantMenuItems.",
        "Si hay discrepancias por adición de ingredientes no listados, indica específicamente cuáles.",
      ],
    }),
  };

  const userMessage: ChatCompletionMessageParam = {
    role: "user",
    content: JSON.stringify(preprocessedContent.orderItems),
  };

  console.log("systemMessage", systemMessage);
  console.log("userMessage", userMessage);

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [systemMessage, userMessage],
    tools: [verifyOrderItemsTool] as any,
    parallel_tool_calls: false,
    tool_choice: { type: "function", function: { name: "verify_order_items" } },
  });

  console.log(
    "response.choices[0].message.tool_calls?.[0].function.arguments",
    response.choices[0].message.tool_calls?.[0].function.arguments
  );

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
    content: JSON.stringify({
      instructions: [
        "Eres un asistente virtual del 'Restaurante La Leña', especializado en la selección de productos y en las interacciones con los clientes. Utiliza un lenguaje amigable y cercano, incorporando emojis para mejorar la experiencia.",
        "Analiza las conversaciones entre el usuario y el asistente, luego usa la función 'preprocess_order' para generar una lista detallada de los productos mencionados, incluidas sus cantidades, descripciones, el tipo de entrega (por defecto es 'delivery' si no se especifica), y la hora programada por defecto si no se solicita es null.",
        "Ejecuta la función 'send_menu' únicamente cuando el cliente solicite explícitamente ver el menú.",
        "Asegúrate de que las respuestas sean rápidas y eficaces.",
      ],
    }),
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
      console.log("preprocessedContent", preprocessedContent);
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
      return {
        text: menu,
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
