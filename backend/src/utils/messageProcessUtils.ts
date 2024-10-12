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
