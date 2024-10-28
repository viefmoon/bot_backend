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
    const normalizedProductName = normalizeText(product.name).join(" ");
    const similarity = stringSimilarity.compareTwoStrings(
      normalizedSummary.join(" "),
      normalizedProductName
    );

    if (similarity >= SIMILARITY_THRESHOLDS.WORD) {
      let itemDescription = `Producto: ${product.name}`;
      
      // Buscar variantes mencionadas
      if (product.productVariants) {
        for (const variant of product.productVariants) {
          const normalizedVariant = normalizeText(variant.name).join(" ");
          const variantSimilarity = stringSimilarity.compareTwoStrings(
            normalizedSummary.join(" "),
            normalizedVariant
          );
          
          if (variantSimilarity >= SIMILARITY_THRESHOLDS.VARIANT) {
            itemDescription += ` (${variant.name})`;
          }
        }
      }

      // Buscar modificadores mencionados
      if (product.modifierTypes) {
        for (const modifierType of product.modifierTypes) {
          for (const modifier of modifierType.modifiers) {
            const normalizedModifier = normalizeText(modifier.name).join(" ");
            const modifierSimilarity = stringSimilarity.compareTwoStrings(
              normalizedSummary.join(" "),
              normalizedModifier
            );

            if (modifierSimilarity >= SIMILARITY_THRESHOLDS.MODIFIER) {
              itemDescription += `, ${modifier.name}`;
            }
          }
        }
      }

      mentionedItems.push(itemDescription);
    }
  }

  if (mentionedItems.length === 0) {
    return "No he podido identificar productos específicos en el resumen anterior.";
  }

  return `Basado en la conversación anterior, identifico los siguientes elementos: ${mentionedItems.join(". ")}. ¿Puedo ayudarte a confirmar o modificar alguno de estos detalles?`;
}
