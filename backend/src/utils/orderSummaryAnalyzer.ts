import { MenuService } from "src/services/menu.service";
import { normalizeText, SIMILARITY_THRESHOLDS } from "./messageProcessUtils";
import * as stringSimilarity from "string-similarity";

const menuService = new MenuService();

export async function findMenuMatches(
  orderDetails: { quantity: number; description: string }[]
) {
  const menuResult = await menuService.getMenuForAI();

  if (typeof menuResult === "object" && "error" in menuResult) {
    return orderDetails;
  }

  const menu = JSON.parse(menuResult as string).productos;
  
  const orderDetailsWithMatches = orderDetails.map(orderItem => {
    const normalizedDescription = normalizeText(orderItem.description);
    const possibleMatches = {
      productos: [],
    };

    // Buscar coincidencias en el menú
    for (const product of menu) {
      const normalizedProductName = normalizeText(product.nombre);
      let maxWordSimilarity = 0;

      // Comparar palabra por palabra
      for (const summaryWord of normalizedDescription) {
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
            for (const summaryWord of normalizedDescription) {
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
          const matchedOpciones = [];
          for (const modifierType of product.personalizacion) {
            for (const modifier of modifierType.opciones) {
              const normalizedModifier = normalizeText(modifier);
              let maxModifierSimilarity = 0;

              // Comparar palabra por palabra, similar a productos y variantes
              for (const summaryWord of normalizedDescription) {
                for (const modifierWord of normalizedModifier) {
                  const similarity = stringSimilarity.compareTwoStrings(
                    summaryWord,
                    modifierWord
                  );
                  maxModifierSimilarity = Math.max(
                    maxModifierSimilarity,
                    similarity
                  );
                }
              }

              if (maxModifierSimilarity >= SIMILARITY_THRESHOLDS.MODIFIER) {
                matchedOpciones.push(modifier);
              }
            }
          }
          if (matchedOpciones.length > 0) {
            itemObject.personalizacion = matchedOpciones;
          }
        }

        // Buscar ingredientes de pizza mencionados
        if (product.ingredientesPizza) {
          for (const ingredient of product.ingredientesPizza) {
            const normalizedIngredient = normalizeText(ingredient);
            let maxIngredientSimilarity = 0;

            // Comparar palabra por palabra, similar a productos y variantes
            for (const summaryWord of normalizedDescription) {
              for (const ingredientWord of normalizedIngredient) {
                const similarity = stringSimilarity.compareTwoStrings(
                  summaryWord,
                  ingredientWord
                );
                maxIngredientSimilarity = Math.max(
                  maxIngredientSimilarity,
                  similarity
                );
              }
            }

            if (maxIngredientSimilarity >= SIMILARITY_THRESHOLDS.MODIFIER) {
              itemObject.ingredientesPizza.push(ingredient);
            }
          }
        }

        // Antes de agregar el itemObject al array de productos, limpiamos los arrays vacíos
        if (itemObject.variantes.length === 0) {
          delete itemObject.variantes;
        }
        if (itemObject.personalizacion.length === 0) {
          delete itemObject.personalizacion;
        }
        if (itemObject.ingredientesPizza.length === 0) {
          delete itemObject.ingredientesPizza;
        }

        possibleMatches.productos.push(itemObject);
      }
    }

    return {
      ...orderItem,
      menuMatches: possibleMatches.productos.length > 0 ? possibleMatches : null
    };
  });

  return orderDetailsWithMatches;
}
