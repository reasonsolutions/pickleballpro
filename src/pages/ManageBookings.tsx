import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  Timestamp,
  onSnapshot,
  updateDoc,
  doc
} from 'firebase/firestore';
import { format, parseISO, isBefore, isSameDay } from 'date-fns';
import { 
  BsCalendar2Check, 
  BsTrash,
  BsSearch,
  BsCheckCircle,
  BsXCircle
} from 'react-icons/bs';
import { GiTennisCourt } from 'react-icons/gi';

interface Booking {
  id: string;
  userId: string;
  courtId: string;
  courtName: string;
  facilityId: string;
  facilityName: string;
  date: string;
  timeSlot: string;
  status: 'confirmed' | 'cancelled';
  createdAt: Timestamp;
  price: number;
  userName?: string;
  userEmail?: string;
}

interface User {
  id: string;
  displayName: string;
  email: string;
}

export default function ManageBookings() {
  const { currentUser, userData } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [users, setUsers] = useState<Record<string, User>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [actionSuccess, setActionSuccess] = useState<{message: string, type: 'success' | 'error'} | null>(null);

  // Fetch all bookings for this facility
  useEffect(() => {
    if (!currentUser || userData?.role !== 'facility_manager') return;
    
    setIsLoading(true);
    
    // Fetch all users first to get their names
    const fetchUsers = async () => {
      try {
        const usersCollection = collection(db, 'users');
        const usersSnapshot = await getDocs(usersCollection);
        
        const usersData: Record<string, User> = {};
        usersSnapshot.docs.forEach(userDoc => {
          const userData = userDoc.data();
          usersData[userDoc.id] = {
            id: userDoc.id,
            displayName: userData.displayName || 'Unknown User',
            email: userData.email || 'No email'
          };
        });
        
        setUsers(usersData);
        
        // Setup real-time listener for bookings for this facility manager
        const bookingsQuery = query(
          collection(db, 'bookings'),
          where('facilityId', '==', currentUser.uid)
        );
        
        const unsubscribe = onSnapshot(bookingsQuery, (snapshot) => {
          const bookingsList = snapshot.docs.map(bookingDoc => {
            const bookingData = bookingDoc.data();
            const user = usersData[bookingData.userId];
            
            return {
              id: bookingDoc.id,
              userId: bookingData.userId,
              courtId: bookingData.courtId,
              courtName: bookingData.courtName,
              facilityId: bookingData.facilityId,
              facilityName: bookingData.facilityName,
              date: bookingData.date,
              timeSlot: bookingData.timeSlot,
              status: bookingData.status,
              createdAt: bookingData.createdAt,
              price: bookingData.price,
              userName: user?.displayName || 'Unknown User',
              userEmail: user?.email || 'No email'
            };
          });
          
          setBookings(bookingsList);
          setIsLoading(false);
        });
        
        return unsubscribe;
      } catch (error) {
        console.error('Error fetching users and bookings:', error);
        setIsLoading(false);
        return () => {};
      }
    };
    
    fetchUsers();
  }, [currentUser, userData?.role]);

  // Handle booking cancellation
  const handleCancelBooking = async (bookingId: string) => {
    try {
      await updateDoc(doc(db, 'bookings', bookingId), {
        status: 'cancelled'
      });
      
      setActionSuccess({
        message: 'Booking cancelled successfully',
        type: 'success'
      });
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        setActionSuccess(null);
      }, 3000);
    } catch (error) {
      console.error('Error cancelling booking:', error);
      setActionSuccess({
        message: 'Failed to cancel booking',
        type: 'error'
      });
    }
  };

  // Determine if a booking is in the past
  const isBookingPast = (date: string, timeSlot: string) => {
    const bookingDate = parseISO(date);
    const now = new Date();
    
    // If the booking date is before today, it's in the past
    if (isBefore(bookingDate, new Date(now.setHours(0, 0, 0, 0)))) {
      return true;
    }
    
    // If the booking is today, check if the time slot is in the past
    if (isSameDay(bookingDate, now)) {
      const timeStart = timeSlot.split(' - ')[0];
      const [hours, minutes] = timeStart.split(':').map(Number);
      
      const bookingTime = new Date();
      bookingTime.setHours(hours, minutes, 0, 0);
      
      return isBefore(bookingTime, now);
    }
    
    return false;
  };

  // Filter bookings based on selected date and search query
  const filteredBookings = bookings.filter(booking => {
    const matchesDate = isSameDay(parseISO(booking.date), selectedDate);
    
    const matchesSearch = 
      booking.userName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.userEmail?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.courtName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      booking.timeSlot.toLowerCase().includes(searchQuery.toLowerCase());
    
    return matchesDate && (searchQuery === '' || matchesSearch);
  });

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-800">Manage Bookings</h1>
        <p className="text-gray-600">View and manage court bookings from users</p>
      </div>

      {/* Action Success/Error Message */}
      {actionSuccess && (
        <div className={`glass-card p-4 ${actionSuccess.type === 'success' ? 'bg-green-50 border-green-200 text-green-700' : 'bg-red-50 border-red-200 text-red-700'} flex items-center`}>
          {actionSuccess.type === 'success' ? <BsCheckCircle className="text-xl mr-2" /> : <BsXCircle className="text-xl mr-2" />}
          <span>{actionSuccess.message}</span>
        </div>
      )}

      {/* Search and Date Filter */}
      <div className="glass-card p-6">
        <div className="flex flex-col md:flex-row gap-4 justify-between">
          {/* Date Picker */}
          <div className="w-full md:w-auto">
            <label className="block text-sm font-medium text-gray-700 mb-1">Filter by Date</label>
            <input
              type="date"
              value={format(selectedDate, 'yyyy-MM-dd')}
              onChange={(e) => setSelectedDate(parseISO(e.target.value))}
              className="w-full md:w-auto rounded-md border border-gray-300 py-2 px-3 focus:outline-none focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          {/* Search */}
          <div className="relative w-full md:w-72">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search Bookings</label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <BsSearch className="text-gray-400" />
              </div>
              <input
                type="text"
                placeholder="Search user, court, time..."
                className="pl-10 w-full py-2 border border-gray-300 rounded-md focus:ring-primary-500 focus:border-primary-500"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Bookings List */}
      <div className="glass-card p-6">
        <h2 className="text-lg font-medium text-gray-800 mb-4">
          Bookings for {format(selectedDate, 'EEEE, MMMM d, yyyy')}
        </h2>
        
        {filteredBookings.length === 0 ? (
          <p className="text-gray-600 text-center py-6">No bookings found for this date.</p>
        ) : (
          <div className="space-y-4">
            {filteredBookings
              .sort((a, b) => a.timeSlot.localeCompare(b.timeSlot))
              .map(booking => {
                const isPast = isBookingPast(booking.date, booking.timeSlot);
                return (
                  <div 
                    key={booking.id} 
                    className={`p-4 rounded-lg border ${
                      isPast ? 'bg-gray-50 border-gray-200' : 'bg-white/50 border-white/60'
                    }`}
                  >
                    <div className="flex flex-col md:flex-row justify-between">
                      <div className="mb-2 md:mb-0">
                        <div className="flex items-center">
                          <GiTennisCourt className="text-primary-500 mr-2" />
                          <h3 className="font-medium">{booking.courtName}</h3>
                        </div>
                        <p className="text-sm text-gray-600 mt-1">{booking.timeSlot}</p>
                      </div>
                      
                      <div className="mb-2 md:mb-0">
                        <p className="text-sm font-medium">{booking.userName}</p>
                        <p className="text-xs text-gray-500">{booking.userEmail}</p>
                      </div>
                      
                      <div className="flex items-center space-x-4">
                        <span className="text-sm font-medium">₹{booking.price}</span>
                        {!isPast && booking.status === 'confirmed' && (
                          <button
                            onClick={() => handleCancelBooking(booking.id)}
                            className="text-red-500 hover:text-red-700 transition flex items-center"
                            aria-label="Cancel booking"
                          >
                            <BsTrash className="mr-1" />
                            <span className="text-sm">Cancel</span>
                          </button>
                        )}
                        {booking.status === 'cancelled' && (
                          <span className="text-sm text-red-500">Cancelled</span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </div>
      
      {/* Booking Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <h3 className="text-gray-600 text-sm mb-1">Total Bookings Today</h3>
          <p className="text-2xl font-bold text-primary-600">
            {filteredBookings.filter(b => b.status === 'confirmed').length}
          </p>
        </div>
        
        <div className="glass-card p-4">
          <h3 className="text-gray-600 text-sm mb-1">Revenue Today</h3>
          <p className="text-2xl font-bold text-primary-600">
            ₹{filteredBookings
              .filter(b => b.status === 'confirmed')
              .reduce((sum, booking) => sum + booking.price, 0)
            }
          </p>
        </div>
        
        <div className="glass-card p-4">
          <h3 className="text-gray-600 text-sm mb-1">Cancelled Bookings</h3>
          <p className="text-2xl font-bold text-red-500">
            {filteredBookings.filter(b => b.status === 'cancelled').length}
          </p>
        </div>
      </div>
    </div>
  );
}