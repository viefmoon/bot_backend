import { MenuService } from "src/services/menu.service";
import { normalizeText, SIMILARITY_THRESHOLDS } from "./messageProcessUtils";
import * as stringSimilarity from "string-similarity";

const menuService = new MenuService();

export async function analyzeOrderSummary(orderSummary: string) {
  const fullMenuResult = await menuService.getMenuAvailability();

  if ("error" in fullMenuResult) {
    return "";
  }

  const fullMenu = fullMenuResult;
  const normalizedSummary = normalizeText(orderSummary);
  const mentionedItems = [];

  // Buscar productos mencionados
  for (const product of fullMenu) {
    const normalizedProductName = normalizeText(product.name);

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
      let itemDescription = `Producto: ${product.name}`;

      // Buscar variantes mencionadas
      if (product.productVariants) {
        for (const variant of product.productVariants) {
          const normalizedVariant = normalizeText(variant.name);

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
            itemDescription += ` (${variant.name})`;
          }
        }
      }

      // Buscar modificadores mencionados
      if (product.modifierTypes) {
        for (const modifierType of product.modifierTypes) {
          for (const modifier of modifierType.modifiers) {
            const normalizedModifier = normalizeText(modifier.name);
            const modifierSimilarity = stringSimilarity.compareTwoStrings(
              normalizedSummary.join(" "),
              normalizedModifier.join(" ")
            );

            if (modifierSimilarity >= SIMILARITY_THRESHOLDS.MODIFIER) {
              itemDescription += `, ${modifier.name}`;
            }
          }
        }
      }

      // Buscar ingredientes de pizza mencionados
      if (product.pizzaIngredients) {
        for (const ingredient of product.pizzaIngredients) {
          const normalizedIngredient = normalizeText(ingredient.name);
          const ingredientSimilarity = stringSimilarity.compareTwoStrings(
            normalizedSummary.join(" "),
            normalizedIngredient.join(" ")
          );

          if (ingredientSimilarity >= SIMILARITY_THRESHOLDS.MODIFIER) {
            itemDescription += `, ${ingredient.name}`;
          }
        }
      }

      mentionedItems.push(itemDescription);
    }
  }

  if (mentionedItems.length === 0) {
    return "No he podido identificar productos específicos en el resumen anterior.";
  }

  return `Basado en la conversación anterior, identifico los siguientes elementos: ${mentionedItems.join(
    ". "
  )}. ¿Puedo ayudarte a confirmar o modificar alguno de estos detalles?`;
}
