#!/bin/bash
# Script to reset database and apply initial migration

echo "🗑️  Resetting database..."
npx prisma migrate reset --force --skip-seed

echo "📝 Creating initial migration..."
npx prisma migrate dev --name initial_schema --skip-seed

echo "🌱 Seeding database..."
npm run seed

echo "✅ Database reset complete!"