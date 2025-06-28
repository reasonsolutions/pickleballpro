import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';
import {
  collection,
  addDoc,
  doc,
  setDoc,
  Timestamp,
  getDocs,
  query,
  where,
  deleteDoc
} from 'firebase/firestore';
import { db, auth } from '../firebase/config';
import type { Product, ProductCategory } from '../firebase/models';

// This script sets up test products with sample images
export async function setupTestProducts() {
  console.log('Setting up test products...');
  
  try {
    // Sign in as facility manager to create products
    const facilityEmail = 'facility1@test.com';
    const facilityPassword = 'Test123!';
    
    try {
      await signInWithEmailAndPassword(auth, facilityEmail, facilityPassword);
      console.log('Signed in as facility manager');
    } catch (error) {
      console.error('Failed to sign in as facility manager. Make sure test data is set up first.');
      return;
    }

    const user = auth.currentUser;
    if (!user) {
      console.error('No user signed in');
      return;
    }

    // Clear existing test products
    await clearTestProducts(user.uid);

    // Create sample products with placeholder images
    const sampleProducts: Partial<Product>[] = [
      {
        title: 'Professional Paddle Pro',
        description: 'High-quality carbon fiber paddle perfect for competitive play. Lightweight design with excellent control and power.',
        category: 'Paddles' as ProductCategory,
        price: 12999.00,
        compareAtPrice: 15999.00,
        quantity: 25,
        weight: 240,
        mediaUrls: [
          'https://images.unsplash.com/photo-1551698618-1dfe5d97d256?w=400&h=400&fit=crop',
          'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=400&fit=crop',
          'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop'
        ],
        facilityId: user.uid,
        facilityName: 'Downtown Pickleball Center',
        createdAt: Timestamp.now()
      },
      {
        title: 'Tournament Balls Set',
        description: 'Official tournament-grade pickleball balls. Set of 6 balls approved for competitive play.',
        category: 'Balls' as ProductCategory,
        price: 1299.00,
        quantity: 50,
        mediaUrls: [
          'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=400&h=400&fit=crop',
          'https://images.unsplash.com/photo-1571019613454-1cb2f99b2d8b?w=400&h=400&fit=crop'
        ],
        facilityId: user.uid,
        facilityName: 'Downtown Pickleball Center',
        createdAt: Timestamp.now()
      },
      {
        title: 'Court Shoes Elite',
        description: 'Professional pickleball shoes with superior grip and comfort. Designed for indoor and outdoor courts.',
        category: 'Shoes' as ProductCategory,
        price: 8999.00,
        compareAtPrice: 10999.00,
        quantity: 15,
        mediaUrls: [
          'https://images.unsplash.com/photo-1549298916-b41d501d3772?w=400&h=400&fit=crop',
          'https://images.unsplash.com/photo-1560769629-975ec94e6a86?w=400&h=400&fit=crop'
        ],
        facilityId: user.uid,
        facilityName: 'Downtown Pickleball Center',
        createdAt: Timestamp.now()
      },
      {
        title: 'Premium Sports Bag',
        description: 'Spacious sports bag with dedicated compartments for paddles, balls, and accessories.',
        category: 'Bags' as ProductCategory,
        price: 4999.00,
        quantity: 20,
        mediaUrls: [
          'https://images.unsplash.com/photo-1553062407-98eeb64c6a62?w=400&h=400&fit=crop'
        ],
        facilityId: user.uid,
        facilityName: 'Downtown Pickleball Center',
        createdAt: Timestamp.now()
      },
      {
        title: 'Test Product (No Images)',
        description: 'This is a test product without any images to verify fallback behavior.',
        category: 'Accessories' as ProductCategory,
        price: 999.00,
        quantity: 10,
        mediaUrls: [], // Empty array to test fallback
        facilityId: user.uid,
        facilityName: 'Downtown Pickleball Center',
        createdAt: Timestamp.now()
      }
    ];

    // Create products
    for (const productData of sampleProducts) {
      await addDoc(collection(db, 'products'), productData);
      console.log(`Created product: ${productData.title}`);
    }

    await signOut(auth);
    console.log('Test products setup complete!');
    console.log('Products created:');
    sampleProducts.forEach(p => console.log(`- ${p.title}`));
    
  } catch (error) {
    console.error('Error setting up test products:', error);
  }
}

async function clearTestProducts(facilityId: string) {
  try {
    const productsQuery = query(
      collection(db, 'products'),
      where('facilityId', '==', facilityId)
    );
    const productsSnapshot = await getDocs(productsQuery);
    
    for (const doc of productsSnapshot.docs) {
      await deleteDoc(doc.ref);
    }
    
    console.log('Cleared existing test products');
  } catch (error) {
    console.error('Error clearing test products:', error);
  }
}

// Run the setup if this file is executed directly
if (typeof window !== 'undefined') {
  // Browser environment - you can call this function from the console
  (window as any).setupTestProducts = setupTestProducts;
  console.log('Run setupTestProducts() in the console to create test products');
}