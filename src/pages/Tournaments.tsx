import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { orderBy, doc, serverTimestamp, setDoc } from 'firebase/firestore';
import { useCollection } from '../hooks/useFirestore';
import { useAuth } from '../context/AuthContext';
import TournamentForm from '../components/tournaments/TournamentForm';
import type { Tournament } from '../firebase/models';
import { deleteDocById } from '../firebase/firestore';
import { db } from '../firebase/config';

export default function Tournaments() {
  const navigate = useNavigate();
  const { userData } = useAuth();
  const [showForm, setShowForm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteMessage, setDeleteMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const { documents: tournaments, loading, error } = useCollection<Tournament>(
    'tournaments',
    [orderBy('startDate', 'asc')]
  );

  // Check for and remove demo tournaments on component mount (if user is admin or facility manager)
  useEffect(() => {
    const removeDemoTournaments = async () => {
      if (!tournaments || !(userData?.isAdmin || userData?.role === 'facility_manager')) return;
      
      const demoTournaments = tournaments.filter(t =>
        t.name.toLowerCase().includes('demo') ||
        t.name.toLowerCase().includes('test') ||
        t.description?.toLowerCase().includes('demo tournament')
      );
      
      if (demoTournaments.length > 0) {
        for (const tournament of demoTournaments) {
          try {
            await deleteDocById('tournaments', tournament.id);
            console.log(`Removed demo tournament: ${tournament.name}`);
          } catch (error) {
            console.error(`Error removing demo tournament ${tournament.name}:`, error);
          }
        }
        
        // Set a flag in Firestore to indicate demo tournaments were deleted
        try {
          const flagsRef = doc(db, 'system_flags', 'demo_tournaments');
          await setDoc(flagsRef, {
            deleted: true,
            deletedAt: serverTimestamp(),
            deletedBy: userData?.uid || 'unknown'
          });
          console.log('Set demo tournaments deleted flag');
        } catch (error) {
          console.error('Error setting demo tournaments flag:', error);
        }
      }
    };
    
    removeDemoTournaments();
  }, [tournaments, userData]);

  const handleCreateTournament = () => {
    setShowForm(true);
  };

  const handleFormClose = () => {
    setShowForm(false);
  };

  const handleFormSuccess = () => {
    // Firestore hooks will automatically update the UI
  };

  // Function to handle tournament deletion
  const handleDeleteTournament = async (tournamentId: string, tournamentName: string) => {
    if (!tournamentId) return;
    
    if (!confirm(`Are you sure you want to delete the tournament "${tournamentName}"? This action cannot be undone.`)) {
      return;
    }
    
    setIsDeleting(true);
    setDeleteMessage(null);
    
    try {
      await deleteDocById('tournaments', tournamentId);
      
      // If this is a demo tournament, set the flag
      const isDemoTournament = tournamentName.toLowerCase().includes('demo') ||
        tournamentName.toLowerCase().includes('test');
        
      if (isDemoTournament) {
        // Set a flag in Firestore to indicate demo tournaments were deleted
        try {
          const flagsRef = doc(db, 'system_flags', 'demo_tournaments');
          await setDoc(flagsRef, {
            deleted: true,
            deletedAt: serverTimestamp(),
            deletedBy: userData?.uid || 'unknown'
          });
          console.log('Set demo tournaments deleted flag');
        } catch (flagError) {
          console.error('Error setting demo tournaments flag:', flagError);
        }
      }
      
      setDeleteMessage({
        type: 'success',
        text: `Tournament "${tournamentName}" deleted successfully`
      });
      
      // Message will automatically disappear after 3 seconds
      setTimeout(() => {
        setDeleteMessage(null);
      }, 3000);
    } catch (error) {
      console.error('Error deleting tournament:', error);
      setDeleteMessage({
        type: 'error',
        text: 'Failed to delete tournament. Please try again.'
      });
    } finally {
      setIsDeleting(false);
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

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Tournaments</h1>
          <p className="text-gray-600">View and manage pickleball tournaments</p>
        </div>
        {/* Only show Create Tournament button for facility managers */}
        {(userData?.role === 'facility_manager' || userData?.isAdmin) && (
          <div className="flex gap-2">
            <button
              onClick={handleCreateTournament}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50"
            >
              Create Tournament
            </button>
          </div>
        )}
      </div>
      
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          {error}
        </div>
      )}
      
      {loading ? (
        <div className="glass-card p-6">
          <div className="text-center py-12">
            <p className="text-gray-600">Loading tournaments...</p>
          </div>
        </div>
      ) : tournaments && tournaments.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {tournaments.map((tournament) => (
            <div
              key={tournament.id}
              className="glass-card overflow-hidden flex flex-col cursor-pointer hover:shadow-lg transition-shadow relative tournament-image-gradient"
            >
              {/* Delete button for facility managers and admins */}
              {(userData?.role === 'facility_manager' || userData?.isAdmin) && (
                <button
                  className="absolute top-2 right-2 z-20 bg-red-500 text-white rounded-full p-1 hover:bg-red-600 transition-colors"
                  onClick={(e) => {
                    e.stopPropagation(); // Prevent card click
                    handleDeleteTournament(tournament.id, tournament.name);
                  }}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                  </svg>
                </button>
              )}
              
              <div 
                className="w-full h-full"
                onClick={() => {
                  if (userData?.role === 'facility_manager' || userData?.isAdmin) {
                    navigate(`/dashboard/tournaments/facility/${tournament.id}`);
                  } else {
                    navigate(`/dashboard/tournaments/${tournament.id}`);
                  }
                }}
              >
                {/* Background image that fills the entire card */}
                <img
                  src={tournament.imageURLs && tournament.imageURLs.length > 0
                    ? tournament.imageURLs[0]
                    : "https://i.pinimg.com/736x/a5/a0/ce/a5a0ce9bdc9589e58b42e28e92dd5b8e.jpg"}
                  alt={tournament.name}
                  className="absolute inset-0 w-full h-full object-cover"
                />
                
                {/* Tournament content overlay */}
                <div className="relative z-10 flex flex-col h-full">
                  {/* Top section with tournament name and details */}
                  <div className="p-5 flex-grow">
                    <h3 className="text-xl font-semibold text-white mb-2">{tournament.name}</h3>
                    
                    <div className="flex items-center text-white/90 mb-2">
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
                    
                    <div className="flex items-center text-white/90 mb-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                      <span>{tournament.location}</span>
                    </div>
                    
                    {tournament.categories && tournament.categories.length > 0 && (
                      <div className="mb-3">
                        <div className="flex flex-wrap gap-2">
                          {tournament.categories.map((category, index) => (
                            <span key={index} className="px-2 py-1 bg-white/20 text-white text-xs rounded-full">
                              {category}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    
                    {tournament.description && (
                      <p className="text-white/90 mb-3 line-clamp-2">{tournament.description}</p>
                    )}
                  </div>
                  
                  {/* Bottom section with pricing info */}
                  <div className="bg-white/10 backdrop-blur-sm px-5 py-3 border-t border-white/20">
                    <div className="flex justify-between items-center">
                      <div className="font-semibold text-white">
                        ₹{tournament.registrationFee}
                        <span className="text-xs text-white/80 ml-1">registration</span>
                      </div>
                      
                      {tournament.isDuprRanked && (
                        <span className="px-2 py-1 bg-green-500/30 text-white text-xs rounded-full">
                          DUPR Ranked
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="glass-card p-6">
          <div className="text-center py-12">
            <h2 className="text-xl font-medium text-gray-700 mb-2">No Tournaments Found</h2>
            <p className="text-gray-600">
              Get started by creating your first tournament.
            </p>
          </div>
        </div>
      )}
      
      {/* Delete status message */}
      {deleteMessage && (
        <div className={`fixed bottom-4 right-4 p-4 rounded-md shadow-md ${
          deleteMessage.type === 'success' ? 'bg-green-500' : 'bg-red-500'
        } text-white`}>
          {deleteMessage.text}
        </div>
      )}
      
      {showForm && (
        <TournamentForm onClose={handleFormClose} onSuccess={handleFormSuccess} />
      )}
    </div>
  );
}