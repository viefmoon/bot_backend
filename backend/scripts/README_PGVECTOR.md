# pgvector Setup Documentation

## Overview
This project uses pgvector for semantic search capabilities. pgvector is a PostgreSQL extension that enables vector similarity search, which powers our AI-based menu search functionality.

## Automatic Setup
When you run `start-local.sh`, everything is configured automatically:
1. Docker Compose uses the `pgvector/pgvector:pg15` image
2. Database migrations create the vector extension and embedding column
3. Product embeddings are generated automatically when the server starts
4. Embeddings update automatically when products change

## Production Setup
For production environments (e.g., Railway), you need to enable pgvector:

1. Execute `production-pgvector-setup.sql` in your production database:
```sql
-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- Create index for efficient similarity search
CREATE INDEX IF NOT EXISTS product_embedding_idx ON "Product" 
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
```

2. Deploy your application - embeddings will be generated automatically on first startup

## How It Works

### Embedding Generation
- Each product gets a 768-dimensional vector embedding
- Embeddings include: name, category, subcategory, description, ingredients, variants, and modifiers
- Generated using Google's text-embedding-004 model

### Automatic Updates
- On server startup: Checks for products without embeddings
- Every hour: Checks for product changes and updates embeddings
- All embedding generation is automatic - no manual steps required

### Search Process
1. User query is converted to embedding
2. pgvector finds the 15 most similar products using cosine similarity
3. Results are returned sorted by relevance

## Troubleshooting

### "type vector does not exist" error
- Ensure you're using `pgvector/pgvector:pg15` Docker image
- Restart Docker: `docker-compose down && docker-compose up -d`
- The migration should create the extension automatically

### Embeddings not generating
- Check `GOOGLE_AI_API_KEY` is set in `.env`
- Verify pgvector is installed: `SELECT * FROM pg_extension WHERE extname = 'vector';`
- Check server logs for rate limiting errors from Google AI API

### Search returning empty results
- Verify embeddings exist: `SELECT COUNT(*) FROM "Product" WHERE embedding IS NOT NULL;`
- Restart the server - embeddings generate automatically on startup
- Check server logs for errors during embedding generation

## Performance Notes
- HNSW index provides fast similarity searches
- Initial embedding generation takes ~300ms per product (rate limited)
- Search queries typically complete in <100ms
- Index parameters: m=16, ef_construction=64 (balanced for accuracy/speed)