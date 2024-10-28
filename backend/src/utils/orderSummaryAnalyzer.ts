import { MenuService } from "src/services/menu.service";
import { normalizeText, SIMILARITY_THRESHOLDS } from "./messageProcessUtils";
import * as stringSimilarity from "string-similarity";

const menuService = new MenuService();

export async function analyzeOrderSummary(orderSummary: string) {
  const menuResult = await menuService.getMenuForAI();

  if (typeof menuResult === "object" && "error" in menuResult) {
    return "";
  }

  const menu = JSON.parse(menuResult as string).productos;
  const normalizedSummary = normalizeText(orderSummary);
  const mentionedItems = {
    productos: [],
  };

  // Buscar productos mencionados
  for (const product of menu) {
    const normalizedProductName = normalizeText(product.nombre);
    let maxWordSimilarity = 0;

    // Comparar palabra por palabra
    for (const summaryWord of normalizedSummary) {
      for (const productWord of normalizedProductName) {
        const similarity = stringSimilarity.compareTwoStrings(
          summaryWord,
          productWord
        );
        maxWordSimilarity = Math.max(maxWordSimilarity, similarity);
      }
    }

    if (maxWordSimilarity >= SIMILARITY_THRESHOLDS.WORD) {
      const itemObject = {
        nombre: product.nombre,
        variantes: [],
        personalizacion: [],
        ingredientesPizza: [],
      };

      // Buscar variantes mencionadas
      if (product.variantes) {
        for (const variant of product.variantes) {
          const normalizedVariant = normalizeText(variant);
          let maxVariantSimilarity = 0;

          // Comparar palabra por palabra
          for (const summaryWord of normalizedSummary) {
            for (const variantWord of normalizedVariant) {
              const similarity = stringSimilarity.compareTwoStrings(
                summaryWord,
                variantWord
              );
              maxVariantSimilarity = Math.max(maxVariantSimilarity, similarity);
            }
          }

          if (maxVariantSimilarity >= SIMILARITY_THRESHOLDS.VARIANT) {
            itemObject.variantes.push(variant);
          }
        }
      }

      // Buscar modificadores mencionados
      if (product.personalizacion) {
        for (const modifierType of product.personalizacion) {
          const matchedOpciones = [];
          for (const modifier of modifierType.opciones) {
            const normalizedModifier = normalizeText(modifier);
            const modifierSimilarity = stringSimilarity.compareTwoStrings(
              normalizedSummary.join(" "),
              normalizedModifier.join(" ")
            );

            if (modifierSimilarity >= SIMILARITY_THRESHOLDS.MODIFIER) {
              matchedOpciones.push(modifier);
            }
          }
          if (matchedOpciones.length > 0) {
            itemObject.personalizacion.push({
              modificador: modifierType.modificador,
              opciones: matchedOpciones,
            });
          }
        }
      }

      // Buscar ingredientes de pizza mencionados
      if (product.ingredientesPizza) {
        for (const ingredient of product.ingredientesPizza) {
          const normalizedIngredient = normalizeText(ingredient);
          const ingredientSimilarity = stringSimilarity.compareTwoStrings(
            normalizedSummary.join(" "),
            normalizedIngredient.join(" ")
          );

          if (ingredientSimilarity >= SIMILARITY_THRESHOLDS.MODIFIER) {
            itemObject.ingredientesPizza.push(ingredient);
          }
        }
      }

      mentionedItems.productos.push(itemObject);
    }
  }

  if (mentionedItems.productos.length === 0) {
    return "";
  }

  return JSON.stringify(mentionedItems);
}
