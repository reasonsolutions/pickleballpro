import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDocument } from '../hooks/useFirestore';
import { registerUserForTournament, updateDocById } from '../firebase/firestore';
import { useAuth } from '../context/AuthContext';
import type { Tournament, TournamentCategory } from '../firebase/models';
import type { Fixture } from '../utils/fixtureUtils';
import { TOURNAMENT_CATEGORIES } from '../firebase/models';
import FixtureDisplay from '../components/tournaments/FixtureDisplay';

export default function TournamentDetails() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { currentUser, userData } = useAuth();
  const [selectedCategory, setSelectedCategory] = useState<TournamentCategory | ''>('');
  const [registering, setRegistering] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [updating, setUpdating] = useState(false);
  
  const { document: tournament, loading, error: tournamentError } = useDocument<Tournament>(
    'tournaments',
    id || ''
  );

  // Function to format date range
  const formatDateRange = (startDate: Date, endDate: Date) => {
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    // If same month and year
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
      return `${start.getDate()} - ${end.getDate()} ${start.toLocaleString('default', { month: 'short' })} ${start.getFullYear()}`;
    }
    
    // If same year but different months
    if (start.getFullYear() === end.getFullYear()) {
      return `${start.getDate()} ${start.toLocaleString('default', { month: 'short' })} - ${end.getDate()} ${end.toLocaleString('default', { month: 'short' })} ${start.getFullYear()}`;
    }
    
    // Different years
    return `${start.getDate()} ${start.toLocaleString('default', { month: 'short' })} ${start.getFullYear()} - ${end.getDate()} ${end.toLocaleString('default', { month: 'short' })} ${end.getFullYear()}`;
  };

  const handleRegister = async () => {
    setError(null);
    
    if (!currentUser) {
      setError('You must be logged in to register for a tournament');
      return;
    }
    
    if (!selectedCategory) {
      setError('Please select a category');
      return;
    }
    
    if (!id) {
      setError('Invalid tournament');
      return;
    }
    
    try {
      setRegistering(true);
      await registerUserForTournament(id, currentUser.uid, selectedCategory);
      setSuccess(true);
      setRegistering(false);
    } catch (err: any) {
      console.error('Error registering for tournament:', err);
      setError(err.message || 'Failed to register for tournament');
      setRegistering(false);
    }
  };

  // Check if user is already registered for this tournament
  const isRegistered = (category: TournamentCategory): boolean => {
    if (!tournament || !tournament.participants || !currentUser) return false;
    
    return tournament.participants.some(
      p => p.userId === currentUser.uid && p.category === category
    );
  };

  const anyRegistration = (): boolean => {
    if (!tournament || !tournament.participants || !currentUser) return false;
    
    return tournament.participants.some(p => p.userId === currentUser.uid);
  };
  
  // Handler to add playoff fixtures after pool play is complete
  const handleAddPlayoffFixtures = async (newFixtures: Fixture[]) => {
    if (!id || !tournament) return;
    
    try {
      setUpdating(true);
      
      // Ensure all fixtures have the proper properties set
      const enhancedFixtures = newFixtures.map(fixture => ({
        ...fixture,
        stage: 'playoff' // Ensure all fixtures are marked as playoff stage
      }));
      
      // Log the new fixtures being added
      console.log('New playoff fixtures to add:', enhancedFixtures.length);
      
      // Combine existing fixtures with new playoff fixtures
      const updatedFixtures = [
        ...(tournament.fixtures || []),
        ...enhancedFixtures
      ];
      
      console.log('Total fixtures after adding playoffs:', updatedFixtures.length);
      console.log('Tournament format:', tournament.fixtureFormat);
      console.log('Total Silver Cup fixtures:', updatedFixtures.filter(f => f.cup === 'silver').length);
      console.log('Total Gold Cup fixtures:', updatedFixtures.filter(f => f.cup === 'gold').length);
      
      // Update tournament with new fixtures
      await updateDocById('tournaments', id, {
        fixtures: updatedFixtures
      });
      
      setUpdating(false);
    } catch (err: any) {
      console.error('Error adding playoff fixtures:', err);
      setError(err.message || 'Failed to add playoff fixtures');
      setUpdating(false);
    }
  };

  // Function to generate scores for all matches
  const generateScores = () => {
    if (!id || !tournament || !tournament.fixtures) return;
    
    // Create a copy of fixtures with generated scores
    const updatedFixtures = tournament.fixtures.map(fixture => {
      // Only generate scores for matches with both players assigned
      if (fixture.player1Id && fixture.player2Id && !fixture.completed) {
        // Generate random scores where winner gets max 11, loser gets 9 or less
        const player1Score = Math.floor(Math.random() * 12); // 0-11
        const player2Score = Math.floor(Math.random() * 10); // 0-9
        
        // Determine winner and ensure scores follow the rule
        let winner, finalPlayer1Score, finalPlayer2Score;
        
        if (player1Score > player2Score) {
          winner = fixture.player1Id;
          finalPlayer1Score = Math.max(player1Score, 11); // Winner gets at least 11
          finalPlayer2Score = Math.min(player2Score, 9);  // Loser gets max 9
        } else {
          winner = fixture.player2Id;
          finalPlayer2Score = Math.max(player2Score, 11); // Winner gets at least 11
          finalPlayer1Score = Math.min(player1Score, 9);  // Loser gets max 9
        }
        
        return {
          ...fixture,
          winner,
          score: `${finalPlayer1Score}-${finalPlayer2Score}`,
          completed: true
        };
      }
      return fixture;
    });
    
    // Update tournament with all new fixtures at once
    updateDocById('tournaments', id, { fixtures: updatedFixtures });
  };

  if (loading || updating) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-gray-600">{updating ? 'Updating tournament fixtures...' : 'Loading tournament details...'}</p>
      </div>
    );
  }

  if (tournamentError || !tournament) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        {tournamentError || 'Tournament not found'}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <button 
        onClick={() => navigate('/tournaments')}
        className="mb-6 flex items-center text-blue-600 hover:text-blue-800"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
        </svg>
        Back to Tournaments
      </button>

      <div className="bg-white rounded-lg shadow-lg overflow-hidden">
        {tournament.imageURLs && tournament.imageURLs.length > 0 ? (
          <img
            src={tournament.imageURLs[0]}
            alt={tournament.name}
            className="w-full h-64 object-cover"
          />
        ) : (
          <div className="w-full h-64 bg-gray-200 flex items-center justify-center">
            <span className="text-gray-400">No image</span>
          </div>
        )}

        <div className="p-6">
          <h1 className="text-3xl font-bold text-gray-800 mb-2">{tournament.name}</h1>
          
          <div className="flex items-center text-gray-600 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <span>
              {formatDateRange(
                tournament.startDate.toDate(),
                tournament.endDate.toDate()
              )}
            </span>
          </div>
          
          <div className="flex items-center text-gray-600 mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span>{tournament.location}</span>
          </div>

          {tournament.mapLink && (
            <div className="mb-4">
              <a 
                href={tournament.mapLink} 
                target="_blank" 
                rel="noopener noreferrer"
                className="text-blue-600 hover:text-blue-800 flex items-center"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                View on Google Maps
              </a>
            </div>
          )}

          <div className="text-gray-800 mb-6">
            <p>{tournament.description}</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Tournament Details</h2>
              <ul className="space-y-2">
                <li className="flex justify-between">
                  <span className="text-gray-600">Registration Fee:</span>
                  <span className="font-medium">₹{tournament.registrationFee}</span>
                </li>
                <li className="flex justify-between">
                  <span className="text-gray-600">Registration Deadline:</span>
                  <span className="font-medium">
                    {tournament.registrationDeadline.toDate().toLocaleDateString()}
                  </span>
                </li>
                {tournament.cashPrize && (
                  <li className="flex justify-between">
                    <span className="text-gray-600">Cash Prize:</span>
                    <span className="font-medium">₹{tournament.cashPrize}</span>
                  </li>
                )}
                <li className="flex justify-between">
                  <span className="text-gray-600">DUPR Ranked:</span>
                  <span className="font-medium">{tournament.isDuprRanked ? 'Yes' : 'No'}</span>
                </li>
              </ul>
            </div>

            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Categories</h2>
              <div className="flex flex-wrap gap-2">
                {tournament.categories?.map((category, index) => (
                  <span
                    key={index}
                    className={`px-3 py-1 rounded-full text-sm ${
                      isRegistered(category as TournamentCategory)
                        ? 'bg-green-100 text-green-800'
                        : 'bg-blue-100 text-blue-800'
                    }`}
                  >
                    {category}
                    {isRegistered(category as TournamentCategory) && ' ✓'}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {currentUser && userData?.role === 'player' && (
            <div className="border-t border-gray-200 pt-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Register for Tournament</h2>
              
              {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
                  {error}
                </div>
              )}
              
              {success ? (
                <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded mb-4">
                  You have successfully registered for this tournament!
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                      Select Category*
                    </label>
                    <select
                      id="category"
                      value={selectedCategory}
                      onChange={(e) => setSelectedCategory(e.target.value as TournamentCategory)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      disabled={registering}
                    >
                      <option value="">Select a category</option>
                      {tournament.categories?.map((category, index) => (
                        <option 
                          key={index} 
                          value={category}
                          disabled={isRegistered(category as TournamentCategory)}
                        >
                          {category} {isRegistered(category as TournamentCategory) ? '(Already Registered)' : ''}
                        </option>
                      ))}
                    </select>
                  </div>
                  
                  <button
                    onClick={handleRegister}
                    disabled={registering || !selectedCategory}
                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  >
                    {registering ? 'Registering...' : 'Register Now'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>


      {/* Display fixtures if available */}
      {tournament.fixtures && tournament.fixtures.length > 0 && tournament.participants && (
        <div className="mt-6">
          <FixtureDisplay
            tournament={tournament}
            participants={tournament.participants.map(p => ({
              ...p,
              userId: p.userId,
              category: p.category,
              registrationDate: p.registrationDate.toDate(),
              seed: p.seed,
              user: null // We don't have user details here, but FixtureDisplay requires this format
            }))}
            onUpdateFixture={(updatedFixture) => {
              // Handle fixture update
              if (!id) return;
              
              // Create a copy of all fixtures
              const allFixtures = [...(tournament.fixtures || [])];
              
              // Update the current fixture
              const fixtureIndex = allFixtures.findIndex(f => f.id === updatedFixture.id);
              if (fixtureIndex !== -1) {
                allFixtures[fixtureIndex] = updatedFixture;
              }
              
              // If this is a playoff quarterfinal match, update the semifinals with the winner
              if (updatedFixture.stage === 'playoff' && updatedFixture.playoffRound === 'quarterFinal') {
                const winner = updatedFixture.winner;
                console.log(`Processing quarterfinal completion for ${updatedFixture.cup} cup, category: ${updatedFixture.category}, winner: ${winner}`);
                
                // Get all quarterfinals for this cup and category
                const quarterfinals = allFixtures.filter(f =>
                  f.stage === 'playoff' &&
                  f.playoffRound === 'quarterFinal' &&
                  f.cup === updatedFixture.cup &&
                  f.category === updatedFixture.category
                ).sort((a, b) => a.matchNumber - b.matchNumber);
                
                console.log(`Found ${quarterfinals.length} quarterfinals for ${updatedFixture.cup} cup:`, quarterfinals.map(qf => ({
                  matchNumber: qf.matchNumber,
                  completed: qf.completed,
                  winner: qf.winner
                })));
                
                // Get all semifinals for this cup and category
                const semifinals = allFixtures.filter(f =>
                  f.stage === 'playoff' &&
                  f.playoffRound === 'semiFinal' &&
                  f.cup === updatedFixture.cup &&
                  f.category === updatedFixture.category
                ).sort((a, b) => a.matchNumber - b.matchNumber);
                
                console.log(`Found ${semifinals.length} semifinals for ${updatedFixture.cup} cup:`, semifinals.map(sf => ({
                  matchNumber: sf.matchNumber,
                  player1Id: sf.player1Id,
                  player2Id: sf.player2Id
                })));
                
                // Update semifinals based on completed quarterfinals
                if (quarterfinals.length >= 2 && semifinals.length >= 1) {
                  // First semifinal gets winners from first two quarterfinals
                  const qf1 = quarterfinals[0];
                  const qf2 = quarterfinals[1];
                  const sf1 = semifinals[0];
                  
                  if (qf1 && qf2 && sf1) {
                    let sf1Updated = false;
                    
                    // Update SF1 player1 if QF1 is completed
                    if (qf1.completed && qf1.winner && !sf1.player1Id) {
                      sf1.player1Id = qf1.winner;
                      sf1Updated = true;
                      console.log(`Set SF1 player1Id to QF1 winner: ${qf1.winner}`);
                    }
                    
                    // Update SF1 player2 if QF2 is completed
                    if (qf2.completed && qf2.winner && !sf1.player2Id) {
                      sf1.player2Id = qf2.winner;
                      sf1Updated = true;
                      console.log(`Set SF1 player2Id to QF2 winner: ${qf2.winner}`);
                    }
                    
                    if (sf1Updated) {
                      const sf1Index = allFixtures.findIndex(f => f.id === sf1.id);
                      if (sf1Index !== -1) {
                        allFixtures[sf1Index] = sf1;
                        console.log(`Updated SF1 in allFixtures at index ${sf1Index}`);
                      }
                    }
                  }
                }
                
                // If there are 4 quarterfinals and 2 semifinals, handle the second semifinal
                if (quarterfinals.length >= 4 && semifinals.length >= 2) {
                  const qf3 = quarterfinals[2];
                  const qf4 = quarterfinals[3];
                  const sf2 = semifinals[1];
                  
                  if (qf3 && qf4 && sf2) {
                    let sf2Updated = false;
                    
                    // Update SF2 player1 if QF3 is completed
                    if (qf3.completed && qf3.winner && !sf2.player1Id) {
                      sf2.player1Id = qf3.winner;
                      sf2Updated = true;
                      console.log(`Set SF2 player1Id to QF3 winner: ${qf3.winner}`);
                    }
                    
                    // Update SF2 player2 if QF4 is completed
                    if (qf4.completed && qf4.winner && !sf2.player2Id) {
                      sf2.player2Id = qf4.winner;
                      sf2Updated = true;
                      console.log(`Set SF2 player2Id to QF4 winner: ${qf4.winner}`);
                    }
                    
                    if (sf2Updated) {
                      const sf2Index = allFixtures.findIndex(f => f.id === sf2.id);
                      if (sf2Index !== -1) {
                        allFixtures[sf2Index] = sf2;
                        console.log(`Updated SF2 in allFixtures at index ${sf2Index}`);
                      }
                    }
                  }
                }
              }
              
              // If this is a playoff semifinal match, update the final and 3rd place with winners/losers
              if (updatedFixture.stage === 'playoff' && updatedFixture.playoffRound === 'semiFinal') {
                const winner = updatedFixture.winner;
                const loser = updatedFixture.player1Id === winner ? updatedFixture.player2Id : updatedFixture.player1Id;
                console.log(`Processing semifinal completion for ${updatedFixture.cup} cup, category: ${updatedFixture.category}, winner: ${winner}, loser: ${loser}`);
                
                // Get all semifinals for this cup and category
                const semifinals = allFixtures.filter(f =>
                  f.stage === 'playoff' &&
                  f.playoffRound === 'semiFinal' &&
                  f.cup === updatedFixture.cup &&
                  f.category === updatedFixture.category
                ).sort((a, b) => a.matchNumber - b.matchNumber);
                
                console.log(`Found ${semifinals.length} semifinals for ${updatedFixture.cup} cup:`, semifinals.map(sf => ({
                  id: sf.id,
                  matchNumber: sf.matchNumber,
                  completed: sf.completed,
                  winner: sf.winner
                })));
                
                // Find the final for this cup and category
                const final = allFixtures.find(f =>
                  f.stage === 'playoff' &&
                  f.playoffRound === 'final' &&
                  f.category === updatedFixture.category &&
                  f.cup === updatedFixture.cup
                );
                
                // Find the 3rd place match for this cup and category
                const thirdPlace = allFixtures.find(f =>
                  f.stage === 'playoff' &&
                  f.playoffRound === '3rdPlace' &&
                  f.category === updatedFixture.category &&
                  f.cup === updatedFixture.cup
                );
                
                console.log(`Found final:`, final ? { id: final.id, matchNumber: final.matchNumber, player1Id: final.player1Id, player2Id: final.player2Id, cup: final.cup } : null);
                console.log(`Found 3rd place:`, thirdPlace ? { id: thirdPlace.id, matchNumber: thirdPlace.matchNumber, player1Id: thirdPlace.player1Id, player2Id: thirdPlace.player2Id, cup: thirdPlace.cup } : null);
                
                // Special handling for Silver Cup - be more flexible with requirements
                if (updatedFixture.cup === 'silver') {
                  console.log(`SILVER CUP SPECIAL HANDLING - semifinals: ${semifinals.length}, final: ${!!final}, 3rd place: ${!!thirdPlace}`);
                  
                  if (semifinals.length >= 1 && final) {
                    // Determine which semifinal this is (first or second)
                    const sf1 = semifinals[0];
                    const sf2 = semifinals.length > 1 ? semifinals[1] : null;
                    const isFirstSemifinal = updatedFixture.id === sf1.id;
                    
                    console.log(`SILVER CUP: This is ${isFirstSemifinal ? 'first' : 'second'} semifinal`);
                    console.log(`SILVER CUP: SF1 ID: ${sf1.id}, SF2 ID: ${sf2?.id}, Updated fixture ID: ${updatedFixture.id}`);
                    
                    // Update final based on completed semifinals
                    let finalUpdated = false;
                    let thirdPlaceUpdated = false;
                    
                    if (isFirstSemifinal) {
                      // First semifinal winner goes to final as player1, loser goes to 3rd place as player1
                      console.log(`SILVER CUP: Setting final player1Id from ${final.player1Id} to ${winner}`);
                      final.player1Id = winner;
                      finalUpdated = true;
                      
                      if (thirdPlace && loser) {
                        console.log(`SILVER CUP: Setting 3rd place player1Id from ${thirdPlace.player1Id} to ${loser}`);
                        thirdPlace.player1Id = loser;
                        thirdPlaceUpdated = true;
                      }
                    } else {
                      // Second semifinal winner goes to final as player2, loser goes to 3rd place as player2
                      console.log(`SILVER CUP: Setting final player2Id from ${final.player2Id} to ${winner}`);
                      final.player2Id = winner;
                      finalUpdated = true;
                      
                      if (thirdPlace && loser) {
                        console.log(`SILVER CUP: Setting 3rd place player2Id from ${thirdPlace.player2Id} to ${loser}`);
                        thirdPlace.player2Id = loser;
                        thirdPlaceUpdated = true;
                      }
                    }
                    
                    // Update the fixtures in allFixtures array
                    if (finalUpdated) {
                      const finalIndex = allFixtures.findIndex(f => f.id === final.id);
                      if (finalIndex !== -1) {
                        allFixtures[finalIndex] = final;
                        console.log(`SILVER CUP: Updated final in allFixtures at index ${finalIndex}`);
                      } else {
                        console.error(`SILVER CUP: Could not find final index in allFixtures`);
                      }
                    }
                    
                    if (thirdPlaceUpdated && thirdPlace) {
                      const thirdPlaceIndex = allFixtures.findIndex(f => f.id === thirdPlace.id);
                      if (thirdPlaceIndex !== -1) {
                        allFixtures[thirdPlaceIndex] = thirdPlace;
                        console.log(`SILVER CUP: Updated 3rd place in allFixtures at index ${thirdPlaceIndex}`);
                      } else {
                        console.error(`SILVER CUP: Could not find 3rd place index in allFixtures`);
                      }
                    }
                  } else {
                    console.error(`SILVER CUP: Missing required fixtures - semifinals: ${semifinals.length}, final: ${!!final}`);
                  }
                }
                // Gold Cup and other cups - use original logic
                else if (semifinals.length >= 2 && final && thirdPlace) {
                  // Determine which semifinal this is (first or second)
                  const sf1 = semifinals[0];
                  const sf2 = semifinals[1];
                  const isFirstSemifinal = updatedFixture.id === sf1.id;
                  
                  console.log(`This is ${isFirstSemifinal ? 'first' : 'second'} semifinal`);
                  
                  // Update final and 3rd place based on completed semifinals
                  let finalUpdated = false;
                  let thirdPlaceUpdated = false;
                  
                  if (isFirstSemifinal) {
                    // First semifinal winner goes to final as player1, loser goes to 3rd place as player1
                    if (!final.player1Id) {
                      final.player1Id = winner;
                      finalUpdated = true;
                      console.log(`Set final player1Id to SF1 winner: ${winner}`);
                    }
                    
                    if (!thirdPlace.player1Id) {
                      thirdPlace.player1Id = loser;
                      thirdPlaceUpdated = true;
                      console.log(`Set 3rd place player1Id to SF1 loser: ${loser}`);
                    }
                  } else {
                    // Second semifinal winner goes to final as player2, loser goes to 3rd place as player2
                    if (!final.player2Id) {
                      final.player2Id = winner;
                      finalUpdated = true;
                      console.log(`Set final player2Id to SF2 winner: ${winner}`);
                    }
                    
                    if (!thirdPlace.player2Id) {
                      thirdPlace.player2Id = loser;
                      thirdPlaceUpdated = true;
                      console.log(`Set 3rd place player2Id to SF2 loser: ${loser}`);
                    }
                  }
                  
                  // Update the fixtures in allFixtures array
                  if (finalUpdated) {
                    const finalIndex = allFixtures.findIndex(f => f.id === final.id);
                    if (finalIndex !== -1) {
                      allFixtures[finalIndex] = final;
                      console.log(`Updated final in allFixtures at index ${finalIndex}`);
                    }
                  }
                  
                  if (thirdPlaceUpdated) {
                    const thirdPlaceIndex = allFixtures.findIndex(f => f.id === thirdPlace.id);
                    if (thirdPlaceIndex !== -1) {
                      allFixtures[thirdPlaceIndex] = thirdPlace;
                      console.log(`Updated 3rd place in allFixtures at index ${thirdPlaceIndex}`);
                    }
                  }
                } else {
                  console.log(`Could not find required fixtures - semifinals: ${semifinals.length}, final: ${!!final}, 3rd place: ${!!thirdPlace}`);
                }
              }
              
              updateDocById('tournaments', id, { fixtures: allFixtures });
            }}
            onAddPlayoffFixtures={handleAddPlayoffFixtures}
          />
        </div>
      )}
    </div>
  );
}