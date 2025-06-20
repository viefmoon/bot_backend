import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

// Establecer NODE_ENV si no está definido
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

import { PrismaClient } from '@prisma/client';
import { GoogleGenAI } from '@google/genai';

const prisma = new PrismaClient();
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

if (!GOOGLE_AI_API_KEY) {
  console.error('ERROR: GOOGLE_AI_API_KEY no está configurada');
  process.exit(1);
}

const genAI = new GoogleGenAI({ apiKey: GOOGLE_AI_API_KEY });

// Función simple de similitud coseno
function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length) return 0;
  
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

async function searchProducts(query: string) {
  console.log(`\n🔍 Buscando: "${query}"`);
  console.log('═'.repeat(50));
  
  try {
    const startTime = Date.now();
    
    // 1. Generar embedding para la consulta
    const embeddingResponse = await genAI.models.embedContent({
      model: "text-embedding-004",
      contents: query
    });
    const queryEmbedding = embeddingResponse.embeddings?.[0]?.values || [];
    
    // 2. Obtener todos los productos con embeddings
    const productsWithEmbeddings: any[] = await prisma.$queryRaw`
      SELECT id, name, embedding
      FROM "Product"
      WHERE embedding IS NOT NULL
      AND "isActive" = true
    `;
    
    // 3. Calcular similitud para cada producto
    const productScores = productsWithEmbeddings.map(product => {
      const productEmbedding = product.embedding as number[];
      const similarity = cosineSimilarity(queryEmbedding, productEmbedding);
      return { 
        id: product.id, 
        name: product.name,
        similarity 
      };
    });
    
    // 4. Ordenar por similitud
    productScores.sort((a, b) => b.similarity - a.similarity);
    
    const endTime = Date.now();
    
    console.log(`⏱️  Tiempo de búsqueda: ${endTime - startTime}ms`);
    console.log(`\nTop 10 resultados:`);
    
    productScores.slice(0, 10).forEach((product, index) => {
      console.log(`${index + 1}. ${product.name} (similitud: ${product.similarity.toFixed(3)})`);
    });
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

async function main() {
  console.log('🧪 Prueba de búsqueda semántica con embeddings\n');
  
  // Pruebas de búsqueda
  const queries = [
    "quiero dos pizzas hawaianas grandes",
    "dame una coca cola",
    "papas fritas",
    "algo de tomar",
    "pizza con piña",
    "bebida fría",
    "café con leche",
    "alitas picantes",
    "hamburgesa especial", // Error ortográfico intencional
    "piza de peperoni", // Errores ortográficos intencionales
    "coca-cola y papitas"
  ];
  
  for (const query of queries) {
    await searchProducts(query);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa entre búsquedas
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
  });