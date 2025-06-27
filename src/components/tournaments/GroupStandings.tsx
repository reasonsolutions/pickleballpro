import React from 'react';
import type { Fixture, Group } from '../../utils/fixtureUtils';
import type { User } from '../../firebase/models';
import StandingsTable from './StandingsTable';
import {
  organizeStandings,
  createTeamNameMap,
  createPlayerRankMap
} from '../../utils/standingsUtils';

interface GroupStandingsProps {
  fixtures: Fixture[];
  groups: Group[];
  participants: Array<{userId: string; user: User | null; category: string; registrationDate: Date; seed?: number | null}>;
  teamPairings?: Record<string, string>; // For doubles teams
}

const GroupStandings: React.FC<GroupStandingsProps> = ({ 
  fixtures, 
  groups,
  participants,
  teamPairings
}) => {
  // Create map of player IDs to team names
  const teamNames = createTeamNameMap(participants, teamPairings);
  
  // Create map of player IDs to ranks (A1, B2, etc.)
  const playerRanks = createPlayerRankMap(groups);
  
  // Organize fixtures and participants into group standings
  const groupStandings = organizeStandings(fixtures, groups, teamNames);
  
  return (
    <div className="space-y-8">
      {groupStandings.map(standing => (
        <StandingsTable
          key={standing.groupId}
          groupName={standing.groupName}
          fixtures={standing.fixtures}
          teamNames={teamNames}
          playerRanks={playerRanks}
          backgroundColor={standing.backgroundColor}
        />
      ))}
      
      {groupStandings.length === 0 && (
        <div className="text-center py-8 bg-white/10 backdrop-blur-sm rounded-lg">
          <p className="text-gray-600">No group standings available. Generate fixtures first.</p>
        </div>
      )}
    </div>
  );
};

export default GroupStandings;