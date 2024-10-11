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
  modifierTypes?: Array<{
    modifierTypeId: string;
    name: string;
    acceptsMultiple: boolean;
    required: boolean;
    modifiers?: Array<{
      modifierId: string;
      name: string;
    }>;
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
        productoInfo.modifierTypes = producto.modifierTypes.map((mt) => ({
          modifierTypeId: mt.id,
          name: mt.name,
          acceptsMultiple: mt.acceptsMultiple,
          required: mt.required,
          modifiers:
            mt.modifiers?.map((m) => ({
              modifierId: m.id,
              name: m.name,
            })) || [],
        }));
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
function extractMentionedProducts(productMessage, menu) {
  console.log("menu:", JSON.stringify(menu, null, 2));
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

  function normalizeText(text) {
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

  // Obtener las palabras del mensaje normalizado
  const messageWords = normalizeText(productMessage);
  console.log("productMessage:", productMessage);
  console.log("messageWords:", messageWords);

  // Obtener todas las palabras únicas de los nombres de productos
  const productWordsSet = new Set<string>();

  // Normalizar los nombres de los productos y construir el conjunto de palabras
  const normalizedProducts = menu.map((product) => {
    const normalizedNameArray = normalizeText(product.name);
    // Añadir palabras al conjunto
    normalizedNameArray.forEach((word) => productWordsSet.add(word));
    const normalizedName = normalizedNameArray.join(" ");
    const nameWords = normalizedNameArray;
    return {
      productId: product.productId,
      name: product.name,
      normalizedName,
      wordCount: nameWords.length,
      productVariants: product.productVariants,
      modifiers: product.modifiers,
    };
  });

  // Convertir el conjunto de palabras de productos a un array
  const productWordsArray = Array.from(productWordsSet);

  // Establecer un umbral de similitud para palabras individuales
  const WORD_SIMILARITY_THRESHOLD = 0.8; // Ajusta este valor según sea necesario

  // Filtrar las palabras del mensaje que son similares a las palabras de los productos
  const filteredMessageWords = messageWords.filter((messageWord) => {
    for (const productWord of productWordsArray) {
      const similarity = stringSimilarity.compareTwoStrings(
        messageWord,
        productWord
      );
      if (similarity >= WORD_SIMILARITY_THRESHOLD) {
        return true; // Conservar esta palabra
      }
    }
    return false; // Desechar esta palabra
  });

  console.log("filteredMessageWords:", filteredMessageWords);

  let bestProduct = null;
  let highestScore = 0;

  // Obtener el máximo número de palabras en los nombres de los productos
  const maxProductNameWordCount = Math.max(
    ...normalizedProducts.map((p) => p.wordCount)
  );

  // Generar n-gramas del mensaje filtrado
  const messageNGrams = generateNGrams(
    filteredMessageWords,
    maxProductNameWordCount
  );

  // Establecer un umbral de similitud para los n-gramas
  const SIMILARITY_THRESHOLD = 0.8; // Ajusta este valor según sea necesario

  // Comparar cada n-grama con los nombres de los productos
  for (const ngram of messageNGrams) {
    for (const product of normalizedProducts) {
      const similarity = stringSimilarity.compareTwoStrings(
        ngram,
        product.normalizedName
      );

      if (similarity >= SIMILARITY_THRESHOLD && similarity > highestScore) {
        highestScore = similarity;
        bestProduct = {
          productId: product.productId,
          name: product.name,
          score: similarity,
          productVariants: product.productVariants,
          modifiers: product.modifiers,
        };
      }
    }
  }

  // Verificar si se encontró un producto que cumpla con el umbral
  if (bestProduct && bestProduct.score >= SIMILARITY_THRESHOLD) {
    // **Nuevo código para buscar la mejor variante**
    if (bestProduct.productVariants && bestProduct.productVariants.length > 0) {
      // Obtener las palabras del nombre del producto
      const productNameWords = new Set(normalizeText(bestProduct.name));
      // Normalizar los nombres de las variantes y construir el conjunto de palabras
      const variantWordsSet = new Set<string>();
      const normalizedVariants = bestProduct.productVariants.map((variant) => {
        const normalizedNameArray = normalizeText(variant.name).filter(
          (word) => !productNameWords.has(word)
        ); // Eliminar palabras del nombre del producto
        normalizedNameArray.forEach((word) => variantWordsSet.add(word));
        const normalizedName = normalizedNameArray.join(" ");
        return {
          variantId: variant.variantId,
          name: variant.name,
          normalizedName,
          wordCount: normalizedNameArray.length,
        };
      });

      // Usamos messageWords sin filtrar para las variantes
      const variantMessageWords = messageWords.filter(
        (word) => !productNameWords.has(word)
      );

      // Establecer un umbral de similitud para palabras individuales (variantes)
      const VARIANT_WORD_SIMILARITY_THRESHOLD = 0.8; // Ajusta este valor según sea necesario

      // Filtrar las palabras del mensaje que son similares a las palabras de las variantes
      const filteredVariantMessageWords = variantMessageWords.filter(
        (messageWord) => {
          for (const variantWord of Array.from(variantWordsSet)) {
            const similarity = stringSimilarity.compareTwoStrings(
              messageWord,
              variantWord
            );
            if (similarity >= VARIANT_WORD_SIMILARITY_THRESHOLD) {
              return true; // Conservar esta palabra
            }
          }
          return false; // Desechar esta palabra
        }
      );

      console.log("filteredVariantMessageWords:", filteredVariantMessageWords);

      let bestVariant = null;
      let highestVariantScore = 0;

      // Obtener el máximo número de palabras en los nombres de las variantes
      const maxVariantNameWordCount = Math.max(
        ...normalizedVariants.map((v) => v.wordCount)
      );

      // Generar n-gramas del mensaje filtrado para variantes
      const variantMessageNGrams = generateNGrams(
        filteredVariantMessageWords,
        maxVariantNameWordCount
      );

      // Establecer un umbral de similitud para los n-gramas de variantes
      const VARIANT_SIMILARITY_THRESHOLD = 0.8; // Ajusta este valor según sea necesario

      // Comparar cada n-grama con los nombres de las variantes
      for (const ngram of variantMessageNGrams) {
        for (const variant of normalizedVariants) {
          const similarity = stringSimilarity.compareTwoStrings(
            ngram,
            variant.normalizedName
          );

          if (
            similarity >= VARIANT_SIMILARITY_THRESHOLD &&
            similarity > highestVariantScore
          ) {
            highestVariantScore = similarity;
            bestVariant = {
              variantId: variant.variantId,
              name: variant.name,
              score: similarity,
            };
          }
        }
      }

      // Agregar la mejor variante al producto si se encontró
      if (bestVariant && bestVariant.score >= VARIANT_SIMILARITY_THRESHOLD) {
        bestProduct.productVariants = [bestVariant];
      } else {
        // Si no se encontró una variante que cumpla con el umbral, dejamos productVariants vacío
        bestProduct.productVariants = [];
      }
    }

    // **Nuevo código para buscar los modificadores por grupo (modifierTypes)**
    if (bestProduct.modifierTypes && bestProduct.modifierTypes.length > 0) {
      const productNameWords = new Set(normalizeText(bestProduct.name));
      const variantNameWords = new Set();
      if (
        bestProduct.productVariants &&
        bestProduct.productVariants.length > 0
      ) {
        const bestVariant = bestProduct.productVariants[0];
        normalizeText(bestVariant.name).forEach((word) =>
          variantNameWords.add(word)
        );
      }
      // Filtrar las palabras del mensaje que no están en el nombre del producto ni de la variante
      const modifierMessageWords = messageWords.filter(
        (word) => !productNameWords.has(word) && !variantNameWords.has(word)
      );

      const collectedModifierTypes = [];
      const errors = [];

      // Recorrer cada modifierType
      for (const modifierType of bestProduct.modifierTypes) {
        const {
          modifierTypeId,
          name: modifierTypeName,
          acceptsMultiple,
          required,
          modifiers,
        } = modifierType;

        // Normalizar los nombres de los modificadores y construir el conjunto de palabras
        const modifierWordsSet = new Set<string>();
        const normalizedModifiers = modifiers.map((modifier) => {
          const normalizedNameArray = normalizeText(modifier.name);
          normalizedNameArray.forEach((word) => modifierWordsSet.add(word));
          const normalizedName = normalizedNameArray.join(" ");
          return {
            modifierId: modifier.modifierId,
            name: modifier.name,
            normalizedName,
            wordCount: normalizedNameArray.length,
          };
        });

        // Establecer un umbral de similitud para palabras individuales (modificadores)
        const MODIFIER_WORD_SIMILARITY_THRESHOLD = 0.8; // Ajusta este valor según sea necesario

        // Filtrar las palabras del mensaje que son similares a las palabras de los modificadores
        const filteredModifierMessageWords = modifierMessageWords.filter(
          (messageWord) => {
            for (const modifierWord of Array.from(modifierWordsSet)) {
              const similarity = stringSimilarity.compareTwoStrings(
                messageWord,
                modifierWord
              );
              if (similarity >= MODIFIER_WORD_SIMILARITY_THRESHOLD) {
                return true; // Conservar esta palabra
              }
            }
            return false; // Desechar esta palabra
          }
        );

        console.log(
          `filteredModifierMessageWords for ${modifierTypeName}:`,
          filteredModifierMessageWords
        );

        let matchedModifiers = [];

        // Obtener el máximo número de palabras en los nombres de los modificadores
        const maxModifierNameWordCount = Math.max(
          ...normalizedModifiers.map((m) => m.wordCount)
        );

        // Generar n-gramas del mensaje filtrado para modificadores
        const modifierMessageNGrams = generateNGrams(
          filteredModifierMessageWords,
          maxModifierNameWordCount
        );

        // Establecer un umbral de similitud para los n-gramas de modificadores
        const MODIFIER_SIMILARITY_THRESHOLD = 0.8; // Ajusta este valor según sea necesario

        // Comparar cada n-grama con los nombres de los modificadores
        for (const ngram of modifierMessageNGrams) {
          for (const modifier of normalizedModifiers) {
            const similarity = stringSimilarity.compareTwoStrings(
              ngram,
              modifier.normalizedName
            );

            if (similarity >= MODIFIER_SIMILARITY_THRESHOLD) {
              matchedModifiers.push({
                modifierId: modifier.modifierId,
                name: modifier.name,
                score: similarity,
              });
            }
          }
        }

        // Eliminar duplicados y mantener los modificadores con mayor similitud
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

        // Validar si se encontraron modificadores según las reglas de acceptsMultiple y required
        if (matchedModifiers.length === 0) {
          if (required) {
            // Generar error si no se encontraron modificadores en un modifierType requerido
            console.error(
              `No se encontraron modificadores para el grupo requerido '${modifierTypeName}'.`
            );
            errors.push(
              `No se encontraron modificadores para el grupo requerido '${modifierTypeName}'.`
            );
          }
          // No agregar este modifierType si no se encontraron modificadores y no es requerido
        } else {
          if (!acceptsMultiple && matchedModifiers.length > 1) {
            // Generar error si se encontraron múltiples modificadores en un modifierType que no acepta múltiples
            console.error(
              `Se encontraron múltiples modificadores para el grupo '${modifierTypeName}', que no acepta múltiples opciones.`
            );
            errors.push(
              `Se encontraron múltiples modificadores para el grupo '${modifierTypeName}', que no acepta múltiples opciones.`
            );
          }
          // Agregar los modificadores encontrados al modifierType
          collectedModifierTypes.push({
            modifierTypeId,
            name: modifierTypeName,
            acceptsMultiple,
            required,
            modifiers: matchedModifiers,
          });
        }
      }

      // Agregar los modifierTypes recopilados al bestProduct
      bestProduct.modifierTypes = collectedModifierTypes;

      // Si hay errores, puedes decidir cómo manejarlos
      if (errors.length > 0) {
        // Puedes lanzar una excepción, retornar null o agregar los errores al objeto
        console.error("Errores encontrados en los modificadores:", errors);
        bestProduct.errors = errors;
      }
    }

    console.log("bestProduct", JSON.stringify(bestProduct, null, 2));
    return bestProduct;
  } else {
    console.log("No se encontró un producto que cumpla con el umbral.");
    return null;
  }
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
