// Re-export everything from our Firebase modules
export * from './config';
export * from './models';
export * from './auth';
export * from './firestore';
export * from './storage';
export * from './initializeDatabase';

// This file serves as a central point for importing Firebase functionality
// throughout the application. Instead of importing from individual files,
// components can import from this index file.
//
// Example:
// import { auth, db, storage, signInWithEmail, uploadUserProfileImage } from '../firebase';