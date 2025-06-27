import { Timestamp } from 'firebase/firestore';
import type { Fixture, Group, TournamentFormat } from '../utils/fixtureUtils';

// User model
export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL?: string | null;
  isAdmin?: boolean;
  // Support multiple roles for the same user
  roles: {
    player?: boolean;
    facility_manager?: boolean;
    brand?: boolean;
  };
  // Current active role
  activeRole?: 'player' | 'facility_manager' | 'brand';
  // For backward compatibility
  role?: 'player' | 'facility_manager' | 'brand';
  facilityName?: string; // Name of the facility for facility managers
  createdAt: Timestamp;
  bookings?: string[]; // IDs of bookings
  dateOfBirth?: string; // ISO format date string
  gender?: 'Male' | 'Female' | 'Other';
  duprProfileLink?: string; // Link to DUPR ratings profile
  duprRatings?: {
    singles: number | null;
    doubles: number | null;
  };
}

// Court model
export interface Court {
  id: string;
  name: string;
  location: string;
  description?: string;
  imageURL?: string;
  facilityId: string; // Reference to the facility manager's user ID
  facilityName: string; // Name of the facility the court belongs to
  hourlyRate: number;
  availability?: {
    [date: string]: {
      [timeSlot: string]: boolean;
    };
  };
  features?: string[];
  indoorOutdoor: 'indoor' | 'outdoor';
}

// Booking model
export interface Booking {
  id: string;
  userId: string;
  courtId: string;
  date: Timestamp;
  startTime: string;
  endTime: string;
  totalCost: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: Timestamp;
  participants?: number;
}

// Tournament model
export interface Tournament {
  id: string;
  name: string;
  description: string;
  startDate: Timestamp;
  endDate: Timestamp;
  location: string; // Physical location
  mapLink?: string; // Google Maps link
  imageURLs?: string[]; // Array of image URLs
  registrationFee: number;
  registrationDeadline: Timestamp;
  maxParticipants: number;
  currentParticipants: number;
  categories?: string[]; // Array of categories
  cashPrize?: number;
  isDuprRanked?: boolean;
  prizes?: {
    first: string;
    second: string;
    third: string;
  };
  participants?: TournamentParticipant[]; // Array of participant objects
  fixtures?: Fixture[]; // Array of fixture objects
  fixtureGroups?: Group[]; // Array of groups for group-based tournaments
  fixtureFormat?: TournamentFormat; // The format of the tournament (legacy - use fixtureFormats instead)
  fixturesGenerated?: boolean; // Whether fixtures have been generated
  fixtureFormats?: {
    [category: string]: {
      format: TournamentFormat;
      playersPerCategory: number;
      groupSize?: number;
      matchFrequency: number;
      playoffStructure?: 'quarterFinals' | 'semiFinals' | 'finalOnly';
    }
  }; // Format configuration per category
  // Daily schedule for tournament
  schedule?: {
    [date: string]: {
      startTime: string;
      endTime: string;
    }
  };
  rules?: string[]; // Tournament rules
}

// Tournament Participant model
export interface TournamentParticipant {
  userId: string;
  category: TournamentCategory;
  registrationDate: Timestamp;
  seed?: number | null;
}

// Tournament Category Types
export type TournamentCategory =
  | 'Mens Singles'
  | 'Mens Doubles'
  | 'Womens Singles'
  | 'Womens Doubles'
  | 'Mixed Doubles'
  | 'Open Doubles';

export const TOURNAMENT_CATEGORIES: TournamentCategory[] = [
  'Mens Singles',
  'Mens Doubles',
  'Womens Singles',
  'Womens Doubles',
  'Mixed Doubles',
  'Open Doubles'
];

// Product model for shop
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  imageURL: string;
  category: string;
  inventory: number;
  featured?: boolean;
}

// Order model for shop
export interface Order {
  id: string;
  userId: string;
  items: {
    productId: string;
    quantity: number;
    price: number;
  }[];
  totalAmount: number;
  status: 'pending' | 'processing' | 'shipped' | 'delivered';
  createdAt: Timestamp;
  shippingAddress?: {
    name: string;
    address: string;
    city: string;
    state: string;
    zipCode: string;
    country: string;
  };
}