import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Link } from 'react-router-dom';
import { fetchDuprRatings, saveDuprRatings } from '../../services/duprService';
import { Card, Button, Divider, Link as HeroLink } from '@heroui/react';

export default function DuprRatingsCard() {
  const { userData, currentUser, refreshUserData } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const hasProfileLink = !!userData?.duprProfileLink;
  const hasRatings = !!userData?.duprRatings;

  const handleCheckRatings = async () => {
    if (!userData?.duprProfileLink || !currentUser) return;
    
    try {
      setLoading(true);
      setError('');
      
      const ratings = await fetchDuprRatings(userData.duprProfileLink);
      
      if (ratings) {
        await saveDuprRatings(currentUser.uid, ratings);
        await refreshUserData();
      } else {
        setError('Could not retrieve ratings. Please try again later.');
      }
    } catch (err) {
      console.error('Error checking DUPR ratings:', err);
      setError('An error occurred while checking ratings.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card className="p-6 pb-glass-effect rounded-lg overflow-hidden card-hover">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-lg font-bold text-white flex items-center">
          <span className="w-1.5 h-1.5 rounded-full bg-accent-orange mr-2"></span>
          DUPR Ratings
        </h2>
        {hasProfileLink && (
          <Button
            size="sm"
            variant="flat"
            onClick={handleCheckRatings}
            isDisabled={loading}
            isLoading={loading}
            className="bg-accent-orange text-white hover:bg-accent-orangeDark transition-colors"
          >
            {loading ? 'Checking...' : 'Refresh Ratings'}
          </Button>
        )}
      </div>
      
      {error && (
        <div className="bg-accent-orange/20 border border-accent-orange/40 text-white px-4 py-3 rounded-lg mb-4 text-sm font-medium">
          {error}
        </div>
      )}
      
      {!hasProfileLink ? (
        <div className="text-center py-6 bg-white/10 rounded-lg text-white/80">
          <p className="font-medium">No DUPR profile linked to your account.</p>
          <p className="text-sm mt-2">Add your profile link in your account settings.</p>
        </div>
      ) : !hasRatings ? (
        <div className="text-center py-6 bg-white/10 rounded-lg">
          <p className="text-white/80 font-medium">Click "Refresh Ratings" to check your DUPR ratings.</p>
        </div>
      ) : (
        <Card className="bg-gradient-to-r from-court-blueDark to-court-blue bg-opacity-90 backdrop-blur-sm p-5 text-white rounded-lg shadow-inner border border-white/20">
          <h3 className="text-xl font-bold mb-4 flex items-center">
            <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
            </svg>
            Rating
          </h3>
          <div className="flex justify-around space-x-4">
            {/* Doubles Rating */}
            <Card className="text-center bg-court-green bg-opacity-90 backdrop-blur-sm p-4 flex-1 rounded-lg border border-white/20 transform hover:scale-105 transition-all duration-300 shadow-lg">
              <div className="flex items-center justify-center mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zM17 6a3 3 0 11-6 0 3 3 0 016 0zM12.93 17c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
                </svg>
                <span className="font-medium">Doubles</span>
              </div>
              <div className="text-5xl font-mono font-bold">
                {userData?.duprRatings?.doubles || '4.064'}
              </div>
              <div className="text-xs mt-2 text-blue-200 font-medium">
                {userData?.duprRatings?.doubles ? 'Current Rating' : 'Example Rating'}
              </div>
            </Card>
            
            {/* Singles Rating */}
            <Card className="text-center bg-court-blue bg-opacity-90 backdrop-blur-sm p-4 flex-1 rounded-lg border border-white/20 transform hover:scale-105 transition-all duration-300 shadow-lg">
              <div className="flex items-center justify-center mb-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 mr-2" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
                </svg>
                <span className="font-medium">Singles</span>
              </div>
              <div className="text-5xl font-mono font-bold">
                {userData?.duprRatings?.singles || '3.187'}
              </div>
              <div className="text-xs mt-2 text-blue-200 font-medium">
                {userData?.duprRatings?.singles ? 'Current Rating' : 'Example Rating'}
              </div>
            </Card>
          </div>
        </Card>
      )}
      
      <Divider className="my-5" />
      
      <div className="text-xs text-white/60 text-center font-medium">
        Ratings are provided by DUPR (Dynamic Universal Pickleball Rating)
      </div>
      
      <div className="mt-4 text-center">
        <HeroLink
          as={Link}
          to="/dashboard/dupr-profile"
          size="sm"
          className="font-medium text-accent-orange hover:text-accent-orangeLight transition-colors"
        >
          Manage DUPR Profile
        </HeroLink>
      </div>
    </Card>
  );
}