import { db } from '../firebase/config';
import { collection, addDoc } from 'firebase/firestore';

/**
 * Script to create sample courts in the Firestore database
 * Run this script to populate the courts collection with test data
 */
export async function createTestCourts() {
  console.log("Creating test courts in Firestore...");
  
  try {
    const courtsCollection = collection(db, 'courts');
    
    // Sample courts for a couple of facilities
    const testCourts = [
      // Facility 1 courts
      {
        name: "Center Court 1",
        description: "Premium indoor court with tournament-grade surface",
        pricePerHour: 30,
        amenities: ["indoor", "premium", "lighting", "air-conditioned"],
        imageUrl: "https://images.unsplash.com/photo-1625676751186-844340fdfdc3?q=80&w=600&auto=format&fit=crop",
        facilityId: "facility-center"
      },
      {
        name: "Center Court 2",
        description: "Standard indoor court with good lighting",
        pricePerHour: 25,
        amenities: ["indoor", "standard", "lighting"],
        imageUrl: "https://images.unsplash.com/photo-1625676751186-844340fdfdc3?q=80&w=600&auto=format&fit=crop",
        facilityId: "facility-center"
      },
      // Facility 2 courts
      {
        name: "Sunset Court 1",
        description: "Outdoor court with beautiful views",
        pricePerHour: 20,
        amenities: ["outdoor", "premium", "shade"],
        imageUrl: "https://images.unsplash.com/photo-1613409450938-c5307d0a7767?q=80&w=600&auto=format&fit=crop",
        facilityId: "facility-sunset"
      },
      {
        name: "Sunset Court 2",
        description: "Tournament-ready outdoor court",
        pricePerHour: 25,
        amenities: ["outdoor", "tournament", "spectator-seating"],
        imageUrl: "https://images.unsplash.com/photo-1613409450938-c5307d0a7767?q=80&w=600&auto=format&fit=crop",
        facilityId: "facility-sunset"
      }
    ];
    
    // Add each court to Firestore
    for (const court of testCourts) {
      const docRef = await addDoc(courtsCollection, court);
      console.log(`Created court: ${court.name} with ID: ${docRef.id}`);
    }
    
    console.log("Test courts created successfully!");
    return { success: true, courtCount: testCourts.length };
  } catch (error) {
    console.error("Error creating test courts:", error);
    return { success: false, error };
  }
}

// Make it easily accessible from browser console
(window as any).createTestCourts = createTestCourts;