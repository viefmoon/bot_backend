import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

// Establecer NODE_ENV si no está definido
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

import { MenuSearchService } from '../src/services/ai/MenuSearchService';

async function testSearch(query: string) {
  console.log(`\n🔍 Buscando: "${query}"`);
  console.log('═'.repeat(50));
  
  try {
    const startTime = Date.now();
    const result = await MenuSearchService.getRelevantMenu(query);
    const endTime = Date.now();
    
    const products = JSON.parse(result);
    
    console.log(`⏱️  Tiempo de búsqueda: ${endTime - startTime}ms`);
    console.log(`📦 Productos encontrados: ${products.length}`);
    console.log('\nTop 5 resultados:');
    
    products.slice(0, 5).forEach((product: any, index: number) => {
      console.log(`${index + 1}. ${product.nombre}`);
      if (product.variantes) {
        console.log(`   Variantes: ${product.variantes.map((v: any) => v.nombre).join(', ')}`);
      }
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
    "comida para llevar",
    "pizza con piña",
    "bebida fría",
    "café con leche",
    "alitas picantes",
    "hamburgesa especial", // Error ortográfico intencional
    "piza de peperoni", // Errores ortográficos intencionales
    "coca-cola y papitas"
  ];
  
  for (const query of queries) {
    await testSearch(query);
    await new Promise(resolve => setTimeout(resolve, 1000)); // Pausa entre búsquedas
  }
  
  process.exit(0);
}

main().catch(console.error);