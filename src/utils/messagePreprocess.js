import {
  Product,
  ProductVariant,
  Availability,
  PizzaIngredient,
  ModifierType,
  Modifier,
} from "../models";
const OpenAI = require("openai");
const menu = require("../data/menu");
const { ratio } = require("fuzzball");
import { preprocessOrderTool, sendMenuTool } from "../aiTools/aiTools";

import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function getMenuAvailability() {
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
      const productoInfo = {
        productId: producto.id,
        name: producto.name,
        keywords: producto.keywords || null,
        //active: producto.Availability?.available || false,
      };

      // Agregar variantes
      if (producto.productVariants?.length > 0) {
        productoInfo.variantes = producto.productVariants.map((v) => ({
          variantId: v.id,
          name: v.name,
          keywords: v.keywords || null,
          //active: v.Availability?.available || false,
        }));
      }

      // Agregar modificadores
      if (producto.modifierTypes?.length > 0) {
        productoInfo.modificadores = producto.modifierTypes.flatMap(
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
        productoInfo.ingredientesPizza = producto.pizzaIngredients.map((i) => ({
          pizzaIngredientId: i.id,
          name: i.name,
          keywords: i.keywords || null,
          //active: i.Availability?.available || false,
        }));
      }

      return productoInfo;
    });

    return menuSimplificado;
  } catch (error) {
    console.error("Error al obtener la disponibilidad del menú:", error);
    return {
      error: "No se pudo obtener la disponibilidad del menú",
      detalles: error.message,
      stack: error.stack,
    };
  }
}

async function getAvailableMenu() {
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
      const productoInfo = {
        name: producto.name,
      };

      if (producto.ingredients) {
        productoInfo.ingredients = producto.ingredients;
      }

      if (producto.productVariants && producto.productVariants.length > 0) {
        productoInfo.variantes = producto.productVariants.map((v) => {
          const variante = { name: v.name };
          if (v.ingredients) {
            variante.ingredients = v.ingredients;
          }
          return variante;
        });
      }

      if (producto.modifierTypes && producto.modifierTypes.length > 0) {
        const modificadores = producto.modifierTypes.flatMap(
          (mt) => mt.modifiers?.map((m) => m.name) || []
        );
        if (modificadores.length > 0) {
          productoInfo.modificadores = modificadores;
        }
      }

      if (producto.pizzaIngredients && producto.pizzaIngredients.length > 0) {
        productoInfo.ingredientesPizza = producto.pizzaIngredients.map((i) => ({
          name: i.name,
        }));
      }

      return productoInfo;
    });
  } catch (error) {
    console.error("Error al obtener el menú disponible:", error);
    return {
      error: "No se pudo obtener el menú disponible",
      detalles: error.message,
      stack: error.stack,
    };
  }
}
async function getRelevantMenuItems(preprocessedContent) {
  const fullMenu = await getMenuAvailability();
  let productos = [];

  for (const product of preprocessedContent.orderItems) {
    const productsInMessage = extractMentionedProducts(product, fullMenu);
    productos = [...productos, ...productsInMessage];
  }

  productos = Array.from(
    new Set(productos.map(JSON.stringify)),
    JSON.parse
  ).map((producto) => {
    const productoLimpio = removeKeywords(producto);

    if (productoLimpio.productVariants?.length) {
      productoLimpio.productVariants =
        productoLimpio.productVariants.map(removeKeywords);
    } else {
      delete productoLimpio.productVariants;
    }

    if (productoLimpio.modifiers?.length) {
      productoLimpio.modifiers = productoLimpio.modifiers.map(removeKeywords);
    } else {
      delete productoLimpio.modifiers;
    }

    if (productoLimpio.pizzaIngredients?.length) {
      productoLimpio.pizzaIngredients =
        productoLimpio.pizzaIngredients.map(removeKeywords);
    } else {
      delete productoLimpio.pizzaIngredients;
    }

    return productoLimpio;
  });

  return productos;
}

function removeKeywords(item) {
  const { keywords, ...itemWithoutKeywords } = item;
  return itemWithoutKeywords;
}

function extractMentionedProducts(productMessage, menu) {
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
      let mentionedProduct = {};

      // Verificar variantes
      if (product.variantes) {
        const matchedVariants = product.variantes.filter((variant) =>
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
      if (product.modificadores) {
        mentionedProduct.modifiers = product.modificadores.filter((modifier) =>
          checkKeywords(modifier.keywords, words)
        );
      }

      // Verificar ingredientes de pizza
      if (product.ingredientesPizza) {
        mentionedProduct.pizzaIngredients = product.ingredientesPizza.filter(
          (ingredient) => checkKeywords(ingredient.keywords, words)
        );
      }

      console.log("Producto mencionado:", mentionedProduct);
      mentionedProducts.push(mentionedProduct);
    }
  }
  return mentionedProducts;
}

export async function preprocessMessages(messages) {
  const availableMenu = await getAvailableMenu();

  const systemMessageForPreprocessing = {
    role: "system",
    content: JSON.stringify({
      instrucciones: [
        "Eres un asistente virtual del Restaurante La Leña, especializado en la selección de productos. Utilizas emojis en tus interacciones para crear una experiencia amigable y cercana.",
        "Analiza los mensajes entre usuario y asistente, utiliza la función 'preprocess_order' para crear una lista detallada de los productos mencionados con sus cantidades y detalles, la información de entrega, la hora programada para la entrega en caso de que el cliente la haya proporcionado y un resumen extenso de la conversación.",
        "Mantén las interacciones rápidas y eficaces.",
        "No ofrezcas extras o modificadores si el cliente no los ha mencionado explícitamente.",
        "La función `send_menu` debe ejecutarse única y exclusivamente cuando el cliente solicite explícitamente ver el menú.",
        "La función `preprocess_order` se ejecuta cuando el cliente menciona productos, esta contiene cantidad y descripcion de cada producto, la informacion de entrega debe ser proporcionada por el cliente, si no se proporciona, se debe solicitar antes de ejecutar la funcion.",
        "Puedes proporcionar la siguiente información del restaurante cuando el cliente la solicite:",
        "🍕 Información y horarios de La Leña:",
        "📍 Ubicación: C. Ogazón Sur 36, Centro, 47730 Tototlán, Jal.",
        "📞 Teléfonos: Fijo: 3919160126, Celular: 3338423316",
        "🕒 Horarios: Martes a sábado: 6:00 PM - 11:00 PM, Domingos: 2:00 PM - 11:00 PM",
      ],
    }),
  };

  const assistantMessageWithMenu = {
    role: "assistant",
    content: JSON.stringify({
      "MENU DISPONIBLE": availableMenu,
    }),
  };

  const preprocessingMessages = [
    systemMessageForPreprocessing,
    assistantMessageWithMenu,
    ...messages,
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: preprocessingMessages,
    tools: [...preprocessOrderTool, ...sendMenuTool],
    parallel_tool_calls: false,
  });

  if (response.choices[0].message.tool_calls) {
    const toolCall = response.choices[0].message.tool_calls[0];

    console.log("toolCall", toolCall);
    if (toolCall.function.name === "preprocess_order") {
      console.log("toolCall", toolCall);
      const preprocessedContent = JSON.parse(toolCall.function.arguments);

      if (Array.isArray(preprocessedContent.orderItems)) {
        for (const item of preprocessedContent.orderItems) {
          if (item && typeof item.description === "string") {
            item.relevantMenuItems = await getRelevantMenuItems({
              orderItems: [item.description],
            });
          } else {
            console.error("Item inválido o sin descripción:", item);
          }
        }
      } else {
        console.error(
          "orderItems no es un array:",
          preprocessedContent.orderItems
        );
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
}
