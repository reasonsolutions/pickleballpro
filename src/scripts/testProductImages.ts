import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import type { Product } from '../firebase/models';

// This script tests product image display functionality
export async function testProductImages() {
  console.log('Testing product image display...');
  
  try {
    // Fetch all products
    const productsSnapshot = await getDocs(collection(db, 'products'));
    const products = productsSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Product[];

    console.log(`Found ${products.length} products:`);
    
    products.forEach((product, index) => {
      console.log(`\n${index + 1}. ${product.title}`);
      console.log(`   Category: ${product.category}`);
      console.log(`   Price: ₹${product.price}`);
      console.log(`   MediaUrls type: ${typeof product.mediaUrls}`);
      console.log(`   MediaUrls is array: ${Array.isArray(product.mediaUrls)}`);
      console.log(`   MediaUrls length: ${product.mediaUrls?.length || 0}`);
      
      if (product.mediaUrls && Array.isArray(product.mediaUrls) && product.mediaUrls.length > 0) {
        console.log(`   ✅ First image: ${product.mediaUrls[0]}`);
        console.log(`   📸 Total images: ${product.mediaUrls.length}`);
      } else {
        console.log(`   ❌ No images - will show placeholder`);
      }
    });

    // Test the same logic used in Shop.tsx
    console.log('\n--- Testing Shop.tsx display logic ---');
    products.forEach((product, index) => {
      const shouldShowImage = product.mediaUrls && 
                             Array.isArray(product.mediaUrls) && 
                             product.mediaUrls.length > 0 && 
                             product.mediaUrls[0];
      
      console.log(`${index + 1}. ${product.title}: ${shouldShowImage ? '🖼️ SHOW IMAGE' : '🔲 SHOW PLACEHOLDER'}`);
      if (shouldShowImage) {
        console.log(`   Image URL: ${product.mediaUrls[0]}`);
      }
    });

  } catch (error) {
    console.error('Error testing product images:', error);
  }
}

// Run the test if this file is executed directly
if (typeof window !== 'undefined') {
  // Browser environment - you can call this function from the console
  (window as any).testProductImages = testProductImages;
  console.log('Run testProductImages() in the console to test product image display');
}