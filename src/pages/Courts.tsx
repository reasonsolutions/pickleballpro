import React, { useState, useEffect } from 'react';
import { collection, addDoc, getDocs, doc, deleteDoc, query, where } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useAuth } from '../context/AuthContext';
import { IoAddCircleOutline } from 'react-icons/io5';
import { FaTrash, FaTableTennis } from 'react-icons/fa';
import courtIcon from '../assets/court_icon.png';
import type { Court } from '../firebase/models';

export default function Courts() {
  const [courts, setCourts] = useState<Court[]>([]);
  const [newCourtName, setNewCourtName] = useState('');
  const [price, setPrice] = useState<number>(500);
  const [location, setLocation] = useState('Main Facility');
  const [type, setType] = useState<'indoor' | 'outdoor'>('outdoor');
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  
  const { userData } = useAuth();
  
  useEffect(() => {
    fetchCourts();
  }, []);
  
  const fetchCourts = async () => {
    setLoading(true);
    try {
      // Only fetch courts associated with this facility manager
      const courtsRef = collection(db, 'courts');
      let courtsQuery;
      
      if (userData && userData.role === 'facility_manager') {
        // Query courts that belong to this facility manager
        courtsQuery = query(courtsRef, where('facilityId', '==', userData.uid));
      } else {
        // Admin can see all courts
        courtsQuery = courtsRef;
      }
      
      const snapshot = await getDocs(courtsQuery);
      const courtsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Court[];
      
      setCourts(courtsList);
    } catch (err) {
      console.error('Error fetching courts:', err);
      setError('Failed to load courts. Please try again.');
    } finally {
      setLoading(false);
    }
  };
  
  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!newCourtName.trim()) {
      setError('Please enter a court name');
      return;
    }
    
    console.log('Adding court:', newCourtName, location, price, type);
    
    // Set loading state
    setIsAdding(true);
    setError(null);
    
    // Create the new court object
    const newCourt = {
      name: newCourtName,
      location: location,
      hourlyRate: price,
      indoorOutdoor: type,
      facilityId: userData?.uid || '',
      facilityName: userData?.facilityName || 'Unknown Facility',
      createdAt: new Date()
    };
    
    // Add to Firestore
    addDoc(collection(db, 'courts'), newCourt)
      .then(docRef => {
        console.log('Court added with ID:', docRef.id);
        
        // Update local state
        setCourts(prevCourts => [...prevCourts, { ...newCourt, id: docRef.id } as unknown as Court]);
        
        // Reset form
        setNewCourtName('');
        setLocation('Main Facility');
        setPrice(500);
        setType('outdoor');
        
        // Show success message and hide form
        setSuccess('Court added successfully!');
        setShowForm(false);
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setSuccess(null);
        }, 3000);
      })
      .catch(err => {
        console.error('Error adding court:', err);
        setError(`Failed to add court: ${err instanceof Error ? err.message : 'Unknown error'}`);
      })
      .finally(() => {
        // Reset loading state
        setIsAdding(false);
      });
  }
  
  const handleDeleteCourt = (id: string) => {
    if (!window.confirm('Are you sure you want to delete this court?')) {
      return;
    }
    
    deleteDoc(doc(db, 'courts', id))
      .then(() => {
        setCourts(courts.filter(court => court.id !== id));
        setSuccess('Court deleted successfully!');
        
        // Clear success message after 3 seconds
        setTimeout(() => {
          setSuccess(null);
        }, 3000);
      })
      .catch(err => {
        console.error('Error deleting court:', err);
        setError('Failed to delete court. Please try again.');
      });
  };
  
  // Check if the user is a facility manager
  if (userData?.role !== 'facility_manager' && !userData?.isAdmin) {
    return (
      <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
        You don't have permission to view this page.
      </div>
    );
  }
  
  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Manage Courts</h1>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center"
        >
          <IoAddCircleOutline className="mr-2" />
          {showForm ? 'Cancel' : 'Add New Court'}
        </button>
      </div>
      
      {error && (
        <div className="mb-4 p-3 bg-red-100 text-red-800 rounded-md">
          {error}
        </div>
      )}
      
      {success && (
        <div className="mb-4 p-3 bg-green-100 text-green-800 rounded-md">
          {success}
        </div>
      )}
      
      {showForm && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-8">
          <h2 className="text-xl font-semibold mb-4">Add New Court</h2>
          <form onSubmit={handleSubmit}>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="court-name">
                  Court Name *
                </label>
                <input
                  id="court-name"
                  type="text"
                  value={newCourtName}
                  onChange={(e) => setNewCourtName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Center Court 1"
                  required
                />
              </div>
              
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="location">
                  Location
                </label>
                <input
                  id="location"
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="e.g., Main Building"
                />
              </div>
              
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2" htmlFor="price">
                  Price per Hour (₹)
                </label>
                <input
                  id="price"
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(Number(e.target.value))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  min="0"
                  step="50"
                />
              </div>
              
              <div>
                <label className="block text-gray-700 text-sm font-bold mb-2">
                  Court Type
                </label>
                <div className="flex space-x-4">
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      className="form-radio"
                      name="court-type"
                      value="indoor"
                      checked={type === 'indoor'}
                      onChange={() => setType('indoor')}
                    />
                    <span className="ml-2">Indoor</span>
                  </label>
                  <label className="inline-flex items-center">
                    <input
                      type="radio"
                      className="form-radio"
                      name="court-type"
                      value="outdoor"
                      checked={type === 'outdoor'}
                      onChange={() => setType('outdoor')}
                    />
                    <span className="ml-2">Outdoor</span>
                  </label>
                </div>
              </div>
            </div>
            
            <div className="mt-6 flex justify-end">
              <button
                type="submit"
                disabled={isAdding}
                className={`px-4 py-2 rounded-md text-white ${
                  isAdding ? 'bg-gray-400' : 'bg-blue-600 hover:bg-blue-700'
                }`}
              >
                {isAdding ? 'Adding...' : 'Add Court'}
              </button>
            </div>
          </form>
        </div>
      )}
      
      {loading ? (
        <div className="text-center py-8">
          <p className="text-gray-600">Loading courts...</p>
        </div>
      ) : courts.length === 0 ? (
        <div className="text-center py-8 bg-white rounded-lg shadow-md">
          <img src={courtIcon} alt="Court Icon" className="w-16 h-16 mx-auto mb-4" />
          <p className="text-gray-600">No courts have been added yet.</p>
          <p className="text-gray-500 text-sm mt-2">Click the "Add New Court" button to get started.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {courts.map((court) => (
            <div key={court.id} className="bg-white rounded-lg shadow-md overflow-hidden">
              <div className="p-4 flex items-center justify-center bg-gray-100 h-48">
                <div className="w-full h-full flex items-center justify-center">
                  <img src={courtIcon} alt="Court Icon" className="w-16 h-16" />
                </div>
              </div>
              <div className="p-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-semibold text-gray-800">{court.name}</h3>
                  <button
                    onClick={() => handleDeleteCourt(court.id)}
                    className="text-red-500 hover:text-red-700"
                    aria-label="Delete court"
                  >
                    <FaTrash />
                  </button>
                </div>
                <p className="text-sm text-gray-600 mt-1">{court.location}</p>
                <div className="mt-2 flex items-center justify-between">
                  <span className="inline-block px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                    {court.indoorOutdoor}
                  </span>
                  <span className="font-medium text-gray-900">₹{court.hourlyRate}/hr</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}