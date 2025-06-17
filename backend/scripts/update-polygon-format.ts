import { PrismaClient } from '@prisma/client';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const prisma = new PrismaClient();

async function updatePolygonFormat() {
  console.log('Updating polygon format to Google Maps format...');
  
  try {
    // Get all restaurant configs
    const restaurants = await prisma.restaurantConfig.findMany();
    
    for (const restaurant of restaurants) {
      if (restaurant.deliveryCoverageArea && Array.isArray(restaurant.deliveryCoverageArea)) {
        const coverageArea = restaurant.deliveryCoverageArea as any[];
        
        // Check if it's in the old format [lat, lng]
        if (coverageArea.length > 0 && Array.isArray(coverageArea[0])) {
          console.log(`Converting polygon format for restaurant ${restaurant.id}...`);
          
          // Convert to new format {lat, lng}
          const newFormat = coverageArea.map((coord: any) => {
            if (Array.isArray(coord) && coord.length >= 2) {
              return { lat: coord[0], lng: coord[1] };
            }
            return coord; // Already in correct format
          });
          
          // Update the restaurant config
          await prisma.restaurantConfig.update({
            where: { id: restaurant.id },
            data: {
              deliveryCoverageArea: newFormat
            }
          });
          
          console.log(`Updated restaurant ${restaurant.id} successfully`);
        } else {
          console.log(`Restaurant ${restaurant.id} already has correct format`);
        }
      }
    }
    
    console.log('Polygon format update completed!');
  } catch (error) {
    console.error('Error updating polygon format:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// Run the update
updatePolygonFormat();