import { 
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  startAfter,
  Timestamp,
  QueryConstraint,
  addDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db } from './config';
import type { 
  User,
  Court,
  Booking,
  Tournament,
  Product,
  Order
} from './models';

/**
 * Generic function to get a document by ID
 */
export const getDocById = async <T>(
  collectionName: string, 
  id: string
): Promise<T | null> => {
  try {
    const docRef = doc(db, collectionName, id);
    const docSnap = await getDoc(docRef);
    
    if (docSnap.exists()) {
      return { id: docSnap.id, ...docSnap.data() } as T;
    }
    
    return null;
  } catch (error) {
    console.error(`Error getting ${collectionName} document:`, error);
    throw error;
  }
};

/**
 * Generic function to create a document with a specific ID
 */
export const createDocWithId = async <T>(
  collectionName: string, 
  id: string, 
  data: Partial<T>
): Promise<void> => {
  try {
    const docRef = doc(db, collectionName, id);
    await setDoc(docRef, {
      ...data,
      createdAt: 'createdAt' in data ? data.createdAt : serverTimestamp()
    });
  } catch (error) {
    console.error(`Error creating ${collectionName} document:`, error);
    throw error;
  }
};

/**
 * Generic function to create a document with auto-generated ID
 */
export const createDoc = async <T>(
  collectionName: string, 
  data: Partial<T>
): Promise<string> => {
  try {
    const collectionRef = collection(db, collectionName);
    const docRef = await addDoc(collectionRef, {
      ...data,
      createdAt: 'createdAt' in data ? data.createdAt : serverTimestamp()
    });
    return docRef.id;
  } catch (error) {
    console.error(`Error creating ${collectionName} document:`, error);
    throw error;
  }
};

/**
 * Generic function to update a document
 */
export const updateDocById = async <T>(
  collectionName: string, 
  id: string, 
  data: Partial<T>
): Promise<void> => {
  try {
    const docRef = doc(db, collectionName, id);
    await updateDoc(docRef, {
      ...data,
      updatedAt: serverTimestamp()
    });
  } catch (error) {
    console.error(`Error updating ${collectionName} document:`, error);
    throw error;
  }
};

/**
 * Generic function to delete a document
 */
export const deleteDocById = async (
  collectionName: string, 
  id: string
): Promise<void> => {
  try {
    const docRef = doc(db, collectionName, id);
    await deleteDoc(docRef);
  } catch (error) {
    console.error(`Error deleting ${collectionName} document:`, error);
    throw error;
  }
};

/**
 * Generic function to query documents
 */
export const queryDocs = async <T>(
  collectionName: string, 
  constraints: QueryConstraint[] = [],
  limitCount: number = 100
): Promise<T[]> => {
  try {
    const collectionRef = collection(db, collectionName);
    const q = query(collectionRef, ...constraints, limit(limitCount));
    const querySnapshot = await getDocs(q);
    
    return querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    })) as T[];
  } catch (error) {
    console.error(`Error querying ${collectionName} collection:`, error);
    throw error;
  }
};

// User-specific functions
export const getUserById = async (id: string): Promise<User | null> => {
  return getDocById<User>('users', id);
};

export const createOrUpdateUser = async (user: Partial<User>): Promise<void> => {
  if (!user.uid) throw new Error('User ID is required');
  await createDocWithId<User>('users', user.uid, user);
};

// Court-specific functions
export const getAllCourts = async (): Promise<Court[]> => {
  return queryDocs<Court>('courts', [orderBy('name')]);
};

export const getCourtById = async (id: string): Promise<Court | null> => {
  return getDocById<Court>('courts', id);
};

export const createCourt = async (court: Partial<Court>): Promise<string> => {
  return createDoc<Court>('courts', court);
};

export const updateCourt = async (id: string, data: Partial<Court>): Promise<void> => {
  await updateDocById<Court>('courts', id, data);
};

// Booking-specific functions
export const createBooking = async (booking: Partial<Booking>): Promise<string> => {
  const bookingId = await createDoc<Booking>('bookings', booking);
  
  // Update user's bookings array
  if (booking.userId) {
    const userRef = doc(db, 'users', booking.userId);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data() as User;
      const bookings = userData.bookings || [];
      
      await updateDoc(userRef, {
        bookings: [...bookings, bookingId]
      });
    }
  }
  
  return bookingId;
};

export const getUserBookings = async (userId: string): Promise<Booking[]> => {
  return queryDocs<Booking>('bookings', [
    where('userId', '==', userId),
    orderBy('date', 'desc')
  ]);
};

export const getBookingsByCourtAndDate = async (
  courtId: string, 
  date: Date
): Promise<Booking[]> => {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);
  
  return queryDocs<Booking>('bookings', [
    where('courtId', '==', courtId),
    where('date', '>=', Timestamp.fromDate(startOfDay)),
    where('date', '<=', Timestamp.fromDate(endOfDay)),
    orderBy('date')
  ]);
};

// Tournament-specific functions
export const getAllTournaments = async (): Promise<Tournament[]> => {
  return queryDocs<Tournament>('tournaments', [orderBy('startDate')]);
};

export const getTournamentById = async (id: string): Promise<Tournament | null> => {
  return getDocById<Tournament>('tournaments', id);
};

export const createTournament = async (tournament: Partial<Tournament>): Promise<string> => {
  return createDoc<Tournament>('tournaments', tournament);
};

export const registerUserForTournament = async (
  tournamentId: string,
  userId: string,
  category: string
): Promise<void> => {
  const tournamentRef = doc(db, 'tournaments', tournamentId);
  const tournamentDoc = await getDoc(tournamentRef);
  
  if (tournamentDoc.exists()) {
    const tournamentData = tournamentDoc.data() as Tournament;
    const participants = tournamentData.participants || [];
    
    // Check if user is already registered for this category
    const existingRegistration = participants.find(
      p => p.userId === userId && p.category === category
    );
    
    if (!existingRegistration) {
      const newParticipant = {
        userId,
        category,
        registrationDate: Timestamp.fromDate(new Date())
      };
      
      await updateDoc(tournamentRef, {
        participants: [...participants, newParticipant],
        currentParticipants: (tournamentData.currentParticipants || 0) + 1
      });
    }
  }
};

// Product-specific functions
export const getAllProducts = async (category?: string): Promise<Product[]> => {
  const constraints: QueryConstraint[] = [orderBy('name')];
  
  if (category) {
    constraints.unshift(where('category', '==', category));
  }
  
  return queryDocs<Product>('products', constraints);
};

export const getFeaturedProducts = async (limit: number = 8): Promise<Product[]> => {
  return queryDocs<Product>('products', [
    where('featured', '==', true),
    orderBy('name')
  ], limit);
};

// Order-specific functions
export const createOrder = async (order: Partial<Order>): Promise<string> => {
  return createDoc<Order>('orders', order);
};

export const getUserOrders = async (userId: string): Promise<Order[]> => {
  return queryDocs<Order>('orders', [
    where('userId', '==', userId),
    orderBy('createdAt', 'desc')
  ]);
};