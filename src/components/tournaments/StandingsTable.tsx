import React from 'react';
import type { Fixture } from '../../utils/fixtureUtils';

interface TeamStats {
  teamId: string;
  teamName: string;
  rank: string; // A1, B2, etc.
  matches: number;
  matchesWon: number;
  ptsWon: number;
  ptsLost: number;
  ptsDiff: number;
}

interface StandingsTableProps {
  groupName: string; // "MENS GROUP A", "MENS GROUP B", etc.
  fixtures: Fixture[];
  teamNames: Record<string, string>; // Map of player IDs to team names
  playerRanks: Record<string, string>; // Map of player IDs to ranks (A1, B2, etc.)
  backgroundColor?: string; // Color for the header - blue for A, green for B, etc.
}

const StandingsTable: React.FC<StandingsTableProps> = ({ 
  groupName, 
  fixtures, 
  teamNames, 
  playerRanks,
  backgroundColor = 'bg-blue-500' 
}) => {
  // Calculate stats for each team in this group
  const calculateTeamStats = (): TeamStats[] => {
    const stats: Record<string, TeamStats> = {};
    
    // Get unique player IDs in this group
    const playerIds = Array.from(
      new Set(
        fixtures.flatMap(fixture => [
          fixture.player1Id, 
          fixture.player2Id
        ]).filter(Boolean) as string[]
      )
    );

    // Initialize stats for each player
    playerIds.forEach(playerId => {
      stats[playerId] = {
        teamId: playerId,
        teamName: teamNames[playerId] || 'Unknown Team',
        rank: playerRanks[playerId] || '',
        matches: 0,
        matchesWon: 0,
        ptsWon: 0,
        ptsLost: 0,
        ptsDiff: 0
      };
    });

    // Calculate stats from completed fixtures
    fixtures
      .filter(fixture => fixture.completed && fixture.score)
      .forEach(fixture => {
        if (!fixture.player1Id || !fixture.player2Id) return;
        
        const player1 = fixture.player1Id;
        const player2 = fixture.player2Id;
        
        // Increment match count for both players
        stats[player1].matches++;
        stats[player2].matches++;
        
        // Parse score (format: "21-15")
        const [score1, score2] = fixture.score?.split('-').map(s => parseInt(s)) || [0, 0];
        
        // Add points
        stats[player1].ptsWon += score1;
        stats[player1].ptsLost += score2;
        stats[player2].ptsWon += score2;
        stats[player2].ptsLost += score1;
        
        // Update match wins
        if (fixture.winner === player1) {
          stats[player1].matchesWon++;
        } else if (fixture.winner === player2) {
          stats[player2].matchesWon++;
        }
      });
    
    // Calculate point differential
    Object.values(stats).forEach(team => {
      team.ptsDiff = team.ptsWon - team.ptsLost;
    });
    
    // Convert to array and sort
    return Object.values(stats)
      .sort((a, b) => {
        // Sort by matches won (descending)
        if (b.matchesWon !== a.matchesWon) {
          return b.matchesWon - a.matchesWon;
        }
        // Then by point differential (descending)
        return b.ptsDiff - a.ptsDiff;
      });
  };

  const teamStats = calculateTeamStats();

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200 shadow-md mb-8">
      <div className={`${backgroundColor} text-white font-bold py-2 px-4 text-center text-xl`}>
        {groupName}
      </div>
      <table className="w-full border-collapse bg-white text-left text-sm text-gray-500">
        <thead className="bg-blue-100">
          <tr>
            <th scope="col" className="px-4 py-2 font-medium text-gray-600">POSITION</th>
            <th scope="col" className="px-4 py-2 font-medium text-gray-600">Team Name</th>
            <th scope="col" className="px-4 py-2 font-medium text-gray-600">Matches</th>
            <th scope="col" className="px-4 py-2 font-medium text-gray-600">Matches Won</th>
            <th scope="col" className="px-4 py-2 font-medium text-gray-600">Pts Won</th>
            <th scope="col" className="px-4 py-2 font-medium text-gray-600">Pts Lost</th>
            <th scope="col" className="px-4 py-2 font-medium text-gray-600">Pts Diff</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100 border-t border-gray-100">
          {teamStats.map((team, index) => (
            <tr key={team.teamId} className={index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
              <td className="px-4 py-2 font-medium text-gray-900">
                {index + 1}
              </td>
              <td className="px-4 py-2 font-medium text-gray-900">
                <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded mr-2 text-xs">
                  {team.rank}
                </span>
                {team.teamName}
              </td>
              <td className="px-4 py-2 text-center">{team.matches}</td>
              <td className="px-4 py-2 text-center">{team.matchesWon}</td>
              <td className="px-4 py-2 text-center">{team.ptsWon}</td>
              <td className="px-4 py-2 text-center">{team.ptsLost}</td>
              <td className="px-4 py-2 text-center">{team.ptsDiff}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default StandingsTable;