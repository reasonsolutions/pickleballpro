import type { Fixture, Group } from './fixtureUtils';
import type { User } from '../firebase/models';

export interface TeamData {
  id: string;
  name: string;
  rank: string;
}

export interface GroupStanding {
  groupName: string;
  groupId: string;
  teams: TeamData[];
  fixtures: Fixture[];
  backgroundColor: string;
}

export interface TeamStats {
  teamId: string;
  teamName: string;
  rank: string;
  matches: number;
  matchesWon: number;
  ptsWon: number;
  ptsLost: number;
  ptsDiff: number;
}

// Colors for different groups
const GROUP_COLORS = {
  A: 'bg-blue-500',
  B: 'bg-green-500',
  C: 'bg-orange-500',
  D: 'bg-purple-500',
};

/**
 * Organizes fixtures and participant data into group standings
 */
export function organizeStandings(
  fixtures: Fixture[],
  groups: Group[],
  participantNames: Record<string, string>
): GroupStanding[] {
  // Filter out fixtures without a group
  const groupFixtures = fixtures.filter(fixture => fixture.group);
  
  // Map group IDs to their fixtures
  const fixturesByGroup: Record<string, Fixture[]> = {};
  groupFixtures.forEach(fixture => {
    const groupId = fixture.group!;
    if (!fixturesByGroup[groupId]) {
      fixturesByGroup[groupId] = [];
    }
    fixturesByGroup[groupId].push(fixture);
  });
  
  // Create standings for each group
  return groups.map(group => {
    // Get group letter (A, B, C, etc.) from the group name
    const groupLetter = group.name.split(' ')[1] || 'A';
    
    // Create team data for each player in the group
    const teams = group.playerIds.map((playerId, index) => {
      // Create rank like A1, A2, B1, B2, etc.
      const rank = `${groupLetter}${index + 1}`;
      
      return {
        id: playerId,
        name: participantNames[playerId] || `Team ${rank}`,
        rank
      };
    });
    
    // Extract group name from group id (e.g., "Men's Singles_GroupA" -> "MENS GROUP A")
    const categoryName = group.category.replace("'s", 'S').toUpperCase();
    const groupName = `${categoryName} GROUP ${groupLetter}`;
    
    return {
      groupName,
      groupId: group.id,
      teams,
      fixtures: fixturesByGroup[group.id] || [],
      backgroundColor: GROUP_COLORS[groupLetter as keyof typeof GROUP_COLORS] || 'bg-gray-500'
    };
  });
}

/**
 * Creates a map of player IDs to their team names
 */
export function createTeamNameMap(
  participants: Array<{userId: string; user: User | null}>,
  teamPairings?: Record<string, string> // Optional mapping for doubles teams
): Record<string, string> {
  const teamNames: Record<string, string> = {};
  
  participants.forEach(participant => {
    const userId = participant.userId;
    
    // If this is a doubles tournament with team pairings
    if (teamPairings && teamPairings[userId]) {
      teamNames[userId] = teamPairings[userId];
    } else {
      // For singles or if no team pairing found
      // Handle the case where displayName might be null or undefined
      const displayName = participant.user?.displayName || 'Unknown Player';
      teamNames[userId] = displayName;
    }
  });
  
  return teamNames;
}

/**
 * Creates a map of player IDs to their ranks (A1, B2, etc.)
 */
export function createPlayerRankMap(groups: Group[]): Record<string, string> {
  const playerRanks: Record<string, string> = {};
  
  groups.forEach(group => {
    const groupLetter = group.name.split(' ')[1] || 'A';
    
    group.playerIds.forEach((playerId, index) => {
      const rank = `${groupLetter}${index + 1}`;
      playerRanks[playerId] = rank;
    });
  });
  
  return playerRanks;
}