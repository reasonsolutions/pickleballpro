# Firebase Setup Guide for PickleBall Pro

This document explains how Firebase is set up in this application and how to use its various services.

## Overview

The application uses Firebase for:
- Authentication (Email/Password and Google)
- Firestore Database (for storing application data)
- Storage (for storing files like images)

## Firebase Configuration

The Firebase configuration is in `src/firebase/config.ts`. This file initializes the Firebase app and exports the auth, firestore, and storage services.

## Directory Structure

- `src/firebase/config.ts` - Firebase configuration
- `src/firebase/models.ts` - TypeScript interfaces for Firestore data models
- `src/firebase/auth.ts` - Authentication services
- `src/firebase/firestore.ts` - Firestore database services
- `src/firebase/storage.ts` - Storage services
- `src/firebase/index.ts` - Exports all Firebase modules

## Authentication

### Available Methods

- Sign up with email and password
- Sign in with email and password
- Sign in with Google
- Sign out
- Reset password
- Update user profile
- Update user email
- Update user password

### Using Authentication

Authentication is managed through the AuthContext (`src/context/AuthContext.tsx`), which provides hooks and methods to interact with Firebase auth.

```tsx
// Example usage in a component
import { useAuth } from '../context/AuthContext';

function MyComponent() {
  const { 
    currentUser, 
    userData, 
    signIn, 
    signUp, 
    signInWithGoogle, 
    logout 
  } = useAuth();

  // Now you can use these methods
}
```

## Firestore Database

### Data Models

The application uses the following data models:

- User
- Court
- Booking
- Tournament
- Product
- Order

### Using Firestore

You can use the functions in `src/firebase/firestore.ts` directly or use the custom hooks in `src/hooks/useFirestore.ts`.

```tsx
// Example using direct functions
import { getUserById, createBooking } from '../firebase/firestore';

// Example using hooks
import { useCollection, useDocument } from '../hooks/useFirestore';

function CourtsComponent() {
  // Get all courts with real-time updates
  const { documents: courts, loading, error } = useCollection('courts');

  // Render the courts
}

function CourtDetailComponent({ courtId }) {
  // Get a single court with real-time updates
  const { document: court, loading, error } = useDocument('courts', courtId);

  // Render the court details
}
```

## Storage

### Available Methods

- Upload files
- Upload files with progress tracking
- Upload data URLs
- Get download URLs
- Delete files
- List files in a directory
- Check if a file exists

### Using Storage

```tsx
// Example usage
import { uploadUserProfileImage, deleteFile } from '../firebase/storage';

async function uploadProfilePicture(userId, file) {
  try {
    const downloadURL = await uploadUserProfileImage(userId, file);
    // Update user profile with the download URL
  } catch (error) {
    console.error('Error uploading profile picture:', error);
  }
}
```

## Security Rules

The application uses Firebase security rules to protect data access:

- Firestore rules (`firestore.rules`): Control access to database collections
- Storage rules (`storage.rules`): Control access to stored files

## Deployment

The application is configured for Firebase Hosting in `firebase.json`. To deploy:

1. Build the application: `npm run build`
2. Deploy to Firebase: `firebase deploy`

## Best Practices

1. Always use the AuthContext for authentication operations
2. Use appropriate security rules to protect your data
3. Use batch operations for multiple database updates
4. Keep file sizes small for uploads
5. Use appropriate error handling for Firebase operations