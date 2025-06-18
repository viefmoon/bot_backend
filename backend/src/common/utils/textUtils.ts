/**
 * Utilidades de procesamiento de texto
 * Extraídas del antiguo messageProcessUtils.ts
 */

export const SIMILARITY_THRESHOLDS = {
  PRODUCT_NAME: 0.8,
  VARIANT_NAME: 0.85,
  MODIFIER_NAME: 0.85,
  PIZZA_INGREDIENT_NAME: 0.85,
  WORD: 0.7,
  PRODUCT: 0.8,
  VARIANT: 0.85,
  MODIFIER: 0.85,
  INGREDIENT: 0.85,
};

export function normalizeText(text: string): string[] {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const wordsToFilter = [
    "pizza", "con", "de", "y", "la", "el", "los", "las", "un", "una",
    "para", "por", "sin", "mas", "menos", "extra", "doble", "triple",
    "grande", "mediana", "chica", "pequeña", "familiar", "personal"
  ];

  const words = normalized.split(/\s+/);
  const filteredWords = words
    .filter((word) => !wordsToFilter.includes(word))
    .map((word) => mapSynonym(word) || word);

  return filteredWords;
}

export function normalizeTextForIngredients(text: string): string[] {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  const words = normalized.split(/\s+/);
  const filteredWords = words.map((word) => mapSynonym(word) || word);

  return filteredWords;
}

export function generateNGrams(words: string[], maxN: number): string[] {
  const ngrams = [];
  const len = words.length;
  for (let n = 1; n <= maxN; n++) {
    for (let i = 0; i <= len - n; i++) {
      ngrams.push(words.slice(i, i + n).join(" "));
    }
  }
  return ngrams;
}

function mapSynonym(word: string): string | null {
  const synonymMap: { [key: string]: string } = {
    // Sinónimos generales
    "chica": "pequeña",
    "grande": "grande",
    "mediana": "mediana",
    
    // Ingredientes
    "champinones": "champiñones",
    "champinon": "champiñones",
    "hongos": "champiñones",
    "setas": "champiñones",
    
    "pina": "piña",
    "anana": "piña",
    
    "pepperoni": "pepperoni",
    "peperoni": "pepperoni",
    "salami": "pepperoni",
    
    "queso": "queso",
    "mozzarella": "queso",
    "mozarela": "queso",
    
    "jamon": "jamón",
    "ham": "jamón",
    
    "tocino": "tocino",
    "bacon": "tocino",
    "panceta": "tocino",
    
    "salchicha": "salchicha",
    "chorizo": "salchicha",
    
    "pimiento": "pimiento",
    "morron": "pimiento",
    "bell pepper": "pimiento",
    
    "cebolla": "cebolla",
    "onion": "cebolla",
    
    "aceitunas": "aceitunas",
    "olivas": "aceitunas",
    
    "tomate": "tomate",
    "jitomate": "tomate",
    
    // Bebidas
    "coca": "coca cola",
    "cocacola": "coca cola",
    "coke": "coca cola",
    
    "sprite": "sprite",
    "seven": "sprite",
    "7up": "sprite",
    
    // Otros
    "ranch": "ranch",
    "ranchero": "ranch",
  };

  return synonymMap[word] || null;
}

export function getErrorsAndWarnings(
  orderSummary: any,
  textSummary: string
): { errors: string[]; warnings: string[] } {
  const errors: string[] = [];
  const warnings: string[] = [];

  orderSummary.forEach((producto: any) => {
    if (producto.errors && producto.errors.length > 0) {
      errors.push(...producto.errors);
    }
    if (producto.warnings && producto.warnings.length > 0) {
      warnings.push(...producto.warnings);
    }
  });

  return { errors, warnings };
}

export function removeScoreField(obj: any): any {
  if (Array.isArray(obj)) {
    return obj.map(item => removeScoreField(item));
  } else if (obj !== null && typeof obj === 'object') {
    const newObj: any = {};
    for (const key in obj) {
      if (key !== 'score') {
        newObj[key] = removeScoreField(obj[key]);
      }
    }
    return newObj;
  }
  return obj;
}

export function detectUnknownWords(
  productMessage: string,
  bestProduct: any,
  warnings: string[]
): void {
  // Normalizar el mensaje del producto
  const messageWords = new Set(normalizeText(productMessage));
  
  // Crear conjunto de palabras conocidas del producto
  const knownWords = new Set<string>();
  
  // Agregar palabras del nombre del producto
  normalizeText(bestProduct.name).forEach(word => knownWords.add(word));
  
  // Agregar palabras de la variante seleccionada
  if (bestProduct.productVariant) {
    normalizeText(bestProduct.productVariant.name).forEach(word => knownWords.add(word));
  }
  
  // Agregar palabras de los modificadores seleccionados
  if (bestProduct.selectedModifiers) {
    bestProduct.selectedModifiers.forEach((modifier: any) => {
      normalizeText(modifier.name).forEach(word => knownWords.add(word));
    });
  }
  
  // Agregar palabras de los ingredientes de pizza seleccionados
  if (bestProduct.selectedPizzaIngredients) {
    bestProduct.selectedPizzaIngredients.forEach((ingredient: any) => {
      normalizeText(ingredient.name).forEach(word => knownWords.add(word));
    });
  }
  
  // Encontrar palabras desconocidas
  const unknownWords = Array.from(messageWords).filter(word => !knownWords.has(word));
  
  // Si hay palabras desconocidas, agregar advertencia
  if (unknownWords.length > 0) {
    warnings.push(`Algunas palabras no fueron reconocidas: ${unknownWords.join(', ')}`);
  }
}