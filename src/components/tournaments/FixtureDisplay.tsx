import React, { useState } from 'react';
import type { Fixture, Group, TournamentFormat } from '../../utils/fixtureUtils';
import {
  isDummyPlayer,
  getDummyPlayerName,
  generatePlayoffFixtures
} from '../../utils/fixtureUtils';
import type { Tournament, User } from '../../firebase/models';

interface FixtureDisplayProps {
  tournament: Tournament;
  participants: Array<{
    user: User | null;
    category: string;
    registrationDate: Date;
    seed?: number | null;
    userId: string;
  }>;
  onUpdateFixture: (updatedFixture: Fixture) => void;
  onAddPlayoffFixtures?: (fixtures: Fixture[]) => void;
}

const FixtureDisplay: React.FC<FixtureDisplayProps> = ({ 
  tournament,
  participants,
  onUpdateFixture,
  onAddPlayoffFixtures
}) => {
  const [activeTab, setActiveTab] = useState<string | null>(
    tournament.categories && tournament.categories.length > 0 
      ? tournament.categories[0] 
      : null
  );
  const [viewMode, setViewMode] = useState<'round' | 'team' | 'court' | 'group'>('round');
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [editFixture, setEditFixture] = useState<Fixture | null>(null);
  
  // Check if all matches are completed (including playoffs and finals)
  const areAllMatchesCompleted = (): boolean => {
    // If there are no fixtures, return false
    if (!tournament.fixtures || tournament.fixtures.length === 0) {
      return false;
    }
    
    // Check if all fixtures are completed
    return tournament.fixtures.every(fixture => fixture.completed);
  };
  
  // Function to export match data for DUPR
  const handleExportForDupr = () => {
    if (!tournament.fixtures || tournament.fixtures.length === 0) {
      return;
    }
    
    // Create CSV content
    let csvContent = "data:text/csv;charset=utf-8,";
    
    // Process each fixture to create CSV rows
    tournament.fixtures.forEach(fixture => {
      if (!fixture.completed || !fixture.player1Id || !fixture.player2Id || !fixture.score) {
        return; // Skip incomplete fixtures
      }
      
      const category = fixture.category;
      const isDoubles = category.includes('Doubles');
      const matchType = isDoubles ? 'D' : 'S';
      const tournamentName = tournament.name;
      
      // Format date as DD/MM/YY
      const tournamentDate = tournament.startDate.toDate();
      const formattedDate = `${String(tournamentDate.getDate()).padStart(2, '0')}/${String(tournamentDate.getMonth() + 1).padStart(2, '0')}/${String(tournamentDate.getFullYear()).slice(2)}`;
      
      // Find participants
      const player1 = participants.find(p => p.userId === fixture.player1Id);
      const player2 = participants.find(p => p.userId === fixture.player2Id);
      
      if (!player1 || !player2) {
        return; // Skip if player data is not found
      }
      
      // Get player names and DUPR IDs
      const player1Name = player1.user?.displayName || getParticipantName(fixture.player1Id);
      const player1DuprId = player1.user?.duprProfileLink?.split('/').pop() || '';
      
      const player2Name = player2.user?.displayName || getParticipantName(fixture.player2Id);
      const player2DuprId = player2.user?.duprProfileLink?.split('/').pop() || '';
      
      // Parse score
      const scoreArray = fixture.score.split('-').map(s => parseInt(s.trim()));
      const score1 = scoreArray[0];
      const score2 = scoreArray[1];
      
      // For DUPR format, we need to determine team1 and team2 based on the example
      // In the example, each row represents a match from a player's perspective
      // For both teams in a match, we create two rows - one for each team's perspective
      
      // Build CSV row based on match type
      if (isDoubles) {
        // For doubles matches - create two rows (one for each team)
        
        // Team 1 perspective
        const team1Player1 = player1Name;
        const team1Player1DuprId = player1DuprId;
        const team1Player2 = findPartnerName(player1, category) || "Partner";
        const team1Player2DuprId = findPartnerDuprId(player1, category) || "";
        
        const team2Player1 = player2Name;
        const team2Player1DuprId = player2DuprId;
        const team2Player2 = findPartnerName(player2, category) || "Partner";
        const team2Player2DuprId = findPartnerDuprId(player2, category) || "";
        
        // Team 1's row
        csvContent += `${matchType},${tournamentName},${formattedDate},${team1Player1},${team1Player1DuprId},,${team1Player2},${team1Player2DuprId},,${team2Player1},${team2Player1DuprId},,${team2Player2},${team2Player2DuprId},,${score1},${score2}\n`;
        
        // Team 2's row
        csvContent += `${matchType},${tournamentName},${formattedDate},${team2Player1},${team2Player1DuprId},,${team2Player2},${team2Player2DuprId},,${team1Player1},${team1Player1DuprId},,${team1Player2},${team1Player2DuprId},,${score2},${score1}\n`;
      } else {
        // For singles matches - create two rows (one for each player's perspective)
        
        // Player 1's perspective
        csvContent += `${matchType},${tournamentName},${formattedDate},${player1Name},${player1DuprId},,${player2Name},${player2DuprId},,,,,,,${score1},${score2}\n`;
        
        // Player 2's perspective
        csvContent += `${matchType},${tournamentName},${formattedDate},${player2Name},${player2DuprId},,${player1Name},${player1DuprId},,,,,,,${score2},${score1}\n`;
      }
    });
    
    // Create download link and trigger download
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${tournament.name.replace(/\s+/g, '_')}_DUPR_Export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };
  
  // Helper function to find a partner's name for doubles matches
  // In a real implementation, this would use actual team data
  const findPartnerName = (player: any, category: string): string => {
    // This is a placeholder function
    // In a real implementation, you would look up the doubles partner
    // based on team registrations or match data
    return "Partner"; // Return placeholder for now
  };
  
  // Helper function to find a partner's DUPR ID for doubles matches
  const findPartnerDuprId = (player: any, category: string): string => {
    // This is a placeholder function
    // In a real implementation, you would look up the partner's DUPR ID
    return ""; // Return empty string for now
  };

  if (!tournament.fixtures || tournament.fixtures.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-6 mt-6">
        <div className="text-center py-8">
          <p className="text-gray-600">No fixtures have been generated yet.</p>
        </div>
      </div>
    );
  }

  // Get participant name from userId
  const getParticipantName = (userId: string | null): string => {
    if (!userId) return 'TBD';
    if (isDummyPlayer(userId)) return getDummyPlayerName(userId);
    
    const participant = participants.find(p => p.userId === userId);
    return participant?.user?.displayName || 'Unknown Player';
  };

  // Get fixtures for current category
  const getCategoryFixtures = (): Fixture[] => {
    if (!activeTab) return [];
    
    // Get all fixtures for current category
    return tournament.fixtures?.filter(f => f.category === activeTab) || [];
  };

  // Get groups for current category
  const getCategoryGroups = (): Group[] => {
    if (!activeTab) return [];
    
    // Check for groups in fixtureGroups
    const fixtureGroups = tournament.fixtureGroups || [];
    
    // Return groups for current category
    return fixtureGroups.filter(g => g.category === activeTab);
  };

  // Get rounds for current category
  const getCategoryRounds = (): number[] => {
    const fixtures = getCategoryFixtures();
    const rounds = [...new Set(fixtures.map(f => f.round))];
    return rounds.sort((a, b) => a - b);
  };

  const handleFixtureClick = (fixture: Fixture) => {
    setIsEditing(fixture.id);
    setEditFixture({...fixture});
  };

  const handleSaveFixture = () => {
    if (editFixture) {
      onUpdateFixture(editFixture);
      setIsEditing(null);
      setEditFixture(null);
    }
  };

  const renderFixturesByRound = () => {
    const fixtures = getCategoryFixtures();
    const format = tournament.fixtureFormat;
    
    // Separate pool and playoff fixtures
    const poolFixtures = fixtures.filter(f => f.stage === 'pool' || !f.stage);
    const playoffFixtures = fixtures.filter(f => f.stage === 'playoff');
    
    // Check if all pool matches are completed to show Generate Playoffs button
    const allPoolMatchesCompleted = poolFixtures.length > 0 && poolFixtures.every(f => f.completed);
    
    // Get pool rounds - these are matches within groups
    const poolRounds = [...new Set(poolFixtures.map(f => f.round))].sort((a, b) => a - b);
    
    return (
      <div>
        {/* Pool Play Matches */}
        {poolFixtures.length > 0 && (
          <div className="mb-10">
            <h3 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">Pool Play Matches</h3>
            {poolRounds.map(round => (
              <div key={round} className="mb-8">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Round {round}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {poolFixtures
                    .filter(fixture => fixture.round === round)
                    .sort((a, b) => {
                      // Sort by group first, then by match number
                      if (a.group !== b.group) {
                        return (a.group || '').localeCompare(b.group || '');
                      }
                      return a.matchNumber - b.matchNumber;
                    })
                    .map(fixture => renderFixtureCard(fixture))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Show Generate Playoffs/Cups button when all pool matches are completed */}
        {(tournament.fixtureFormat === 'poolPlayPlayoffs' || tournament.fixtureFormat === 'poolPlayCups') &&
         allPoolMatchesCompleted &&
         playoffFixtures.length === 0 &&
         onAddPlayoffFixtures && (
          <div className="mt-6 mb-10 text-center">
            <button
              onClick={() => {
                // Generate playoff fixtures based on pool results
                const groups = getCategoryGroups();
                console.log('Found groups for fixture generation:', groups);
                console.log('Tournament fixtureGroups:', tournament.fixtureGroups);
                console.log('Tournament format detected:', tournament.fixtureFormat);
                
                if (groups.length > 0) {
                  // Log the players in each group to debug
                  groups.forEach(group => {
                    console.log(`Group ${group.name} has ${group.playerIds.length} players:`, group.playerIds);
                  });
                  
                  // Always use quarterFinals for proper cross-group seeding
                  const playoffStructure = 'quarterFinals';
                  
                  // Standard Pool Play + Playoffs
                  const newPlayoffFixtures = generatePlayoffFixtures(
                    groups,
                    activeTab || '',
                    playoffStructure
                  );
                  
                  onAddPlayoffFixtures(newPlayoffFixtures);
                }
              }}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700
                        transition-colors focus:outline-none focus:ring-2 focus:ring-green-500
                        focus:ring-opacity-50"
            >
              Generate Playoff Brackets
            </button>
            <p className="mt-2 text-sm text-gray-600">
              All pool matches are complete. You can now generate the playoff brackets.
            </p>
          </div>
        )}

        {/* Playoff Matches */}
        {playoffFixtures.length > 0 && (
          <div className="mb-10">
            <h3 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">Knockout Stage</h3>
            
            {/* Determine if we have cup-based format */}
            {tournament.fixtureFormat === 'poolPlayCups' ? (
              <>
                {/* GOLD CUP SECTION */}
                {playoffFixtures.some(f => f.cup === 'gold') && (
                  <div className="mb-10">
                    <h3 className="text-lg font-bold text-yellow-700 mb-4 pb-2 border-b-2 border-yellow-300 flex items-center">
                      <span className="bg-yellow-100 text-yellow-800 px-3 py-1 rounded-md mr-2 shadow-sm flex items-center">
                        <span className="mr-1 text-yellow-600">🏆</span>
                        Gold Cup
                      </span>
                      <span>Championship Bracket</span>
                    </h3>
                    
                    {/* Gold Cup Quarter Finals */}
                    {playoffFixtures.some(f => f.playoffRound === 'quarterFinal' && f.cup === 'gold') && (
                      <div className="mb-8">
                        <h4 className="text-lg font-semibold text-gray-800 mb-4">Quarter Finals</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                          {playoffFixtures
                            .filter(fixture => fixture.playoffRound === 'quarterFinal' && fixture.cup === 'gold')
                            .sort((a, b) => a.matchNumber - b.matchNumber)
                            .map(fixture => renderFixtureCard(fixture))}
                        </div>
                      </div>
                    )}
                    
                    {/* Gold Cup Semi Finals */}
                    {playoffFixtures.some(f => f.playoffRound === 'semiFinal' && f.cup === 'gold') && (
                      <div className="mb-8">
                        <h4 className="text-lg font-semibold text-gray-800 mb-4">Semi Finals</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                          {playoffFixtures
                            .filter(fixture => fixture.playoffRound === 'semiFinal' && fixture.cup === 'gold')
                            .sort((a, b) => a.matchNumber - b.matchNumber)
                            .map(fixture => renderFixtureCard(fixture))}
                        </div>
                      </div>
                    )}
                    
                    {/* Gold Cup Final and 3rd Place */}
                    {(playoffFixtures.some(f => f.playoffRound === 'final' && f.cup === 'gold') ||
                      playoffFixtures.some(f => f.playoffRound === '3rdPlace' && f.cup === 'gold')) && (
                      <div className="mb-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {/* Gold Cup Final */}
                          {playoffFixtures.some(f => f.playoffRound === 'final' && f.cup === 'gold') && (
                            <div>
                              <h4 className="text-lg font-semibold text-gray-800 mb-4">Final</h4>
                              <div>
                                {playoffFixtures
                                  .filter(fixture => fixture.playoffRound === 'final' && fixture.cup === 'gold')
                                  .map(fixture => renderFixtureCard(fixture))}
                              </div>
                            </div>
                          )}
                          
                          {/* Gold Cup 3rd Place Match */}
                          {playoffFixtures.some(f => f.playoffRound === '3rdPlace' && f.cup === 'gold') && (
                            <div>
                              <h4 className="text-lg font-semibold text-gray-800 mb-4">3rd Place Match</h4>
                              <div>
                                {playoffFixtures
                                  .filter(fixture => fixture.playoffRound === '3rdPlace' && fixture.cup === 'gold')
                                  .map(fixture => renderFixtureCard(fixture))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                
                {/* SILVER CUP SECTION */}
                {playoffFixtures.some(f => f.cup === 'silver') && (
                  <div className="mb-10">
                    <h3 className="text-lg font-bold text-gray-700 mb-4 pb-2 border-b-2 border-gray-300 flex items-center">
                      <span className="bg-gray-200 text-gray-800 px-3 py-1 rounded-md mr-2 shadow-sm flex items-center">
                        <span className="mr-1">🥈</span>
                        Silver Cup
                      </span>
                      <span>Consolation Bracket</span>
                    </h3>
                    
                    {/* Silver Cup Quarter Finals */}
                    {playoffFixtures.some(f => f.playoffRound === 'quarterFinal' && f.cup === 'silver') && (
                      <div className="mb-8">
                        <h4 className="text-lg font-semibold text-gray-800 mb-4">Quarter Finals</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                          {playoffFixtures
                            .filter(fixture => fixture.playoffRound === 'quarterFinal' && fixture.cup === 'silver')
                            .sort((a, b) => a.matchNumber - b.matchNumber)
                            .map(fixture => renderFixtureCard(fixture))}
                        </div>
                      </div>
                    )}
                    
                    {/* Silver Cup Semi Finals */}
                    {playoffFixtures.some(f => f.playoffRound === 'semiFinal' && f.cup === 'silver') && (
                      <div className="mb-8">
                        <h4 className="text-lg font-semibold text-gray-800 mb-4">Semi Finals</h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                          {playoffFixtures
                            .filter(fixture => fixture.playoffRound === 'semiFinal' && fixture.cup === 'silver')
                            .sort((a, b) => a.matchNumber - b.matchNumber)
                            .map(fixture => renderFixtureCard(fixture))}
                        </div>
                      </div>
                    )}
                    
                    {/* Silver Cup Final and 3rd Place */}
                    {(playoffFixtures.some(f => f.playoffRound === 'final' && f.cup === 'silver') ||
                      playoffFixtures.some(f => f.playoffRound === '3rdPlace' && f.cup === 'silver')) && (
                      <div className="mb-8">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                          {/* Silver Cup Final */}
                          {playoffFixtures.some(f => f.playoffRound === 'final' && f.cup === 'silver') && (
                            <div>
                              <h4 className="text-lg font-semibold text-gray-800 mb-4">Final</h4>
                              <div>
                                {playoffFixtures
                                  .filter(fixture => fixture.playoffRound === 'final' && fixture.cup === 'silver')
                                  .map(fixture => renderFixtureCard(fixture))}
                              </div>
                            </div>
                          )}
                          
                          {/* Silver Cup 3rd Place Match */}
                          {playoffFixtures.some(f => f.playoffRound === '3rdPlace' && f.cup === 'silver') && (
                            <div>
                              <h4 className="text-lg font-semibold text-gray-800 mb-4">3rd Place Match</h4>
                              <div>
                                {playoffFixtures
                                  .filter(fixture => fixture.playoffRound === '3rdPlace' && fixture.cup === 'silver')
                                  .map(fixture => renderFixtureCard(fixture))}
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                {/* Standard Playoffs Display (unchanged) */}
                {/* Quarter Finals */}
                {playoffFixtures.some(f => f.playoffRound === 'quarterFinal') && (
                  <div className="mb-8">
                    <h4 className="text-lg font-semibold text-gray-800 mb-4">Quarter Finals</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                      {playoffFixtures
                        .filter(fixture => fixture.playoffRound === 'quarterFinal')
                        .sort((a, b) => a.matchNumber - b.matchNumber)
                        .map(fixture => renderFixtureCard(fixture))}
                    </div>
                  </div>
                )}
                
                {/* Semi Finals */}
                {playoffFixtures.some(f => f.playoffRound === 'semiFinal') && (
                  <div className="mb-8">
                    <h4 className="text-lg font-semibold text-gray-800 mb-4">Semi Finals</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                      {playoffFixtures
                        .filter(fixture => fixture.playoffRound === 'semiFinal')
                        .sort((a, b) => a.matchNumber - b.matchNumber)
                        .map(fixture => renderFixtureCard(fixture))}
                    </div>
                  </div>
                )}
                
                {/* Final and 3rd Place in the same row */}
                {(playoffFixtures.some(f => f.playoffRound === 'final') ||
                  playoffFixtures.some(f => f.playoffRound === '3rdPlace')) && (
                  <div className="mb-8">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                      {/* Final */}
                      {playoffFixtures.some(f => f.playoffRound === 'final') && (
                        <div>
                          <h4 className="text-lg font-semibold text-gray-800 mb-4">Final</h4>
                          <div>
                            {playoffFixtures
                              .filter(fixture => fixture.playoffRound === 'final')
                              .map(fixture => renderFixtureCard(fixture))}
                          </div>
                        </div>
                      )}
                      
                      {/* 3rd Place Match */}
                      {playoffFixtures.some(f => f.playoffRound === '3rdPlace') && (
                        <div>
                          <h4 className="text-lg font-semibold text-gray-800 mb-4">3rd Place Match</h4>
                          <div>
                            {playoffFixtures
                              .filter(fixture => fixture.playoffRound === '3rdPlace')
                              .map(fixture => renderFixtureCard(fixture))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderFixturesByGroup = () => {
    const fixtures = getCategoryFixtures();
    const format = tournament.fixtureFormat;
    
    // Separate pool and playoff fixtures
    const poolFixtures = fixtures.filter(f => f.stage === 'pool' || !f.stage);
    const playoffFixtures = fixtures.filter(f => f.stage === 'playoff');
    
    // Get all groups from pool fixtures
    const poolGroups = [...new Set(poolFixtures.map(f => f.group))].filter(Boolean).sort();

    return (
      <div>
        {/* Pool Play Matches By Group */}
        {poolFixtures.length > 0 && (
          <div className="mb-10">
            <h3 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">Pool Play Matches</h3>
            
            {poolGroups.map(group => (
              <div key={group} className="mb-8">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">{group}</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {poolFixtures
                    .filter(fixture => fixture.group === group)
                    .sort((a, b) => {
                      // Sort by round first, then by match number
                      if (a.round !== b.round) {
                        return a.round - b.round;
                      }
                      return a.matchNumber - b.matchNumber;
                    })
                    .map(fixture => renderFixtureCard(fixture))}
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* Playoff section is the same as in renderFixturesByRound */}
        {playoffFixtures.length > 0 && (
          <div className="mb-10">
            <h3 className="text-xl font-bold text-gray-800 mb-4 pb-2 border-b border-gray-200">Knockout Stage</h3>
            
            {/* Quarter Finals */}
            {playoffFixtures.some(f => f.playoffRound === 'quarterFinal') && (
              <div className="mb-8">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Quarter Finals</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                  {playoffFixtures
                    .filter(fixture => fixture.playoffRound === 'quarterFinal')
                    .sort((a, b) => a.matchNumber - b.matchNumber)
                    .map(fixture => renderFixtureCard(fixture))}
                </div>
              </div>
            )}
            
            {/* Semi Finals */}
            {playoffFixtures.some(f => f.playoffRound === 'semiFinal') && (
              <div className="mb-8">
                <h4 className="text-lg font-semibold text-gray-800 mb-4">Semi Finals</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-4">
                  {playoffFixtures
                    .filter(fixture => fixture.playoffRound === 'semiFinal')
                    .sort((a, b) => a.matchNumber - b.matchNumber)
                    .map(fixture => renderFixtureCard(fixture))}
                </div>
              </div>
            )}
            
            {/* Final and 3rd Place in the same row */}
            {(playoffFixtures.some(f => f.playoffRound === 'final') ||
              playoffFixtures.some(f => f.playoffRound === '3rdPlace')) && (
              <div className="mb-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  {/* Final */}
                  {playoffFixtures.some(f => f.playoffRound === 'final') && (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-800 mb-4">Final</h4>
                      <div>
                        {playoffFixtures
                          .filter(fixture => fixture.playoffRound === 'final')
                          .map(fixture => renderFixtureCard(fixture))}
                      </div>
                    </div>
                  )}
                  
                  {/* 3rd Place Match */}
                  {playoffFixtures.some(f => f.playoffRound === '3rdPlace') && (
                    <div>
                      <h4 className="text-lg font-semibold text-gray-800 mb-4">3rd Place Match</h4>
                      <div>
                        {playoffFixtures
                          .filter(fixture => fixture.playoffRound === '3rdPlace')
                          .map(fixture => renderFixtureCard(fixture))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  const renderFixturesByTeam = () => {
    const fixtures = getCategoryFixtures();
    
    // Get all participant IDs from fixtures
    const participantIds = [...new Set(
      fixtures.flatMap(f => [f.player1Id, f.player2Id]).filter(Boolean) as string[]
    )];
    
    return (
      <div>
        {participantIds.map(participantId => {
          const participantFixtures = fixtures.filter(
            f => f.player1Id === participantId || f.player2Id === participantId
          );
          
          return (
            <div key={participantId} className="mb-8">
              <h4 className="text-lg font-semibold text-gray-800 mb-4">
                {getParticipantName(participantId)}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {participantFixtures
                  .sort((a, b) => {
                    // Sort by round first, then by match number
                    if (a.round !== b.round) {
                      return a.round - b.round;
                    }
                    return a.matchNumber - b.matchNumber;
                  })
                  .map(fixture => renderFixtureCard(fixture))}
              </div>
            </div>
          );
        })}
      </div>
    );
  };

  const renderFixturesByCourt = () => {
    const fixtures = getCategoryFixtures();
    
    // Get all courts from fixtures
    const courts = [...new Set(
      fixtures.map(f => f.court).filter(Boolean) as string[]
    )].sort();
    
    // Handle fixtures without court assignment
    const unassignedFixtures = fixtures.filter(f => !f.court);
    
    return (
      <div>
        {/* Fixtures with court assignments */}
        {courts.map(court => {
          const courtFixtures = fixtures.filter(f => f.court === court);
          
          return (
            <div key={court} className="mb-8">
              <h4 className="text-lg font-semibold text-gray-800 mb-4">
                Court: {court}
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {courtFixtures
                  .sort((a, b) => {
                    // Sort by scheduledDate first, then by scheduledTime
                    if (a.scheduledDate !== b.scheduledDate) {
                      return (a.scheduledDate || '').localeCompare(b.scheduledDate || '');
                    }
                    return (a.scheduledTime || '').localeCompare(b.scheduledTime || '');
                  })
                  .map(fixture => renderFixtureCard(fixture))}
              </div>
            </div>
          );
        })}
        
        {/* Unassigned fixtures */}
        {unassignedFixtures.length > 0 && (
          <div className="mb-8">
            <h4 className="text-lg font-semibold text-gray-800 mb-4">
              Unassigned Fixtures
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {unassignedFixtures
                .sort((a, b) => {
                  // Sort by round first, then by match number
                  if (a.round !== b.round) {
                    return a.round - b.round;
                  }
                  return a.matchNumber - b.matchNumber;
                })
                .map(fixture => renderFixtureCard(fixture))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderFixtureCard = (fixture: Fixture) => {
    const isFixtureEditing = isEditing === fixture.id;
    
    return (
      <div
        key={fixture.id}
        className={`bg-white rounded-lg shadow overflow-hidden ${
          fixture.cup === 'gold'
            ? 'border-2 border-yellow-500 bg-yellow-50/30'
            : fixture.cup === 'silver'
              ? 'border-2 border-gray-400 bg-gray-50/30'
              : fixture.completed
                ? 'border-l-4 border-green-500'
                : 'border-l-4 border-gray-300'
        }`}
      >
        <div className="p-4">
          {/* Match ID and Info */}
          <div className="flex justify-between items-start mb-3">
            <div>
              {fixture.stage === 'playoff' && fixture.playoffRound && (
                <div className="flex items-center">
                  <span className="text-xs font-semibold uppercase text-gray-500 mr-2">
                    {fixture.playoffRound === 'quarterFinal' && 'Quarter Final'}
                    {fixture.playoffRound === 'semiFinal' && 'Semi Final'}
                    {fixture.playoffRound === 'final' && 'Final'}
                    {fixture.playoffRound === '3rdPlace' && '3rd Place'}
                  </span>
                  
                  {fixture.cup === 'gold' && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded font-bold flex items-center">
                      <span className="mr-1 text-yellow-600">🏆</span>
                      Gold Cup
                    </span>
                  )}
                  
                  {fixture.cup === 'silver' && (
                    <span className="text-xs bg-gray-200 text-gray-800 px-2 py-0.5 rounded font-bold flex items-center">
                      <span className="mr-1">🥈</span>
                      Silver Cup
                    </span>
                  )}
                </div>
              )}
              {fixture.stage !== 'playoff' && (
                <span className="text-xs font-semibold uppercase text-gray-500">
                  {fixture.group ? `${fixture.group} - ` : ''}
                  Round {fixture.round}, Match {fixture.matchNumber}
                </span>
              )}
            </div>
            {fixture.court && (
              <span className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded">
                Court {fixture.court}
              </span>
            )}
          </div>
          
          {/* Player 1 */}
          <div className="mb-2 flex items-center">
            <div className={`w-4 h-4 rounded-full mr-2 ${
              fixture.winner === fixture.player1Id 
                ? 'bg-green-500' 
                : 'bg-gray-300'
            }`}></div>
            <span className={`${
              fixture.winner === fixture.player1Id
                ? 'font-bold'
                : ''
            }`}>
              {getParticipantName(fixture.player1Id)}
            </span>
          </div>
          
          {/* Player 2 */}
          <div className="mb-3 flex items-center">
            <div className={`w-4 h-4 rounded-full mr-2 ${
              fixture.winner === fixture.player2Id 
                ? 'bg-green-500' 
                : 'bg-gray-300'
            }`}></div>
            <span className={`${
              fixture.winner === fixture.player2Id
                ? 'font-bold'
                : ''
            }`}>
              {getParticipantName(fixture.player2Id)}
            </span>
          </div>
          
          {/* Score and scheduling info */}
          <div className="flex justify-between items-center">
            <div>
              {fixture.score && (
                <span className="text-sm font-semibold">
                  Score: {fixture.score}
                </span>
              )}
              {(!fixture.score && fixture.scheduledDate) && (
                <span className="text-sm text-gray-600">
                  {fixture.scheduledDate} {fixture.scheduledTime || ''}
                </span>
              )}
            </div>
            
            {/* Edit/Save buttons */}
            {!isFixtureEditing ? (
              <button 
                onClick={() => handleFixtureClick(fixture)}
                className="text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 rounded"
              >
                Edit
              </button>
            ) : (
              <button 
                onClick={handleSaveFixture}
                className="text-xs px-2 py-1 bg-green-100 hover:bg-green-200 text-green-800 rounded"
              >
                Save
              </button>
            )}
          </div>
          
          {/* Editing interface */}
          {isFixtureEditing && editFixture && (
            <div className="mt-4 pt-4 border-t border-gray-200">
              <div className="space-y-3">
                {/* Score Input */}
                <div>
                  <label className="block text-xs text-gray-700 mb-1">Score</label>
                  <input 
                    type="text"
                    value={editFixture.score || ''}
                    onChange={(e) => setEditFixture({...editFixture, score: e.target.value})}
                    placeholder="e.g., 21-15"
                    className="w-full px-2 py-1 text-sm border rounded"
                  />
                </div>
                
                {/* Winner Selection */}
                <div>
                  <label className="block text-xs text-gray-700 mb-1">Winner</label>
                  <select
                    value={editFixture.winner || ''}
                    onChange={(e) => setEditFixture({...editFixture, winner: e.target.value || null})}
                    className="w-full px-2 py-1 text-sm border rounded"
                  >
                    <option value="">Select Winner</option>
                    {editFixture.player1Id && (
                      <option value={editFixture.player1Id}>
                        {getParticipantName(editFixture.player1Id)}
                      </option>
                    )}
                    {editFixture.player2Id && (
                      <option value={editFixture.player2Id}>
                        {getParticipantName(editFixture.player2Id)}
                      </option>
                    )}
                  </select>
                </div>
                
                {/* Completed Checkbox */}
                <div className="flex items-center">
                  <input 
                    type="checkbox"
                    checked={editFixture.completed}
                    onChange={(e) => setEditFixture({...editFixture, completed: e.target.checked})}
                    className="mr-2"
                  />
                  <label className="text-xs text-gray-700">Mark as Completed</label>
                </div>
                
                {/* Court Assignment */}
                <div>
                  <label className="block text-xs text-gray-700 mb-1">Court</label>
                  <input 
                    type="text"
                    value={editFixture.court || ''}
                    onChange={(e) => setEditFixture({...editFixture, court: e.target.value})}
                    placeholder="Court Number"
                    className="w-full px-2 py-1 text-sm border rounded"
                  />
                </div>
                
                {/* Scheduled Date */}
                <div>
                  <label className="block text-xs text-gray-700 mb-1">Date</label>
                  <input 
                    type="date"
                    value={editFixture.scheduledDate || ''}
                    onChange={(e) => setEditFixture({...editFixture, scheduledDate: e.target.value})}
                    className="w-full px-2 py-1 text-sm border rounded"
                  />
                </div>
                
                {/* Scheduled Time */}
                <div>
                  <label className="block text-xs text-gray-700 mb-1">Time</label>
                  <input 
                    type="time"
                    value={editFixture.scheduledTime || ''}
                    onChange={(e) => setEditFixture({...editFixture, scheduledTime: e.target.value})}
                    className="w-full px-2 py-1 text-sm border rounded"
                  />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-lg shadow p-6 mt-6">
      {/* Category tabs */}
      {tournament.categories && tournament.categories.length > 0 && (
        <div className="mb-6 border-b border-gray-200">
          <div className="flex flex-wrap -mb-px">
            {tournament.categories.map(category => (
              <button
                key={category}
                onClick={() => setActiveTab(category)}
                className={`mr-2 inline-block py-2 px-4 text-sm font-medium ${
                  activeTab === category
                    ? 'text-blue-600 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      )}
      
      {/* View mode selector */}
      <div className="mb-6">
        <div className="flex justify-between items-center">
          <div className="flex space-x-2">
            <button
              onClick={() => setViewMode('round')}
              className={`px-3 py-1 text-sm rounded ${
                viewMode === 'round'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              By Round
            </button>
          <button
            onClick={() => setViewMode('group')}
            className={`px-3 py-1 text-sm rounded ${
              viewMode === 'group'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            By Group
          </button>
          <button
            onClick={() => setViewMode('team')}
            className={`px-3 py-1 text-sm rounded ${
              viewMode === 'team'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            By Player
          </button>
          <button
            onClick={() => setViewMode('court')}
            className={`px-3 py-1 text-sm rounded ${
              viewMode === 'court'
                ? 'bg-blue-600 text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            By Court
          </button>
          </div>
          
          {/* Export for DUPR button - only visible after all matches are completed */}
          {areAllMatchesCompleted() && (
            <button
              onClick={handleExportForDupr}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700
                        transition-colors focus:outline-none focus:ring-2 focus:ring-green-500
                        focus:ring-opacity-50"
            >
              Export for DUPR
            </button>
          )}
        </div>
      </div>
      
      {/* Display fixtures based on selected view mode */}
      {viewMode === 'round' && renderFixturesByRound()}
      {viewMode === 'group' && renderFixturesByGroup()}
      {viewMode === 'team' && renderFixturesByTeam()}
      {viewMode === 'court' && renderFixturesByCourt()}
    </div>
  );
};

export default FixtureDisplay;