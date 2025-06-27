import React, { useState } from 'react';
import type { Tournament } from '../../firebase/models';
import type { TournamentFormat } from '../../utils/fixtureUtils';
import { generateFixtures, calculateTotalMatches } from '../../utils/fixtureUtils';

interface FixtureGenerationModalProps {
  tournament: Tournament;
  isOpen: boolean;
  onClose: () => void;
  onGenerateFixtures: (
    format: TournamentFormat,
    category: string,
    playersPerCategory?: number,
    groupCount?: number,
    matchFrequency?: number,
    playoffStructure?: 'quarterFinals' | 'semiFinals' | 'finalOnly'
  ) => void;
  selectedCategory: string;
}

const FixtureGenerationModal: React.FC<FixtureGenerationModalProps> = ({
  tournament,
  isOpen,
  onClose,
  onGenerateFixtures,
  selectedCategory
}) => {
  const [selectedFormat, setSelectedFormat] = useState<TournamentFormat>('singleElimination');
  const [groupCount, setGroupCount] = useState<number>(2);
  const [loading, setLoading] = useState(false);

  // Calculate the estimated number of matches
  const getEstimatedMatches = (): number => {
    try {
      // For round robin groups or pool+playoffs, pass the selected group count
      let fixtures;
      if (selectedFormat === 'roundRobinGroups') {
        fixtures = generateFixtures(tournament, selectedFormat, 20, groupCount);
        return calculateTotalMatches(fixtures);
      } else if (selectedFormat === 'poolPlayPlayoffs' || selectedFormat === 'poolPlayCups') {
        fixtures = generateFixtures(tournament, selectedFormat, 20, groupCount);
        const poolMatches = calculateTotalMatches(fixtures);
        
        // Estimate playoff matches based on group count and structure
        let playoffMatches = 0;
        
        // Different playoff structures have different numbers of matches
        if (tournament.categories?.some(cat =>
            (cat === 'Mens Singles' || cat === 'Womens Singles')
        )) {
          // QuarterFinals: 4 QF + 2 SF + 1 Final + 1 3rd place = 8 matches
          // SemiFinals: 2 SF + 1 Final + 1 3rd place = 4 matches
          // FinalOnly: 1 Final + 1 3rd place = 2 matches
          
          // Default to quarterfinals structure for estimation
          playoffMatches = 8;
        }
        
        return poolMatches + playoffMatches;
      } else {
        fixtures = generateFixtures(tournament, selectedFormat, 20);
        return calculateTotalMatches(fixtures);
      }
    } catch (error) {
      console.error('Error calculating matches:', error);
      return 0;
    }
  };

  const handleGenerateFixtures = () => {
    setLoading(true);
    setTimeout(() => {
      // Pass group count for round robin groups format or pool play formats (always)
      if (selectedFormat === 'roundRobinGroups' ||
          selectedFormat === 'poolPlayPlayoffs' ||
          selectedFormat === 'poolPlayCups') {
        onGenerateFixtures(selectedFormat, selectedCategory, 20, groupCount);
      } else {
        onGenerateFixtures(selectedFormat, selectedCategory, 20);
      }
      setLoading(false);
    }, 500);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 overflow-hidden">
        <div className="bg-blue-600 text-white px-6 py-4">
          <h3 className="text-xl font-semibold">Generate Tournament Fixtures</h3>
        </div>
        
        <div className="p-6">
          <div className="mb-6">
            <p className="text-gray-700 mb-2">
              Generate fixtures for {tournament.name}. This will create match schedules based on the selected format.
            </p>
            
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 text-sm text-yellow-800 mb-4">
              <p>
                <strong>Note:</strong> If there are fewer than 20 players registered, the system will automatically add placeholder players to ensure fair brackets.
              </p>
            </div>
          </div>
          
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Tournament Format
            </label>
            <select
              value={selectedFormat}
              onChange={(e) => setSelectedFormat(e.target.value as TournamentFormat)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="roundRobin">Round Robin (single group)</option>
              <option value="roundRobinGroups">Round Robin (split into groups)</option>
              <option value="singleElimination">Single Elimination</option>
              <option value="doubleElimination">Double Elimination</option>
              <option value="poolPlayPlayoffs">Pool Play + Playoffs</option>
              <option value="poolPlayCups">Pool Play + Cups</option>
              <option value="swiss">Swiss System</option>
            </select>
          </div>
          
          {/* Group count selector for Round Robin Groups or Pool Play formats with Singles */}
          {(selectedFormat === 'roundRobinGroups' ||
            ((selectedFormat === 'poolPlayPlayoffs' || selectedFormat === 'poolPlayCups') && tournament.categories?.some(cat =>
              (cat === 'Mens Singles' || cat === 'Womens Singles')
            ))
          ) && (
            <div className="mb-6">
              <label className="block text-gray-700 text-sm font-bold mb-2">
                Number of Groups
              </label>
              <select
                value={groupCount}
                onChange={(e) => setGroupCount(parseInt(e.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {[2, 3, 4, 5, 6, 8].map(count => (
                  <option key={count} value={count}>
                    {count} Groups
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-600">
                Players will be divided evenly across {groupCount} groups based on seeding.
              </p>
            </div>
          )}
          
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4 mb-6">
            <h4 className="font-medium text-gray-800 mb-2">Format Details</h4>
            {selectedFormat === 'roundRobin' && (
              <p className="text-sm text-gray-700">
                All participants play against each other once. Best for small tournaments with fewer than 10 players.
              </p>
            )}
            {selectedFormat === 'roundRobinGroups' && (
              <p className="text-sm text-gray-700">
                Players are divided into {groupCount} groups, with round-robin play within each group. Good for medium-sized tournaments. Players are distributed based on seeding to ensure balanced groups.
              </p>
            )}
            {selectedFormat === 'singleElimination' && (
              <p className="text-sm text-gray-700">
                Knockout format where players are eliminated after a single loss. Quick to complete but provides less play time.
              </p>
            )}
            {selectedFormat === 'doubleElimination' && (
              <p className="text-sm text-gray-700">
                Players must lose twice to be eliminated, with separate winners and losers brackets.
              </p>
            )}
            {selectedFormat === 'poolPlayPlayoffs' && (
              <p className="text-sm text-gray-700">
                Initial round-robin group play followed by knockout playoffs for the top performers from each group.
              </p>
            )}
            {selectedFormat === 'poolPlayCups' && (
              <p className="text-sm text-gray-700">
                Initial round-robin group play followed by Gold and Silver Cup competitions. Top performers compete in Gold Cup, others in Silver Cup.
              </p>
            )}
            {selectedFormat === 'swiss' && (
              <p className="text-sm text-gray-700">
                Players are paired with others who have similar records. Everyone plays the same number of matches.
              </p>
            )}
          </div>
          
          <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-6">
            <p className="text-sm text-blue-800">
              <strong>Estimated matches:</strong> {getEstimatedMatches()} total matches across all categories
            </p>
          </div>
        </div>
        
        <div className="bg-gray-50 px-6 py-4 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none"
          >
            Cancel
          </button>
          <button
            onClick={handleGenerateFixtures}
            disabled={loading}
            className={`px-4 py-2 rounded-md text-white ${
              loading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
            } focus:outline-none`}
          >
            {loading ? 'Generating...' : 'Generate Fixtures'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default FixtureGenerationModal;