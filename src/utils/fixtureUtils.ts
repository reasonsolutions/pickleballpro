import type { Tournament, TournamentParticipant, User } from '../firebase/models';

// Types for tournament fixtures
export interface Fixture {
  id: string;
  round: number;
  matchNumber: number;
  player1Id: string | null;
  player2Id: string | null;
  winner: string | null;
  score: string | null;
  court?: string;
  scheduledTime?: string;
  scheduledDate?: string;
  completed: boolean;
  category: string;
  bracket?: 'winners' | 'losers' | 'final';
  stage?: 'pool' | 'playoff';
  group?: string;
  playoffRound?: 'quarterFinal' | 'semiFinal' | 'final' | '3rdPlace';
  cup?: 'gold' | 'silver';
}

export interface TournamentFixtures {
  format: TournamentFormat;
  fixtures: Fixture[];
  groups?: Group[];
}

export interface Group {
  id: string;
  name: string;
  playerIds: string[];
  category: string;
}

export type TournamentFormat =
  | 'roundRobin'
  | 'roundRobinGroups'
  | 'singleElimination'
  | 'doubleElimination'
  | 'poolPlayPlayoffs'
  | 'poolPlayCups'
  | 'swiss';

// Helper function to generate dummy players if needed
const generateDummyPlayers = (
  participants: TournamentParticipant[],
  category: string,
  requiredCount: number,
  minCount: number = 20
): TournamentParticipant[] => {
  // Filter participants by category
  const result = [...participants.filter(p => p.category === category)];
  
  // Determine the target count - needs to be at least minCount (20) and at least requiredCount
  const targetCount = Math.max(requiredCount, minCount);
  
  // If we already have enough participants, return the required number
  if (result.length >= targetCount) {
    return result.slice(0, targetCount);
  }
  
  // Add dummy players to reach the target count
  const dummyCount = targetCount - result.length;
  for (let i = 0; i < dummyCount; i++) {
    result.push({
      userId: `dummy_${i}`,
      category: category as any,
      registrationDate: new Date() as any,
      seed: null
    });
  }
  
  return result;
};

// Helper to check if a player is a dummy player
export const isDummyPlayer = (userId: string): boolean => {
  return userId.startsWith('dummy_') || userId === 'bye';
};

// Sort participants by seed (null seeds at the end)
const sortParticipantsBySeeding = (participants: TournamentParticipant[]): TournamentParticipant[] => {
  return [...participants].sort((a, b) => {
    if ((a.seed === null || a.seed === undefined) && (b.seed === null || b.seed === undefined)) return 0;
    if (a.seed === null || a.seed === undefined) return 1;
    if (b.seed === null || b.seed === undefined) return -1;
    return (a.seed || 0) - (b.seed || 0);
  });
};

// Generate Single Elimination Tournament fixtures
export const generateSingleEliminationFixtures = (
  participants: TournamentParticipant[],
  category: string
): Fixture[] => {
  // Ensure we have a power of 2 number of participants
  const rounds = Math.ceil(Math.log2(participants.length));
  const totalParticipants = Math.pow(2, rounds);
  
  // Fill with dummy players if needed
  const allParticipants = generateDummyPlayers(participants, category, totalParticipants);
  const seededParticipants = sortParticipantsBySeeding(allParticipants);
  
  const fixtures: Fixture[] = [];
  let matchCount = 0;

  // First round matches
  const firstRoundMatches = totalParticipants / 2;
  for (let i = 0; i < firstRoundMatches; i++) {
    matchCount++;
    fixtures.push({
      id: `${category}_R1_M${matchCount}`,
      round: 1,
      matchNumber: matchCount,
      player1Id: seededParticipants[i].userId,
      player2Id: seededParticipants[totalParticipants - 1 - i].userId,
      winner: null,
      score: null,
      completed: false,
      category
    });
  }

  // Generate subsequent rounds (empty matches)
  for (let round = 2; round <= rounds; round++) {
    const roundMatches = totalParticipants / Math.pow(2, round);
    for (let match = 0; match < roundMatches; match++) {
      matchCount++;
      fixtures.push({
        id: `${category}_R${round}_M${match + 1}`,
        round,
        matchNumber: match + 1,
        player1Id: null,
        player2Id: null,
        winner: null,
        score: null,
        completed: false,
        category
      });
    }
  }

  return fixtures;
};

// Generate Round Robin Tournament fixtures
export const generateRoundRobinFixtures = (
  participants: TournamentParticipant[],
  category: string
): Fixture[] => {
  // Ensure we have at least 2 participants
  if (participants.length < 2) {
    participants = generateDummyPlayers(participants, category, 2);
  }
  
  const filteredParticipants = participants.filter(p => p.category === category);
  const count = filteredParticipants.length;
  
  // If odd number of participants, add a dummy
  const actualParticipants = count % 2 === 0
    ? filteredParticipants
    : [...filteredParticipants, {
        userId: 'bye',
        category: category as any,
        registrationDate: new Date() as any,
        seed: null
      }];
  
  const playerIds = actualParticipants.map(p => p.userId);
  const fixtures: Fixture[] = [];
  let matchNumber = 0;
  
  // Round robin algorithm (circle method)
  const rounds = playerIds.length - 1;
  const matchesPerRound = playerIds.length / 2;
  
  for (let round = 0; round < rounds; round++) {
    for (let match = 0; match < matchesPerRound; match++) {
      const homeIndex = match;
      const awayIndex = playerIds.length - 1 - match;
      
      // Skip matches involving the dummy "bye" player
      if (playerIds[homeIndex] !== 'bye' && playerIds[awayIndex] !== 'bye') {
        matchNumber++;
        fixtures.push({
          id: `${category}_RR_R${round + 1}_M${matchNumber}`,
          round: round + 1,
          matchNumber,
          player1Id: playerIds[homeIndex],
          player2Id: playerIds[awayIndex],
          winner: null,
          score: null,
          completed: false,
          category
        });
      }
    }
    
    // Rotate players (keep first player fixed)
    playerIds.splice(1, 0, playerIds.pop()!);
  }
  
  return fixtures;
};

// Generate Round Robin Groups Tournament fixtures
export const generateRoundRobinGroupsFixtures = (
  participants: TournamentParticipant[],
  category: string,
  groupCount: number = 2
): { fixtures: Fixture[], groups: Group[] } => {
  console.log(`generateRoundRobinGroupsFixtures - category: ${category}, requested groupCount: ${groupCount}`);
  const filteredParticipants = participants.filter(p => p.category === category);
  
  // Ensure we have enough participants (at least groupCount * 2)
  const minParticipants = groupCount * 2;
  const allParticipants = filteredParticipants.length < minParticipants
    ? generateDummyPlayers(filteredParticipants, category, minParticipants)
    : filteredParticipants;
  
  // Sort by seeding
  const seededParticipants = sortParticipantsBySeeding(allParticipants);
  
  // Create groups using snake distribution (1,4,5,8.. in group A, 2,3,6,7.. in group B)
  const groups: Group[] = Array(groupCount).fill(null).map((_, i) => ({
    id: `${category}_Group${String.fromCharCode(65 + i)}`, // Group A, B, C...
    name: `Group ${String.fromCharCode(65 + i)}`,
    playerIds: [],
    category
  }));
  
  // Distribute players to groups using snake pattern
  let direction = 1; // 1 for forward, -1 for backward
  let currentGroup = 0;
  
  seededParticipants.forEach((participant, index) => {
    groups[currentGroup].playerIds.push(participant.userId);
    
    currentGroup += direction;
    
    // Change direction if we reached the end or beginning
    if (currentGroup >= groupCount) {
      direction = -1;
      currentGroup = groupCount - 1;
    } else if (currentGroup < 0) {
      direction = 1;
      currentGroup = 0;
    }
  });
  
  // Generate round robin fixtures for each group
  let fixtures: Fixture[] = [];
  
  groups.forEach(group => {
    const groupParticipants = group.playerIds.map(id => {
      const participant = seededParticipants.find(p => p.userId === id);
      return participant || {
        userId: id,
        category: category as any,
        registrationDate: new Date() as any,
        seed: null
      };
    });
    
    const groupFixtures = generateRoundRobinFixtures(groupParticipants, category)
      .map(fixture => ({
        ...fixture,
        id: `${group.id}_${fixture.id}`,
        group: group.id
      }));
      
    fixtures = [...fixtures, ...groupFixtures];
  });
  
  return { fixtures, groups };
};

// Generate Double Elimination Tournament fixtures
export const generateDoubleEliminationFixtures = (
  participants: TournamentParticipant[],
  category: string
): Fixture[] => {
  // First generate single elimination fixtures for the winners bracket
  const winnersBracket = generateSingleEliminationFixtures(participants, category);
  
  // Modify ids to indicate winners bracket
  winnersBracket.forEach(fixture => {
    fixture.id = `W_${fixture.id}`;
    fixture.bracket = 'winners';
  });
  
  // Create losers bracket
  const rounds = Math.ceil(Math.log2(participants.length));
  const losersBracket: Fixture[] = [];
  let matchCount = 0;
  
  // Generate losers bracket matches
  for (let round = 1; round < rounds; round++) {
    // Number of matches in this round of losers bracket
    const roundMatches = Math.pow(2, Math.floor((round + 1) / 2));
    
    for (let match = 0; match < roundMatches; match++) {
      matchCount++;
      losersBracket.push({
        id: `L_${category}_R${round}_M${match + 1}`,
        round,
        matchNumber: match + 1,
        player1Id: null,
        player2Id: null,
        winner: null,
        score: null,
        completed: false,
        category,
        bracket: 'losers'
      });
    }
  }
  
  // Add final championship match
  matchCount++;
  const finalMatch: Fixture = {
    id: `F_${category}_Final`,
    round: rounds + 1,
    matchNumber: 1,
    player1Id: null, // Winner of winners bracket
    player2Id: null, // Winner of losers bracket
    winner: null,
    score: null,
    completed: false,
    category,
    bracket: 'final'
  };
  
  return [...winnersBracket, ...losersBracket, finalMatch];
};

// Generate Swiss Tournament fixtures
export const generateSwissFixtures = (
  participants: TournamentParticipant[],
  category: string,
  roundCount: number = 3
): Fixture[] => {
  // Need at least 4 participants for Swiss system
  const filteredParticipants = participants.filter(p => p.category === category);
  const allParticipants = filteredParticipants.length < 4
    ? generateDummyPlayers(filteredParticipants, category, 4)
    : filteredParticipants;
  
  // For Swiss, just generate first round, other rounds will be generated
  // after each round based on results
  const fixtures: Fixture[] = [];
  const playerIds = allParticipants.map(p => p.userId);
  
  // First round - randomly pair players
  const shuffledIds = [...playerIds].sort(() => Math.random() - 0.5);
  
  for (let i = 0; i < shuffledIds.length / 2; i++) {
    fixtures.push({
      id: `${category}_Swiss_R1_M${i + 1}`,
      round: 1,
      matchNumber: i + 1,
      player1Id: shuffledIds[i * 2],
      player2Id: shuffledIds[i * 2 + 1],
      winner: null,
      score: null,
      completed: false,
      category
    });
  }
  
  // Other rounds will be empty until previous round results are in
  for (let round = 2; round <= roundCount; round++) {
    for (let match = 0; match < playerIds.length / 2; match++) {
      fixtures.push({
        id: `${category}_Swiss_R${round}_M${match + 1}`,
        round,
        matchNumber: match + 1,
        player1Id: null,
        player2Id: null,
        winner: null,
        score: null,
        completed: false,
        category
      });
    }
  }
  
  return fixtures;
};

// Generate Pool Play + Playoffs fixtures (Pool phase only)
export const generatePoolPlayoffFixtures = (
  participants: TournamentParticipant[],
  category: string,
  groupCount: number = 2,
  playoffTeams: number = 4,
  playoffStructure: 'quarterFinals' | 'semiFinals' | 'finalOnly' = 'quarterFinals'
): { fixtures: Fixture[], groups: Group[] } => {
  // Generate only the pool play (round robin groups) initially
  const { fixtures: poolFixtures, groups } = generateRoundRobinGroupsFixtures(
    participants,
    category,
    groupCount
  );
  
  // Mark all pool fixtures as part of pool stage
  poolFixtures.forEach(fixture => {
    fixture.stage = 'pool';
  });
  
  // We don't generate playoff fixtures upfront
  // They will be generated later when pool play is complete
  
  return {
    fixtures: poolFixtures,
    groups
  };
};

// Generate playoff fixtures after pool play is complete
export const generatePlayoffFixtures = (
  groups: Group[],
  category: string,
  playoffStructure: 'quarterFinals' | 'semiFinals' | 'finalOnly' = 'quarterFinals'
): Fixture[] => {
  const playoffFixtures: Fixture[] = [];
  
  // Get sorted groups (A, B, C, D)
  const sortedGroups = [...groups].sort((a, b) => {
    const groupALetter = a.name.split(' ')[1] || '';
    const groupBLetter = b.name.split(' ')[1] || '';
    return groupALetter.localeCompare(groupBLetter);
  });
  
  if (playoffStructure === 'quarterFinals') {
    // Handle based on number of groups
    if (sortedGroups.length === 2) {
      // 2 Groups scenario (top 2 from each group qualify for quarterfinals)
      const groupA = sortedGroups[0];
      const groupB = sortedGroups[1];
      
      if (!groupA || !groupB) {
        console.error('Insufficient groups for playoff generation');
        return [];
      }
      
      // Get player standings for each group (top 2)
      // In a real implementation, we would sort by performance
      // For now, we'll assume the playerIds array is already in the correct order
      const groupAPlayers = [...(groupA.playerIds || [])].slice(0, 2);
      const groupBPlayers = [...(groupB.playerIds || [])].slice(0, 2);
      
      // QF1: Group A 1st vs Group B 2nd
      playoffFixtures.push({
        id: `${category}_Playoff_QF1`,
        round: 1,
        matchNumber: 1,
        player1Id: groupAPlayers[0] || null,
        player2Id: groupBPlayers.length >= 2 ? groupBPlayers[1] : null,
        winner: null,
        score: null,
        completed: false,
        category,
        stage: 'playoff',
        playoffRound: 'quarterFinal'
      });
      
      // QF2: Group B 1st vs Group A 2nd
      playoffFixtures.push({
        id: `${category}_Playoff_QF2`,
        round: 1,
        matchNumber: 2,
        player1Id: groupBPlayers[0] || null,
        player2Id: groupAPlayers.length >= 2 ? groupAPlayers[1] : null,
        winner: null,
        score: null,
        completed: false,
        category,
        stage: 'playoff',
        playoffRound: 'quarterFinal'
      });
      
      // Generate semi-finals (winners of quarterfinals will advance here)
      playoffFixtures.push({
        id: `${category}_Playoff_SF1`,
        round: 2,
        matchNumber: 1,
        player1Id: null, // Will be filled by winner of QF1 when played
        player2Id: null, // Will be filled by winner of QF2 when played
        winner: null,
        score: null,
        completed: false,
        category,
        stage: 'playoff',
        playoffRound: 'semiFinal'
      });
    } else if (sortedGroups.length === 4) {
      // 4 Groups scenario (winner from each group qualifies for semi-finals)
      const groupA = sortedGroups[0];
      const groupB = sortedGroups[1];
      const groupC = sortedGroups[2];
      const groupD = sortedGroups[3];
      
      if (!groupA || !groupB || !groupC || !groupD) {
        console.error('Insufficient groups for 4-group playoff generation');
        return [];
      }
      
      // Get player standings for each group (top 2)
      const groupAPlayers = [...(groupA.playerIds || [])].slice(0, 2);
      const groupBPlayers = [...(groupB.playerIds || [])].slice(0, 2);
      const groupCPlayers = [...(groupC.playerIds || [])].slice(0, 2);
      const groupDPlayers = [...(groupD.playerIds || [])].slice(0, 2);
      
      // QF1: Group A 1st vs Group D 2nd
      playoffFixtures.push({
        id: `${category}_Playoff_QF1`,
        round: 1,
        matchNumber: 1,
        player1Id: groupAPlayers[0] || null,
        player2Id: groupDPlayers.length >= 2 ? groupDPlayers[1] : null,
        winner: null,
        score: null,
        completed: false,
        category,
        stage: 'playoff',
        playoffRound: 'quarterFinal'
      });
      
      // QF2: Group B 1st vs Group C 2nd
      playoffFixtures.push({
        id: `${category}_Playoff_QF2`,
        round: 1,
        matchNumber: 2,
        player1Id: groupBPlayers[0] || null,
        player2Id: groupCPlayers.length >= 2 ? groupCPlayers[1] : null,
        winner: null,
        score: null,
        completed: false,
        category,
        stage: 'playoff',
        playoffRound: 'quarterFinal'
      });
      
      // QF3: Group C 1st vs Group B 2nd
      playoffFixtures.push({
        id: `${category}_Playoff_QF3`,
        round: 1,
        matchNumber: 3,
        player1Id: groupCPlayers[0] || null,
        player2Id: groupBPlayers.length >= 2 ? groupBPlayers[1] : null,
        winner: null,
        score: null,
        completed: false,
        category,
        stage: 'playoff',
        playoffRound: 'quarterFinal'
      });
      
      // QF4: Group D 1st vs Group A 2nd
      playoffFixtures.push({
        id: `${category}_Playoff_QF4`,
        round: 1,
        matchNumber: 4,
        player1Id: groupDPlayers[0] || null,
        player2Id: groupAPlayers.length >= 2 ? groupAPlayers[1] : null,
        winner: null,
        score: null,
        completed: false,
        category,
        stage: 'playoff',
        playoffRound: 'quarterFinal'
      });
      
      // Generate semi-finals (winners of quarterfinals will advance here)
      playoffFixtures.push({
        id: `${category}_Playoff_SF1`,
        round: 2,
        matchNumber: 1,
        player1Id: null, // Will be filled by winner of QF1 when played
        player2Id: null, // Will be filled by winner of QF2 when played
        winner: null,
        score: null,
        completed: false,
        category,
        stage: 'playoff',
        playoffRound: 'semiFinal'
      });
      
      playoffFixtures.push({
        id: `${category}_Playoff_SF2`,
        round: 2,
        matchNumber: 2,
        player1Id: null, // Will be filled by winner of QF3 when played
        player2Id: null, // Will be filled by winner of QF4 when played
        winner: null,
        score: null,
        completed: false,
        category,
        stage: 'playoff',
        playoffRound: 'semiFinal'
      });
    } else {
      // For any other number of groups, try to create a sensible playoff structure
      const totalGroups = sortedGroups.length;
      console.log(`Creating playoff structure for ${totalGroups} groups`);
      
      // Get the top 2 players from each group
      const qualifiedPlayers = sortedGroups.flatMap(group => {
        const players = [...(group.playerIds || [])];
        return players.slice(0, Math.min(2, players.length)).map(playerId => ({
          playerId,
          group: group.name
        }));
      });
      
      // Create quarterfinals with as many matches as possible
      const maxQFs = Math.floor(qualifiedPlayers.length / 2);
      for (let i = 0; i < maxQFs; i++) {
        playoffFixtures.push({
          id: `${category}_Playoff_QF${i+1}`,
          round: 1,
          matchNumber: i+1,
          player1Id: qualifiedPlayers[i].playerId,
          player2Id: qualifiedPlayers[qualifiedPlayers.length - 1 - i].playerId,
          winner: null,
          score: null,
          completed: false,
          category,
          stage: 'playoff',
          playoffRound: 'quarterFinal'
        });
      }
      
      // Create appropriate number of semifinals
      const numSemis = Math.ceil(maxQFs / 2);
      for (let i = 0; i < numSemis; i++) {
        playoffFixtures.push({
          id: `${category}_Playoff_SF${i+1}`,
          round: 2,
          matchNumber: i+1,
          player1Id: null, // Will be filled by winners of QFs
          player2Id: null,
          winner: null,
          score: null,
          completed: false,
          category,
          stage: 'playoff',
          playoffRound: 'semiFinal'
        });
      }
    }
    
    // Generate final - always round 3 now that we have QFs and SFs
    playoffFixtures.push({
      id: `${category}_Playoff_Final`,
      round: 3,
      matchNumber: 1,
      player1Id: null, // Will be filled by winners of SFs
      player2Id: null,
      winner: null,
      score: null,
      completed: false,
      category,
      stage: 'playoff',
      playoffRound: 'final'
    });
    
    // Generate 3rd place match
    playoffFixtures.push({
      id: `${category}_Playoff_3rdPlace`,
      round: 3,
      matchNumber: 2,
      player1Id: null, // Will be filled by losers of SFs
      player2Id: null,
      winner: null,
      score: null,
      completed: false,
      category,
      stage: 'playoff',
      playoffRound: '3rdPlace'
    });
  }
  else if (playoffStructure === 'semiFinals') {
    // Generate semifinals directly (top from each group)
    if (sortedGroups.length >= 2) {
      const numSemis = Math.min(2, Math.floor(sortedGroups.length / 2));
      
      for (let i = 0; i < numSemis; i++) {
        // For each semifinal, take top player from one group vs top from another
        const group1 = sortedGroups[i];
        const group2 = sortedGroups[sortedGroups.length - 1 - i];
        
        playoffFixtures.push({
          id: `${category}_Playoff_SF${i+1}`,
          round: 1,
          matchNumber: i+1,
          player1Id: group1?.playerIds[0] || null,
          player2Id: group2?.playerIds[0] || null,
          winner: null,
          score: null,
          completed: false,
          category,
          stage: 'playoff',
          playoffRound: 'semiFinal'
        });
      }
    }
    
    // Generate final
    playoffFixtures.push({
      id: `${category}_Playoff_Final`,
      round: 2,
      matchNumber: 1,
      player1Id: null, // Will be filled by winners of SFs
      player2Id: null,
      winner: null,
      score: null,
      completed: false,
      category,
      stage: 'playoff',
      playoffRound: 'final'
    });
    
    // Generate 3rd place match
    playoffFixtures.push({
      id: `${category}_Playoff_3rdPlace`,
      round: 2,
      matchNumber: 2,
      player1Id: null, // Will be filled by losers of SFs
      player2Id: null,
      winner: null,
      score: null,
      completed: false,
      category,
      stage: 'playoff',
      playoffRound: '3rdPlace'
    });
  }
  else if (playoffStructure === 'finalOnly') {
    // Generate final only (2 players - top 1 from each of 2 groups)
    playoffFixtures.push({
      id: `${category}_Playoff_Final`,
      round: 1,
      matchNumber: 1,
      player1Id: null, // Will be filled with 1st from Group A
      player2Id: null, // Will be filled with 1st from Group B
      winner: null,
      score: null,
      completed: false,
      category,
      stage: 'playoff',
      playoffRound: 'final'
    });
    
    // Generate 3rd place match
    playoffFixtures.push({
      id: `${category}_Playoff_3rdPlace`,
      round: 1,
      matchNumber: 2,
      player1Id: null, // Will be filled with 2nd from Group A
      player2Id: null, // Will be filled with 2nd from Group B
      winner: null,
      score: null,
      completed: false,
      category,
      stage: 'playoff',
      playoffRound: '3rdPlace'
    });
  }
  
  return playoffFixtures;
};
// Generate cup fixtures after pool play is complete (Gold Cup and Silver Cup)
export const generateCupsFixtures = (
  groups: Group[],
  category: string,
  playoffStructure: 'quarterFinals' | 'semiFinals' | 'finalOnly' = 'quarterFinals'
): Fixture[] => {
  const cupsFixtures: Fixture[] = [];
  
  // Get sorted groups (A, B, C, D)
  const sortedGroups = [...groups].sort((a, b) => {
    const groupALetter = a.name.split(' ')[1] || '';
    const groupBLetter = b.name.split(' ')[1] || '';
    return groupALetter.localeCompare(groupBLetter);
  });
  
  if (playoffStructure === 'quarterFinals') {
    // Handle based on number of groups
    if (sortedGroups.length === 2) {
      // 2 Groups scenario (top 2 from each group qualify for Gold Cup, next 2 for Silver Cup)
      const groupA = sortedGroups[0];
      const groupB = sortedGroups[1];
      
      if (!groupA || !groupB) {
        console.error('Insufficient groups for cup generation');
        return [];
      }
      
      // Get player standings for each group (top 4)
      // In a real implementation, we would sort by performance
      // For now, we'll assume the playerIds array is already in the correct order
      const groupAPlayers = [...(groupA.playerIds || [])].slice(0, 4);
      const groupBPlayers = [...(groupB.playerIds || [])].slice(0, 4);
      
      // Gold Cup QF1: Group A 1st vs Group B 2nd
      cupsFixtures.push({
        id: `${category}_Gold_QF1`,
        round: 1,
        matchNumber: 1,
        player1Id: groupAPlayers[0] || null,
        player2Id: groupBPlayers.length >= 2 ? groupBPlayers[1] : null,
        winner: null,
        score: null,
        completed: false,
        category,
        stage: 'playoff',
        playoffRound: 'quarterFinal',
        cup: 'gold'
      });
      
      // Gold Cup QF2: Group B 1st vs Group A 2nd
      cupsFixtures.push({
        id: `${category}_Gold_QF2`,
        round: 1,
        matchNumber: 2,
        player1Id: groupBPlayers[0] || null,
        player2Id: groupAPlayers.length >= 2 ? groupAPlayers[1] : null,
        winner: null,
        score: null,
        completed: false,
        category,
        stage: 'playoff',
        playoffRound: 'quarterFinal',
        cup: 'gold'
      });
      
      // Silver Cup QF1: Group A 3rd vs Group B 4th
      // Always create Silver Cup quarterfinals
      cupsFixtures.push({
        id: `${category}_Silver_QF1`,
        round: 1,
        matchNumber: 3,
        player1Id: groupAPlayers.length >= 3 ? groupAPlayers[2] : null,
        player2Id: groupBPlayers.length >= 4 ? groupBPlayers[3] : null,
        winner: null,
        score: null,
        completed: false,
        category,
        stage: 'playoff',
        playoffRound: 'quarterFinal',
        cup: 'silver'
      });
      
      // Silver Cup QF2: Group B 3rd vs Group A 4th
      // Always create Silver Cup quarterfinals
      cupsFixtures.push({
        id: `${category}_Silver_QF2`,
        round: 1,
        matchNumber: 4,
        player1Id: groupBPlayers.length >= 3 ? groupBPlayers[2] : null,
        player2Id: groupAPlayers.length >= 4 ? groupAPlayers[3] : null,
        winner: null,
        score: null,
        completed: false,
        category,
        stage: 'playoff',
        playoffRound: 'quarterFinal',
        cup: 'silver'
      });
      
      // Generate Gold Cup semi-finals
      cupsFixtures.push({
        id: `${category}_Gold_SF1`,
        round: 2,
        matchNumber: 1,
        player1Id: null, // Will be filled by winner of Gold QF1 when played
        player2Id: null, // Will be filled by winner of Gold QF2 when played
        winner: null,
        score: null,
        completed: false,
        category,
        stage: 'playoff',
        playoffRound: 'semiFinal',
        cup: 'gold'
      });
      
      // Generate Silver Cup semi-finals
      cupsFixtures.push({
        id: `${category}_Silver_SF1`,
        round: 2,
        matchNumber: 2,
        player1Id: null, // Will be filled by winner of Silver QF1 when played
        player2Id: null, // Will be filled by winner of Silver QF2 when played
        winner: null,
        score: null,
        completed: false,
        category,
        stage: 'playoff',
        playoffRound: 'semiFinal',
        cup: 'silver'
      });
    } else if (sortedGroups.length === 4) {
      // 4 Groups scenario
      const groupA = sortedGroups[0];
      const groupB = sortedGroups[1];
      const groupC = sortedGroups[2];
      const groupD = sortedGroups[3];
      
      if (!groupA || !groupB || !groupC || !groupD) {
        console.error('Insufficient groups for 4-group cup generation');
        return [];
      }
      
      // Get player standings for each group (top 2)
      const groupAPlayers = [...(groupA.playerIds || [])].slice(0, 2);
      const groupBPlayers = [...(groupB.playerIds || [])].slice(0, 2);
      const groupCPlayers = [...(groupC.playerIds || [])].slice(0, 2);
      const groupDPlayers = [...(groupD.playerIds || [])].slice(0, 2);
      
      // Gold Cup QF1: Group A 1st vs Group D 2nd
      cupsFixtures.push({
        id: `${category}_Gold_QF1`,
        round: 1,
        matchNumber: 1,
        player1Id: groupAPlayers[0] || null,
        player2Id: groupDPlayers.length >= 2 ? groupDPlayers[1] : null,
        winner: null,
        score: null,
        completed: false,
        category,
        stage: 'playoff',
        playoffRound: 'quarterFinal',
        cup: 'gold'
      });
      
      // Gold Cup QF2: Group B 1st vs Group C 2nd
      cupsFixtures.push({
        id: `${category}_Gold_QF2`,
        round: 1,
        matchNumber: 2,
        player1Id: groupBPlayers[0] || null,
        player2Id: groupCPlayers.length >= 2 ? groupCPlayers[1] : null,
        winner: null,
        score: null,
        completed: false,
        category,
        stage: 'playoff',
        playoffRound: 'quarterFinal',
        cup: 'gold'
      });
      
      // Gold Cup QF3: Group C 1st vs Group B 2nd
      cupsFixtures.push({
        id: `${category}_Gold_QF3`,
        round: 1,
        matchNumber: 3,
        player1Id: groupCPlayers[0] || null,
        player2Id: groupBPlayers.length >= 2 ? groupBPlayers[1] : null,
        winner: null,
        score: null,
        completed: false,
        category,
        stage: 'playoff',
        playoffRound: 'quarterFinal',
        cup: 'gold'
      });
      
      // Gold Cup QF4: Group D 1st vs Group A 2nd
      cupsFixtures.push({
        id: `${category}_Gold_QF4`,
        round: 1,
        matchNumber: 4,
        player1Id: groupDPlayers[0] || null,
        player2Id: groupAPlayers.length >= 2 ? groupAPlayers[1] : null,
        winner: null,
        score: null,
        completed: false,
        category,
        stage: 'playoff',
        playoffRound: 'quarterFinal',
        cup: 'gold'
      });
      
      // Generate Gold Cup semi-finals
      cupsFixtures.push({
        id: `${category}_Gold_SF1`,
        round: 2,
        matchNumber: 1,
        player1Id: null, // Will be filled by winner of Gold QF1 when played
        player2Id: null, // Will be filled by winner of Gold QF2 when played
        winner: null,
        score: null,
        completed: false,
        category,
        stage: 'playoff',
        playoffRound: 'semiFinal',
        cup: 'gold'
      });
      
      cupsFixtures.push({
        id: `${category}_Gold_SF2`,
        round: 2,
        matchNumber: 2,
        player1Id: null, // Will be filled by winner of Gold QF3 when played
        player2Id: null, // Will be filled by winner of Gold QF4 when played
        winner: null,
        score: null,
        completed: false,
        category,
        stage: 'playoff',
        playoffRound: 'semiFinal',
        cup: 'gold'
      });
      
      // Now let's add Silver Cup fixtures for 4-group scenario
      // Get 3rd and 4th place players from each group
      const groupALowerPlayers = [...(groupA.playerIds || [])].slice(2, 4);
      const groupBLowerPlayers = [...(groupB.playerIds || [])].slice(2, 4);
      const groupCLowerPlayers = [...(groupC.playerIds || [])].slice(2, 4);
      const groupDLowerPlayers = [...(groupD.playerIds || [])].slice(2, 4);
      
      // Silver Cup QF1: Group A 3rd vs Group D 4th
      cupsFixtures.push({
        id: `${category}_Silver_QF1`,
        round: 1,
        matchNumber: 5,
        player1Id: groupALowerPlayers.length >= 1 ? groupALowerPlayers[0] : null,
        player2Id: groupDLowerPlayers.length >= 2 ? groupDLowerPlayers[1] : null,
        winner: null,
        score: null,
        completed: false,
        category,
        stage: 'playoff',
        playoffRound: 'quarterFinal',
        cup: 'silver'
      });
      
      // Silver Cup QF2: Group B 3rd vs Group C 4th
      cupsFixtures.push({
        id: `${category}_Silver_QF2`,
        round: 1,
        matchNumber: 6,
        player1Id: groupBLowerPlayers.length >= 1 ? groupBLowerPlayers[0] : null,
        player2Id: groupCLowerPlayers.length >= 2 ? groupCLowerPlayers[1] : null,
        winner: null,
        score: null,
        completed: false,
        category,
        stage: 'playoff',
        playoffRound: 'quarterFinal',
        cup: 'silver'
      });
      
      // Silver Cup QF3: Group C 3rd vs Group B 4th
      cupsFixtures.push({
        id: `${category}_Silver_QF3`,
        round: 1,
        matchNumber: 7,
        player1Id: groupCLowerPlayers.length >= 1 ? groupCLowerPlayers[0] : null,
        player2Id: groupBLowerPlayers.length >= 2 ? groupBLowerPlayers[1] : null,
        winner: null,
        score: null,
        completed: false,
        category,
        stage: 'playoff',
        playoffRound: 'quarterFinal',
        cup: 'silver'
      });
      
      // Silver Cup QF4: Group D 3rd vs Group A 4th
      cupsFixtures.push({
        id: `${category}_Silver_QF4`,
        round: 1,
        matchNumber: 8,
        player1Id: groupDLowerPlayers.length >= 1 ? groupDLowerPlayers[0] : null,
        player2Id: groupALowerPlayers.length >= 2 ? groupALowerPlayers[1] : null,
        winner: null,
        score: null,
        completed: false,
        category,
        stage: 'playoff',
        playoffRound: 'quarterFinal',
        cup: 'silver'
      });
      
      // Generate Silver Cup semi-finals
      cupsFixtures.push({
        id: `${category}_Silver_SF1`,
        round: 2,
        matchNumber: 3,
        player1Id: null, // Will be filled by winner of Silver QF1 when played
        player2Id: null, // Will be filled by winner of Silver QF2 when played
        winner: null,
        score: null,
        completed: false,
        category,
        stage: 'playoff',
        playoffRound: 'semiFinal',
        cup: 'silver'
      });
      
      cupsFixtures.push({
        id: `${category}_Silver_SF2`,
        round: 2,
        matchNumber: 4,
        player1Id: null, // Will be filled by winner of Silver QF3 when played
        player2Id: null, // Will be filled by winner of Silver QF4 when played
        winner: null,
        score: null,
        completed: false,
        category,
        stage: 'playoff',
        playoffRound: 'semiFinal',
        cup: 'silver'
      });
    } else {
      // For any other number of groups
      const totalGroups = sortedGroups.length;
      console.log(`Creating cup structure for ${totalGroups} groups`);
      
      // Get the top players from each group for Gold Cup
      const goldCupPlayers = sortedGroups.flatMap(group => {
        const players = [...(group.playerIds || [])];
        return players.slice(0, Math.min(2, players.length)).map(playerId => ({
          playerId,
          group: group.name
        }));
      });
      
      // Create Gold Cup quarterfinals
      const maxGoldQFs = Math.floor(goldCupPlayers.length / 2);
      for (let i = 0; i < maxGoldQFs; i++) {
        cupsFixtures.push({
          id: `${category}_Gold_QF${i+1}`,
          round: 1,
          matchNumber: i+1,
          player1Id: goldCupPlayers[i].playerId,
          player2Id: goldCupPlayers[goldCupPlayers.length - 1 - i].playerId,
          winner: null,
          score: null,
          completed: false,
          category,
          stage: 'playoff',
          playoffRound: 'quarterFinal',
          cup: 'gold'
        });
      }
      
      // Create Gold Cup semifinals
      const numGoldSemis = Math.ceil(maxGoldQFs / 2);
      for (let i = 0; i < numGoldSemis; i++) {
        cupsFixtures.push({
          id: `${category}_Gold_SF${i+1}`,
          round: 2,
          matchNumber: i+1,
          player1Id: null,
          player2Id: null,
          winner: null,
          score: null,
          completed: false,
          category,
          stage: 'playoff',
          playoffRound: 'semiFinal',
          cup: 'gold'
        });
      }
      
      // Now get the bottom players from each group for Silver Cup
      const silverCupPlayers = sortedGroups.flatMap(group => {
        const players = [...(group.playerIds || [])];
        // Get 3rd and 4th place (or equivalent) from each group
        return players.slice(2, 4).map(playerId => ({
          playerId,
          group: group.name
        }));
      });
      
      // Create Silver Cup quarterfinals
      const maxSilverQFs = Math.floor(silverCupPlayers.length / 2);
      for (let i = 0; i < maxSilverQFs; i++) {
        cupsFixtures.push({
          id: `${category}_Silver_QF${i+1}`,
          round: 1,
          matchNumber: maxGoldQFs + i + 1, // Continue match numbering after Gold QFs
          player1Id: silverCupPlayers[i].playerId,
          player2Id: silverCupPlayers[silverCupPlayers.length - 1 - i].playerId,
          winner: null,
          score: null,
          completed: false,
          category,
          stage: 'playoff',
          playoffRound: 'quarterFinal',
          cup: 'silver'
        });
      }
      
      // Create Silver Cup semifinals
      const numSilverSemis = Math.ceil(maxSilverQFs / 2);
      for (let i = 0; i < numSilverSemis; i++) {
        cupsFixtures.push({
          id: `${category}_Silver_SF${i+1}`,
          round: 2,
          matchNumber: numGoldSemis + i + 1, // Continue match numbering after Gold SFs
          player1Id: null,
          player2Id: null,
          winner: null,
          score: null,
          completed: false,
          category,
          stage: 'playoff',
          playoffRound: 'semiFinal',
          cup: 'silver'
        });
      }
    }
    
    // Generate Gold Cup final
    cupsFixtures.push({
      id: `${category}_Gold_Final`,
      round: 3,
      matchNumber: 1,
      player1Id: null,
      player2Id: null,
      winner: null,
      score: null,
      completed: false,
      category,
      stage: 'playoff',
      playoffRound: 'final',
      cup: 'gold'
    });
    
    // Generate Gold Cup 3rd place match
    cupsFixtures.push({
      id: `${category}_Gold_3rdPlace`,
      round: 3,
      matchNumber: 2,
      player1Id: null,
      player2Id: null,
      winner: null,
      score: null,
      completed: false,
      category,
      stage: 'playoff',
      playoffRound: '3rdPlace',
      cup: 'gold'
    });
    
    // Generate Silver Cup final
    cupsFixtures.push({
      id: `${category}_Silver_Final`,
      round: 3,
      matchNumber: 3,
      player1Id: null,
      player2Id: null,
      winner: null,
      score: null,
      completed: false,
      category,
      stage: 'playoff',
      playoffRound: 'final',
      cup: 'silver'
    });
  }
  else if (playoffStructure === 'semiFinals') {
    // Similar structure to quarterFinals but with fewer matches
    // Generate semifinals directly (top from each group)
    if (sortedGroups.length >= 2) {
      const numSemis = Math.min(2, Math.floor(sortedGroups.length / 2));
      
      for (let i = 0; i < numSemis; i++) {
        // For each semifinal, take top player from one group vs top from another
        const group1 = sortedGroups[i];
        const group2 = sortedGroups[sortedGroups.length - 1 - i];
        
        cupsFixtures.push({
          id: `${category}_Gold_SF${i+1}`,
          round: 1,
          matchNumber: i+1,
          player1Id: group1?.playerIds[0] || null,
          player2Id: group2?.playerIds[0] || null,
          winner: null,
          score: null,
          completed: false,
          category,
          stage: 'playoff',
          playoffRound: 'semiFinal',
          cup: 'gold'
        });
        
        // For Silver Cup, take 2nd player from each group
        if (group1?.playerIds.length >= 2 && group2?.playerIds.length >= 2) {
          cupsFixtures.push({
            id: `${category}_Silver_SF${i+1}`,
            round: 1,
            matchNumber: i+numSemis+1,
            player1Id: group1?.playerIds[1] || null,
            player2Id: group2?.playerIds[1] || null,
            winner: null,
            score: null,
            completed: false,
            category,
            stage: 'playoff',
            playoffRound: 'semiFinal',
            cup: 'silver'
          });
        }
      }
    }
    
    // Generate Gold Cup final
    cupsFixtures.push({
      id: `${category}_Gold_Final`,
      round: 2,
      matchNumber: 1,
      player1Id: null,
      player2Id: null,
      winner: null,
      score: null,
      completed: false,
      category,
      stage: 'playoff',
      playoffRound: 'final',
      cup: 'gold'
    });
    
    // Generate Gold Cup 3rd place match
    cupsFixtures.push({
      id: `${category}_Gold_3rdPlace`,
      round: 2,
      matchNumber: 2,
      player1Id: null,
      player2Id: null,
      winner: null,
      score: null,
      completed: false,
      category,
      stage: 'playoff',
      playoffRound: '3rdPlace',
      cup: 'gold'
    });
    
    // Generate Silver Cup final
    cupsFixtures.push({
      id: `${category}_Silver_Final`,
      round: 2,
      matchNumber: 3,
      player1Id: null,
      player2Id: null,
      winner: null,
      score: null,
      completed: false,
      category,
      stage: 'playoff',
      playoffRound: 'final',
      cup: 'silver'
    });
  }
  else if (playoffStructure === 'finalOnly') {
    // Generate Gold Cup final only (top 1 from each of 2 groups)
    cupsFixtures.push({
      id: `${category}_Gold_Final`,
      round: 1,
      matchNumber: 1,
      player1Id: null,
      player2Id: null,
      winner: null,
      score: null,
      completed: false,
      category,
      stage: 'playoff',
      playoffRound: 'final',
      cup: 'gold'
    });
    
    // Generate Gold Cup 3rd place match
    cupsFixtures.push({
      id: `${category}_Gold_3rdPlace`,
      round: 1,
      matchNumber: 2,
      player1Id: null,
      player2Id: null,
      winner: null,
      score: null,
      completed: false,
      category,
      stage: 'playoff',
      playoffRound: '3rdPlace',
      cup: 'gold'
    });
    
    // Generate Silver Cup final
    cupsFixtures.push({
      id: `${category}_Silver_Final`,
      round: 1,
      matchNumber: 3,
      player1Id: null,
      player2Id: null,
      winner: null,
      score: null,
      completed: false,
      category,
      stage: 'playoff',
      playoffRound: 'final',
      cup: 'silver'
    });
  }
  
  return cupsFixtures;
};

// For PoolPlay + Cups format, we can reuse the same Pool Play generation code,
// and then use the generateCupsFixtures function to generate the cups after pool play is complete



// Main function to generate fixtures based on tournament format
export const generateFixtures = (
  tournament: Tournament,
  format: TournamentFormat,
  minPlayers: number = 20,
  customGroupCount?: number,
  playoffStructure?: 'quarterFinals' | 'semiFinals' | 'finalOnly',
  specificCategory?: string
): TournamentFixtures => {
  if (!tournament.participants || !tournament.categories) {
    throw new Error('Tournament must have participants and categories');
  }
  
  let allFixtures: Fixture[] = [];
  let allGroups: Group[] = [];
  
  // If specificCategory is provided, only generate fixtures for that category
  // Otherwise, generate for all categories
  const categoriesToUse = specificCategory ?
    tournament.categories.filter(cat => cat === specificCategory) :
    tournament.categories;
  
  // Generate fixtures for each category
  categoriesToUse.forEach(category => {
    const categoryParticipants = tournament.participants?.filter(p => p.category === category) || [];
    console.log(`Category ${category} has ${categoryParticipants.length} registered players`);
    console.log(`Using format: ${format}, customGroupCount: ${customGroupCount}`);
    
    // Generate fixtures based on selected format
    switch (format) {
      case 'roundRobin': {
        // Ensure minimum 20 players
        const participantsWithDummies = generateDummyPlayers(categoryParticipants, category, 2, minPlayers);
        const fixtures = generateRoundRobinFixtures(participantsWithDummies, category);
        allFixtures = [...allFixtures, ...fixtures];
        break;
      }
      case 'roundRobinGroups': {
        // Ensure minimum 20 players
        const participantsWithDummies = generateDummyPlayers(categoryParticipants, category, 4, minPlayers);
        // Use custom group count if provided
        const groupCount = customGroupCount || 2;
        const { fixtures, groups } = generateRoundRobinGroupsFixtures(participantsWithDummies, category, groupCount);
        allFixtures = [...allFixtures, ...fixtures];
        allGroups = [...allGroups, ...groups];
        break;
      }
      case 'singleElimination': {
        // Ensure minimum 20 players
        const participantsWithDummies = generateDummyPlayers(categoryParticipants, category, 8, minPlayers);
        const fixtures = generateSingleEliminationFixtures(participantsWithDummies, category);
        allFixtures = [...allFixtures, ...fixtures];
        break;
      }
      case 'doubleElimination': {
        // Ensure minimum 20 players
        const participantsWithDummies = generateDummyPlayers(categoryParticipants, category, 8, minPlayers);
        const fixtures = generateDoubleEliminationFixtures(participantsWithDummies, category);
        allFixtures = [...allFixtures, ...fixtures];
        break;
      }
      case 'poolPlayPlayoffs': {
        // Ensure minimum 20 players
        const participantsWithDummies = generateDummyPlayers(categoryParticipants, category, 8, minPlayers);
        
        // Use specified playoff structure or default to quarterFinals
        const structure = playoffStructure || 'quarterFinals';
        
        // Group count parameter - use the custom count passed in from the modal
        const groupCount = customGroupCount || 2;
        
        // Generate pool play fixtures
        const { fixtures, groups } = generatePoolPlayoffFixtures(
          participantsWithDummies,
          category,
          groupCount,
          4, // playoffTeams
          structure
        );
        
        allFixtures = [...allFixtures, ...fixtures];
        allGroups = [...allGroups, ...groups];
        break;
      }
      case 'poolPlayCups': {
        // Make poolPlayCups behave exactly like poolPlayPlayoffs
        // Ensure minimum 20 players
        const participantsWithDummies = generateDummyPlayers(categoryParticipants, category, 8, minPlayers);
        
        // Use specified playoff structure or default to quarterFinals
        const structure = playoffStructure || 'quarterFinals';
        // Group count parameter - use the custom count passed in from the modal
        const groupCount = customGroupCount || 2;
        
        // Generate pool play fixtures using the same function as poolPlayPlayoffs
        const { fixtures, groups } = generatePoolPlayoffFixtures(
          participantsWithDummies,
          category,
          groupCount,
          4, // playoffTeams
          structure
        );
        
        allFixtures = [...allFixtures, ...fixtures];
        allGroups = [...allGroups, ...groups];
        break;
      }
      case 'swiss': {
        // Ensure minimum 20 players
        const participantsWithDummies = generateDummyPlayers(categoryParticipants, category, 4, minPlayers);
        const fixtures = generateSwissFixtures(participantsWithDummies, category);
        allFixtures = [...allFixtures, ...fixtures];
        break;
      }
      default:
        throw new Error(`Unsupported tournament format: ${format}`);
    }
  });
  
  return {
    format,
    fixtures: allFixtures,
    groups: allGroups.length > 0 ? allGroups : undefined
  };
};

export const getDummyPlayerName = (id: string): string => {
  if (id === 'bye') return 'Bye';
  const match = id.match(/dummy_(\d+)/);
  if (match) {
    return `Player ${Number(match[1]) + 1}`;
  }
  return 'Unknown Player';
};

// Function to calculate the total number of matches in tournament fixtures
export const calculateTotalMatches = (tournamentFixtures: TournamentFixtures): number => {
  // Count the number of actual matches (fixtures) in the tournament
  // Filter out any fixtures that are duplicates or not valid matches
  const validFixtures = tournamentFixtures.fixtures.filter(fixture => {
    // Count only fixtures that are valid matches (have either player IDs or will be determined in the future)
    return true; // We count all fixtures as they all represent potential matches
  });
  
  return validFixtures.length;
};