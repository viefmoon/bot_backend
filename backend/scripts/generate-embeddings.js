#!/usr/bin/env node

/**
 * Script to manually generate embeddings for all products
 * Can be run with: npm run seed:embeddings
 */

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    console.log('🚀 Starting embedding generation...\n');
    
    // Check if products exist
    const productCount = await prisma.product.count({
      where: { isActive: true }
    });
    
    if (productCount === 0) {
      console.log('❌ No active products found in database');
      console.log('💡 Embeddings will be generated automatically after menu sync');
      return;
    }
    
    console.log(`Found ${productCount} active products\n`);
    
    // Import and use EmbeddingManager
    const { EmbeddingManager } = require('../dist/services/sync/EmbeddingManager');
    
    // Check current status
    const status = await EmbeddingManager.getEmbeddingStatus();
    console.log('📊 Current status:');
    console.log(`   Total products: ${status.totalProducts}`);
    console.log(`   With embeddings: ${status.productsWithEmbeddings}`);
    console.log(`   Need embeddings: ${status.productsNeedingEmbeddings}\n`);
    
    if (status.productsNeedingEmbeddings === 0) {
      console.log('✅ All products already have embeddings!');
      return;
    }
    
    // Generate embeddings
    console.log('⏳ Generating embeddings...\n');
    const updatedCount = await EmbeddingManager.generateEmbeddingsAfterSync();
    
    // Check final status
    const finalStatus = await EmbeddingManager.getEmbeddingStatus();
    console.log('\n✅ Embedding generation completed!');
    console.log(`   Generated: ${updatedCount} embeddings`);
    console.log(`   Total with embeddings: ${finalStatus.productsWithEmbeddings}/${finalStatus.totalProducts}`);
    
  } catch (error) {
    console.error('❌ Error generating embeddings:', error.message);
    if (error.message.includes('Cannot find module')) {
      console.error('\n💡 Make sure to build the project first: npm run build');
    }
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Check for required environment variable
if (!process.env.GOOGLE_AI_API_KEY) {
  console.error('❌ GOOGLE_AI_API_KEY environment variable is not set');
  console.error('💡 Add it to your .env file to enable embedding generation');
  process.exit(1);
}

main().catch(console.error);