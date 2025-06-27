import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDocument } from '../hooks/useFirestore';
import { toast } from 'react-toastify';
import { collection, query, where, getDocs, doc, getDoc, updateDoc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import type { Tournament, TournamentParticipant, User, TournamentCategory } from '../firebase/models';
import TournamentSetupModal from '../components/tournaments/TournamentSetupModal';
import FixtureDisplay from '../components/tournaments/FixtureDisplay';
import GroupStandings from '../components/tournaments/GroupStandings';
import type { TournamentFormat, Fixture } from '../utils/fixtureUtils';
import { generateFixtures, generateRoundRobinFixtures, generatePlayoffFixtures, generateCupsFixtures } from '../utils/fixtureUtils';

export default function FacilityTournamentDetails() {
  // Debug initial render
  console.log("[Debug] Component rendering with state:", {
    isScoreModalOpen: "initializing"
  });
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { userData } = useAuth();
  const [participants, setParticipants] = useState<Array<{
    user: User | null;
    category: string;
    registrationDate: Date;
    seed?: number | null;
    userId: string;
  }>>([]);
  const [loading, setLoading] = useState(true);
  const [mainTab, setMainTab] = useState<'info' | 'tournament'>('info');
  const [activeTab, setActiveTab] = useState<string | null>(null);
  const [seeds, setSeeds] = useState<Record<string, number | null>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<{type: 'success' | 'error', text: string} | null>(null);
  const [isFixtureModalOpen, setIsFixtureModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [isGeneratingFixtures, setIsGeneratingFixtures] = useState(false);
  const [tournamentSubTab, setTournamentSubTab] = useState<'players' | 'fixtures' | 'groups' | 'matches' | 'liveView'>('players');
  const [showAddPlayerForm, setShowAddPlayerForm] = useState(false);
  const [addPlayerMode, setAddPlayerMode] = useState<'single' | 'bulk'>('single');
  const [newPlayerEmail, setNewPlayerEmail] = useState('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [bulkPlayerNames, setBulkPlayerNames] = useState('');
  const [isAddingPlayer, setIsAddingPlayer] = useState(false);
  const [draggedPlayer, setDraggedPlayer] = useState<string | null>(null);
  const [isUpdatingGroups, setIsUpdatingGroups] = useState(false);
  const [selectedFixture, setSelectedFixture] = useState<Fixture | null>(null);
  const [isScoreModalOpen, setIsScoreModalOpen] = useState(false);
  const [player1Score, setPlayer1Score] = useState('');
  const [player2Score, setPlayer2Score] = useState('');
  const [hasDuplicateFixtures, setHasDuplicateFixtures] = useState(false);
  
  // Filters for matches tab
  const [statusFilter, setStatusFilter] = useState<'all' | 'completed' | 'pending'>('all');
  const [groupFilter, setGroupFilter] = useState<string>('all');
  const [playerNameFilter, setPlayerNameFilter] = useState<string>('');
  
  const { document: tournament, loading: tournamentLoading, error: tournamentError } = useDocument<Tournament>(
    'tournaments', 
    id || ''
  );

  // Debug state changes
  useEffect(() => {
    console.log("[Debug] isScoreModalOpen state changed:", isScoreModalOpen);
  }, [isScoreModalOpen]);
  
  useEffect(() => {
    console.log("[Debug] selectedFixture state changed:", selectedFixture);
  }, [selectedFixture]);
  
  // Check for and remove duplicate playoff fixtures
  useEffect(() => {
    if (tournament?.fixtures && tournament.fixtures.length > 0 && tournament.id) {
      let hasDuplicates = false;
      const duplicateFixtureIds = new Set<string>();
      
      // Create a map to detect duplicates
      const playoffFixtureMap = new Map<string, Fixture>();
      
      // Find all playoff fixtures
      const playoffFixtures = tournament.fixtures.filter(f =>
        f.stage === 'playoff' && f.playoffRound);
      
      // Check for duplicates by playoff round and match number
      playoffFixtures.forEach(fixture => {
        if (!fixture.playoffRound) return;
        
        const key = `${fixture.category}_${fixture.playoffRound}_${fixture.matchNumber}`;
        
        if (playoffFixtureMap.has(key)) {
          // We found a duplicate
          hasDuplicates = true;
          const existingFixture = playoffFixtureMap.get(key)!;
          
          // Determine which fixture to keep - prefer those with data
          const currentHasData = fixture.player1Id || fixture.player2Id ||
                                fixture.score || fixture.completed;
          const existingHasData = existingFixture.player1Id || existingFixture.player2Id ||
                                existingFixture.score || existingFixture.completed;
          
          if (currentHasData && !existingHasData) {
            // Current fixture has data but existing doesn't - replace existing
            duplicateFixtureIds.add(existingFixture.id);
            playoffFixtureMap.set(key, fixture);
            console.log(`Found duplicate playoff fixture: ${key}, keeping newer fixture with data`);
          } else {
            // Keep existing fixture
            duplicateFixtureIds.add(fixture.id);
            console.log(`Found duplicate playoff fixture: ${key}, keeping existing fixture`);
          }
        } else {
          // No duplicate yet, add to map
          playoffFixtureMap.set(key, fixture);
        }
      });
      
      // If we found duplicates, update the tournament
      if (hasDuplicates && duplicateFixtureIds.size > 0) {
        console.log(`Found ${duplicateFixtureIds.size} duplicate playoff fixtures to remove`);
        
        // Filter out duplicates
        const updatedFixtures = tournament.fixtures.filter(f => !duplicateFixtureIds.has(f.id));
        
        // Update tournament in Firestore
        const tournamentRef = doc(db, 'tournaments', tournament.id);
        updateDoc(tournamentRef, {
          fixtures: updatedFixtures
        }).then(() => {
          console.log("Successfully removed duplicate playoff fixtures from database");
          setHasDuplicateFixtures(true);
        }).catch(error => {
          console.error("Error removing duplicate fixtures:", error);
        });
      }
    }
  }, [tournament?.fixtures, tournament?.id]);
  
  // Fetch participant details when tournament data is loaded
  useEffect(() => {
    const fetchParticipants = async () => {
      if (!tournament || !tournament.participants) {
        setParticipants([]);
        setLoading(false);
        return;
      }

      try {
        const participantsWithDetails = await Promise.all(
          tournament.participants.map(async (participant: TournamentParticipant) => {
            try {
              // Debug the participant data
              console.log('Processing participant:', participant);
              console.log('Participant userId:', participant.userId);
              
              // Fetch user directly by their user ID
              const userDocRef = doc(db, 'users', participant.userId);
              const userDocSnap = await getDoc(userDocRef);
              
              console.log('User document exists:', userDocSnap.exists());
              if (userDocSnap.exists()) {
                console.log('User data:', userDocSnap.data());
              }
              
              let userData = null;
              
              if (userDocSnap.exists()) {
                const data = userDocSnap.data();
                userData = {
                  uid: participant.userId, // Use the participant's userId directly
                  email: data.email,
                  displayName: data.displayName,
                  photoURL: data.photoURL,
                  isAdmin: data.isAdmin,
                  role: data.role,
                  createdAt: data.createdAt,
                  bookings: data.bookings
                } as User;
                
                console.log('Processed user data:', userData);
              } else {
                console.error('User document not found for ID:', participant.userId);
              }
              
              return {
                user: userData,
                category: participant.category,
                registrationDate: participant.registrationDate.toDate(),
                seed: participant.seed || null,
                userId: participant.userId
              };
            } catch (error) {
              console.error('Error fetching participant details:', error);
              return {
                user: null,
                category: participant.category,
                registrationDate: participant.registrationDate.toDate(),
                seed: participant.seed || null,
                userId: participant.userId
              };
            }
          })
        );
        
        setParticipants(participantsWithDetails);
      } catch (error) {
        console.error('Error fetching participants:', error);
      } finally {
        setLoading(false);
      }
    };

    if (!tournamentLoading && tournament) {
      fetchParticipants();
      
      // Initialize the active tab with the first category if available
      if (tournament.categories && tournament.categories.length > 0) {
        setActiveTab(tournament.categories[0]);
      }
    }
  }, [tournament, tournamentLoading]);

  // Initialize seeds state when participants are loaded
  useEffect(() => {
    const initialSeeds: Record<string, number | null> = {};
    participants.forEach(participant => {
      const key = `${participant.userId}-${participant.category}`;
      initialSeeds[key] = participant.seed === undefined ? null : participant.seed;
    });
    setSeeds(initialSeeds);
  }, [participants]);

  // Function to handle seed input change
  const handleSeedChange = (userId: string, category: string, value: string) => {
    const key = `${userId}-${category}`;
    const seedValue = value === '' ? null : parseInt(value);
    setSeeds(prev => ({
      ...prev,
      [key]: isNaN(seedValue as number) ? null : seedValue
    }));
  };

  // Function to save seeds to database
  const saveSeeds = async () => {
    if (!tournament || !tournament.id) return;
    
    setIsSaving(true);
    setSaveMessage(null);
    
    try {
      // Create updated participants array with seeds
      const updatedParticipants = tournament.participants?.map(participant => {
        const key = `${participant.userId}-${participant.category}`;
        return {
          ...participant,
          seed: seeds[key] || null
        };
      });
      
      // Update tournament document in Firestore
      const tournamentRef = doc(db, 'tournaments', tournament.id);
      await updateDoc(tournamentRef, {
        participants: updatedParticipants
      });
      
      setSaveMessage({
        type: 'success',
        text: 'Seeds saved successfully!'
      });
      
      // Update local state with new seeds
      setParticipants(prev => prev.map(participant => {
        const key = `${participant.userId}-${participant.category}`;
        return {
          ...participant,
          seed: seeds[key]
        };
      }));
    } catch (error) {
      console.error('Error saving seeds:', error);
      setSaveMessage({
        type: 'error',
        text: 'Failed to save seeds. Please try again.'
      });
    } finally {
      setIsSaving(false);
    }
  };

  // Function to add a new player to the tournament
  const handleAddPlayer = async () => {
    // Check if this is a doubles category
    const isDoublesCategory = selectedCategory && selectedCategory.toLowerCase().includes('doubles');
    
    // For non-doubles categories, email is required
    // For doubles categories, email is optional
    if (!tournament || !tournament.id || !selectedCategory || !newPlayerName ||
        (!isDoublesCategory && !newPlayerEmail)) return;
    
    setIsAddingPlayer(true);
    setSaveMessage(null);
    
    try {
      let userId;
      
      // Use the isDoublesCategory variable declared at the function start
      
      if (isDoublesCategory) {
        // For doubles teams, create a new team entry directly
        const teamUserRef = doc(collection(db, 'users'));
        await setDoc(teamUserRef, {
          email: newPlayerEmail || '',
          displayName: newPlayerName,
          createdAt: Timestamp.now(),
          role: 'player',
          isAdmin: false,
          isTeam: true,
          doubleTeam: true,
          // Parse team name to extract player names if in format "Player1 / Player2"
          playerNames: newPlayerName.includes('/') ?
            newPlayerName.split('/').map(name => name.trim()) :
            [newPlayerName]
        });
        
        userId = teamUserRef.id;
      } else {
        // For single players, use the original logic
        // Check if the user already exists
        const userQuerySnapshot = await getDocs(
          query(collection(db, 'users'), where('email', '==', newPlayerEmail))
        );
        
        // If user doesn't exist, create a new one
        if (userQuerySnapshot.empty) {
          // Create a new user in the users collection
          const newUserRef = doc(collection(db, 'users'));
          await setDoc(newUserRef, {
            email: newPlayerEmail,
            displayName: newPlayerName,
            createdAt: Timestamp.now(),
            role: 'player',
            isAdmin: false
          });
          
          userId = newUserRef.id;
        } else {
          // Use existing user
          userId = userQuerySnapshot.docs[0].id;
        }
      }
      
      // Add the user to tournament participants
      const newParticipant = {
        userId,
        category: selectedCategory,
        registrationDate: Timestamp.now(),
        seed: null,
        // Add doubles team properties if applicable
        ...(isDoublesCategory && {
          isDoublesTeam: true,
          teamMembers: newPlayerName.includes('/') ?
            newPlayerName.split('/').map(name => name.trim()) :
            [newPlayerName]
        })
      };
      
      const updatedParticipants = [...(tournament.participants || []), newParticipant];
      
      // Update tournament document in Firestore
      const tournamentRef = doc(db, 'tournaments', tournament.id);
      await updateDoc(tournamentRef, {
        participants: updatedParticipants,
        currentParticipants: (tournament.currentParticipants || 0) + 1
      });
      
      setSaveMessage({
        type: 'success',
        text: 'Player added successfully!'
      });
      
      // Clear form
      setNewPlayerEmail('');
      setNewPlayerName('');
      
      // Refresh participants list
      const userDocRef = doc(db, 'users', userId);
      const userDocSnap = await getDoc(userDocRef);
      
      let userData = null;
      if (userDocSnap.exists()) {
        const data = userDocSnap.data();
        userData = {
          uid: userId,
          email: data.email,
          displayName: data.displayName,
          photoURL: data.photoURL,
          isAdmin: data.isAdmin,
          role: data.role,
          createdAt: data.createdAt,
          bookings: data.bookings
        } as User;
        
        // Add doubles team specific properties if applicable
        if (data.isTeam) {
          userData = {
            ...userData,
            isTeam: true,
            doubleTeam: data.doubleTeam,
            playerNames: data.playerNames
          };
        }
      }
      
      // Use the isDoublesCategory variable from the top of the function
      
      // Add new participant to local state
      setParticipants([
        ...participants,
        {
          user: userData,
          category: selectedCategory,
          registrationDate: Timestamp.now().toDate(),
          seed: null,
          userId,
          // Add doubles team properties if applicable
          ...(isDoublesCategory && {
            isDoublesTeam: true,
            teamMembers: newPlayerName.includes('/') ?
              newPlayerName.split('/').map(name => name.trim()) :
              [newPlayerName]
          })
        }
      ]);
      
    } catch (error) {
      console.error('Error adding player:', error);
      setSaveMessage({
        type: 'error',
        text: 'Failed to add player. Please try again.'
      });
    } finally {
      setIsAddingPlayer(false);
    }
  };
  
  // Function to handle bulk adding players
  const handleBulkAddPlayers = async () => {
    if (!tournament || !tournament.id || !selectedCategory || !bulkPlayerNames.trim()) return;
    
    setIsAddingPlayer(true);
    setSaveMessage(null);
    
    try {
      const isDoublesCategory = selectedCategory.toLowerCase().includes('doubles');
      const newParticipants = [];
      const newLocalParticipants = [];
      
      if (isDoublesCategory) {
        // For doubles categories, handle team format
        // Split input by empty lines to get teams
        const teams = bulkPlayerNames
          .split('\n\n')
          .map(team => team.trim())
          .filter(team => team.length > 0);
        
        if (teams.length === 0) {
          setSaveMessage({
            type: 'error',
            text: 'Please enter at least one team (two players separated by a line break).'
          });
          setIsAddingPlayer(false);
          return;
        }
        
        // Process each team as a single entry
        for (let teamIndex = 0; teamIndex < teams.length; teamIndex++) {
          const team = teams[teamIndex];
          
          // Split team by newlines to get individual players
          const playerNames = team
            .split('\n')
            .map(name => name.trim())
            .filter(name => name.length > 0);
          
          // Check if we have exactly 2 players for doubles
          if (playerNames.length !== 2) {
            setSaveMessage({
              type: 'error',
              text: `Each team must have exactly 2 players. Team "${team}" has ${playerNames.length} player(s).`
            });
            setIsAddingPlayer(false);
            return;
          }
          
          // Create a combined team name
          const teamName = `${playerNames[0]} / ${playerNames[1]}`;
          const teamId = `team_${Date.now()}_${teamIndex}`;
          
          // Create a team entry in users collection
          const teamUserRef = doc(collection(db, 'users'));
          await setDoc(teamUserRef, {
            displayName: teamName,
            email: '',
            createdAt: Timestamp.now(),
            role: 'player',
            isAdmin: false,
            isTeam: true,
            playerNames: playerNames,
            doubleTeam: true
          });
          
          // Create participant entry for the team
          newParticipants.push({
            userId: teamUserRef.id,
            category: selectedCategory,
            registrationDate: Timestamp.now(),
            seed: null,
            isDoublesTeam: true,
            teamMembers: playerNames
          });
          
          // Create local participant entry
          newLocalParticipants.push({
            user: {
              uid: teamUserRef.id,
              displayName: teamName,
              email: '',
              photoURL: null,
              isAdmin: false,
              role: 'player',
              createdAt: Timestamp.now(),
              isTeam: true,
              playerNames: playerNames,
              doubleTeam: true
            } as User,
            category: selectedCategory,
            registrationDate: Timestamp.now().toDate(),
            seed: null,
            userId: teamUserRef.id,
            isDoublesTeam: true,
            teamMembers: playerNames
          });
        }
        
        setSaveMessage({
          type: 'success',
          text: `Added ${teams.length} doubles teams successfully!`
        });
      } else {
        // For singles categories, use original implementation
        // Split the input by new lines to get each player name
        const playerNames = bulkPlayerNames
          .split('\n')
          .map(name => name.trim())
          .filter(name => name.length > 0);
        
        if (playerNames.length === 0) {
          setSaveMessage({
            type: 'error',
            text: 'Please enter at least one player name.'
          });
          setIsAddingPlayer(false);
          return;
        }
        
        // Process each player
        for (const playerName of playerNames) {
          // Create a new user in the users collection
          const newUserRef = doc(collection(db, 'users'));
          await setDoc(newUserRef, {
            displayName: playerName,
            email: '', // Email is optional
            createdAt: Timestamp.now(),
            role: 'player',
            isAdmin: false
          });
          
          const userId = newUserRef.id;
          
          // Create participant entry
          newParticipants.push({
            userId,
            category: selectedCategory,
            registrationDate: Timestamp.now(),
            seed: null
          });
          
          // Create local participant entry
          newLocalParticipants.push({
            user: {
              uid: userId,
              displayName: playerName,
              email: '',
              photoURL: null,
              isAdmin: false,
              role: 'player',
              createdAt: Timestamp.now(),
            } as User,
            category: selectedCategory,
            registrationDate: Timestamp.now().toDate(),
            seed: null,
            userId
          });
        }
        
        setSaveMessage({
          type: 'success',
          text: `Added ${playerNames.length} players successfully!`
        });
      }
      
      // Update tournament document in Firestore
      const updatedParticipants = [...(tournament.participants || []), ...newParticipants];
      const tournamentRef = doc(db, 'tournaments', tournament.id);
      await updateDoc(tournamentRef, {
        participants: updatedParticipants,
        currentParticipants: (tournament.currentParticipants || 0) + newParticipants.length
      });
      
      // Update local state
      setParticipants([...participants, ...newLocalParticipants]);
      
      // Clear form
      setBulkPlayerNames('');
      
    } catch (error) {
      console.error('Error bulk adding players:', error);
      setSaveMessage({
        type: 'error',
        text: 'Failed to add players. Please try again.'
      });
    } finally {
      setIsAddingPlayer(false);
    }
  };
  
  // Function to delete a player from the tournament
  const handleDeletePlayer = async (userId: string, category: string) => {
    if (!tournament || !tournament.id) return;
    
    setIsSaving(true);
    setSaveMessage(null);
    
    try {
      // Filter out the participant to be deleted
      const updatedParticipants = tournament.participants?.filter(
        participant => !(participant.userId === userId && participant.category === category)
      ) || [];
      
      // Update tournament document in Firestore
      const tournamentRef = doc(db, 'tournaments', tournament.id);
      await updateDoc(tournamentRef, {
        participants: updatedParticipants,
        currentParticipants: (tournament.currentParticipants || 0) - 1
      });
      
      // Update local state
      setParticipants(prevParticipants =>
        prevParticipants.filter(p => !(p.userId === userId && p.category === category))
      );
      
      setSaveMessage({
        type: 'success',
        text: 'Player removed successfully!'
      });
    } catch (error) {
      console.error('Error removing player:', error);
      setSaveMessage({
        type: 'error',
        text: 'Failed to remove player. Please try again.'
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  // Function to handle fixture generation
  const handleGenerateFixtures = async (
    format: TournamentFormat,
    category: string,
    playersPerCategory: number = 20,
    groupSize?: number,
    matchFrequency?: number = 1,
    playoffStructure?: 'quarterFinals' | 'semiFinals' | 'finalOnly'
  ) => {
    if (!tournament || !tournament.id) return;
    
    setIsGeneratingFixtures(true);
    setSaveMessage(null);
    
    try {
      // Generate fixtures based on the selected format with specified parameters
      // Calculate the number of groups to create
      console.log(`Generating fixtures for ${category} with ${playersPerCategory} players, ${groupSize} per group`);
      
      // Use group size for all categories including doubles
      const useGroupSize = (format === 'roundRobinGroups' || format === 'poolPlayPlayoffs' || format === 'poolPlayCups') && groupSize;
                          
      // First, check if the tournament already has playoff fixtures for this category
      const existingFixtures = tournament.fixtures || [];
      const existingGroups = tournament.fixtureGroups || [];
      
      // Specifically identify QF, SF, and Final fixtures by playoffRound
      const existingQFFixtures = existingFixtures.filter(f =>
        f.category === category && f.playoffRound === 'quarterFinal');
      
      const existingSFFixtures = existingFixtures.filter(f =>
        f.category === category && f.playoffRound === 'semiFinal');
      
      const existingFinalFixtures = existingFixtures.filter(f =>
        f.category === category && (f.playoffRound === 'final' || f.playoffRound === '3rdPlace'));
      
      // Check if any playoff fixtures exist
      const hasPlayoffFixtures = existingQFFixtures.length > 0 ||
                                existingSFFixtures.length > 0 ||
                                existingFinalFixtures.length > 0;
      
      // If there are playoff fixtures, we need to preserve them and only generate pool fixtures
      if (hasPlayoffFixtures) {
        console.log("Preserving existing playoff fixtures for category:", category);
        
        // Get all fixtures for other categories
        const otherCategoryFixtures = existingFixtures.filter(f => f.category !== category);
        
        // Get all existing playoff fixtures for this category
        const existingPlayoffFixtures = [...existingQFFixtures, ...existingSFFixtures, ...existingFinalFixtures];
        
        // Generate new pool fixtures for this category (but not playoff fixtures)
        console.log(`Using group size: ${useGroupSize}, Group size: ${groupSize}`);
        
        const poolFixtures = useGroupSize
          ? generateFixtures(tournament, format, playersPerCategory, groupSize, undefined, category)
          : generateFixtures(tournament, format, playersPerCategory, undefined, undefined, category);
        
        console.log(`Generated ${poolFixtures.groups?.length} groups`);
        
        // Get only the pool fixtures (not playoff)
        const newPoolFixtures = poolFixtures.fixtures.filter(f =>
          f.stage !== 'playoff' && !f.playoffRound);
        
        // Combine: other categories + existing playoffs + new pool
        const allFixtures = [
          ...otherCategoryFixtures,
          ...existingPlayoffFixtures,
          ...newPoolFixtures
        ];
        
        // Get groups for other categories
        const otherCategoryGroups = existingGroups.filter(g => g.category !== category);
        
        // Combine with new groups
        const allGroups = [...otherCategoryGroups, ...(poolFixtures.groups || [])];
        
        // Create or update the fixture formats map
        const fixtureFormats = tournament.fixtureFormats || {};
        fixtureFormats[category] = {
          format,
          playersPerCategory,
          groupSize,
          matchFrequency: matchFrequency || 1,
          playoffStructure
        };
        
        // Update tournament document in Firestore
        const tournamentRef = doc(db, 'tournaments', tournament.id);
        await updateDoc(tournamentRef, {
          fixtures: allFixtures,
          fixtureGroups: allGroups,
          fixtureFormats: fixtureFormats,
          fixturesGenerated: true
        });
        
        setSaveMessage({
          type: 'success',
          text: 'Pool fixtures regenerated while preserving playoff fixtures!'
        });
        
        // Close the modal
        setIsFixtureModalOpen(false);
        return;
      }
      
      // If no playoff fixtures exist, proceed with normal fixture generation
      console.log(`Using group size: ${useGroupSize}, Group size: ${groupSize}`);
      
      const tournamentFixtures = useGroupSize
        ? generateFixtures(tournament, format, playersPerCategory, groupSize, playoffStructure, category)
        : generateFixtures(tournament, format, playersPerCategory, undefined, playoffStructure, category);
      
      console.log(`Generated ${tournamentFixtures.groups?.length} groups`);
      
      // Filter out any existing fixtures for the current category
      const otherCategoryFixtures = existingFixtures.filter(f => f.category !== category);
      const otherCategoryGroups = existingGroups.filter(g => g.category !== category);
      
      // Combine with new fixtures
      const allFixtures = [...otherCategoryFixtures, ...tournamentFixtures.fixtures];
      const allGroups = [...otherCategoryGroups, ...(tournamentFixtures.groups || [])];
      
      // Create or update the fixture formats map
      const fixtureFormats = tournament.fixtureFormats || {};
      fixtureFormats[category] = {
        format,
        playersPerCategory,
        groupSize,
        matchFrequency: matchFrequency || 1,
        playoffStructure
      };
      
      // Update tournament document in Firestore
      const tournamentRef = doc(db, 'tournaments', tournament.id);
      await updateDoc(tournamentRef, {
        fixtures: allFixtures,
        fixtureGroups: allGroups,
        fixtureFormats: fixtureFormats,
        fixturesGenerated: true
      });
      
      setSaveMessage({
        type: 'success',
        text: 'Fixtures generated successfully!'
      });
      
      // Close the modal
      setIsFixtureModalOpen(false);
    } catch (error) {
      console.error('Error generating fixtures:', error);
      setSaveMessage({
        type: 'error',
        text: 'Failed to generate fixtures. Please try again.'
      });
    } finally {
      setIsGeneratingFixtures(false);
    }
  };
  
  // Function to add playoff fixtures after pool play is complete
  const handleAddPlayoffFixtures = async (newFixtures: Fixture[]) => {
    if (!id || !tournament) return;
    
    setIsSaving(true);
    setSaveMessage(null);
    
    try {
      // Get the category from the first new fixture (all new fixtures should be same category)
      const category = newFixtures[0]?.category;
      
      if (!category) {
        throw new Error('No category found in playoff fixtures');
      }
      
      // Filter out any existing playoff fixtures for this category to avoid duplicates
      const existingFixtures = tournament.fixtures || [];
      const nonPlayoffFixturesForCategory = existingFixtures.filter(
        f => !(f.category === category && f.stage === 'playoff')
      );
      
      // Combine existing fixtures with new playoff fixtures
      const updatedFixtures = [
        ...nonPlayoffFixturesForCategory,
        ...newFixtures
      ];
      
      // Update tournament with new fixtures
      const tournamentRef = doc(db, 'tournaments', id);
      await updateDoc(tournamentRef, {
        fixtures: updatedFixtures
      });
      
      setSaveMessage({
        type: 'success',
        text: 'Playoff fixtures generated successfully!'
      });
    } catch (error) {
      console.error('Error adding playoff fixtures:', error);
      setSaveMessage({
        type: 'error',
        text: 'Failed to add playoff fixtures. Please try again.'
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  // Function to update a fixture
  const handleUpdateFixture = async (updatedFixture: Fixture) => {
    if (!tournament || !tournament.id || !tournament.fixtures) return;
    
    setIsSaving(true);
    setSaveMessage(null);
    
    try {
      // Create updated fixtures array
      const updatedFixtures = tournament.fixtures.map(fixture =>
        fixture.id === updatedFixture.id ? updatedFixture : fixture
      );
      
      // Update tournament document in Firestore
      const tournamentRef = doc(db, 'tournaments', tournament.id);
      await updateDoc(tournamentRef, {
        fixtures: updatedFixtures
      });
      
      setSaveMessage({
        type: 'success',
        text: 'Fixture updated successfully!'
      });
    } catch (error) {
      console.error('Error updating fixture:', error);
      setSaveMessage({
        type: 'error',
        text: 'Failed to update fixture. Please try again.'
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  // Function to handle saving match scores
  const handleSaveScore = async () => {
    if (!tournament || !tournament.id || !selectedFixture || !player1Score || !player2Score) return;
    
    setIsSaving(true);
    
    try {
      // Create updated fixture with score and completed status
      const updatedFixture: Fixture = {
        ...selectedFixture,
        score: `${player1Score}-${player2Score}`,
        completed: true,
        winner: parseInt(player1Score) > parseInt(player2Score)
          ? selectedFixture.player1Id
          : selectedFixture.player2Id
      };
      
      // Update the fixture
      let allFixtures = [...(tournament.fixtures || [])];
      const fixtureIndex = allFixtures.findIndex(f => f.id === updatedFixture.id);
      if (fixtureIndex !== -1) {
        allFixtures[fixtureIndex] = updatedFixture;
      }
      
      // Log all fixture match numbers to debug
      console.log('All fixture match numbers (initial):');
      const initialMatchNumbers = allFixtures
        .filter(f => f.stage === 'playoff')
        .map(f => ({
          id: f.id,
          matchNumber: f.matchNumber,
          playoffRound: f.playoffRound,
          cup: f.cup,
          category: f.category
        }));
      console.log(initialMatchNumbers);
      
      // If this is a playoff match, update the next round fixture with the winner
      if (updatedFixture.stage === 'playoff') {
        const winner = updatedFixture.winner;
        
        // Find the next fixture that this winner advances to
        if (updatedFixture.playoffRound === 'quarterFinal') {
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
        
        // Semifinal winners go to final, losers go to 3rd place match
        else if (updatedFixture.playoffRound === 'semiFinal') {
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
      }
      
      // Update tournament with all fixtures
      const tournamentRef = doc(db, 'tournaments', tournament.id);
      
      console.log('About to update tournament with fixtures. Checking semifinals:');
      // Debug log to check if semifinal matches have been updated before saving
      const goldSemis = allFixtures.filter(f => f.stage === 'playoff' && f.playoffRound === 'semiFinal' && f.cup === 'gold');
      console.log('Gold Cup semifinals:', goldSemis);
      
      const silverSemis = allFixtures.filter(f => f.stage === 'playoff' && f.playoffRound === 'semiFinal' && f.cup === 'silver');
      console.log('Silver Cup semifinals:', silverSemis);
      
      // Try alternative ways to find semifinals that might have different properties
      const altSemis = allFixtures.filter(f =>
        f.stage === 'playoff' &&
        f.playoffRound === 'semiFinal'
      );
      console.log('All semifinals (ignoring cup):', altSemis);
      
      // Look for semifinals based on their match numbers only
      const semifinalsByNumber = allFixtures.filter(f =>
        f.matchNumber === 49 ||
        f.matchNumber === 50 ||
        f.matchNumber === 51 ||
        f.matchNumber === 52
      );
      console.log('Matches with semifinal numbers 49-52:', semifinalsByNumber);
      
      // Let's log all fixture match numbers to debug
      console.log('All fixture match numbers (with players):');
      const detailedMatchNumbers = allFixtures
        .filter(f => f.stage === 'playoff')
        .map(f => ({
          id: f.id,
          matchNumber: f.matchNumber,
          playoffRound: f.playoffRound,
          cup: f.cup,
          category: f.category,
          player1Id: f.player1Id,
          player2Id: f.player2Id
        }));
      console.log(detailedMatchNumbers);
      
      // Try updating the semifinal fixtures directly using index instead of find
      // Try for ALL semifinal matches
      // Gold Cup SF1
      const goldSF1 = allFixtures.findIndex(f =>
        f.stage === 'playoff' &&
        f.playoffRound === 'semiFinal' &&
        f.matchNumber === 49 &&
        f.cup === 'gold'
      );
      
      if (goldSF1 !== -1) {
        console.log(`Found Gold Cup SF1 at index ${goldSF1}, updating directly`);
        // Find winners from QF1 and QF2
        const qf1Winner = allFixtures.find(f => f.matchNumber === 41 && f.cup === 'gold')?.winner;
        const qf2Winner = allFixtures.find(f => f.matchNumber === 42 && f.cup === 'gold')?.winner;
        
        if (qf1Winner) {
          allFixtures[goldSF1].player1Id = qf1Winner;
          console.log(`Set player1Id of Gold SF1 to ${qf1Winner}`);
        }
        
        if (qf2Winner) {
          allFixtures[goldSF1].player2Id = qf2Winner;
          console.log(`Set player2Id of Gold SF1 to ${qf2Winner}`);
        }
      }
      
      // Gold Cup SF2
      const goldSF2 = allFixtures.findIndex(f =>
        f.stage === 'playoff' &&
        f.playoffRound === 'semiFinal' &&
        f.matchNumber === 50 &&
        f.cup === 'gold'
      );
      
      if (goldSF2 !== -1) {
        console.log(`Found Gold Cup SF2 at index ${goldSF2}, updating directly`);
        // Find winners from QF3 and QF4
        const qf3Winner = allFixtures.find(f => f.matchNumber === 43 && f.cup === 'gold')?.winner;
        const qf4Winner = allFixtures.find(f => f.matchNumber === 44 && f.cup === 'gold')?.winner;
        
        if (qf3Winner) {
          allFixtures[goldSF2].player1Id = qf3Winner;
          console.log(`Set player1Id of Gold SF2 to ${qf3Winner}`);
        }
        
        if (qf4Winner) {
          allFixtures[goldSF2].player2Id = qf4Winner;
          console.log(`Set player2Id of Gold SF2 to ${qf4Winner}`);
        }
      }
      
      // Silver Cup SF1
      const silverSF1 = allFixtures.findIndex(f =>
        f.stage === 'playoff' &&
        f.playoffRound === 'semiFinal' &&
        f.matchNumber === 51 &&
        f.cup === 'silver'
      );
      
      if (silverSF1 !== -1) {
        console.log(`Found Silver Cup SF1 at index ${silverSF1}, updating directly`);
        // Find winners from QF1 and QF2
        const silverQf1Winner = allFixtures.find(f => f.matchNumber === 45 && f.cup === 'silver')?.winner;
        const silverQf2Winner = allFixtures.find(f => f.matchNumber === 46 && f.cup === 'silver')?.winner;
        
        if (silverQf1Winner) {
          allFixtures[silverSF1].player1Id = silverQf1Winner;
          console.log(`Set player1Id of Silver SF1 to ${silverQf1Winner}`);
        }
        
        if (silverQf2Winner) {
          allFixtures[silverSF1].player2Id = silverQf2Winner;
          console.log(`Set player2Id of Silver SF1 to ${silverQf2Winner}`);
        }
      }
      
      // Silver Cup SF2
      const silverSF2 = allFixtures.findIndex(f =>
        f.stage === 'playoff' &&
        f.playoffRound === 'semiFinal' &&
        f.matchNumber === 52 &&
        f.cup === 'silver'
      );
      
      if (silverSF2 !== -1) {
        console.log(`Found Silver Cup SF2 at index ${silverSF2}, updating directly`);
        // Find winners from QF3 and QF4
        const silverQf3Winner = allFixtures.find(f => f.matchNumber === 47 && f.cup === 'silver')?.winner;
        const silverQf4Winner = allFixtures.find(f => f.matchNumber === 48 && f.cup === 'silver')?.winner;
        
        if (silverQf3Winner) {
          allFixtures[silverSF2].player1Id = silverQf3Winner;
          console.log(`Set player1Id of Silver SF2 to ${silverQf3Winner}`);
        }
        
        if (silverQf4Winner) {
          allFixtures[silverSF2].player2Id = silverQf4Winner;
          console.log(`Set player2Id of Silver SF2 to ${silverQf4Winner}`);
        }
      }
      
      await updateDoc(tournamentRef, {
        fixtures: allFixtures
      });
      
      console.log('Tournament fixtures updated in Firestore');
      
      // Show toast notification about advancement
      if (updatedFixture.winner) {
        const fixture = updatedFixture;
        const winner = getParticipantName(fixture.winner);
        const cupType = fixture.cup === 'gold' ? 'Gold Cup' : 'Silver Cup';
        const roundName = fixture.playoffRound === 'quarterFinal' ? 'Quarterfinals' :
                         (fixture.playoffRound === 'semiFinal' ? 'Semifinals' :
                         (fixture.playoffRound === 'final' ? 'Finals' : fixture.playoffRound));
        
        if (fixture.playoffRound !== 'final' && fixture.playoffRound !== '3rdPlace') {
          toast.success(`${winner} has advanced to the ${cupType} ${roundName === 'Quarterfinals' ? 'Semifinals' : 'Finals'}`);
        } else if (fixture.playoffRound === 'final') {
          toast.success(`${winner} is the ${cupType} Champion! 🏆`, {
            autoClose: 5000,
            icon: "🏆"
          });
        }
      }
      
      // Close the modal
      setIsScoreModalOpen(false);
      setSelectedFixture(null);
      
      setSaveMessage({
        type: 'success',
        text: 'Score saved and brackets updated successfully!'
      });
    } catch (error) {
      console.error('Error saving match score:', error);
      setSaveMessage({
        type: 'error',
        text: 'Failed to save match score. Please try again.'
      });
    } finally {
      setIsSaving(false);
    }
  };
  
  // Check if all tournament matches are completed (including playoffs and finals)
  const areAllMatchesCompleted = (): boolean => {
    // If there are no fixtures, return false
    if (!tournament?.fixtures || tournament.fixtures.length === 0) {
      return false;
    }
    
    // Check if all fixtures are completed
    return tournament.fixtures.every(fixture => fixture.completed);
  };
  
  // Function to export match data for DUPR
  const handleExportForDupr = () => {
    if (!tournament?.fixtures || tournament.fixtures.length === 0) {
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
        const team1Player2 = findPartnerName(player1) || "Partner";
        const team1Player2DuprId = findPartnerDuprId(player1) || "";
        
        const team2Player1 = player2Name;
        const team2Player1DuprId = player2DuprId;
        const team2Player2 = findPartnerName(player2) || "Partner";
        const team2Player2DuprId = findPartnerDuprId(player2) || "";
        
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
  const findPartnerName = (player: any): string => {
    // Check if the player has team information
    if (player.user?.doubleTeam && player.user?.playerNames && player.user?.playerNames.length > 1) {
      // If this is player1, return player2 name
      if (player.user.playerNames[0] === player.user.displayName) {
        return player.user.playerNames[1];
      } else {
        return player.user.playerNames[0];
      }
    }
    
    // If no team information, return a placeholder
    return "Partner";
  };
  
  // Helper function to find a partner's DUPR ID for doubles matches
  const findPartnerDuprId = (player: any): string => {
    // In a real implementation, you would look up the partner's DUPR ID
    return "";
  };
  
  // Helper function to get participant name (similar to what's in FixtureDisplay)
  const getParticipantName = (userId: string | null): string => {
    if (!userId) return 'TBD';
    
    const participant = participants.find(p => p.userId === userId);
    return participant?.user?.displayName || 'Unknown Player';
  };
  
  // Function to handle moving a player to a different group
  const handleMovePlayerToGroup = async (playerId: string, targetGroupId: string) => {
    if (!tournament || !tournament.id || !tournament.fixtureGroups) return;
    
    // Find current group of the player
    const currentGroup = tournament.fixtureGroups.find(g =>
      g.playerIds && g.playerIds.includes(playerId)
    );
    
    // If player is already in the target group, do nothing
    if (currentGroup?.id === targetGroupId) return;
    
    // If no current group found, do nothing
    if (!currentGroup) return;
    
    setIsUpdatingGroups(true);
    setSaveMessage(null);
    
    try {
      // Create updated fixture groups
      const updatedGroups = tournament.fixtureGroups.map(group => {
        if (group.id === currentGroup.id) {
          // Remove player from current group
          return {
            ...group,
            playerIds: group.playerIds.filter(id => id !== playerId)
          };
        } else if (group.id === targetGroupId) {
          // Add player to target group
          return {
            ...group,
            playerIds: [...group.playerIds, playerId]
          };
        }
        return group;
      });
      
      // Update the tournament's fixture groups in Firestore
      const tournamentRef = doc(db, 'tournaments', tournament.id);
      
      // First update the groups
      await updateDoc(tournamentRef, {
        fixtureGroups: updatedGroups
      });
      
      // Now regenerate fixtures for the affected category
      const category = currentGroup.category;
      
      // Get the tournament format for this category
      const format = tournament.fixtureFormats?.[category]?.format || 'roundRobinGroups';
      const groupCount = tournament.fixtureFormats?.[category]?.groupSize || 2;
      const playoffStructure = tournament.fixtureFormats?.[category]?.playoffStructure;
      
      // Filter out fixtures for this category
      const otherCategoryFixtures = tournament.fixtures?.filter(f => f.category !== category) || [];
      
      // Generate new fixtures for this category
      const categoryParticipants = tournament.participants?.filter(p => p.category === category) || [];
      
      // For round robin groups, we need to generate new fixtures
      if (format === 'roundRobinGroups' || format === 'poolPlayPlayoffs') {
        // Create new fixtures for each group based on updated group membership
        let newFixtures: Fixture[] = [];
        
        updatedGroups.filter(g => g.category === category).forEach(group => {
          const groupParticipants = group.playerIds.map(id => {
            const participant = categoryParticipants.find(p => p.userId === id);
            return participant || {
              userId: id,
              category: category as any,
              registrationDate: Timestamp.now(),
              seed: null
            };
          });
          
          const roundRobinFixtures = generateRoundRobinFixtures(groupParticipants, category);
          
          // Create properly typed fixtures
          const groupFixtures: Fixture[] = roundRobinFixtures.map(fixture => ({
            ...fixture,
            id: `${group.id}_${fixture.id}`,
            group: group.id,
            stage: 'pool' as 'pool' | 'playoff'
          }));
            
          newFixtures = [...newFixtures, ...groupFixtures];
        });
        
        // Combine with fixtures from other categories
        const allFixtures = [...otherCategoryFixtures, ...newFixtures];
        
        // Update tournament with new fixtures
        await updateDoc(tournamentRef, {
          fixtures: allFixtures
        });
      }
      
      setSaveMessage({
        type: 'success',
        text: 'Player moved and fixtures updated successfully!'
      });
    } catch (error) {
      console.error('Error moving player between groups:', error);
      setSaveMessage({
        type: 'error',
        text: 'Failed to move player. Please try again.'
      });
    } finally {
      setIsUpdatingGroups(false);
    }
  };

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

  // Check if current user is allowed to view this page
  if (userData?.role !== 'facility_manager' && !userData?.isAdmin) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        You don't have permission to view this page.
      </div>
    );
  }

  if (tournamentLoading || loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-gray-600">Loading tournament details...</p>
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

      {/* Main Tabs */}
      <div className="border-b border-white/30 mb-6">
        <nav className="-mb-px flex space-x-8">
          <button
            onClick={() => setMainTab('info')}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${
              mainTab === 'info'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-white/50'
            }`}
          >
            Information
          </button>
          <button
            onClick={() => setMainTab('tournament')}
            className={`py-3 px-1 border-b-2 font-medium text-sm ${
              mainTab === 'tournament'
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-white/50'
            }`}
          >
            Tournament
          </button>
        </nav>
      </div>

      {mainTab === 'info' && (
        <div className="glass-card overflow-hidden mb-8">
        <img
          src={tournament.imageURLs && tournament.imageURLs.length > 0
            ? tournament.imageURLs[0]
            : "https://i.pinimg.com/736x/04/eb/c9/04ebc9b1bef4862c0eb2fc4cbc98b8ae.jpg"}
          alt={tournament.name}
          className="w-full h-64 object-cover"
        />

        <div className="p-6 backdrop-blur-sm">
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
                <li className="flex justify-between">
                  <span className="text-gray-600">Participants:</span>
                  <span className="font-medium">
                    {tournament.currentParticipants} / {tournament.maxParticipants}
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
                    className="px-3 py-1 rounded-full text-sm bg-blue-100 text-blue-800"
                  >
                    {category}
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="text-gray-800 mb-6">
            <p>{tournament.description}</p>
          </div>
        </div>
      </div>
      )}

      {mainTab === 'info' && (
        <div className="glass-card overflow-hidden">
        <div className="p-6 backdrop-blur-sm">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Registered Participants</h2>
            <div className="flex space-x-4">
              <div className="flex items-center">
                <select
                  value={selectedCategory || ''}
                  onChange={(e) => setSelectedCategory(e.target.value || null)}
                  className="mr-2 px-3 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">Select Category</option>
                  {tournament.categories?.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
                <button
                  onClick={() => setIsFixtureModalOpen(true)}
                  className="px-4 py-2 rounded-md text-white bg-blue-600/80 hover:bg-blue-700/90 backdrop-blur-sm mr-2"
                  disabled={isGeneratingFixtures || !selectedCategory}
                >
                  Generate Fixtures
                </button>
              </div>
              
              <button
                onClick={saveSeeds}
                disabled={isSaving}
                className={`px-4 py-2 rounded-md text-white backdrop-blur-sm ${isSaving ? 'bg-gray-400/80' : 'bg-green-600/80 hover:bg-green-700/90'}`}
              >
                {isSaving ? 'Saving...' : 'Save Seeds'}
              </button>
            </div>
          </div>
          
          {saveMessage && (
            <div className={`mb-4 p-3 rounded-md backdrop-blur-sm ${saveMessage.type === 'success' ? 'bg-green-100/70 text-green-800' : 'bg-red-100/70 text-red-800'}`}>
              {saveMessage.text}
            </div>
          )}
          
          {participants.length === 0 ? (
            <div className="text-center py-8 bg-white/10 backdrop-blur-sm rounded-lg">
              <p className="text-gray-600">No participants have registered yet.</p>
            </div>
          ) : tournament?.categories && tournament.categories.length > 0 ? (
            <>
              {/* Tabs navigation */}
              <div className="border-b border-white/30 mb-4">
                <nav className="-mb-px flex space-x-6">
                  {tournament.categories.map((category) => (
                    <button
                      key={category}
                      onClick={() => setActiveTab(category)}
                      className={`py-3 px-1 border-b-2 font-medium text-sm ${
                        activeTab === category
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-white/50'
                      }`}
                    >
                      {category}
                    </button>
                  ))}
                </nav>
              </div>
              
              {/* Tab content */}
              {activeTab && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-white/30">
                      <tr>
                        <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Seed
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Registration Date
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white/20 backdrop-blur-sm divide-y divide-gray-200/40">
                      {participants
                        .filter(p => p.category === activeTab)
                        .map((participant, index) => {
                          const seedKey = `${participant.userId}-${participant.category}`;
                          return (
                            <tr key={index}>
                              <td className="px-4 py-4 whitespace-nowrap">
                                <input
                                  type="number"
                                  min="1"
                                  value={seeds[seedKey] === null ? '' : seeds[seedKey] || ''}
                                  onChange={(e) => handleSeedChange(participant.userId, participant.category, e.target.value)}
                                  className="w-16 p-1 border border-gray-300 rounded-md text-center"
                                  placeholder="#"
                                />
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="flex items-center">
                                  {participant.user?.photoURL ? (
                                    <img className="h-10 w-10 rounded-full mr-3" src={participant.user.photoURL} alt="" />
                                  ) : (
                                    <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center mr-3">
                                      <span className="text-gray-500 text-sm">
                                        {participant.user?.displayName?.charAt(0) || 'U'}
                                      </span>
                                    </div>
                                  )}
                                  <div>
                                    <div className="text-sm font-medium text-gray-900">
                                      {participant.user?.displayName || 'Unknown User'}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap">
                                <div className="text-sm text-gray-900">{participant.user?.email || 'N/A'}</div>
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                {participant.registrationDate.toLocaleString()}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                <button
                                  onClick={() => handleDeletePlayer(participant.userId, participant.category)}
                                  className="text-red-500 hover:text-red-700"
                                  aria-label="Delete player"
                                >
                                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                  </svg>
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-600">No tournament categories have been defined.</p>
            </div>
          )}
        </div>
      </div>
      )}
      
      {mainTab === 'tournament' && (
        <div className="glass-card overflow-hidden">
          <div className="p-6 backdrop-blur-sm">
            <div className="mb-6">
              <h2 className="text-2xl font-bold text-gray-800">Tournament Management</h2>
            </div>
            <div className="flex flex-col mb-6">
              
              {/* Category Type Selector */}
              <div className="w-full mb-4">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Select Category Type (Each category functions as its own mini-tournament)
                </label>
                <select
                  value={selectedCategory || ''}
                  onChange={(e) => setSelectedCategory(e.target.value || null)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-md text-sm"
                >
                  <option value="">Select Category</option>
                  {tournament.categories?.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            
            {selectedCategory ? (
              <>
                <div className="mb-4 p-3 bg-blue-50 rounded-md">
                  <h3 className="font-semibold text-blue-800">
                    Managing Tournament Category: <span className="text-blue-600">{selectedCategory}</span>
                  </h3>
                  <p className="text-sm text-blue-600 mt-1">
                    All players, fixtures, groups, and matches shown below are specific to this category
                  </p>
                </div>
                {/* Tournament Sub-Tabs */}
                <div className="border-b border-white/30 mb-4">
                  <nav className="-mb-px flex space-x-6">
                    <button
                      onClick={() => setTournamentSubTab('players')}
                      className={`py-3 px-1 border-b-2 font-medium text-sm ${
                        tournamentSubTab === 'players'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-white/50'
                      }`}
                    >
                      {selectedCategory && selectedCategory.toLowerCase().includes('doubles') ? 'Teams' : 'Players'}
                    </button>
                    <button
                      onClick={() => setTournamentSubTab('fixtures')}
                      className={`py-3 px-1 border-b-2 font-medium text-sm ${
                        tournamentSubTab === 'fixtures'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-white/50'
                      }`}
                    >
                      Fixtures
                    </button>
                    {tournament.fixtureGroups?.some(g => g.category === selectedCategory) && (
                      <button
                        onClick={() => setTournamentSubTab('groups')}
                        className={`py-3 px-1 border-b-2 font-medium text-sm ${
                          tournamentSubTab === 'groups'
                            ? 'border-blue-500 text-blue-600'
                            : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-white/50'
                        }`}
                      >
                        Groups
                      </button>
                    )}
                    <button
                      onClick={() => setTournamentSubTab('matches')}
                      className={`py-3 px-1 border-b-2 font-medium text-sm ${
                        tournamentSubTab === 'matches'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-white/50'
                      }`}
                    >
                      Matches
                    </button>
                    <button
                      onClick={() => setTournamentSubTab('liveView')}
                      className={`py-3 px-1 border-b-2 font-medium text-sm ${
                        tournamentSubTab === 'liveView'
                          ? 'border-blue-500 text-blue-600'
                          : 'border-transparent text-gray-600 hover:text-gray-800 hover:border-white/50'
                      }`}
                    >
                      Live View
                    </button>
                  </nav>
                </div>
                
                {/* Sub-Tab Content */}
                {tournamentSubTab === 'players' && (
                  <div className="overflow-x-auto">
                    <div className="flex justify-between mb-4">
                      <button
                        onClick={() => setShowAddPlayerForm(!showAddPlayerForm)}
                        className="px-4 py-2 rounded-md text-white bg-blue-600/80 hover:bg-blue-700/90 backdrop-blur-sm"
                      >
                        {showAddPlayerForm ? 'Cancel' :
                          (selectedCategory && selectedCategory.toLowerCase().includes('doubles') ? 'Add Team' : 'Add Player')}
                      </button>
                      <button
                        onClick={saveSeeds}
                        disabled={isSaving}
                        className={`px-4 py-2 rounded-md text-white backdrop-blur-sm ${isSaving ? 'bg-gray-400/80' : 'bg-green-600/80 hover:bg-green-700/90'}`}
                      >
                        {isSaving ? 'Saving...' : 'Save Seeds'}
                      </button>
                    </div>

                    {/* Add Player Form */}
                    {showAddPlayerForm && (
                      <div className="mb-6 p-4 border border-blue-200 rounded-md bg-blue-50">
                        <h3 className="text-lg font-semibold text-gray-800 mb-3">
                          {selectedCategory && selectedCategory.toLowerCase().includes('doubles')
                            ? `Add New Team to ${selectedCategory}`
                            : `Add New Player to ${selectedCategory}`}
                        </h3>
                        
                        {/* Toggle between single and bulk mode */}
                        <div className="flex mb-4 border-b pb-3">
                          <button
                            onClick={() => setAddPlayerMode('single')}
                            className={`px-4 py-2 rounded-l-md ${
                              addPlayerMode === 'single'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            {selectedCategory && selectedCategory.toLowerCase().includes('doubles')
                              ? 'Add Single Team'
                              : 'Add Single Player'}
                          </button>
                          <button
                            onClick={() => setAddPlayerMode('bulk')}
                            className={`px-4 py-2 rounded-r-md ${
                              addPlayerMode === 'bulk'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                            }`}
                          >
                            {selectedCategory && selectedCategory.toLowerCase().includes('doubles')
                              ? 'Bulk Add Teams'
                              : 'Bulk Add Players'}
                          </button>
                        </div>
                        
                        {addPlayerMode === 'single' ? (
                          <>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  {selectedCategory && selectedCategory.toLowerCase().includes('doubles')
                                    ? 'Team Name'
                                    : 'Player Name'}
                                </label>
                                <input
                                  type="text"
                                  value={newPlayerName}
                                  onChange={(e) => setNewPlayerName(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                  placeholder={selectedCategory && selectedCategory.toLowerCase().includes('doubles')
                                    ? "Enter team name (e.g., 'Player1 / Player2')"
                                    : "Enter player name"}
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">
                                  {selectedCategory && selectedCategory.toLowerCase().includes('doubles')
                                    ? 'Team Email (Optional)'
                                    : 'Player Email'}
                                </label>
                                <input
                                  type="email"
                                  value={newPlayerEmail}
                                  onChange={(e) => setNewPlayerEmail(e.target.value)}
                                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                                  placeholder={selectedCategory && selectedCategory.toLowerCase().includes('doubles')
                                    ? "Enter team email (optional)"
                                    : "Enter player email"}
                                />
                              </div>
                            </div>
                            <div className="flex justify-end">
                              <button
                                onClick={handleAddPlayer}
                                disabled={isAddingPlayer || !newPlayerName || !newPlayerEmail}
                                className={`px-4 py-2 rounded-md text-white ${
                                  isAddingPlayer || !newPlayerName || (!newPlayerEmail && !selectedCategory.toLowerCase().includes('doubles'))
                                    ? 'bg-gray-400'
                                    : 'bg-green-600 hover:bg-green-700'
                                }`}
                              >
                                {isAddingPlayer ? 'Adding...' :
                                  (selectedCategory && selectedCategory.toLowerCase().includes('doubles') ? 'Add Team' : 'Add Player')}
                              </button>
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="mb-4">
                              <label className="block text-sm font-medium text-gray-700 mb-1">
                                {selectedCategory.toLowerCase().includes('doubles') ?
                                  "Doubles Teams (two players per team)" :
                                  "Player Names (one per line)"}
                              </label>
                              <textarea
                                value={bulkPlayerNames}
                                onChange={(e) => setBulkPlayerNames(e.target.value)}
                                className="w-full px-3 py-2 border border-gray-300 rounded-md h-32"
                                placeholder={selectedCategory.toLowerCase().includes('doubles') ?
                                  "Enter doubles teams (two players per team):\n\nArjun Sharma\nRohit Gupta\n\nVikram Singh\nSiddharth Mehta\n\nRajesh Kumar\nAditya Joshi" :
                                  "Enter each player name on a new line:\nJohn Doe\nJane Smith\nMike Johnson"}
                              />
                              <div className="text-xs text-gray-500 mt-1">
                                {selectedCategory.toLowerCase().includes('doubles') ? (
                                  <>
                                    <p className="font-medium mb-1">Doubles Teams Format:</p>
                                    <ul className="list-disc pl-4 space-y-1">
                                      <li>Enter <strong>two player names</strong> (one per line) to form a team</li>
                                      <li>Leave an <strong>empty line</strong> between different teams</li>
                                      <li>Players will be registered as a single team in the fixtures</li>
                                      <li>Example: "Arjun Sharma" + "Rohit Gupta" = Team "Arjun Sharma / Rohit Gupta"</li>
                                      <li>Teams clubbed together will play as a doubles team vs other teams</li>
                                    </ul>
                                  </>
                                ) : (
                                  <p>Enter one player name per line. Email addresses are optional for bulk-added players.</p>
                                )}
                              </div>
                            </div>
                            <div className="flex justify-end">
                              <button
                                onClick={handleBulkAddPlayers}
                                disabled={isAddingPlayer || !bulkPlayerNames.trim()}
                                className={`px-4 py-2 rounded-md text-white ${
                                  isAddingPlayer || !bulkPlayerNames.trim()
                                    ? 'bg-gray-400'
                                    : 'bg-green-600 hover:bg-green-700'
                                }`}
                              >
                                {isAddingPlayer ? 'Adding...' :
                                  (selectedCategory && selectedCategory.toLowerCase().includes('doubles') ? 'Add Teams' : 'Add Players')}
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                    
                    {saveMessage && (
                      <div className={`mb-4 p-3 rounded-md backdrop-blur-sm ${saveMessage.type === 'success' ? 'bg-green-100/70 text-green-800' : 'bg-red-100/70 text-red-800'}`}>
                        {saveMessage.text}
                      </div>
                    )}
                    
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-white/30">
                        <tr>
                          <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Seed
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Name
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Email
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Registration Date
                          </th>
                          <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Actions
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white/20 backdrop-blur-sm divide-y divide-gray-200/40">
                        {participants
                          .filter(p => p.category === selectedCategory)
                          .map((participant, index) => {
                            const seedKey = `${participant.userId}-${participant.category}`;
                            return (
                              <tr key={index}>
                                <td className="px-4 py-4 whitespace-nowrap">
                                  <input
                                    type="number"
                                    min="1"
                                    value={seeds[seedKey] === null ? '' : seeds[seedKey] || ''}
                                    onChange={(e) => handleSeedChange(participant.userId, participant.category, e.target.value)}
                                    className="w-16 p-1 border border-gray-300 rounded-md text-center"
                                    placeholder="#"
                                  />
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="flex items-center">
                                    {participant.user?.photoURL ? (
                                      <img className="h-10 w-10 rounded-full mr-3" src={participant.user.photoURL} alt="" />
                                    ) : (
                                      <div className="h-10 w-10 rounded-full bg-gray-200 flex items-center justify-center mr-3">
                                        <span className="text-gray-500 text-sm">
                                          {participant.user?.displayName?.charAt(0) || 'U'}
                                        </span>
                                      </div>
                                    )}
                                    <div>
                                      <div className="text-sm font-medium text-gray-900">
                                        {participant.user && 'doubleTeam' in participant.user ?
                                         (participant.user.displayName ||
                                          (participant.user.playerNames ?
                                           participant.user.playerNames.join(' / ') : 'Doubles Team')) :
                                         (participant.user?.displayName || 'Unknown User')}
                                      </div>
                                      {participant.user && 'playerNames' in participant.user && participant.user.playerNames && (
                                        <div className="text-xs text-gray-500 mt-1">
                                          Doubles Team: {participant.user.playerNames.join(' & ')}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap">
                                  <div className="text-sm text-gray-900">{participant.user?.email || 'N/A'}</div>
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                  {participant.registrationDate.toLocaleString()}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                  <button
                                    onClick={() => handleDeletePlayer(participant.userId, participant.category)}
                                    className="text-red-500 hover:text-red-700"
                                    aria-label="Delete player"
                                  >
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                                    </svg>
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                      </tbody>
                    </table>
                  </div>
                )}
                
                {tournamentSubTab === 'fixtures' && (
                  <div className="overflow-x-auto">
                    <div className="flex justify-end mb-4">
                      <button
                        onClick={() => setIsFixtureModalOpen(true)}
                        className="px-4 py-2 rounded-md text-white bg-blue-600/80 hover:bg-blue-700/90 backdrop-blur-sm"
                        disabled={isGeneratingFixtures}
                      >
                        {isGeneratingFixtures ? 'Generating...' : 'Generate Fixtures'}
                      </button>
                    </div>
                    
                    {tournament.fixtures && tournament.fixtures.filter(f => f.category === selectedCategory).length > 0 ? (
                      <FixtureDisplay
                        tournament={{
                          ...tournament,
                          fixtures: tournament.fixtures?.filter(f => f.category === selectedCategory)
                        }}
                        participants={participants}
                        onUpdateFixture={handleUpdateFixture}
                      />
                    ) : (
                      <div className="text-center py-8 bg-white/10 backdrop-blur-sm rounded-lg">
                        <p className="text-gray-600">No fixtures have been generated for this category yet.</p>
                      </div>
                    )}
                  </div>
                )}
                
                {tournamentSubTab === 'groups' && tournament.fixtureGroups?.some(g => g.category === selectedCategory) && (
                  <div className="overflow-x-auto">
                    {saveMessage && (
                      <div className={`mb-4 p-3 rounded-md backdrop-blur-sm ${saveMessage.type === 'success' ? 'bg-green-100/70 text-green-800' : 'bg-red-100/70 text-red-800'}`}>
                        {saveMessage.text}
                      </div>
                    )}
                    
                    {isUpdatingGroups && (
                      <div className="mb-4 p-3 rounded-md backdrop-blur-sm bg-blue-100/70 text-blue-800">
                        Updating fixtures... This may take a moment.
                      </div>
                    )}
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {tournament.fixtureGroups
                        .filter(group => group.category === selectedCategory)
                        .map((group, idx) => (
                          <div
                            key={idx}
                            className={`bg-white/20 backdrop-blur-sm rounded-lg p-4 border border-white/30 ${
                              draggedPlayer ? 'border-dashed border-2 border-blue-400 transition-all duration-200' : ''
                            }`}
                            onDragOver={(e) => {
                              e.preventDefault();
                              e.stopPropagation();
                            }}
                            onDrop={(e) => {
                              e.preventDefault();
                              if (draggedPlayer) {
                                handleMovePlayerToGroup(draggedPlayer, group.id);
                              }
                              setDraggedPlayer(null);
                            }}
                          >
                            <h3 className="text-lg font-semibold mb-3">Group {group.name}</h3>
                            <ul className="space-y-2">
                              {group.playerIds && group.playerIds.map((playerId: string, playerIdx: number) => {
                                const player = participants.find(p => p.userId === playerId);
                                return (
                                  <li
                                    key={playerIdx}
                                    className={`flex items-center p-2 rounded ${
                                      draggedPlayer === playerId ? 'opacity-50 bg-gray-100' : 'hover:bg-white/30'
                                    } cursor-grab`}
                                    draggable={true}
                                    onDragStart={(e) => {
                                      setDraggedPlayer(playerId);
                                      e.dataTransfer.setData('text/plain', playerId);
                                      e.dataTransfer.effectAllowed = 'move';
                                    }}
                                    onDragEnd={() => setDraggedPlayer(null)}
                                  >
                                    <span className="text-gray-700">
                                      {player?.user && 'doubleTeam' in player.user ?
                                        (player.user.displayName ||
                                         (player.user.playerNames ? player.user.playerNames.join(' / ') : 'Doubles Team')) :
                                        (player?.user?.displayName || 'Unknown Player')}
                                    </span>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ))}
                    </div>
                    
                    <div className="mt-6 p-4 bg-blue-50/80 rounded-md">
                      <h3 className="text-lg font-semibold text-blue-800 mb-2">How to move players between groups</h3>
                      <p className="text-blue-600 text-sm">
                        Drag and drop players between groups. Fixtures will be automatically updated when you move a player.
                      </p>
                    </div>
                  </div>
                )}
                
                {tournamentSubTab === 'matches' && (
                  <div className="overflow-x-auto">
                    {hasDuplicateFixtures && (
                      <div className="mb-4 p-3 rounded-md backdrop-blur-sm bg-green-100/70 text-green-800">
                        Duplicate playoff fixtures were detected and have been removed.
                      </div>
                    )}
                    
                    {/* Filters for matches */}
                    <div className="mb-4 p-4 bg-white/20 backdrop-blur-sm rounded-lg">
                      <h3 className="text-lg font-semibold mb-3">Filter Matches</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Group filter */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Group
                          </label>
                          <select
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            value={groupFilter}
                            onChange={(e) => setGroupFilter(e.target.value)}
                          >
                            <option value="all">All Groups</option>
                            {tournament.fixtureGroups?.filter(g => g.category === selectedCategory).map((group) => (
                              <option key={group.id} value={group.id}>
                                {group.name}
                              </option>
                            ))}
                            <option value="playoff">Playoff Matches</option>
                          </select>
                        </div>
                        
                        {/* Status filter */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Status
                          </label>
                          <select
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            value={statusFilter}
                            onChange={(e) => setStatusFilter(e.target.value as 'all' | 'completed' | 'pending')}
                          >
                            <option value="all">All Statuses</option>
                            <option value="completed">Completed</option>
                            <option value="pending">Pending</option>
                          </select>
                        </div>
                        
                        {/* Player name search */}
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">
                            Player Name
                          </label>
                          <input
                            type="text"
                            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500"
                            placeholder="Search by player name"
                            value={playerNameFilter}
                            onChange={(e) => setPlayerNameFilter(e.target.value)}
                          />
                        </div>
                      </div>
                    </div>
                    
                    {/* Generate Scores button */}
                    <div className="flex justify-end mb-4">
                      <button
                        onClick={() => {
                          if (!tournament || !tournament.fixtures || !id) return;
                          
                          // Create a copy of fixtures with generated scores
                          const updatedFixtures = tournament.fixtures.map(fixture => {
                            // Only generate scores for matches with both players assigned and in selected category
                            if (fixture.category === selectedCategory && fixture.player1Id && fixture.player2Id && !fixture.completed) {
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
                          const tournamentRef = doc(db, 'tournaments', id);
                          updateDoc(tournamentRef, { fixtures: updatedFixtures })
                            .then(() => {
                              setSaveMessage({
                                type: 'success',
                                text: 'Scores generated successfully!'
                              });
                              
                              // Clear message after 3 seconds
                              setTimeout(() => {
                                setSaveMessage(null);
                              }, 3000);
                            })
                            .catch(error => {
                              console.error('Error generating scores:', error);
                              setSaveMessage({
                                type: 'error',
                                text: 'Failed to generate scores. Please try again.'
                              });
                            });
                        }}
                        className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
                      >
                        Generate Scores
                      </button>
                    </div>
                    
                    {tournament.fixtures && tournament.fixtures.filter(f => f.category === selectedCategory).length > 0 ? (
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-white/30">
                          <tr>
                            <th scope="col" className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Match
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Group
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Players
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Score
                            </th>
                            <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Status
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white/20 backdrop-blur-sm divide-y divide-gray-200/40">
                          {tournament.fixtures
                            .filter(fixture => {
                              // Filter by category (always required)
                              if (fixture.category !== selectedCategory) return false;
                              
                              // Filter by group
                              if (groupFilter !== 'all') {
                                if (groupFilter === 'playoff') {
                                  if (fixture.stage !== 'playoff') return false;
                                } else {
                                  if (fixture.group !== groupFilter) return false;
                                }
                              }
                              
                              // Filter by status
                              if (statusFilter !== 'all') {
                                if (statusFilter === 'completed' && !fixture.completed) return false;
                                if (statusFilter === 'pending' && fixture.completed) return false;
                              }
                              
                              // Filter by player name
                              if (playerNameFilter.trim() !== '') {
                                const player1 = participants.find(p => p.userId === fixture.player1Id);
                                const player2 = participants.find(p => p.userId === fixture.player2Id);
                                
                                const player1Name = player1?.user?.displayName?.toLowerCase() || '';
                                const player2Name = player2?.user?.displayName?.toLowerCase() || '';
                                const searchTerm = playerNameFilter.toLowerCase();
                                
                                if (!player1Name.includes(searchTerm) && !player2Name.includes(searchTerm)) {
                                  return false;
                                }
                              }
                              
                              return true;
                            })
                            // Sort by stage (pool first, then playoff) and then by round and playoffRound
                            .sort((a, b) => {
                              // First sort by stage - pool matches come before playoff matches
                              if ((a.stage || 'pool') !== (b.stage || 'pool')) {
                                return (a.stage || 'pool') === 'pool' ? -1 : 1;
                              }
                              
                              // If both are playoff matches, sort by playoff round
                              if ((a.stage || 'pool') === 'playoff' && (b.stage || 'pool') === 'playoff') {
                                // Define order of playoff rounds
                                const roundOrder = {
                                  'quarterFinal': 1,
                                  'semiFinal': 2,
                                  'final': 4,
                                  '3rdPlace': 3
                                };
                                
                                // Get the order value for each round (default to 999 if not found)
                                const aOrder = a.playoffRound ? roundOrder[a.playoffRound as keyof typeof roundOrder] || 999 : 999;
                                const bOrder = b.playoffRound ? roundOrder[b.playoffRound as keyof typeof roundOrder] || 999 : 999;
                                
                                return aOrder - bOrder;
                              }
                              
                              // If both are pool matches or if stage comparison is equal, sort by round
                              return (a.round || 0) - (b.round || 0);
                            })
                            .map((fixture, index) => {
                              // Find player names
                              const player1 = participants.find(p => p.userId === fixture.player1Id);
                              const player2 = participants.find(p => p.userId === fixture.player2Id);
                              return (
                                <tr
                                  key={index}
                                  className={`cursor-pointer hover:bg-white/30 ${
                                    !fixture.completed ? 'transition-colors duration-150' : ''
                                  } ${
                                    fixture.stage === 'playoff' && fixture.cup === 'gold' ? 'bg-yellow-50/50' :
                                    fixture.stage === 'playoff' && fixture.cup === 'silver' ? 'bg-gray-50/70' : ''
                                  }`}
                                  onClick={() => {
                                    console.log("Match clicked:", fixture);
                                    if (!fixture.player1Id || !fixture.player2Id) {
                                      console.log("Missing player IDs, not opening modal");
                                      return;
                                    }
                                    console.log("Setting fixture:", fixture);
                                    setSelectedFixture(fixture);
                                    setPlayer1Score(fixture.score ? fixture.score.split('-')[0] : '');
                                    setPlayer2Score(fixture.score ? fixture.score.split('-')[1] : '');
                                    console.log("Opening score modal");
                                    setIsScoreModalOpen(true);
                                    console.log("isScoreModalOpen set to:", true);
                                  }}
                                >
                                  <td className="px-4 py-4 whitespace-nowrap">
                                    <div className="text-sm font-medium text-gray-900">
                                      Match {index + 1}
                                    </div>
                                    <div className="text-sm text-gray-500">
                                      Round {fixture.round}
                                      {fixture.stage === 'playoff' && fixture.playoffRound && (
                                        <>
                                          <span className="ml-1 px-2 py-0.5 bg-blue-100 text-blue-800 text-xs rounded-full">
                                            {fixture.playoffRound === 'quarterFinal' ? 'QF' :
                                             fixture.playoffRound === 'semiFinal' ? 'SF' :
                                             fixture.playoffRound === 'final' ? 'Final' :
                                             fixture.playoffRound === '3rdPlace' ? '3rd Place' : ''}
                                          </span>
                                          
                                          {fixture.cup && (
                                            <span className={`ml-1 px-2 py-0.5 text-xs rounded-full ${
                                              fixture.cup === 'gold' ? 'bg-yellow-100 text-yellow-800' :
                                              fixture.cup === 'silver' ? 'bg-gray-200 text-gray-800' : ''
                                            }`}>
                                              {fixture.cup === 'gold' ? 'Gold Cup' : 'Silver Cup'}
                                            </span>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    {fixture.stage === 'pool' && fixture.group ? (
                                      <div className="text-sm font-medium text-gray-900">
                                        Group {fixture.group.split('_').pop()}
                                      </div>
                                    ) : (
                                      <div className="text-sm text-gray-500">
                                        {fixture.stage === 'playoff' ? 'Playoff' : '-'}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm text-gray-900">
                                      {player1?.user?.displayName || 'TBD'} vs {player2?.user?.displayName || 'TBD'}
                                    </div>
                                    {fixture.stage === 'playoff' && (!fixture.player1Id || !fixture.player2Id) && (
                                      <div className="text-xs text-gray-500 italic mt-1">
                                        {fixture.playoffRound === 'semiFinal' ? 'Awaiting quarterfinal results' :
                                         fixture.playoffRound === 'final' ? 'Awaiting semifinal results' :
                                         fixture.playoffRound === '3rdPlace' ? 'Awaiting semifinal results' : ''}
                                      </div>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    {fixture.completed ? (
                                      <div className="text-sm font-medium text-gray-900">
                                        {fixture.score}
                                      </div>
                                    ) : (
                                      <div className="text-sm text-gray-500">Not played</div>
                                    )}
                                  </td>
                                  <td className="px-6 py-4 whitespace-nowrap">
                                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                      fixture.completed
                                        ? 'bg-green-100 text-green-800'
                                        : 'bg-yellow-100 text-yellow-800'
                                    }`}>
                                      {fixture.completed ? 'Completed' : 'Pending'}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    ) : (
                      <div className="text-center py-8 bg-white/10 backdrop-blur-sm rounded-lg">
                        <p className="text-gray-600">No matches available for this category yet.</p>
                      </div>
                    )}
                  </div>
                )}
                
                {tournamentSubTab === 'liveView' && (
                  <div className="overflow-x-auto">
                    <div className="flex justify-between items-center mb-4">
                      <h3 className="text-xl font-semibold text-gray-800">Tournament Standings</h3>
                      
                      {/* Export for DUPR button - only visible after all matches are completed */}
                      {tournament.fixtures && areAllMatchesCompleted() && (
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
                    
                    {tournament.fixtures && tournament.fixtures.filter(f => f.category === selectedCategory).length > 0 &&
                     tournament.fixtureGroups && tournament.fixtureGroups.filter(g => g.category === selectedCategory).length > 0 ? (
                      <>
                        <GroupStandings
                          fixtures={tournament.fixtures.filter(f => f.category === selectedCategory && f.group)}
                          groups={tournament.fixtureGroups.filter(g => g.category === selectedCategory)}
                          participants={participants.filter(p => p.category === selectedCategory)}
                        />
                        
                        {/* Check if all pool matches are completed */}
                        {(() => {
                          const poolFixtures = tournament.fixtures.filter(
                            f => f.category === selectedCategory && f.stage === 'pool'
                          );
                          const allPoolMatchesCompleted = poolFixtures.length > 0 &&
                            poolFixtures.every(fixture => fixture.completed);
                          
                          // Check if playoffs already exist
                          const playoffFixtures = tournament.fixtures.filter(
                            f => f.category === selectedCategory && f.stage === 'playoff'
                          );
                          const playoffsExist = playoffFixtures.length > 0;
                          
                          if (allPoolMatchesCompleted && !playoffsExist) {
                            return (
                              <div className="mt-6 mb-8 p-4 bg-green-50 border border-green-200 rounded-lg">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <h4 className="text-lg font-semibold text-green-800">All Group Matches Completed!</h4>
                                    <p className="text-green-700">
                                      Generate playoff fixtures to continue the tournament.
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => {
                                      if (!tournament || !tournament.id) return;
                                      
                                      // Get groups for this category
                                      const groups = tournament.fixtureGroups?.filter(
                                        g => g.category === selectedCategory
                                      ) || [];
                                      
                                      // Get all pool fixtures for this category
                                      const poolFixtures = tournament.fixtures?.filter(
                                        f => f.category === selectedCategory && f.stage === 'pool'
                                      ) || [];
                                      
                                      // Calculate standings and sort players within each group
                                      const sortedGroups = groups.map(group => {
                                        // Get fixtures for this group
                                        const groupFixtures = poolFixtures.filter(
                                          f => f.group === group.id
                                        );
                                        
                                        // Calculate stats for each player
                                        const playerStats: Record<string, {
                                          matchesWon: number;
                                          ptsWon: number;
                                          ptsLost: number;
                                          ptsDiff: number;
                                        }> = {};
                                        
                                        // Initialize stats for all players
                                        group.playerIds.forEach(playerId => {
                                          playerStats[playerId] = {
                                            matchesWon: 0,
                                            ptsWon: 0,
                                            ptsLost: 0,
                                            ptsDiff: 0
                                          };
                                        });
                                        
                                        // Calculate stats from completed fixtures
                                        groupFixtures
                                          .filter(fixture => fixture.completed && fixture.score)
                                          .forEach(fixture => {
                                            if (!fixture.player1Id || !fixture.player2Id) return;
                                            
                                            const player1 = fixture.player1Id;
                                            const player2 = fixture.player2Id;
                                            
                                            // Parse score (format: "21-15")
                                            const [score1, score2] = fixture.score?.split('-').map(s => parseInt(s)) || [0, 0];
                                            
                                            // Add points
                                            if (playerStats[player1]) {
                                              playerStats[player1].ptsWon += score1;
                                              playerStats[player1].ptsLost += score2;
                                            }
                                            
                                            if (playerStats[player2]) {
                                              playerStats[player2].ptsWon += score2;
                                              playerStats[player2].ptsLost += score1;
                                            }
                                            
                                            // Update match wins
                                            if (fixture.winner === player1 && playerStats[player1]) {
                                              playerStats[player1].matchesWon++;
                                            } else if (fixture.winner === player2 && playerStats[player2]) {
                                              playerStats[player2].matchesWon++;
                                            }
                                          });
                                        
                                        // Calculate point differential
                                        Object.keys(playerStats).forEach(playerId => {
                                          playerStats[playerId].ptsDiff =
                                            playerStats[playerId].ptsWon - playerStats[playerId].ptsLost;
                                        });
                                        
                                        // Sort players by performance
                                        const sortedPlayerIds = [...group.playerIds].sort((a, b) => {
                                          const statsA = playerStats[a] || { matchesWon: 0, ptsDiff: 0 };
                                          const statsB = playerStats[b] || { matchesWon: 0, ptsDiff: 0 };
                                          
                                          // Sort by matches won (descending)
                                          if (statsB.matchesWon !== statsA.matchesWon) {
                                            return statsB.matchesWon - statsA.matchesWon;
                                          }
                                          // Then by point differential (descending)
                                          return statsB.ptsDiff - statsA.ptsDiff;
                                        });
                                        
                                        // Return group with sorted player IDs
                                        return {
                                          ...group,
                                          playerIds: sortedPlayerIds
                                        };
                                      });
                                      
                                      // Use the playoffStructure from tournament settings or default to quarterFinals
                                      const playoffStructure = tournament.fixtureFormats?.[selectedCategory]?.playoffStructure || 'quarterFinals';
                                      
                                      // Get the tournament format
                                      const format = tournament.fixtureFormats?.[selectedCategory]?.format || 'poolPlayPlayoffs';
                                      
                                      let playoffFixtures;
                                      
                                      // Generate fixtures based on format
                                      if (format === 'poolPlayCups') {
                                        // For Cup format, use generateCupsFixtures to get Gold and Silver Cup fixtures
                                        playoffFixtures = generateCupsFixtures(
                                          sortedGroups,
                                          selectedCategory,
                                          playoffStructure
                                        );
                                      } else {
                                        // For regular Playoff format, use generatePlayoffFixtures
                                        playoffFixtures = generatePlayoffFixtures(
                                          sortedGroups,
                                          selectedCategory,
                                          playoffStructure
                                        );
                                      }
                                      
                                      // Add playoff fixtures to tournament
                                      handleAddPlayoffFixtures(playoffFixtures);
                                    }}
                                    className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700"
                                  >
                                    Generate Playoff Fixtures
                                  </button>
                                </div>
                              </div>
                            );
                          } else if (playoffsExist) {
                            return (
                              <div className="mt-6 mb-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <h4 className="text-lg font-semibold text-blue-800">Playoff Fixtures Generated</h4>
                                    <p className="text-blue-700">
                                      View and manage playoff matches in the Matches tab.
                                    </p>
                                  </div>
                                  <button
                                    onClick={() => {
                                      if (!tournament || !tournament.id) return;
                                      
                                      // First, remove existing playoff fixtures for this category only
                                      const nonPlayoffFixtures = tournament.fixtures?.filter(
                                        f => !(f.category === selectedCategory && f.stage === 'playoff')
                                      ) || [];
                                      
                                      // Update tournament with only non-playoff fixtures
                                      const tournamentRef = doc(db, 'tournaments', tournament.id);
                                      updateDoc(tournamentRef, {
                                        fixtures: nonPlayoffFixtures
                                      }).then(() => {
                                        // Get groups for this category
                                        const groups = tournament.fixtureGroups?.filter(
                                          g => g.category === selectedCategory
                                        ) || [];
                                        
                                        // Get all pool fixtures for this category
                                        const poolFixtures = nonPlayoffFixtures.filter(
                                          f => f.category === selectedCategory && f.stage === 'pool'
                                        );
                                        
                                        // Calculate standings and sort players within each group
                                        const sortedGroups = groups.map(group => {
                                          // Get fixtures for this group
                                          const groupFixtures = poolFixtures.filter(
                                            f => f.group === group.id
                                          );
                                          
                                          // Calculate stats for each player
                                          const playerStats: Record<string, {
                                            matchesWon: number;
                                            ptsWon: number;
                                            ptsLost: number;
                                            ptsDiff: number;
                                          }> = {};
                                          
                                          // Initialize stats for all players
                                          group.playerIds.forEach(playerId => {
                                            playerStats[playerId] = {
                                              matchesWon: 0,
                                              ptsWon: 0,
                                              ptsLost: 0,
                                              ptsDiff: 0
                                            };
                                          });
                                          
                                          // Calculate stats from completed fixtures
                                          groupFixtures
                                            .filter(fixture => fixture.completed && fixture.score)
                                            .forEach(fixture => {
                                              if (!fixture.player1Id || !fixture.player2Id) return;
                                              
                                              const player1 = fixture.player1Id;
                                              const player2 = fixture.player2Id;
                                              
                                              // Parse score (format: "21-15")
                                              const [score1, score2] = fixture.score?.split('-').map(s => parseInt(s)) || [0, 0];
                                              
                                              // Add points
                                              if (playerStats[player1]) {
                                                playerStats[player1].ptsWon += score1;
                                                playerStats[player1].ptsLost += score2;
                                              }
                                              
                                              if (playerStats[player2]) {
                                                playerStats[player2].ptsWon += score2;
                                                playerStats[player2].ptsLost += score1;
                                              }
                                              
                                              // Update match wins
                                              if (fixture.winner === player1 && playerStats[player1]) {
                                                playerStats[player1].matchesWon++;
                                              } else if (fixture.winner === player2 && playerStats[player2]) {
                                                playerStats[player2].matchesWon++;
                                              }
                                            });
                                          
                                          // Calculate point differential
                                          Object.keys(playerStats).forEach(playerId => {
                                            playerStats[playerId].ptsDiff =
                                              playerStats[playerId].ptsWon - playerStats[playerId].ptsLost;
                                          });
                                          
                                          // Sort players by performance
                                          const sortedPlayerIds = [...group.playerIds].sort((a, b) => {
                                            const statsA = playerStats[a] || { matchesWon: 0, ptsDiff: 0 };
                                            const statsB = playerStats[b] || { matchesWon: 0, ptsDiff: 0 };
                                            
                                            // Sort by matches won (descending)
                                            if (statsB.matchesWon !== statsA.matchesWon) {
                                              return statsB.matchesWon - statsA.matchesWon;
                                            }
                                            // Then by point differential (descending)
                                            return statsB.ptsDiff - statsA.ptsDiff;
                                          });
                                          
                                          // Return group with sorted player IDs
                                          return {
                                            ...group,
                                            playerIds: sortedPlayerIds
                                          };
                                        });
                                        
                                        // Use the playoffStructure from tournament settings or default to quarterFinals
                                        const playoffStructure = tournament.fixtureFormats?.[selectedCategory]?.playoffStructure || 'quarterFinals';
                                        
                                        // Get the tournament format
                                        const format = tournament.fixtureFormats?.[selectedCategory]?.format || 'poolPlayPlayoffs';
                                        
                                        let playoffFixtures;
                                        
                                        // Generate fixtures based on format
                                        if (format === 'poolPlayCups') {
                                          // For Cup format, use generateCupsFixtures to get Gold and Silver Cup fixtures
                                          playoffFixtures = generateCupsFixtures(
                                            sortedGroups,
                                            selectedCategory,
                                            playoffStructure
                                          );
                                        } else {
                                          // For regular Playoff format, use generatePlayoffFixtures
                                          playoffFixtures = generatePlayoffFixtures(
                                            sortedGroups,
                                            selectedCategory,
                                            playoffStructure
                                          );
                                        }
                                        
                                        // Add the new playoff fixtures
                                        handleAddPlayoffFixtures(playoffFixtures);
                                      });
                                    }}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                                  >
                                    Regenerate Playoff Fixtures
                                  </button>
                                </div>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </>
                    ) : (
                      <div className="text-center py-8 bg-white/10 backdrop-blur-sm rounded-lg">
                        <p className="text-gray-600">
                          No standings available. Please generate fixtures with groups first.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : (
              <div className="text-center py-8 bg-white/10 backdrop-blur-sm rounded-lg">
                <p className="text-gray-600">Please select a category to view tournament details.</p>
              </div>
            )}
          </div>
        </div>
      )}
      
      {/* Tournament Setup Modal */}
      {selectedCategory && mainTab === 'tournament' && tournamentSubTab === 'fixtures' && (
        <TournamentSetupModal
          tournament={tournament}
          isOpen={isFixtureModalOpen}
          onClose={() => setIsFixtureModalOpen(false)}
          onGenerateFixtures={handleGenerateFixtures}
          initialCategory={selectedCategory}
        />
      )}
      
      {/* Score Entry Modal - Always render but control visibility with CSS */}
      <div
        className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999] ${isScoreModalOpen ? 'flex' : 'hidden'}`}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: isScoreModalOpen ? 'flex' : 'none',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9999
        }}
        onClick={(e) => {
          // Close when clicking outside the modal
          if (e.target === e.currentTarget) {
            console.log("[Debug] Closing modal by clicking outside");
            setIsScoreModalOpen(false);
          }
        }}
      >
        <div className="bg-white rounded-lg p-6 max-w-md w-full">
          <h3 className="text-lg font-semibold mb-4">Enter Match Score</h3>
          
          <div className="mb-6">
            <p className="text-gray-700 mb-2">
              {selectedFixture ?
                `${participants.find(p => p.userId === selectedFixture.player1Id)?.user?.displayName || 'Player 1'} vs
                ${participants.find(p => p.userId === selectedFixture.player2Id)?.user?.displayName || 'Player 2'}`
                : 'Select a match to enter scores'}
            </p>
            
            <div className="flex items-center space-x-2">
              <input
                type="number"
                min="0"
                value={player1Score}
                onChange={(e) => {
                  console.log("[Debug] Setting player 1 score:", e.target.value);
                  setPlayer1Score(e.target.value);
                }}
                className="w-16 p-2 border border-gray-300 rounded-md text-center"
              />
              <span className="text-lg font-medium">-</span>
              <input
                type="number"
                min="0"
                value={player2Score}
                onChange={(e) => {
                  console.log("[Debug] Setting player 2 score:", e.target.value);
                  setPlayer2Score(e.target.value);
                }}
                className="w-16 p-2 border border-gray-300 rounded-md text-center"
              />
            </div>
          </div>
          
          <div className="flex justify-end space-x-3">
            <button
              onClick={() => {
                console.log("[Debug] Cancel button clicked");
                setIsScoreModalOpen(false);
              }}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                console.log("[Debug] Save Score button clicked");
                if (selectedFixture) {
                  handleSaveScore();
                } else {
                  console.error("[Debug] No fixture selected for saving score");
                }
              }}
              disabled={!player1Score || !player2Score || isSaving || !selectedFixture}
              className={`px-4 py-2 rounded-md text-white ${
                !player1Score || !player2Score || isSaving || !selectedFixture
                  ? 'bg-gray-400'
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {isSaving ? 'Saving...' : 'Save Score'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}