# PickleBall Pro - Court Booking Web App

A React-based web application for booking pickleball courts with a modern glass-effect UI design.

## Features

- **Authentication System**: Firebase Authentication integration with email/password and Google OAuth
- **Responsive Dashboard**: Modern glass-effect design that works on mobile and desktop
- **Court Booking**: Calendar-based booking system with real-time availability checking
- **User Profile Management**: Manage your profile and view your booking history
- **Protected Routes**: Secure routes that require authentication

## Tech Stack

- React with TypeScript
- Firebase (Authentication, Firestore Database)
- React Router for navigation
- Tailwind CSS for styling
- React Hook Form for form management
- Date-fns for date manipulation

## Getting Started

### Prerequisites

- Node.js and npm installed
- Firebase account and project setup

### Installation

1. Clone the repository
```bash
git clone <repository-url>
cd pickleballpro
```

2. Install dependencies
```bash
npm install
```

3. Configure Firebase

Update the Firebase configuration in `src/firebase/config.ts` with your own Firebase project details:

```typescript
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID",
  measurementId: "YOUR_MEASUREMENT_ID"
};
```

4. Run the development server
```bash
npm run dev
```

5. Build for production
```bash
npm run build
```

## Firebase Setup

1. Create a new Firebase project at [https://console.firebase.google.com/](https://console.firebase.google.com/)
2. Enable Authentication with Email/Password and Google sign-in methods
3. Create a Firestore database with the following collections:

### Firestore Database Schema

**Users Collection:**
```
users/{userId}
  - uid: string
  - email: string
  - displayName: string
  - createdAt: timestamp
  - bookings: string[]
```

**Courts Collection:**
```
courts/{courtId}
  - courtId: string
  - name: string
  - description: string
  - pricePerHour: number
  - amenities: string[]
```

**Bookings Collection:**
```
bookings/{bookingId}
  - bookingId: string
  - userId: string
  - courtId: string
  - date: string (YYYY-MM-DD)
  - timeSlot: string
  - status: string ('confirmed' | 'cancelled')
  - createdAt: timestamp
  - price: number
```

**Tournaments Collection:**
```
tournaments/{tournamentId}
  - tournamentId: string
  - name: string
  - description: string
  - startDate: timestamp
  - endDate: timestamp
  - participants: string[]
```

## Security Rules

Implement these Firestore security rules for proper data protection:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Users can only read and write their own data
    match /users/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    
    // Everyone can read courts, only admins can write
    match /courts/{courtId} {
      allow read: if true;
      allow write: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
    
    // Users can read all bookings but only write their own
    match /bookings/{bookingId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.resource.data.userId == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.userId == request.auth.uid;
    }
    
    // Everyone can read tournaments, only admins can write
    match /tournaments/{tournamentId} {
      allow read: if true;
      allow write: if request.auth != null && get(/databases/$(database)/documents/users/$(request.auth.uid)).data.isAdmin == true;
    }
  }
}
```

## License

This project is licensed under the MIT License.
