import { db } from '../firebase/config';
import { 
  collection, 
  getDocs, 
  addDoc, 
  query,
  where,
  doc,
  setDoc,
  deleteDoc
} from 'firebase/firestore';

/**
 * Test script to verify the BookCourt functionality
 * This script creates test facilities and courts, and then cleans them up
 */
async function setupTestData() {
  console.log("Setting up test data for BookCourt...");

  try {
    // Create test facilities
    const testFacilities = [
      {
        id: 'test-facility-1',
        name: 'Test Facility 1',
        address: '123 Test Street, Test City',
        description: 'A test facility with multiple courts',
        imageUrl: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?q=80&w=600&auto=format&fit=crop'
      },
      {
        id: 'test-facility-2',
        name: 'Test Facility 2',
        address: '456 Test Avenue, Test Town',
        description: 'Another test facility with different courts',
        imageUrl: 'https://images.unsplash.com/photo-1599967728261-2f5d4531ad91?q=80&w=600&auto=format&fit=crop'
      }
    ];

    // Create test courts
    const testCourts = [
      {
        id: 'test-court-1',
        name: 'Test Court 1',
        description: 'Indoor premium court',
        pricePerHour: 30,
        amenities: ['indoor', 'premium', 'lighting'],
        imageUrl: 'https://images.unsplash.com/photo-1625676751186-844340fdfdc3?q=80&w=600&auto=format&fit=crop',
        facilityId: 'test-facility-1'
      },
      {
        id: 'test-court-2',
        name: 'Test Court 2',
        description: 'Outdoor standard court',
        pricePerHour: 25,
        amenities: ['outdoor', 'standard'],
        imageUrl: 'https://images.unsplash.com/photo-1613409450938-c5307d0a7767?q=80&w=600&auto=format&fit=crop',
        facilityId: 'test-facility-1'
      },
      {
        id: 'test-court-3',
        name: 'Test Court 3',
        description: 'Indoor beginner court',
        pricePerHour: 20,
        amenities: ['indoor', 'beginner'],
        imageUrl: 'https://images.unsplash.com/photo-1625676751186-844340fdfdc3?q=80&w=600&auto=format&fit=crop',
        facilityId: 'test-facility-2'
      }
    ];

    // Add facilities to Firestore
    for (const facility of testFacilities) {
      const { id, ...facilityData } = facility;
      await setDoc(doc(db, 'facilities', id), facilityData);
      console.log(`Created test facility: ${facility.name}`);
    }

    // Add courts to Firestore
    for (const court of testCourts) {
      const { id, ...courtData } = court;
      await setDoc(doc(db, 'courts', id), courtData);
      console.log(`Created test court: ${court.name}`);
    }

    console.log("Test data setup complete!");
    return { facilities: testFacilities, courts: testCourts };
  } catch (error) {
    console.error("Error setting up test data:", error);
    throw error;
  }
}

async function cleanupTestData(testData: { facilities: any[], courts: any[] }) {
  console.log("Cleaning up test data...");

  try {
    // Delete test courts
    for (const court of testData.courts) {
      await deleteDoc(doc(db, 'courts', court.id));
      console.log(`Deleted test court: ${court.name}`);
    }

    // Delete test facilities
    for (const facility of testData.facilities) {
      await deleteDoc(doc(db, 'facilities', facility.id));
      console.log(`Deleted test facility: ${facility.name}`);
    }

    console.log("Test data cleanup complete!");
  } catch (error) {
    console.error("Error cleaning up test data:", error);
    throw error;
  }
}

// Function to run the test
export async function testBookCourt() {
  console.log("Running BookCourt test...");
  let testData;

  try {
    // Setup test data
    testData = await setupTestData();
    
    console.log("Test data created successfully");
    console.log("Go to the Book Court page to verify the functionality");
    console.log("You should see the test facilities and be able to book courts");
    
    // Prompt to clean up when done
    console.log("\nWhen you're done testing, run the cleanupTestData function");
    console.log("Example: await import('./scripts/testBookCourt').then(m => m.cleanupTestData(testData))");
    
    return testData;
  } catch (error) {
    console.error("Test failed:", error);
    
    // Clean up if setup was successful but test failed
    if (testData) {
      await cleanupTestData(testData);
    }
  }
}

export { setupTestData, cleanupTestData };