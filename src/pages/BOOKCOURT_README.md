# Book Court Feature

This feature allows players to book courts by first selecting a facility, then choosing a specific court within that facility, and finally making a booking.

## Implementation Details

### Data Structure

- **Facilities Collection**: Contains facility information (name, address, description, etc.)
- **Courts Collection**: Contains court information with a reference to the facilityId
- **Bookings Collection**: Stores booking information when a player books a court

### Flow

1. User sees a list of available facilities
2. User selects a facility to view its courts
3. User selects a court to book
4. User chooses a date and time slot
5. User confirms the booking

### Components

- **BookCourt.tsx**: Main page component that handles the booking flow
- **Notification.tsx**: Reusable notification component for success/error messages

## Testing Instructions

1. Run the application with `npm run dev`
2. Navigate to the Book Court page
3. You should see facilities displayed as cards
4. Click on a facility to see its courts
5. Select a court, date, and time slot
6. Complete a booking
7. You should see your booking in the "Your Bookings" section

### Test Script

For development and testing, you can run the test script to create sample data:

```typescript
// Run this in the browser console or a script
import { testBookCourt } from './scripts/testBookCourt';
testBookCourt().then(testData => console.log('Test data created:', testData));

// When done testing, clean up:
import { cleanupTestData } from './scripts/testBookCourt';
cleanupTestData(testData);
```

## Future Improvements

- Add pagination for facilities and courts
- Implement filters for court amenities (indoor/outdoor, etc.)
- Add calendar view for date selection
- Implement recurring bookings
- Add payment integration