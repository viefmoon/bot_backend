import 'reflect-metadata';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

// Establecer NODE_ENV si no está definido
process.env.NODE_ENV = process.env.NODE_ENV || 'development';

import { PrismaClient } from '@prisma/client';
import { GoogleGenAI } from '@google/genai';

const prisma = new PrismaClient();

// Acceder directamente a las variables de entorno
const GOOGLE_AI_API_KEY = process.env.GOOGLE_AI_API_KEY;

if (!GOOGLE_AI_API_KEY) {
  console.error('ERROR: GOOGLE_AI_API_KEY no está configurada');
  process.exit(1);
}

const genAI = new GoogleGenAI({ apiKey: GOOGLE_AI_API_KEY });

/**
 * Genera un texto descriptivo para un producto para crear un embedding de alta calidad.
 */
function createProductText(product: any): string {
  let text = `Producto: ${product.name}. Categoría: ${product.subcategory.category.name}, ${product.subcategory.name}.`;
  
  if (product.description) {
    text += ` Descripción: ${product.description}.`;
  }
  
  if (product.isPizza && product.pizzaIngredients.length > 0) {
    const ingredients = product.pizzaIngredients.map((i: any) => i.name).join(', ');
    text += ` Ingredientes: ${ingredients}.`;
  }
  
  if (product.variants.length > 0) {
    const variantNames = product.variants.map((v: any) => v.name).join(', ');
    text += ` Opciones o tamaños: ${variantNames}.`;
  }
  
  // Agregar información adicional para mejorar la búsqueda
  if (product.isPizza) {
    text += ` Pizza.`;
  }
  
  // Agregar sinónimos comunes en español/inglés
  if (product.name.toLowerCase().includes('pizza')) {
    text += ` Piza, pitsa, pitza, pissa.`;
  }
  if (product.name.toLowerCase().includes('coca')) {
    text += ` Refresco, soda, gaseosa, bebida, cocacola, coke.`;
  }
  if (product.name.toLowerCase().includes('papas') || product.name.toLowerCase().includes('french')) {
    text += ` Papas fritas, french fries, patatas, papitas, fritas.`;
  }
  if (product.name.toLowerCase().includes('hamburguesa')) {
    text += ` Hamburgesa, hamburguer, burger, amburgesa.`;
  }
  if (product.name.toLowerCase().includes('alitas')) {
    text += ` Wings, alitas de pollo, boneless.`;
  }
  if (product.name.toLowerCase().includes('ensalada')) {
    text += ` Salad, lechuga, verduras.`;
  }
  
  return text;
}

async function main() {
  console.log('Iniciando la generación de embeddings para todos los productos...');

  try {
    const products = await prisma.product.findMany({
      include: {
        subcategory: { include: { category: true } },
        variants: { where: { isActive: true } },
        pizzaIngredients: { where: { isActive: true } },
      },
      where: { isActive: true },
    });

    console.log(`Se encontraron ${products.length} productos para procesar.`);

    let successCount = 0;
    let errorCount = 0;

    for (const product of products) {
      const textToEmbed = createProductText(product);
      
      try {
        console.log(`Generando embedding para: ${product.name}`);
        console.log(`Texto: ${textToEmbed}`);
        
        const result = await genAI.models.embedContent({
          model: "text-embedding-004",
          contents: textToEmbed
        });
        const embedding = result.embeddings?.[0]?.values || [];
        
        console.log(`Embedding generado con ${embedding.length} dimensiones`);

        // Para desarrollo local sin pgvector, guardamos como JSON
        // En producción, usar: SET embedding = ${`[${embedding.join(',')}]`}::vector
        await prisma.$executeRaw`
          UPDATE "Product"
          SET embedding = ${JSON.stringify(embedding)}::jsonb
          WHERE id = ${product.id}
        `;
        
        successCount++;
        console.log(`✅ Embedding guardado para: ${product.name} (${successCount}/${products.length})`);

      } catch (error) {
        errorCount++;
        console.error(`❌ Error con ${product.name}:`, error);
      }
      
      // Pausa para no saturar la API de Google
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log(`
✅ Proceso completado:
   - Productos procesados: ${successCount}
   - Errores: ${errorCount}
   - Total: ${products.length}
    `);

  } catch (error) {
    console.error('Error fatal en el script:', error);
    process.exit(1);
  }
}

main()
  .catch(e => {
    console.error('Error no manejado:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });