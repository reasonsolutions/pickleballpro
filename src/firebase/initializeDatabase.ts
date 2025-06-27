import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut
} from 'firebase/auth';
import {
  doc,
  setDoc,
  collection,
  getDocs,
  getDoc,
  query,
  where,
  serverTimestamp,
  Timestamp,
  updateDoc
} from 'firebase/firestore';
import { auth, db } from './config';
import type { User, Court, Booking, Tournament, Product, Order } from './models';

// Test account credentials
const TEST_EMAIL = 'test@pickleballpro.com';
const TEST_PASSWORD = 'Test123!';
const TEST_NAME = 'Test User';

/**
 * Create a test account for easy access
 */
export const createTestAccount = async (): Promise<string> => {
  try {
    // Check if test account already exists in Firestore
    const testUserQuery = query(
      collection(db, 'users'),
      where('email', '==', TEST_EMAIL)
    );
    const testUserDocs = await getDocs(testUserQuery);
    
    if (!testUserDocs.empty) {
      console.log('Test account already exists in Firestore');
      return testUserDocs.docs[0].id; // Return the existing user ID
    }
    
    let userCredential;
    
    try {
      // Try to create a new account
      userCredential = await createUserWithEmailAndPassword(
        auth,
        TEST_EMAIL,
        TEST_PASSWORD
      );
    } catch (authError: any) {
      // If the account already exists in Auth but not in Firestore
      if (authError.code === 'auth/email-already-in-use') {
        console.log('Test account exists in Auth but not in Firestore, signing in instead');
        userCredential = await signInWithEmailAndPassword(auth, TEST_EMAIL, TEST_PASSWORD);
      } else {
        throw authError; // Re-throw other errors
      }
    }
    
    // Add user data to Firestore
    await setDoc(doc(db, 'users', userCredential.user.uid), {
      uid: userCredential.user.uid,
      email: TEST_EMAIL,
      displayName: TEST_NAME,
      isAdmin: true,
      role: 'facility_manager',
      createdAt: serverTimestamp(),
      bookings: []
    });
    
    // Sign out after creating/using the account
    await signOut(auth);
    
    return userCredential.user.uid;
    
    console.log('Test account created successfully');
    
    // Sign out after creating the account
    await signOut(auth);
  } catch (error) {
    console.error('Error creating test account:', error);
    throw error;
  }
};

/**
 * Add sample courts to the database
 */
export const createSampleCourts = async (): Promise<void> => {
  try {
    const courtsQuery = query(collection(db, 'courts'));
    const courtsDocs = await getDocs(courtsQuery);
    
    if (!courtsDocs.empty) {
      console.log('Sample courts already exist');
      return;
    }
    
    const sampleCourts: Partial<Court>[] = [
      {
        name: 'Main Court 1',
        location: 'Downtown Facility',
        description: 'Professional-grade indoor court with premium flooring.',
        hourlyRate: 25,
        indoorOutdoor: 'indoor',
        features: ['LED Lighting', 'Pro Netting', 'Spectator Seating']
      },
      {
        name: 'Outdoor Court 2',
        location: 'Lakeside Park',
        description: 'Beautiful outdoor court with lake views.',
        hourlyRate: 18,
        indoorOutdoor: 'outdoor',
        features: ['Shaded Rest Area', 'Water Fountain', 'Equipment Rentals']
      },
      {
        name: 'Elite Court 3',
        location: 'Sports Complex',
        description: 'Tournament-ready court with professional-grade equipment.',
        hourlyRate: 30,
        indoorOutdoor: 'indoor',
        features: ['Tournament Grade', 'Video Recording', 'Coaching Available']
      }
    ];
    
    // Add sample courts to Firestore
    for (const court of sampleCourts) {
      const courtRef = doc(collection(db, 'courts'));
      await setDoc(courtRef, {
        ...court,
        id: courtRef.id,
        createdAt: serverTimestamp()
      });
    }
    
    console.log('Sample courts created successfully');
  } catch (error) {
    console.error('Error creating sample courts:', error);
  }
};

/**
 * Add sample tournaments to the database
 */
export const createSampleTournaments = async (): Promise<void> => {
  try {
    // Check if demo tournaments flag exists (indicating they've been deleted intentionally)
    const flagsRef = doc(db, 'system_flags', 'demo_tournaments');
    const flagDoc = await getDoc(flagsRef);
    
    if (flagDoc.exists() && flagDoc.data().deleted === true) {
      console.log('Demo tournaments were intentionally deleted, not recreating');
      return;
    }
    
    // Check if any tournaments already exist
    const tournamentsQuery = query(collection(db, 'tournaments'));
    const tournamentsDocs = await getDocs(tournamentsQuery);
    
    if (!tournamentsDocs.empty) {
      console.log('Sample tournaments already exist');
      return;
    }
    
    // Set dates for upcoming tournaments
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    
    const twoMonthsFromNow = new Date();
    twoMonthsFromNow.setMonth(twoMonthsFromNow.getMonth() + 2);
    
    const threeMonthsFromNow = new Date();
    threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
    
    const sampleTournaments: Partial<Tournament>[] = [
      {
        name: 'Summer Slam Tournament',
        description: 'Annual summer tournament with prizes for all skill levels.',
        startDate: Timestamp.fromDate(nextMonth),
        endDate: Timestamp.fromDate(new Date(nextMonth.getTime() + 86400000 * 2)), // 2 days after start
        location: 'Downtown Facility',
        registrationFee: 50,
        registrationDeadline: Timestamp.fromDate(new Date(nextMonth.getTime() - 86400000 * 7)), // 7 days before start
        maxParticipants: 32,
        currentParticipants: 12,
        categories: ['Mens Singles', 'Mens Doubles', 'Womens Singles', 'Womens Doubles', 'Mixed Doubles'],
        prizes: {
          first: '₹500',
          second: '₹250',
          third: '₹100'
        }
      },
      {
        name: 'Pro-Am Challenge',
        description: 'Professional and amateur players team up for an exciting competition.',
        startDate: Timestamp.fromDate(twoMonthsFromNow),
        endDate: Timestamp.fromDate(new Date(twoMonthsFromNow.getTime() + 86400000 * 3)), // 3 days after start
        location: 'Sports Complex',
        registrationFee: 75,
        registrationDeadline: Timestamp.fromDate(new Date(twoMonthsFromNow.getTime() - 86400000 * 14)), // 14 days before start
        maxParticipants: 24,
        currentParticipants: 8,
        categories: ['Mens Singles', 'Mixed Doubles', 'Open Doubles'],
        prizes: {
          first: '₹800',
          second: '₹400',
          third: '₹200'
        }
      }
    ];
    
    // Add sample tournaments to Firestore
    for (const tournament of sampleTournaments) {
      const tournamentRef = doc(collection(db, 'tournaments'));
      
      // Get test user to add as participant
      const testUserQuery = query(
        collection(db, 'users'),
        where('email', '==', TEST_EMAIL)
      );
      const testUserDocs = await getDocs(testUserQuery);
      
      if (testUserDocs.empty) {
        console.log('Test user not found, cannot add as tournament participant');
        return;
      }
      
      const testUserId = testUserDocs.docs[0].id;
      
      // Create sample participants
      const participants = [];
      
      // Add test user as participant to all categories
      if (tournament.categories) {
        for (const category of tournament.categories) {
          participants.push({
            userId: testUserId,
            category: category,
            registrationDate: Timestamp.fromDate(new Date()),
            seed: null // Initially no seed
          });
        }
      }
      
      // Add 3-5 more random participants per category
      if (tournament.categories) {
        for (const category of tournament.categories) {
          const numParticipants = Math.floor(Math.random() * 3) + 3; // 3-5 participants
          
          for (let i = 0; i < numParticipants; i++) {
            const randomId = `user_${Math.random().toString(36).substring(2, 8)}`;
            participants.push({
              userId: randomId,
              category: category,
              registrationDate: Timestamp.fromDate(new Date()),
              seed: Math.random() < 0.3 ? Math.floor(Math.random() * 8) + 1 : null // 30% chance of having a seed
            });
          }
        }
      }
      
      await setDoc(tournamentRef, {
        ...tournament,
        participants: participants,
        id: tournamentRef.id,
        createdAt: serverTimestamp()
      });
    }
    
    console.log('Sample tournaments created successfully');
  } catch (error) {
    console.error('Error creating sample tournaments:', error);
  }
};

/**
 * Add sample products to the database
 */
export const createSampleProducts = async (): Promise<void> => {
  try {
    const productsQuery = query(collection(db, 'products'));
    const productsDocs = await getDocs(productsQuery);
    
    if (!productsDocs.empty) {
      console.log('Sample products already exist');
      return;
    }
    
    const sampleProducts: Partial<Product>[] = [
      {
        name: 'Pro Paddle X1',
        description: 'Professional-grade paddle with carbon fiber face and polymer core.',
        price: 89.99,
        category: 'paddles',
        inventory: 25,
        featured: true
      },
      {
        name: 'Beginner Paddle Set',
        description: 'Set of 2 paddles perfect for beginners with carrying case.',
        price: 49.99,
        category: 'paddles',
        inventory: 30
      },
      {
        name: 'Premium Pickleballs (12 pack)',
        description: 'Tournament-approved pickleballs with consistent bounce and durability.',
        price: 24.99,
        category: 'balls',
        inventory: 50
      },
      {
        name: 'Performance Athletic Shirt',
        description: 'Moisture-wicking shirt with pickleball logo.',
        price: 29.99,
        category: 'apparel',
        inventory: 40,
        featured: true
      },
      {
        name: 'Court Shoes',
        description: 'Non-marking shoes designed for pickleball courts.',
        price: 79.99,
        category: 'footwear',
        inventory: 15
      }
    ];
    
    // Add sample products to Firestore
    for (const product of sampleProducts) {
      const productRef = doc(collection(db, 'products'));
      await setDoc(productRef, {
        ...product,
        id: productRef.id,
        createdAt: serverTimestamp()
      });
    }
    
    console.log('Sample products created successfully');
  } catch (error) {
    console.error('Error creating sample products:', error);
  }
};

/**
 * Add sample bookings to the database
 */
export const createSampleBookings = async (testUserId: string): Promise<void> => {
  try {
    const bookingsQuery = query(collection(db, 'bookings'));
    const bookingsDocs = await getDocs(bookingsQuery);
    
    if (!bookingsDocs.empty) {
      console.log('Sample bookings already exist');
      return;
    }
    
    // Verify the user exists
    const userRef = doc(db, 'users', testUserId);
    const userDoc = await getDoc(userRef);
    
    if (!userDoc.exists()) {
      console.log('Test user not found, cannot create sample bookings');
      return;
    }
    
    // Get courts
    const courtsQuery = query(collection(db, 'courts'));
    const courtsDocs = await getDocs(courtsQuery);
    
    if (courtsDocs.empty) {
      console.log('No courts found, cannot create sample bookings');
      return;
    }
    
    const courts = courtsDocs.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Court[];
    
    // Create sample bookings
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);
    
    const sampleBookings: Partial<Booking>[] = [
      {
        userId: testUserId,
        courtId: courts[0].id,
        date: Timestamp.fromDate(today),
        startTime: '10:00',
        endTime: '11:00',
        totalCost: courts[0].hourlyRate,
        status: 'confirmed',
        participants: 4
      },
      {
        userId: testUserId,
        courtId: courts[1].id,
        date: Timestamp.fromDate(nextWeek),
        startTime: '14:00',
        endTime: '16:00',
        totalCost: courts[1].hourlyRate * 2,
        status: 'pending',
        participants: 2
      }
    ];
    
    // Add sample bookings to Firestore
    for (const booking of sampleBookings) {
      const bookingRef = doc(collection(db, 'bookings'));
      await setDoc(bookingRef, {
        ...booking,
        id: bookingRef.id,
        createdAt: serverTimestamp()
      });
      
      // Update user's bookings array
      if (booking.userId) {
        const userRef = doc(db, 'users', booking.userId);
        const userDoc = await getDoc(userRef);
        
        if (userDoc.exists()) {
          const userData = userDoc.data() as User;
          const bookings = userData.bookings || [];
          
          await updateDoc(userRef, {
            bookings: [...bookings, bookingRef.id]
          });
        }
      }
    }
    
    console.log('Sample bookings created successfully');
  } catch (error) {
    console.error('Error creating sample bookings:', error);
  }
};

/**
 * Add sample orders to the database
 */
export const createSampleOrders = async (): Promise<void> => {
  try {
    const ordersQuery = query(collection(db, 'orders'));
    const ordersDocs = await getDocs(ordersQuery);
    
    if (!ordersDocs.empty) {
      console.log('Sample orders already exist');
      return;
    }
    
    // Get test user ID
    const testUserQuery = query(
      collection(db, 'users'),
      where('email', '==', TEST_EMAIL)
    );
    const testUserDocs = await getDocs(testUserQuery);
    
    if (testUserDocs.empty) {
      console.log('Test user not found, cannot create sample orders');
      return;
    }
    
    const testUserId = testUserDocs.docs[0].id;
    
    // Get products
    const productsQuery = query(collection(db, 'products'));
    const productsDocs = await getDocs(productsQuery);
    
    if (productsDocs.empty) {
      console.log('No products found, cannot create sample orders');
      return;
    }
    
    const products = productsDocs.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as Product[];
    
    // Create sample orders
    const lastMonth = new Date();
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    
    const sampleOrders: Partial<Order>[] = [
      {
        userId: testUserId,
        items: [
          {
            productId: products[0].id,
            quantity: 1,
            price: products[0].price
          },
          {
            productId: products[2].id,
            quantity: 2,
            price: products[2].price
          }
        ],
        totalAmount: products[0].price + (products[2].price * 2),
        status: 'delivered',
        shippingAddress: {
          name: TEST_NAME,
          address: '123 Main St',
          city: 'Hyderabad',
          state: 'Telangana',
          zipCode: '500001',
          country: 'India'
        }
      },
      {
        userId: testUserId,
        items: [
          {
            productId: products[3].id,
            quantity: 1,
            price: products[3].price
          }
        ],
        totalAmount: products[3].price,
        status: 'processing',
        shippingAddress: {
          name: TEST_NAME,
          address: '123 Main St',
          city: 'Hyderabad',
          state: 'Telangana',
          zipCode: '500001',
          country: 'India'
        }
      }
    ];
    
    // Add sample orders to Firestore
    for (const order of sampleOrders) {
      const orderRef = doc(collection(db, 'orders'));
      await setDoc(orderRef, {
        ...order,
        id: orderRef.id,
        createdAt: serverTimestamp()
      });
    }
    
    console.log('Sample orders created successfully');
  } catch (error) {
    console.error('Error creating sample orders:', error);
  }
};

/**
 * Initialize all sample data
 */
export const initializeDatabase = async (): Promise<void> => {
  try {
    // Get test user ID, which will ensure user exists in both Auth and Firestore
    const testUserId = await createTestAccount();
    
    // Initialize each part separately to ensure one failure doesn't stop the others
    try {
      await createSampleCourts();
    } catch (error) {
      console.error('Error creating sample courts:', error);
    }
    
    try {
      await createSampleTournaments();
    } catch (error) {
      console.error('Error creating sample tournaments:', error);
    }
    
    try {
      await createSampleProducts();
    } catch (error) {
      console.error('Error creating sample products:', error);
    }
    
    try {
      await createSampleBookings(testUserId);
    } catch (error) {
      console.error('Error creating sample bookings:', error);
    }
    
    try {
      await createSampleOrders();
    } catch (error) {
      console.error('Error creating sample orders:', error);
    }
    
    console.log('Database initialization complete');
  } catch (error) {
    console.error('Error initializing database:', error);
  }
};