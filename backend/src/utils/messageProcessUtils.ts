export function mapSynonym(normalizedWord: string): string | null {
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

export function removeScoreField(obj) {
  if (Array.isArray(obj)) {
    return obj.map(removeScoreField);
  } else if (typeof obj === "object" && obj !== null) {
    const newObj = {};
    for (const [key, value] of Object.entries(obj)) {
      if (key !== "score") {
        newObj[key] = removeScoreField(value);
      }
    }
    return newObj;
  }
  return obj;
}

const actionKeywords = {
  add: ["añadir", "agregar", "con", "extra", "más", "adicional"],
  remove: ["quitar", "sin", "remover", "eliminar", "no"],
};

const halfKeywords = {
  left: ["izquierda", "mitad izquierda"],
  right: ["derecha", "mitad derecha"],
  half: ["mitad", "medio"],
  full: ["entera", "toda", "completa"],
};

// Función para detectar acciones y mitades en una frase
export function detectActionAndHalf(phraseWords) {
  let action = null;
  let half = null;

  // Detectar acción
  for (const [actionType, keywords] of Object.entries(actionKeywords)) {
    for (const keyword of keywords) {
      if (phraseWords.includes(keyword)) {
        action = actionType;
        break;
      }
    }
    if (action) break;
  }

  // Detectar mitad
  for (const [halfType, keywords] of Object.entries(halfKeywords)) {
    for (const keyword of keywords) {
      if (phraseWords.includes(keyword)) {
        if (halfType === "half") {
          // Si solo dice "mitad", necesitamos más contexto
          half = null;
        } else {
          half = halfType;
        }
        break;
      }
    }
    if (half) break;
  }

  // Si no se especifica mitad, asumimos "full"
  if (!half) {
    half = "full";
  }

  // Si no se especifica acción, asumimos "add"
  if (!action) {
    action = "add";
  }

  return { action, half };
}

export function splitMessageIntoPhrases(message) {
  // Puedes ajustar esta expresión regular para adaptarse mejor a tus necesidades
  return message.split(/,|y|con|pero|;/).map((phrase) => phrase.trim());
}

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

export function normalizeText(text) {
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

export function normalizeTextForIngredients(text) {
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
