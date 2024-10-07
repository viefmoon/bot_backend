import {
  Product,
  ProductVariant,
  Availability,
  PizzaIngredient,
  ModifierType,
  Modifier,
} from "../models";
import OpenAI from "openai";
import { ratio } from "fuzzball";
import { preprocessOrderTool, sendMenuTool } from "../aiTools/aiTools";
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

async function getAvailableMenu(): Promise<
  MenuItem[] | { error: string; detalles?: string; stack?: string }
> {
  try {
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
    });

    if (!products || products.length === 0) {
      console.error("No se encontraron productos disponibles");
      return {
        error: "No se encontraron productos disponibles en la base de datos",
      };
    }

    return products.map((producto) => {
      const productoInfo: any = {
        name: producto.name,
      };

      if (producto.ingredients) {
        productoInfo.ingredients = producto.ingredients;
      }

      if (producto.productVariants?.length > 0) {
        productoInfo.variantes = producto.productVariants.map((v) => ({
          name: v.name,
          ...(v.ingredients && { ingredients: v.ingredients }),
        }));
      }

      if (producto.modifierTypes?.length > 0) {
        const modificadores = producto.modifierTypes.flatMap(
          (mt) => mt.modifiers?.map((m) => m.name) || []
        );
        if (modificadores.length > 0) {
          productoInfo.modificadores = modificadores;
        }
      }

      if (producto.pizzaIngredients?.length > 0) {
        productoInfo.ingredientesPizza = producto.pizzaIngredients.map((i) => ({
          name: i.name,
        }));
      }

      return productoInfo;
    });
  } catch (error: any) {
    console.error("Error al obtener el menú disponible:", error);
    return {
      error: "No se pudo obtener el menú disponible",
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

export async function preprocessMessages(messages: any[]): Promise<
  | PreprocessedContent
  | {
      text: string;
      isDirectResponse: boolean;
      isRelevant: boolean;
      confirmationMessage?: string;
    }
> {
  const availableMenu = await getAvailableMenu();

  const systemMessageForPreprocessing = {
    role: "system",
    content: JSON.stringify({
      instructions: [
        "Eres un asistente virtual del 'Restaurante La Leña', especializado en la selección de productos y en las interacciones con los clientes. Utiliza un lenguaje amigable y cercano, incorporando emojis para mejorar la experiencia.",
        "Analiza las conversaciones entre el usuario y el asistente, luego usa la función 'preprocess_order' para generar una lista detallada de los productos mencionados, incluidas sus cantidades, descripciones, el tipo de entrega (por defecto es 'delivery' si no se especifica), y la hora programada para la entrega si el cliente la proporciona. Solo solicita detalles de entrega si el cliente no los ha proporcionado aún.",
        "No ofrezcas productos adicionales, extras o modificaciones a menos que el cliente los mencione explícitamente.",
        "Ejecuta la función 'send_menu' únicamente cuando el cliente solicite explícitamente ver el menú.",
        "Asegúrate de que las respuestas sean rápidas y eficaces.",
        "No ejecutes 'preprocess_order' con productos que no estén en el menú disponible.",
        "Si un cliente solicita un ingrediente que no existe en el menú o que no es aplicable al producto solicitado (no se encuentra dentro del objeto del producto seleccionado por el cliente), informa que el ingrediente no está disponible o no es aplicable y ofrece alternativas.",
        "Si el cliente reemplaza un ingrediente no disponible o no aplicable por otro que tampoco existe o no es aplicable, repite la verificación y solicita una alternativa válida antes de procesar la orden.",
        "Puedes proporcionar la siguiente información del restaurante cuando te la soliciten:",
        "🍕 Información del Restaurante 'La Leña':",
        "📍 Dirección: C. Ogazón Sur 36, Centro, 47730 Tototlán, Jal.",
        "📞 Números de contacto: Fijo: 3919160126, Celular: 3338423316",
        "🕒 Horarios: Martes a sábado: 6:00 PM - 11:00 PM, Domingos: 2:00 PM - 11:00 PM",
      ],
      "MENU DISPONIBLE": availableMenu,
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

      return preprocessedContent;
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
