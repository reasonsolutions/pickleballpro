import React, { useState, useEffect } from 'react';
import { Timestamp } from 'firebase/firestore';
import { createTournament, updateDocById } from '../../firebase/firestore';
import { uploadTournamentImages } from '../../firebase/storage';
import { TOURNAMENT_CATEGORIES } from '../../firebase/models';
import type { TournamentCategory } from '../../firebase/models';
import { useAuth } from '../../context/AuthContext';

interface TournamentFormProps {
  onClose: () => void;
  onSuccess: () => void;
}

const TournamentForm: React.FC<TournamentFormProps> = ({ onClose, onSuccess }) => {
  // Get authentication context
  const { currentUser, userData } = useAuth();

  // Check if user has permission to create tournaments
  if (!userData || (userData.role !== 'facility_manager' && !userData.isAdmin)) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
        <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
          <h2 className="text-xl font-bold text-red-600 mb-4">Access Denied</h2>
          <p className="text-gray-700 mb-4">
            Only facility managers can create tournaments. Please contact your administrator if you believe this is an error.
          </p>
          <button
            onClick={onClose}
            className="w-full px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    );
  }

  const [name, setName] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [registrationFee, setRegistrationFee] = useState('');
  const [location, setLocation] = useState('');
  const [mapLink, setMapLink] = useState('');
  const [cashPrize, setCashPrize] = useState('');
  const [description, setDescription] = useState('');
  const [categories, setCategories] = useState<TournamentCategory[]>([]);
  const [isDuprRanked, setIsDuprRanked] = useState(false);
  const [images, setImages] = useState<File[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // Schedule for multi-day tournament
  const [schedule, setSchedule] = useState<{
    [date: string]: { startTime: string; endTime: string }
  }>({});
  
  // Tournament rules
  const [rules, setRules] = useState<string[]>(['']);

  const handleCategoryToggle = (category: TournamentCategory) => {
    if (categories.includes(category)) {
      setCategories(categories.filter(c => c !== category));
    } else {
      setCategories([...categories, category]);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) {
      const filesArray = Array.from(e.target.files);
      setImages(prev => [...prev, ...filesArray]);
    }
  };

  const removeImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  // Handle schedule changes when dates change
  useEffect(() => {
    if (startDate && endDate) {
      const start = new Date(startDate);
      const end = new Date(endDate);
      
      // Clear schedule if invalid date range
      if (start > end) {
        setSchedule({});
        return;
      }

      // Create a new schedule object with all dates between start and end
      const newSchedule: typeof schedule = {};
      const currentDate = new Date(start);
      
      while (currentDate <= end) {
        const dateKey = currentDate.toISOString().split('T')[0];
        
        // Keep existing times if available or set defaults
        if (schedule[dateKey]) {
          newSchedule[dateKey] = schedule[dateKey];
        } else {
          newSchedule[dateKey] = { startTime: '09:00', endTime: '17:00' };
        }
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Remove dates that are no longer in range
      Object.keys(schedule).forEach(date => {
        if (!newSchedule[date]) {
          delete schedule[date];
        }
      });
      
      setSchedule(newSchedule);
    }
  }, [startDate, endDate]);

  // Helper for adding tournament rules
  const addRule = () => {
    setRules([...rules, '']);
  };

  const updateRule = (index: number, value: string) => {
    const updatedRules = [...rules];
    updatedRules[index] = value;
    setRules(updatedRules);
  };

  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const validateForm = (): boolean => {
    if (!name) {
      setError('Tournament name is required');
      return false;
    }
    if (!startDate) {
      setError('Start date is required');
      return false;
    }
    if (!endDate) {
      setError('End date is required');
      return false;
    }
    if (!registrationFee) {
      setError('Registration fee is required');
      return false;
    }
    if (!location) {
      setError('Location is required');
      return false;
    }
    if (categories.length === 0) {
      setError('At least one category must be selected');
      return false;
    }
    return true;
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    
    if (!validateForm()) {
      return;
    }

    // Check user permissions
    if (!userData) {
      setError("You must be logged in to create a tournament");
      return;
    }

    // Check if user is a facility manager or has admin privileges
    if (userData.role !== 'facility_manager' && !userData.isAdmin) {
      setError("Only facility managers can create tournaments");
      return;
    }

    try {
      setLoading(true);
      console.log("Form submitted with data:", {
        name, startDate, endDate, registrationFee, location, categories
      });

      // Simplified tournament data - only required fields
      const tournamentData = {
        name,
        description: description || "No description provided",
        startDate: Timestamp.fromDate(new Date(startDate)),
        endDate: Timestamp.fromDate(new Date(endDate)),
        location,
        registrationFee: parseFloat(registrationFee),
        registrationDeadline: Timestamp.fromDate(new Date(startDate)), // Default to start date
        maxParticipants: 100, // Default value
        currentParticipants: 0,
        categories: categories,
        // Add creator information
        createdBy: currentUser?.uid,
        // Add schedule and rules
        schedule: Object.keys(schedule).length > 0 ? schedule : undefined,
        rules: rules.filter(rule => rule.trim() !== '')
      };

      console.log("Tournament data prepared:", tournamentData);

      // Create tournament document
      const tournamentId = await createTournament(tournamentData);
      console.log("Tournament created with ID:", tournamentId);
      
      // Skip image upload for now to simplify the process
      // We'll focus on getting the basic tournament creation working first

      setLoading(false);
      onSuccess();
      onClose();
    } catch (err: any) {
      console.error('Error in tournament creation process:', err);
      
      // Provide more helpful error messages based on common errors
      if (err.message && err.message.includes('permission-denied')) {
        setError("Permission denied: You don't have the required access rights to create tournaments. Only facility managers can create tournaments.");
      } else {
        setError(`Failed to create tournament: ${err.message || 'Unknown error'}`);
      }
      
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-75 flex justify-center items-center z-50">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-2xl font-bold text-gray-800">Create New Tournament</h2>
            <button
              onClick={onClose}
              className="text-gray-500 hover:text-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-100 text-red-700 rounded-lg">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Tournament Name */}
              <div className="col-span-2">
                <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
                  Tournament Name*
                </label>
                <input
                  type="text"
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Dates */}
              <div>
                <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date*
                </label>
                <input
                  type="date"
                  id="startDate"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              <div>
                <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 mb-1">
                  End Date*
                </label>
                <input
                  type="date"
                  id="endDate"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Registration Fee */}
              <div>
                <label htmlFor="registrationFee" className="block text-sm font-medium text-gray-700 mb-1">
                  Registration Fee*
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500">₹</span>
                  </div>
                  <input
                    type="number"
                    id="registrationFee"
                    value={registrationFee}
                    onChange={(e) => setRegistrationFee(e.target.value)}
                    className="w-full pl-7 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="0.01"
                    required
                  />
                </div>
              </div>

              {/* Cash Prize */}
              <div>
                <label htmlFor="cashPrize" className="block text-sm font-medium text-gray-700 mb-1">
                  Cash Prize
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <span className="text-gray-500">₹</span>
                  </div>
                  <input
                    type="number"
                    id="cashPrize"
                    value={cashPrize}
                    onChange={(e) => setCashPrize(e.target.value)}
                    className="w-full pl-7 px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    min="0"
                    step="0.01"
                  />
                </div>
              </div>

              {/* Location */}
              <div>
                <label htmlFor="location" className="block text-sm font-medium text-gray-700 mb-1">
                  Location*
                </label>
                <input
                  type="text"
                  id="location"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>

              {/* Google Maps Link */}
              <div>
                <label htmlFor="mapLink" className="block text-sm font-medium text-gray-700 mb-1">
                  Google Maps Link
                </label>
                <input
                  type="url"
                  id="mapLink"
                  value={mapLink}
                  onChange={(e) => setMapLink(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="https://maps.google.com/?q=..."
                />
              </div>

              {/* Categories */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Categories*
                </label>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {TOURNAMENT_CATEGORIES.map((category) => (
                    <div key={category} className="flex items-center">
                      <input
                        type="checkbox"
                        id={`category-${category}`}
                        checked={categories.includes(category)}
                        onChange={() => handleCategoryToggle(category)}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                      />
                      <label htmlFor={`category-${category}`} className="ml-2 text-sm text-gray-700">
                        {category}
                      </label>
                    </div>
                  ))}
                </div>
              </div>

              {/* DUPR Ranked */}
              <div className="col-span-2">
                <div className="flex items-center">
                  <input
                    type="checkbox"
                    id="isDuprRanked"
                    checked={isDuprRanked}
                    onChange={(e) => setIsDuprRanked(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <label htmlFor="isDuprRanked" className="ml-2 text-sm text-gray-700">
                    DUPR Ranked Tournament
                  </label>
                </div>
              </div>

              {/* Description */}
              <div className="col-span-2">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={4}
                />
              </div>
              
              {/* Schedule */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Tournament Schedule*
                </label>
                <div className="border border-gray-300 rounded-md p-4 space-y-4">
                  {Object.keys(schedule).length === 0 ? (
                    <p className="text-sm text-gray-500">Please select start and end dates to configure the schedule.</p>
                  ) : (
                    <div className="space-y-3">
                      {Object.keys(schedule).sort().map((date) => (
                        <div key={date} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="bg-gray-50 p-3 rounded-md">
                            <h4 className="text-sm font-semibold mb-2">
                              {new Date(date).toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                            </h4>
                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label htmlFor={`startTime-${date}`} className="block text-xs text-gray-600 mb-1">
                                  Start Time
                                </label>
                                <input
                                  type="time"
                                  id={`startTime-${date}`}
                                  value={schedule[date].startTime}
                                  onChange={(e) => {
                                    const newSchedule = {...schedule};
                                    newSchedule[date] = {
                                      ...newSchedule[date],
                                      startTime: e.target.value
                                    };
                                    setSchedule(newSchedule);
                                  }}
                                  className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                                  required
                                />
                              </div>
                              <div>
                                <label htmlFor={`endTime-${date}`} className="block text-xs text-gray-600 mb-1">
                                  End Time
                                </label>
                                <input
                                  type="time"
                                  id={`endTime-${date}`}
                                  value={schedule[date].endTime}
                                  onChange={(e) => {
                                    const newSchedule = {...schedule};
                                    newSchedule[date] = {
                                      ...newSchedule[date],
                                      endTime: e.target.value
                                    };
                                    setSchedule(newSchedule);
                                  }}
                                  className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm"
                                  required
                                />
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-gray-500">Schedule will automatically adjust based on the tournament dates.</p>
              </div>
              
              {/* Tournament Rules */}
              <div className="col-span-2">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Tournament Rules
                  </label>
                  <button
                    type="button"
                    onClick={addRule}
                    className="text-sm text-blue-600 hover:text-blue-800"
                  >
                    + Add Rule
                  </button>
                </div>
                <div className="space-y-3 mb-2">
                  {rules.map((rule, index) => (
                    <div key={index} className="flex items-start">
                      <input
                        type="text"
                        value={rule}
                        onChange={(e) => updateRule(index, e.target.value)}
                        placeholder={`Rule #${index + 1}`}
                        className="flex-grow px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      {rules.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRule(index)}
                          className="ml-2 p-2 text-red-500 hover:text-red-700"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
                <p className="text-xs text-gray-500">Add important rules and regulations for this tournament.</p>
              </div>

              {/* Images */}
              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Images
                </label>
                <div className="flex items-center justify-center w-full">
                  <label className="flex flex-col items-center justify-center w-full h-32 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6">
                      <svg className="w-8 h-8 mb-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 16">
                        <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 13h3a3 3 0 0 0 0-6h-.025A5.56 5.56 0 0 0 16 6.5 5.5 5.5 0 0 0 5.207 5.021C5.137 5.017 5.071 5 5 5a4 4 0 0 0 0 8h2.167M10 15V6m0 0L8 8m2-2 2 2"/>
                      </svg>
                      <p className="mb-2 text-sm text-gray-500"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                      <p className="text-xs text-gray-500">PNG, JPG or JPEG (MAX. 10MB each)</p>
                    </div>
                    <input 
                      type="file" 
                      className="hidden" 
                      multiple
                      accept="image/*"
                      onChange={handleImageChange}
                    />
                  </label>
                </div>

                {/* Preview of selected images */}
                {images.length > 0 && (
                  <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-4">
                    {images.map((file, index) => (
                      <div key={index} className="relative group">
                        <img
                          src={URL.createObjectURL(file)}
                          alt={`Preview ${index}`}
                          className="h-24 w-full object-cover rounded-md"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(index)}
                          className="absolute top-1 right-1 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium text-white bg-blue-600 border border-transparent rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
                disabled={loading}
              >
                {loading ? 'Creating...' : 'Create Tournament'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default TournamentForm;