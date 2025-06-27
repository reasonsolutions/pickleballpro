import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { fetchDuprRatings, saveDuprRatings } from '../services/duprService';

export default function DuprProfile() {
  const { userData, currentUser, refreshUserData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [duprLink, setDuprLink] = useState(userData?.duprProfileLink || '');
  const [manualSinglesRating, setManualSinglesRating] = useState<string>(
    userData?.duprRatings?.singles ? userData.duprRatings.singles.toString() : ''
  );
  const [manualDoublesRating, setManualDoublesRating] = useState<string>(
    userData?.duprRatings?.doubles ? userData.duprRatings.doubles.toString() : ''
  );
  const [showManualEntry, setShowManualEntry] = useState(false);

  // Update state when userData changes
  useEffect(() => {
    if (userData?.duprProfileLink) {
      setDuprLink(userData.duprProfileLink);
    }
    if (userData?.duprRatings?.singles) {
      setManualSinglesRating(userData.duprRatings.singles.toString());
    }
    if (userData?.duprRatings?.doubles) {
      setManualDoublesRating(userData.duprRatings.doubles.toString());
    }
  }, [userData]);

  const handleSaveManualRatings = async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      setError('');
      setSuccess(false);
      
      // Convert string inputs to numbers or null
      const singles = manualSinglesRating ? parseFloat(manualSinglesRating) : null;
      const doubles = manualDoublesRating ? parseFloat(manualDoublesRating) : null;
      
      // Validate ratings
      if ((singles !== null && (isNaN(singles) || singles < 1 || singles > 8)) ||
          (doubles !== null && (isNaN(doubles) || doubles < 1 || doubles > 8))) {
        setError('Ratings must be valid numbers between 1.0 and 8.0');
        setLoading(false);
        return;
      }
      
      await saveDuprRatings(currentUser.uid, { singles, doubles });
      await refreshUserData();
      setSuccess(true);
    } catch (err) {
      console.error('Error saving manual ratings:', err);
      setError('Failed to save ratings');
    } finally {
      setLoading(false);
    }
  };
  
  const handleSaveDuprLink = async () => {
    if (!currentUser) return;
    
    try {
      setLoading(true);
      setError('');
      setSuccess(false);
      
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        duprProfileLink: duprLink
      });
      
      await refreshUserData();
      setSuccess(true);
    } catch (err) {
      console.error('Error saving DUPR link:', err);
      setError('Failed to save DUPR profile link');
    } finally {
      setLoading(false);
    }
  };

  const handleCheckRatings = async () => {
    if (!userData?.duprProfileLink || !currentUser) {
      setError('Please save your DUPR profile link first');
      return;
    }
    
    try {
      setLoading(true);
      setError('');
      setSuccess(false);
      
      // Try to automatically fetch the ratings
      const ratings = await fetchDuprRatings(userData.duprProfileLink);
      
      if (ratings) {
        // Save the fetched ratings
        await saveDuprRatings(currentUser.uid, ratings);
        await refreshUserData();
        
        // Update the manual entry fields with the fetched ratings
        if (ratings.singles !== null) {
          setManualSinglesRating(ratings.singles.toString());
        }
        if (ratings.doubles !== null) {
          setManualDoublesRating(ratings.doubles.toString());
        }
        
        setSuccess(true);
      } else {
        // If automatic extraction fails, open the profile in a new window
        // so the user can see the ratings manually
        window.open(userData.duprProfileLink, '_blank');
        setError('Could not automatically extract ratings. Please use manual entry.');
        setShowManualEntry(true);
      }
    } catch (err) {
      console.error('Error checking DUPR ratings:', err);
      setError('Failed to check DUPR ratings');
      setShowManualEntry(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto max-w-4xl p-6">
      <h1 className="text-2xl font-bold mb-6">DUPR Profile</h1>
      
      <div className="glass-card p-6 mb-6">
        <h2 className="text-lg font-medium mb-4">DUPR Profile Link</h2>
        
        {error && (
          <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-4">
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded relative mb-4">
            {userData?.duprProfileLink ? 'DUPR profile link saved successfully!' : 'DUPR profile opened in a new tab. Please login if prompted and check your ratings.'}
          </div>
        )}
        
        <div className="mb-4">
          <label htmlFor="duprProfileLink" className="block text-sm font-medium text-gray-700 mb-1">
            Your DUPR Profile URL
          </label>
          <div className="mt-1 flex rounded-md shadow-sm">
            <input
              id="duprProfileLink"
              type="text"
              value={duprLink}
              onChange={(e) => setDuprLink(e.target.value)}
              className="flex-1 min-w-0 block w-full px-3 py-2 rounded-none rounded-l-md border border-gray-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="https://mydupr.com/profile/..."
            />
            <button
              type="button"
              onClick={handleSaveDuprLink}
              disabled={loading || !duprLink}
              className="inline-flex items-center px-4 py-2 border border-l-0 border-gray-300 rounded-r-md bg-gray-50 text-gray-700 hover:bg-gray-100 disabled:opacity-50"
            >
              Save Link
            </button>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Copy your profile link from the DUPR website
          </p>
        </div>
        
        <div className="mt-6">
          <button
            onClick={handleCheckRatings}
            disabled={loading || !userData?.duprProfileLink}
            className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition disabled:opacity-50"
          >
            {loading ? 'Processing...' : 'Check DUPR Ratings'}
          </button>
          {userData?.duprProfileLink && (
            <p className="text-sm text-gray-500 mt-2">
              When checking ratings, you may need to login with:<br />
              Email: terasiddhartha@gmail.com<br />
              Password: Myra@2016
            </p>
          )}
        </div>
      </div>
      
      <div className="glass-card p-6">
        <h2 className="text-lg font-medium mb-4">Current DUPR Ratings</h2>
        
        {userData?.duprRatings ? (
          <div className="flex justify-around text-center py-4">
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-600">
                {userData.duprRatings.singles || 'N/A'}
              </div>
              <div className="text-sm text-gray-500 mt-1">SINGLES</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-primary-600">
                {userData.duprRatings.doubles || 'N/A'}
              </div>
              <div className="text-sm text-gray-500 mt-1">DOUBLES</div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>No ratings available yet.</p>
            <p className="text-sm mt-1">Check your DUPR profile to fetch your current ratings.</p>
          </div>
        )}
        
        <div className="text-xs text-gray-400 mt-4 text-center">
          Ratings are provided by DUPR (Dynamic Universal Pickleball Rating)
        </div>
        
        <div className="mt-6">
          <button
            onClick={() => setShowManualEntry(!showManualEntry)}
            className="w-full text-primary-600 text-sm underline hover:text-primary-700"
          >
            {showManualEntry ? 'Hide Manual Entry' : 'Manual Rating Entry'}
          </button>
          
          {showManualEntry && (
            <div className="mt-4 border-t pt-4">
              <h3 className="text-md font-medium mb-3">Enter Ratings Manually</h3>
              <p className="text-sm text-gray-500 mb-4">
                Use this if automatic rating detection fails or if you need to update your ratings manually.
              </p>
              
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div>
                  <label htmlFor="singlesRating" className="block text-sm font-medium text-gray-700 mb-1">
                    Singles Rating
                  </label>
                  <input
                    id="singlesRating"
                    type="number"
                    step="0.001"
                    min="1"
                    max="8"
                    value={manualSinglesRating}
                    onChange={(e) => setManualSinglesRating(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="3.187"
                  />
                </div>
                <div>
                  <label htmlFor="doublesRating" className="block text-sm font-medium text-gray-700 mb-1">
                    Doubles Rating
                  </label>
                  <input
                    id="doublesRating"
                    type="number"
                    step="0.001"
                    min="1"
                    max="8"
                    value={manualDoublesRating}
                    onChange={(e) => setManualDoublesRating(e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="4.064"
                  />
                </div>
              </div>
              
              <button
                onClick={handleSaveManualRatings}
                disabled={loading}
                className="w-full bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition disabled:opacity-50"
              >
                {loading ? 'Saving...' : 'Save Ratings'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}