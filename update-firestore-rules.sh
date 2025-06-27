#!/bin/bash

# Script to deploy updated Firestore security rules
echo "Deploying updated Firestore security rules..."

# Deploy Firestore rules
firebase deploy --only firestore:rules

echo "Firestore rules have been updated."
echo ""
echo "To test the BookCourt page, follow these steps:"
echo ""
echo "1. Visit the BookCourt page in your application"
echo "2. If you see 'Insufficient permissions' error:"
echo "   - Make sure you're logged in"
echo "   - Try adding ?demo=true to the URL to see demo data"
echo "     Example: http://localhost:3000/book-court?demo=true"
echo ""
echo "3. To add real court data, run the following in your browser console:"
echo "   import('./src/scripts/createTestCourts.js').then(m => m.createTestCourts())"
echo ""
echo "4. For more details, see the COURT_BOOKING_GUIDE.md in the src/pages directory"