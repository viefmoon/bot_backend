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
import * as Fuse from "fuse.js";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface PreprocessedContent {
  orderItems: {
    description: string;
    relevantMenuItems?: MentionedProduct[];
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
  productVariants?: Array<{ variantId: string; name: string }>;
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
): Promise<MentionedProduct[]> {
  const fullMenu = await getMenuAvailability();
  if ("error" in fullMenu) {
    console.error("Error al obtener el menú completo:", fullMenu.error);
    return [];
  }

  let productos: MentionedProduct[] = [];

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
): MentionedProduct[] {
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

  function normalizeText(text: string): string {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  // Preprocesar el mensaje
  const cleanedMessage = normalizeText(productMessage)
    .split(/\s+/)
    .filter((word) => word.length >= 3 && !wordsToFilter.includes(word))
    .join(" ");

  // Configuración de Fuse.js
  const fuseOptions: Fuse.IFuseOptions<ProductoInfo> = {
    includeScore: true,
    threshold: 0.4,
    keys: [
      "keywords",
      "productVariants.keywords",
      "modifiers.keywords",
      "pizzaIngredients.keywords",
    ],
  };

  // Agregar log para ver las opciones de Fuse
  console.log("Opciones de Fuse:", JSON.stringify(fuseOptions, null, 2));

  const fuse = new (Fuse as any)(menu, fuseOptions);

  // Realizar la búsqueda
  const results = fuse.search(cleanedMessage);
  console.log("Resultados de la búsqueda:", JSON.stringify(results, null, 2));

  const mentionedProducts: MentionedProduct[] = results.map((result) => {
    const product = result.item;
    const mentionedProduct: MentionedProduct = {
      productId: product.productId,
      name: product.name,
      products: [
        {
          productId: product.productId,
          name: product.name,
        },
      ],
    };

    // Verificar variantes
    if (product.productVariants) {
      const variantFuse = new (Fuse as any)(product.productVariants, {
        keys: ["keywords"],
        threshold: 0.4,
      });
      const variantResults = variantFuse.search(cleanedMessage);
      if (variantResults.length > 0) {
        mentionedProduct.productVariants = variantResults.map((vResult) => ({
          variantId: vResult.item.variantId,
          name: vResult.item.name,
        }));
      }
    }

    // Verificar modificadores
    if (product.modifiers) {
      const modifierFuse = new (Fuse as any)(product.modifiers, {
        keys: ["keywords"],
        threshold: 0.4,
      });
      const modifierResults = modifierFuse.search(cleanedMessage);
      if (modifierResults.length > 0) {
        mentionedProduct.modifiers = modifierResults.map((mResult) => ({
          modifierId: mResult.item.modifierId,
          name: mResult.item.name,
        }));
      }
    }

    // Verificar ingredientes de pizza
    if (product.pizzaIngredients) {
      const ingredientFuse = new (Fuse as any)(product.pizzaIngredients, {
        keys: ["keywords"],
        threshold: 0.4,
      });
      const ingredientResults = ingredientFuse.search(cleanedMessage);
      if (ingredientResults.length > 0) {
        mentionedProduct.pizzaIngredients = ingredientResults.map(
          (iResult) => ({
            pizzaIngredientId: iResult.item.pizzaIngredientId,
            name: iResult.item.name,
          })
        );
      }
    }

    return mentionedProduct;
  });

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
