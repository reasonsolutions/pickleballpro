import React, { useState, useEffect } from 'react';
import type { Tournament } from '../../firebase/models';
import type { TournamentFormat } from '../../utils/fixtureUtils';
import { generateFixtures, calculateTotalMatches } from '../../utils/fixtureUtils';

interface TournamentSetupModalProps {
  tournament: Tournament;
  isOpen: boolean;
  onClose: () => void;
  initialCategory?: string;
  onGenerateFixtures: (
    format: TournamentFormat,
    category: string,
    playersPerCategory: number,
    groupSize?: number,
    matchFrequency?: number,
    playoffStructure?: 'quarterFinals' | 'semiFinals' | 'finalOnly'
  ) => void;
}

type Step = 'format' | 'category' | 'players' | 'groups' | 'frequency' | 'playoffs' | 'review';

interface FormData {
  format: TournamentFormat;
  category: string;
  playersPerCategory: number;
  teamsPerGroup: number;
  matchFrequency: number;
  playoffStructure: 'quarterFinals' | 'semiFinals' | 'finalOnly';
}

const TournamentSetupModal: React.FC<TournamentSetupModalProps> = ({
  tournament,
  isOpen,
  onClose,
  onGenerateFixtures,
  initialCategory
}) => {
  // Steps navigation
  const [currentStep, setCurrentStep] = useState<Step>('format');
  const [loading, setLoading] = useState(false);
  const [estimatedMatches, setEstimatedMatches] = useState(0);
  
  // Form data
  const [formData, setFormData] = useState<FormData>({
    format: 'singleElimination',
    category: initialCategory || tournament.categories?.[0] || '',
    playersPerCategory: 20,
    teamsPerGroup: 4,
    matchFrequency: 1,
    playoffStructure: 'quarterFinals'
  });

  // Form validation
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Update estimated matches when form data changes
  useEffect(() => {
    try {
      if (formData.format === 'roundRobinGroups' || formData.format === 'poolPlayPlayoffs' || formData.format === 'poolPlayCups') {
        const fixtures = generateFixtures(
          tournament,
          formData.format,
          formData.playersPerCategory,
          formData.teamsPerGroup,
          undefined,
          formData.category
        );
        setEstimatedMatches(calculateTotalMatches(fixtures));
      } else {
        const fixtures = generateFixtures(
          tournament,
          formData.format,
          formData.playersPerCategory,
          undefined,
          undefined,
          formData.category
        );
        setEstimatedMatches(calculateTotalMatches(fixtures));
      }
    } catch (error) {
      console.error('Error calculating matches:', error);
      setEstimatedMatches(0);
    }
  }, [formData, tournament]);

  if (!isOpen) return null;

  // Function to handle form field changes
  const handleChange = (field: keyof FormData, value: any) => {
    setFormData({
      ...formData,
      [field]: value
    });

    // Clear error for this field
    if (errors[field]) {
      setErrors({
        ...errors,
        [field]: ''
      });
    }
  };

  // Validate current step
  const validateStep = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    switch (currentStep) {
      case 'format':
        if (!formData.format) {
          newErrors.format = 'Please select a tournament format';
        }
        break;
      case 'category':
        if (!formData.category) {
          newErrors.category = 'Please select a category';
        }
        break;
      case 'players':
        if (formData.playersPerCategory < 4) {
          newErrors.playersPerCategory = 'Minimum 4 players required';
        } else if (formData.playersPerCategory > 64) {
          newErrors.playersPerCategory = 'Maximum 64 players allowed';
        }
        break;
      case 'groups':
        if (formData.teamsPerGroup < 3) {
          newErrors.teamsPerGroup = 'Minimum 3 teams per group required';
        } else if (formData.teamsPerGroup > 8) {
          newErrors.teamsPerGroup = 'Maximum 8 teams per group allowed';
        }
        break;
      default:
        break;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Handle next button click
  const handleNext = () => {
    if (!validateStep()) return;
    
    switch (currentStep) {
      case 'format':
        setCurrentStep('category');
        break;
      case 'category':
        setCurrentStep('players');
        break;
      case 'players':
        // Show groups step for doubles categories or singles in pool+playoffs format
        if ((formData.format === 'poolPlayPlayoffs' || formData.format === 'poolPlayCups' || formData.format === 'roundRobinGroups') &&
            (formData.category.toLowerCase().includes('doubles') ||
             ((formData.format === 'poolPlayPlayoffs' || formData.format === 'poolPlayCups') &&
              (formData.category === 'Mens Singles' || formData.category === 'Womens Singles')))) {
          setCurrentStep('groups');
        } else {
          setCurrentStep('frequency');
        }
        break;
      case 'groups':
        setCurrentStep('frequency');
        break;
      case 'frequency':
        if (formData.format === 'poolPlayPlayoffs' ||
            formData.format === 'poolPlayCups' ||
            formData.format === 'singleElimination' ||
            formData.format === 'doubleElimination') {
          setCurrentStep('playoffs');
        } else {
          setCurrentStep('review');
        }
        break;
      case 'playoffs':
        setCurrentStep('review');
        break;
      default:
        break;
    }
  };

  // Handle previous button click
  const handlePrevious = () => {
    switch (currentStep) {
      case 'category':
        setCurrentStep('format');
        break;
      case 'players':
        setCurrentStep('category');
        break;
      case 'groups':
        setCurrentStep('players');
        break;
      case 'frequency':
        // Go back to groups step for doubles categories or singles in pool+playoffs format
        if ((formData.format === 'poolPlayPlayoffs' || formData.format === 'poolPlayCups' || formData.format === 'roundRobinGroups') &&
            (formData.category.toLowerCase().includes('doubles') ||
             ((formData.format === 'poolPlayPlayoffs' || formData.format === 'poolPlayCups') &&
              (formData.category === 'Mens Singles' || formData.category === 'Womens Singles')))) {
          setCurrentStep('groups');
        } else {
          setCurrentStep('players');
        }
        break;
      case 'playoffs':
        setCurrentStep('frequency');
        break;
      case 'review':
        if (formData.format === 'poolPlayPlayoffs' ||
            formData.format === 'poolPlayCups' ||
            formData.format === 'singleElimination' ||
            formData.format === 'doubleElimination') {
          setCurrentStep('playoffs');
        } else {
          setCurrentStep('frequency');
        }
        break;
      default:
        break;
    }
  };

  // Handle generate fixtures
  const handleGenerateFixtures = () => {
    setLoading(true);
    setTimeout(() => {
      // Get the teams per group from form data
      const totalTeams = formData.playersPerCategory;
      const teamsPerGroup = formData.teamsPerGroup;
      
      // This parameter will be used to calculate group count for formats that use groups
      let groupParameter = teamsPerGroup;
      
      // For pool play and round robin formats, calculate the number of groups
      if (formData.format === 'poolPlayPlayoffs' || formData.format === 'poolPlayCups' || formData.format === 'roundRobinGroups') {
        // Calculate the number of groups based on total players and players per group
        if (teamsPerGroup > 0) {
          // Calculate the group count
          const calculatedGroupCount = Math.ceil(totalTeams / teamsPerGroup);
          
          groupParameter = calculatedGroupCount;
          console.log(`Using ${groupParameter} groups for ${totalTeams} teams with ${teamsPerGroup} teams per group`);
        }
      }
      
      onGenerateFixtures(
        formData.format,
        formData.category,
        formData.playersPerCategory,
        groupParameter, // This is either group count or teams per group depending on format
        formData.matchFrequency,
        formData.playoffStructure
      );
      setLoading(false);
      onClose();
    }, 500);
  };

  // Render step content
  const renderStepContent = () => {
    switch (currentStep) {
      case 'format':
        return (
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Tournament Format
            </label>
            <select
              value={formData.format}
              onChange={(e) => handleChange('format', e.target.value as TournamentFormat)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="roundRobin">Round Robin</option>
              <option value="singleElimination">Single Elimination</option>
              <option value="doubleElimination">Double Elimination</option>
              <option value="poolPlayPlayoffs">Pool Play + Playoffs</option>
              <option value="poolPlayCups">Pool Play + Cups</option>
              <option value="swiss">Swiss System</option>
            </select>
            {errors.format && <p className="text-red-500 text-xs mt-1">{errors.format}</p>}
            
            <div className="mt-4 bg-gray-50 border border-gray-200 rounded-md p-4">
              <h4 className="font-medium text-gray-800 mb-2">Format Details</h4>
              {formData.format === 'roundRobin' && (
                <p className="text-sm text-gray-700">
                  All participants play against each other once. Best for small tournaments with fewer than 10 players.
                </p>
              )}
              {formData.format === 'roundRobinGroups' && (
                <p className="text-sm text-gray-700">
                  Players are divided into groups, with round-robin play within each group. Good for medium-sized tournaments.
                </p>
              )}
              {formData.format === 'singleElimination' && (
                <p className="text-sm text-gray-700">
                  Knockout format where players are eliminated after a single loss. Quick to complete but provides less play time.
                </p>
              )}
              {formData.format === 'doubleElimination' && (
                <p className="text-sm text-gray-700">
                  Players must lose twice to be eliminated, with separate winners and losers brackets.
                </p>
              )}
              {formData.format === 'poolPlayPlayoffs' && (
                <p className="text-sm text-gray-700">
                  Initial round-robin group play followed by knockout playoffs for the top performers from each group.
                </p>
              )}
              {formData.format === 'poolPlayCups' && (
                <p className="text-sm text-gray-700">
                  Initial round-robin group play followed by knockout playoffs for the top performers from each group.
                </p>
              )}
              {formData.format === 'swiss' && (
                <p className="text-sm text-gray-700">
                  Players are paired with others who have similar records. Everyone plays the same number of matches.
                </p>
              )}
            </div>
          </div>
        );

      case 'category':
        return (
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Category Selection
            </label>
            <select
              value={formData.category}
              onChange={(e) => handleChange('category', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {tournament.categories?.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category}</p>}
            
            <p className="mt-4 text-sm text-gray-600">
              Select the category for which you want to generate fixtures.
              Each category will have its own set of fixtures.
              {formData.category.toLowerCase().includes('doubles') &&
                " For doubles categories, you'll be able to configure team groupings in the next steps."}
            </p>
          </div>
        );

      case 'players':
        return (
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              {formData.category.toLowerCase().includes('doubles') ?
                'Teams per Category' : 'Players per Category'}
            </label>
            <input
              type="number"
              value={formData.playersPerCategory}
              onChange={(e) => handleChange('playersPerCategory', parseInt(e.target.value))}
              min={4}
              max={64}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.playersPerCategory && <p className="text-red-500 text-xs mt-1">{errors.playersPerCategory}</p>}
            
            <p className="mt-4 text-sm text-gray-600">
              {formData.category.toLowerCase().includes('doubles') ?
                `Specify the number of teams for this category. If fewer teams are registered,
                 the system will add placeholder teams to ensure fair brackets.` :
                `Specify the number of players for this category. If fewer players are registered,
                 the system will add placeholder players to ensure fair brackets.`}
            </p>
          </div>
        );

      case 'groups':
        return (
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              {formData.category.toLowerCase().includes('doubles') ?
                'Teams per Group' : 'Players per Group'}
            </label>
            <input
              type="number"
              value={formData.teamsPerGroup}
              onChange={(e) => handleChange('teamsPerGroup', parseInt(e.target.value))}
              min={3}
              max={8}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            {errors.teamsPerGroup && <p className="text-red-500 text-xs mt-1">{errors.teamsPerGroup}</p>}
            
            <div className="mt-4 bg-blue-50 p-3 rounded-md border border-blue-100">
              <p className="text-sm text-blue-800 font-medium mb-1">How Groups Will Be Created:</p>
              <p className="text-sm text-blue-700">
                For Pool Play or Round Robin Groups format, specify how many {formData.category.toLowerCase().includes('doubles') ? 'teams' : 'players'} should be in <strong>each group</strong>.
              </p>
              <p className="text-sm text-blue-700 mt-1">
                <strong>Example:</strong> If you have {formData.playersPerCategory} {formData.category.toLowerCase().includes('doubles') ? 'teams' : 'players'} total and want {formData.teamsPerGroup} per group,
                the system will create <strong>{Math.ceil(formData.playersPerCategory / formData.teamsPerGroup)} groups</strong>.
              </p>
            </div>
          </div>
        );

      case 'frequency':
        return (
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Match Frequency
            </label>
            <div className="space-y-2">
              <div className="flex items-center">
                <input
                  type="radio"
                  id="frequency-1"
                  name="matchFrequency"
                  value={1}
                  checked={formData.matchFrequency === 1}
                  onChange={() => handleChange('matchFrequency', 1)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <label htmlFor="frequency-1" className="ml-2 text-sm text-gray-700">
                  Play once
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="radio"
                  id="frequency-2"
                  name="matchFrequency"
                  value={2}
                  checked={formData.matchFrequency === 2}
                  onChange={() => handleChange('matchFrequency', 2)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <label htmlFor="frequency-2" className="ml-2 text-sm text-gray-700">
                  Play twice
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="radio"
                  id="frequency-3"
                  name="matchFrequency"
                  value={3}
                  checked={formData.matchFrequency === 3}
                  onChange={() => handleChange('matchFrequency', 3)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <label htmlFor="frequency-3" className="ml-2 text-sm text-gray-700">
                  Play three times
                </label>
              </div>
            </div>
            
            <p className="mt-4 text-sm text-gray-600">
              Select how many times each pair of players should compete against each other.
              This applies primarily to round-robin formats.
            </p>
          </div>
        );

      case 'playoffs':
        return (
          <div>
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Playoff Structure
            </label>
            <div className="space-y-2">
              <div className="flex items-center">
                <input
                  type="radio"
                  id="playoffs-quarter"
                  name="playoffStructure"
                  value="quarterFinals"
                  checked={formData.playoffStructure === 'quarterFinals'}
                  onChange={() => handleChange('playoffStructure', 'quarterFinals')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <label htmlFor="playoffs-quarter" className="ml-2 text-sm text-gray-700">
                  Quarter Finals → Semi Finals → Final
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="radio"
                  id="playoffs-semi"
                  name="playoffStructure"
                  value="semiFinals"
                  checked={formData.playoffStructure === 'semiFinals'}
                  onChange={() => handleChange('playoffStructure', 'semiFinals')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <label htmlFor="playoffs-semi" className="ml-2 text-sm text-gray-700">
                  Semi Finals → Final
                </label>
              </div>
              <div className="flex items-center">
                <input
                  type="radio"
                  id="playoffs-final"
                  name="playoffStructure"
                  value="finalOnly"
                  checked={formData.playoffStructure === 'finalOnly'}
                  onChange={() => handleChange('playoffStructure', 'finalOnly')}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                />
                <label htmlFor="playoffs-final" className="ml-2 text-sm text-gray-700">
                  Final only
                </label>
              </div>
            </div>
            
            <p className="mt-4 text-sm text-gray-600">
              Select the playoff structure for elimination formats or after pool play.
            </p>
          </div>
        );

      case 'review':
        return (
          <div>
            <h4 className="font-medium text-gray-800 mb-4">Review Your Settings</h4>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-600">Tournament Format</p>
                <p className="text-sm text-gray-800">
                  {formData.format === 'roundRobin' && 'Round Robin'}
                  {formData.format === 'singleElimination' && 'Single Elimination'}
                  {formData.format === 'doubleElimination' && 'Double Elimination'}
                  {formData.format === 'poolPlayPlayoffs' && 'Pool Play + Playoffs'}
                  {formData.format === 'poolPlayCups' && 'Pool Play + Cups'}
                  {formData.format === 'swiss' && 'Swiss System'}
                </p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-600">Category</p>
                <p className="text-sm text-gray-800">{formData.category}</p>
              </div>
              
              <div>
                <p className="text-sm font-medium text-gray-600">
                  {formData.category.toLowerCase().includes('doubles') ?
                    'Teams per Category' : 'Players per Category'}
                </p>
                <p className="text-sm text-gray-800">{formData.playersPerCategory}</p>
              </div>
              
              {(formData.format === 'poolPlayPlayoffs' || formData.format === 'poolPlayCups' || formData.format === 'roundRobinGroups') &&
                formData.category.toLowerCase().includes('doubles') && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Teams Configuration</p>
                  <p className="text-sm text-gray-800">
                    {Math.ceil(formData.playersPerCategory / formData.teamsPerGroup)} groups with {formData.teamsPerGroup} teams per group
                  </p>
                </div>
              )}
              
              <div>
                <p className="text-sm font-medium text-gray-600">Match Frequency</p>
                <p className="text-sm text-gray-800">
                  {formData.matchFrequency === 1 && 'Play once'}
                  {formData.matchFrequency === 2 && 'Play twice'}
                  {formData.matchFrequency === 3 && 'Play three times'}
                </p>
              </div>
              
              {(formData.format === 'poolPlayPlayoffs' ||
                formData.format === 'poolPlayCups' ||
                formData.format === 'singleElimination' ||
                formData.format === 'doubleElimination') && (
                <div>
                  <p className="text-sm font-medium text-gray-600">Playoff Structure</p>
                  <p className="text-sm text-gray-800">
                    {formData.playoffStructure === 'quarterFinals' && 'Quarter Finals → Semi Finals → Final'}
                    {formData.playoffStructure === 'semiFinals' && 'Semi Finals → Final'}
                    {formData.playoffStructure === 'finalOnly' && 'Final only'}
                  </p>
                </div>
              )}
            </div>
            
            <div className="mt-6 bg-blue-50 border border-blue-200 rounded-md p-4">
              <p className="text-sm text-blue-800">
                <strong>Estimated matches:</strong> {estimatedMatches} total matches
              </p>
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Render step indicator
  const renderStepIndicator = () => {
    const steps: { key: Step; label: string }[] = [
      { key: 'format', label: 'Format' },
      { key: 'category', label: 'Category' },
      { key: 'players', label: formData.category.toLowerCase().includes('doubles') ? 'Teams' : 'Players' },
    ];
    
    // Only show groups step for doubles categories
    if ((formData.format === 'poolPlayPlayoffs' || formData.format === 'poolPlayCups' || formData.format === 'roundRobinGroups') &&
        formData.category.toLowerCase().includes('doubles')) {
      steps.push({ key: 'groups', label: 'Groups' });
    }
    
    steps.push({ key: 'frequency', label: 'Frequency' });
    
    if (formData.format === 'poolPlayPlayoffs' ||
        formData.format === 'poolPlayCups' ||
        formData.format === 'singleElimination' ||
        formData.format === 'doubleElimination') {
      steps.push({ key: 'playoffs', label: 'Playoffs' });
    }
    
    steps.push({ key: 'review', label: 'Review' });
    
    return (
      <div className="flex items-center justify-center mb-8">
        {steps.map((step, index) => (
          <React.Fragment key={step.key}>
            <div className="flex flex-col items-center">
              <div 
                className={`h-8 w-8 rounded-full flex items-center justify-center ${
                  currentStep === step.key
                    ? 'bg-blue-600 text-white'
                    : steps.indexOf({ key: currentStep, label: '' }) > index
                      ? 'bg-green-500 text-white'
                      : 'bg-gray-200 text-gray-600'
                }`}
              >
                {steps.indexOf({ key: currentStep, label: '' }) > index ? (
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                ) : (
                  index + 1
                )}
              </div>
              <span className="text-xs mt-1">{step.label}</span>
            </div>
            
            {index < steps.length - 1 && (
              <div className="w-10 h-0.5 bg-gray-200 mx-1"></div>
            )}
          </React.Fragment>
        ))}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 overflow-hidden">
        <div className="bg-blue-600 text-white px-6 py-4">
          <h3 className="text-xl font-semibold">Tournament Setup</h3>
        </div>
        
        <div className="p-6">
          <div className="mb-6">
            <p className="text-gray-700 mb-4">
              Set up fixtures for <strong>{tournament.name}</strong>. 
              This will create match schedules based on your selected format and preferences.
            </p>
          </div>
          
          {renderStepIndicator()}
          
          {renderStepContent()}
        </div>
        
        <div className="bg-gray-50 px-6 py-4 flex justify-between">
          {currentStep !== 'format' ? (
            <button
              onClick={handlePrevious}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none"
            >
              Previous
            </button>
          ) : (
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 focus:outline-none"
            >
              Cancel
            </button>
          )}
          
          {currentStep !== 'review' ? (
            <button
              onClick={handleNext}
              className="px-4 py-2 rounded-md text-white bg-blue-600 hover:bg-blue-700 focus:outline-none"
            >
              Next
            </button>
          ) : (
            <button
              onClick={handleGenerateFixtures}
              disabled={loading}
              className={`px-4 py-2 rounded-md text-white ${
                loading ? 'bg-blue-400' : 'bg-blue-600 hover:bg-blue-700'
              } focus:outline-none`}
            >
              {loading ? 'Generating...' : 'Generate Fixtures'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default TournamentSetupModal;