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

// This script sets up test data for the booking courts feature
export async function setupTestData() {
  console.log('Setting up test data for court booking...');
  
  try {
    // Make sure we're logged out before starting
    try {
      await signOut(auth);
      console.log('Signed out any existing user');
    } catch (err) {
      // Ignore errors if no user is signed in
    }
    
    // First, clear any existing test data
    await clearTestData();
    
    // Create facility manager accounts
    const facility1Id = await createFacilityManager(
      'facility1@test.com',
      'Test123!',
      'Downtown Pickleball Center',
      '123 Main St, Downtown',
      'Our premium facility with multiple courts and amenities.'
    );
    
    const facility2Id = await createFacilityManager(
      'facility2@test.com',
      'Test123!',
      'Eastside Sports Complex',
      '456 East Ave, Eastside',
      'Family-friendly facility with both indoor and outdoor courts.'
    );
    
    // Create courts for each facility
    await createCourt(
      facility1Id,
      'Downtown Court 1',
      'Main Building',
      500,
      'indoor',
      'Downtown Pickleball Center'
    );
    
    await createCourt(
      facility1Id,
      'Downtown Court 2',
      'Main Building',
      500,
      'indoor',
      'Downtown Pickleball Center'
    );
    
    await createCourt(
      facility2Id,
      'Eastside Outdoor Court 1',
      'Outdoor Area',
      400,
      'outdoor',
      'Eastside Sports Complex'
    );
    
    await createCourt(
      facility2Id,
      'Eastside Indoor Court',
      'Main Building',
      600,
      'indoor',
      'Eastside Sports Complex'
    );
    
    // Create a player account
    await createPlayerAccount('player@test.com', 'Test123!');
    
    console.log('Test data setup complete!');
    console.log('You can now log in with:');
    console.log('Player: player@test.com / Test123!');
    console.log('Facility Manager: facility1@test.com / Test123!');
  } catch (error) {
    console.error('Error setting up test data:', error);
  }
}

async function clearTestData() {
  try {
    // Clear test courts
    const courtsQuery = query(collection(db, 'courts'));
    const courtsSnapshot = await getDocs(courtsQuery);
    
    for (const courtDoc of courtsSnapshot.docs) {
      await deleteDoc(doc(db, 'courts', courtDoc.id));
    }
    
    // Clear test bookings
    const bookingsQuery = query(collection(db, 'bookings'));
    const bookingsSnapshot = await getDocs(bookingsQuery);
    
    for (const bookingDoc of bookingsSnapshot.docs) {
      await deleteDoc(doc(db, 'bookings', bookingDoc.id));
    }
    
    console.log('Cleared existing test data');
  } catch (error) {
    console.error('Error clearing test data:', error);
  }
}

async function createFacilityManager(
  email: string,
  password: string,
  facilityName: string,
  address: string,
  description: string
): Promise<string> {
  try {
    let userId = '';
    
    try {
      // Try to create the auth account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      userId = userCredential.user.uid;
      console.log(`Created auth account for facility manager ${email} with UID: ${userId}`);
    } catch (authError: any) {
      // If the account already exists, try to sign in to get the UID
      if (authError.code === 'auth/email-already-in-use') {
        try {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          userId = userCredential.user.uid;
          console.log(`Facility manager ${email} already exists with UID: ${userId}`);
          
          // Sign out after getting the UID
          await signOut(auth);
        } catch (signInError) {
          console.error(`Could not sign in as existing user ${email}:`, signInError);
          throw signInError;
        }
      } else {
        throw authError;
      }
    }
    
    // Now create or update the Firestore record
    await setDoc(doc(db, 'users', userId), {
      email: email,
      role: 'facility_manager',
      facilityName: facilityName,
      address: address,
      description: description,
      createdAt: Timestamp.now(),
      bookings: []
    });
    
    console.log(`Created/updated Firestore record for facility manager ${email}`);
    return userId;
  } catch (error) {
    console.error(`Error creating facility manager ${email}:`, error);
    throw error;
  }
}

async function createCourt(
  facilityId: string,
  name: string,
  location: string,
  hourlyRate: number,
  indoorOutdoor: 'indoor' | 'outdoor',
  facilityName: string
) {
  try {
    const courtData = {
      name: name,
      location: location,
      hourlyRate: hourlyRate,
      indoorOutdoor: indoorOutdoor,
      facilityId: facilityId,
      facilityName: facilityName,
      createdAt: Timestamp.now()
    };
    
    const courtDoc = await addDoc(collection(db, 'courts'), courtData);
    console.log(`Created court ${name} with ID: ${courtDoc.id}`);
  } catch (error) {
    console.error(`Error creating court ${name}:`, error);
    throw error;
  }
}

async function createPlayerAccount(email: string, password: string) {
  try {
    let userId = '';
    
    try {
      // Try to create the auth account
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      userId = userCredential.user.uid;
      console.log(`Created auth account for player ${email} with UID: ${userId}`);
    } catch (authError: any) {
      // If the account already exists, try to sign in to get the UID
      if (authError.code === 'auth/email-already-in-use') {
        try {
          const userCredential = await signInWithEmailAndPassword(auth, email, password);
          userId = userCredential.user.uid;
          console.log(`Player ${email} already exists with UID: ${userId}`);
          
          // Sign out after getting the UID
          await signOut(auth);
        } catch (signInError) {
          console.error(`Could not sign in as existing user ${email}:`, signInError);
          throw signInError;
        }
      } else {
        throw authError;
      }
    }
    
    // Now create or update the Firestore record
    await setDoc(doc(db, 'users', userId), {
      email: email,
      role: 'player',
      createdAt: Timestamp.now(),
      bookings: []
    });
    
    console.log(`Created/updated Firestore record for player ${email}`);
  } catch (error) {
    console.error(`Error creating player ${email}:`, error);
    throw error;
  }
}

// Execute the setup if this file is run directly
if (typeof window !== 'undefined') {
  // Make the function available globally for browser execution
  (window as any).setupTestData = setupTestData;
  console.log('Test data setup function is available at window.setupTestData()');
}