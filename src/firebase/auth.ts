import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  GoogleAuthProvider,
  signInWithPopup,
  sendPasswordResetEmail,
  updateProfile,
  updateEmail,
  updatePassword,
  sendEmailVerification
} from 'firebase/auth';
import type { User, UserCredential } from 'firebase/auth';
import { auth, db } from './config';
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
  collection,
  query,
  where,
  getDocs
} from 'firebase/firestore';
import type { User as UserModel } from './models';

/**
 * Sign up a new user with email and password
 */
export const signUpWithEmail = async (
  email: string,
  password: string,
  displayName: string,
  role: 'player' | 'facility_manager' | 'brand' = 'player',
  additionalInfo: {
    dateOfBirth?: string;
    gender?: 'Male' | 'Female' | 'Other';
    duprProfileLink?: string;
    facilityName?: string;
  } = {}
): Promise<UserCredential> => {
  try {
    // Check if a user with this email already exists
    const existingUser = await checkUserExistsByEmail(email);
    
    if (existingUser) {
      // User exists - try to sign in and add the new role
      try {
        // This will throw an error since we don't have the password
        // We'll catch this and inform the user to sign in with existing account
        throw new Error("Email already exists. Please sign in with your existing account and then select the new role.");
      } catch (err) {
        console.error('User already exists:', err);
        throw new Error("Email already exists. Please sign in with your existing account and then select the new role.");
      }
    }
    
    // Create new user
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    
    // Update profile with display name
    await updateProfile(userCredential.user, { displayName });
    
    // Send email verification
    await sendEmailVerification(userCredential.user);
    
    // Create roles object with the selected role
    const roles = {
      [role]: true
    };
    
    // Create user document in Firestore
    await createUserDocument(userCredential.user, {
      displayName,
      roles, // Use the roles object instead of a single role
      activeRole: role, // Set the active role to the current one
      ...additionalInfo
    });
    
    return userCredential;
  } catch (error) {
    console.error('Error signing up:', error);
    throw error;
  }
};

/**
 * Sign in with email and password
 */
export const signInWithEmail = async (
  email: string,
  password: string,
  role?: 'player' | 'facility_manager' | 'brand'
): Promise<UserCredential> => {
  const userCredential = await signInWithEmailAndPassword(auth, email, password);
  
  // If a specific role is requested, set it as the active role
  if (role) {
    const userRef = doc(db, 'users', userCredential.user.uid);
    const userDoc = await getDoc(userRef);
    
    if (userDoc.exists()) {
      const userData = userDoc.data() as UserModel;
      
      // Create a roles object with the requested role, or use existing roles
      const roles = userData.roles || {};
      
      // Add the new role if it doesn't exist
      if (!roles[role]) {
        roles[role] = true;
      }
      
      // Update the user document with the roles and active role
      await updateDoc(userRef, {
        roles,
        activeRole: role
      });
    }
  }
  
  return userCredential;
};

/**
 * Sign in with Google
 */
export const signInWithGoogleProvider = async (): Promise<UserCredential> => {
  try {
    const provider = new GoogleAuthProvider();
    const userCredential = await signInWithPopup(auth, provider);
    
    // Check if user document exists, create if not
    const userExists = await checkUserExists(userCredential.user.uid);
    if (!userExists) {
      // For Google sign-in, create default 'player' role
      await createUserDocument(userCredential.user, {
        roles: { player: true },
        activeRole: 'player'
      });
    }
    
    return userCredential;
  } catch (error) {
    console.error('Error signing in with Google:', error);
    throw error;
  }
};

/**
 * Check if a user document exists in Firestore
 */
export const checkUserExists = async (uid: string): Promise<boolean> => {
  const userDoc = await getDoc(doc(db, 'users', uid));
  return userDoc.exists();
};

/**
 * Check if a user with the given email exists
 */
export const checkUserExistsByEmail = async (email: string): Promise<boolean> => {
  // Query users collection for a user with this email
  const usersRef = collection(db, 'users');
  const q = query(usersRef, where('email', '==', email));
  const querySnapshot = await getDocs(q);
  
  return !querySnapshot.empty;
};

/**
 * Create a user document in Firestore
 */
export const createUserDocument = async (
  user: User,
  additionalData: Partial<UserModel> = {}
): Promise<void> => {
  if (!user.uid) return;

  const userRef = doc(db, 'users', user.uid);
  
  // Check if the user already exists
  const userDoc = await getDoc(userRef);
  
  if (userDoc.exists()) {
    // User exists, update with new role if provided
    const existingData = userDoc.data() as UserModel;
    let roles = existingData.roles || {};
    
    // If there's a new role in additionalData.roles, add it
    if (additionalData.roles) {
      roles = {...roles, ...additionalData.roles};
    }
    // Handle legacy case where role is provided as a string
    else if ('role' in additionalData && typeof additionalData.role === 'string') {
      const roleValue = additionalData.role as 'player' | 'facility_manager' | 'brand';
      roles[roleValue] = true;
    }
    
    const updateData: Partial<UserModel> = {
      ...additionalData,
      roles,
      // Only update these if they're not already set
      displayName: existingData.displayName || user.displayName || additionalData.displayName || '',
      photoURL: existingData.photoURL || user.photoURL,
    };
    
    // Remove the legacy role field if it exists
    if ('role' in updateData) {
      delete updateData.role;
    }
    
    await updateDoc(userRef, updateData);
  } else {
    // New user, create document
    const roles = additionalData.roles || {};
    
    // Handle legacy case where role is provided as a string
    if ('role' in additionalData && typeof additionalData.role === 'string') {
      const roleValue = additionalData.role as 'player' | 'facility_manager' | 'brand';
      roles[roleValue] = true;
    }
    
    const userData: Partial<UserModel> = {
      uid: user.uid,
      email: user.email,
      displayName: user.displayName || additionalData.displayName || '',
      photoURL: user.photoURL,
      createdAt: serverTimestamp() as any,
      bookings: [],
      roles,
      ...additionalData
    };
    
    // Remove the legacy role field if it exists
    if ('role' in userData) {
      delete userData.role;
    }
    
    await setDoc(userRef, userData);
  }
};

/**
 * Update user profile
 */
export const updateUserProfile = async (
  user: User,
  profileData: { displayName?: string; photoURL?: string }
): Promise<void> => {
  try {
    await updateProfile(user, profileData);
    
    // Update the user document in Firestore
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, profileData);
  } catch (error) {
    console.error('Error updating profile:', error);
    throw error;
  }
};

/**
 * Update user email
 */
export const updateUserEmail = async (
  user: User,
  newEmail: string
): Promise<void> => {
  try {
    await updateEmail(user, newEmail);
    
    // Update the user document in Firestore
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, { email: newEmail });
  } catch (error) {
    console.error('Error updating email:', error);
    throw error;
  }
};

/**
 * Update user password
 */
export const updateUserPassword = async (
  user: User,
  newPassword: string
): Promise<void> => {
  try {
    await updatePassword(user, newPassword);
  } catch (error) {
    console.error('Error updating password:', error);
    throw error;
  }
};

/**
 * Send password reset email
 */
export const resetUserPassword = async (email: string): Promise<void> => {
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (error) {
    console.error('Error sending password reset email:', error);
    throw error;
  }
};

/**
 * Sign out user
 */
export const signOutUser = async (): Promise<void> => {
  try {
    await signOut(auth);
  } catch (error) {
    console.error('Error signing out:', error);
    throw error;
  }
};

/**
 * Get current user from Firestore
 */
export const getCurrentUserData = async (uid: string): Promise<UserModel | null> => {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    if (userDoc.exists()) {
      return userDoc.data() as UserModel;
    }
    return null;
  } catch (error) {
    console.error('Error getting user data:', error);
    throw error;
  }
};