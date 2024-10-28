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
  const mentionedItems = [];

  // Buscar productos mencionados
  for (const product of menu) {
    const normalizedProductName = normalizeText(product.nombre);

    // Comparar palabra por palabra
    let maxWordSimilarity = 0;
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
      let itemDescription = `Producto: ${product.nombre}`;

      // Buscar variantes mencionadas
      if (product.variantes) {
        for (const variant of product.variantes) {
          const normalizedVariant = normalizeText(variant);

          let maxVariantSimilarity = 0;
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
            itemDescription += ` (${variant})`;
          }
        }
      }

      // Buscar modificadores mencionados
      if (product.personalizacion) {
        for (const modifierType of product.personalizacion) {
          for (const modifier of modifierType.opciones) {
            const normalizedModifier = normalizeText(modifier);
            const modifierSimilarity = stringSimilarity.compareTwoStrings(
              normalizedSummary.join(" "),
              normalizedModifier.join(" ")
            );

            if (modifierSimilarity >= SIMILARITY_THRESHOLDS.MODIFIER) {
              itemDescription += `, ${modifier}`;
            }
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
            itemDescription += `, ${ingredient}`;
          }
        }
      }

      mentionedItems.push(itemDescription);
    }
  }

  if (mentionedItems.length === 0) {
    return [];
  }

  return mentionedItems;
}
