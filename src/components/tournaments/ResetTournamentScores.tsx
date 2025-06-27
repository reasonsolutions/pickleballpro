import React, { useState } from 'react';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../firebase/config';
import type { Fixture } from '../../utils/fixtureUtils';

interface Props {
  tournamentId: string;
}

const ResetTournamentScores: React.FC<Props> = ({ tournamentId }) => {
  const [isResetting, setIsResetting] = useState(false);
  const [message, setMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);

  const handleReset = async () => {
    if (!tournamentId || isResetting) return;
    
    setIsResetting(true);
    setMessage(null);
    
    try {
      // Get the tournament document
      const tournamentRef = doc(db, 'tournaments', tournamentId);
      const tournamentSnap = await getDoc(tournamentRef);
      
      if (!tournamentSnap.exists()) {
        setMessage({
          type: 'error',
          text: 'Tournament not found!'
        });
        setIsResetting(false);
        return;
      }
      
      const tournamentData = tournamentSnap.data();
      const fixtures = tournamentData.fixtures || [];
      
      // Reset each fixture
      const updatedFixtures = fixtures.map((fixture: Fixture) => {
        if (fixture.score || fixture.completed) {
          return {
            ...fixture,
            score: '',
            completed: false,
            winner: null
          };
        }
        return fixture;
      });
      
      // Update tournament document in Firestore
      await updateDoc(tournamentRef, {
        fixtures: updatedFixtures
      });
      
      setMessage({
        type: 'success',
        text: 'Successfully reset all tournament scores!'
      });
    } catch (error) {
      console.error('Error resetting tournament scores:', error);
      setMessage({
        type: 'error',
        text: 'Failed to reset scores. Please try again.'
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="my-4">
      <button
        onClick={handleReset}
        disabled={isResetting}
        className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 disabled:opacity-50"
      >
        {isResetting ? 'Resetting...' : 'Reset All Scores'}
      </button>
      
      {message && (
        <div className={`mt-2 text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {message.text}
        </div>
      )}
    </div>
  );
};

export default ResetTournamentScores;