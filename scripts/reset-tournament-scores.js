// Script to reset all tournament scores to pending state
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, updateDoc } from 'firebase/firestore';

// Firebase configuration from your config.ts file
const firebaseConfig = {
  apiKey: "AIzaSyBRs0dqOOY_OE-49xMQaYGQZzWzCFP8cOY",
  authDomain: "pickleball-pro-e01dc.firebaseapp.com",
  projectId: "pickleball-pro-e01dc",
  storageBucket: "pickleball-pro-e01dc.appspot.com",
  messagingSenderId: "741309787429",
  appId: "1:741309787429:web:0e14c7f3c8c3df87fd1fe2"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function resetTournamentScores(tournamentId) {
  console.log(`Resetting scores for tournament: ${tournamentId}`);
  
  try {
    // Get the tournament document
    const tournamentRef = doc(db, 'tournaments', tournamentId);
    const tournamentSnap = await getDoc(tournamentRef);
    
    if (!tournamentSnap.exists()) {
      console.error('Tournament not found!');
      return;
    }
    
    const tournamentData = tournamentSnap.data();
    const fixtures = tournamentData.fixtures || [];
    
    console.log(`Found ${fixtures.length} fixtures to reset`);
    
    // Reset each fixture
    const updatedFixtures = fixtures.map(fixture => {
      // For playoff matches, we need to handle advancement logic
      if (fixture.stage === 'playoff' && fixture.playoffRound) {
        // Only reset scores for matches that have scores
        if (fixture.score || fixture.completed) {
          return {
            ...fixture,
            score: '',
            completed: false,
            winner: null
          };
        }
      } else {
        // For all other matches, reset scores
        if (fixture.score || fixture.completed) {
          return {
            ...fixture,
            score: '',
            completed: false,
            winner: null
          };
        }
      }
      
      // If fixture doesn't have a score, return it unchanged
      return fixture;
    });
    
    // Update the tournament document
    await updateDoc(tournamentRef, {
      fixtures: updatedFixtures
    });
    
    console.log('Successfully reset all tournament scores!');
  } catch (error) {
    console.error('Error resetting tournament scores:', error);
  }
}

// Run the function with the tournament ID
const tournamentId = '434VM8rHCP7iVQcCF7du';
resetTournamentScores(tournamentId)
  .then(() => console.log('Script completed'))
  .catch(err => console.error('Script failed:', err));