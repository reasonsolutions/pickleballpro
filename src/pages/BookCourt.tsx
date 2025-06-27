import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { db } from '../firebase/config';
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  deleteDoc,
  doc,
  Timestamp,
  arrayUnion,
  updateDoc,
  onSnapshot
} from 'firebase/firestore';
import { format, addDays, isSameDay, parseISO, isBefore } from 'date-fns';
import {
  BsCalendar2Check,
  BsClock,
  BsTrash,
  BsCheckCircle,
  BsSearch
} from 'react-icons/bs';
import { GiTennisCourt } from 'react-icons/gi';
import Notification from '../components/common/Notification';

interface Facility {
  id: string;
  name: string;
  address: string;
  description: string;
  imageUrl: string;
  courtCount: number;
}

interface Court {
  id: string;
  name: string;
  description: string;
  pricePerHour: number;
  amenities: string[];
  imageUrl: string;
  facilityId: string; // Reference to the facility this court belongs to
}

interface Booking {
  id: string;
  userId: string;
  courtId: string;
  courtName: string;
  date: string;
  timeSlot: string;
  status: 'confirmed' | 'cancelled';
  createdAt: Timestamp;
  price: number;
}

export default function BookCourt() {
  const { currentUser } = useAuth();
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [selectedTimeSlots, setSelectedTimeSlots] = useState<string[]>([]);
  const [selectedCourt, setSelectedCourt] = useState<Court | null>(null);
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingCourts, setIsLoadingCourts] = useState(false);
  const [notification, setNotification] = useState<{
    show: boolean;
    type: 'success' | 'error' | 'info';
    message: string;
  }>({ show: false, type: 'success', message: '' });
  const [unavailableSlots, setUnavailableSlots] = useState<Record<string, string[]>>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [bookingHours, setBookingHours] = useState(1);

  // Fetch facilities and courts from Firestore
  useEffect(() => {
    // Fetch facilities and courts from Firestore
    const fetchFacilitiesAndCourts = async () => {
      try {
        console.log("Fetching courts from Firestore...");
        
        // Since courts collection has proper permissions in the security rules,
        // start by fetching courts and derive facilities from them
        const courtsCollection = collection(db, 'courts');
        const courtsSnapshot = await getDocs(courtsCollection);
        
        if (courtsSnapshot.empty) {
          console.log("No courts found in database");
          // Handle demo mode or show error
          const urlParams = new URLSearchParams(window.location.search);
          if (urlParams.get('demo') === 'true') {
            console.log("Demo mode requested, loading demo data");
            loadDemoData();
          } else {
            setFacilities([]);
            setCourts([]);
            setIsLoading(false);
            setNotification({
              show: true,
              type: 'info',
              message: 'No courts found in the database. Please contact support.'
            });
          }
          return;
        }
        
        console.log(`Found ${courtsSnapshot.docs.length} courts`);
        
        // Extract courts data
        const courtsList = courtsSnapshot.docs.map(doc => {
          const courtData = doc.data();
          return {
            id: doc.id,
            name: courtData.name || `Court ${doc.id.slice(0, 4)}`,
            description: courtData.description || courtData.location || 'Standard court',
            pricePerHour: courtData.hourlyRate || courtData.pricePerHour || 25,
            amenities: courtData.amenities || [courtData.indoorOutdoor || 'outdoor', 'Standard Equipment'],
            imageUrl: courtData.imageUrl || 'https://images.unsplash.com/photo-1625676751186-844340fdfdc3?q=80&w=600&auto=format&fit=crop',
            facilityId: courtData.facilityId || 'default-facility'
          } as Court;
        });
        
        // Group courts by facilityId and create facilities from them
        const facilitiesMap = new Map<string, Facility>();
        
        courtsList.forEach(court => {
          if (!facilitiesMap.has(court.facilityId)) {
            // Create a new facility from court data
            facilitiesMap.set(court.facilityId, {
              id: court.facilityId,
              name: court.facilityId.includes('default') ? 'Main Facility' : `Facility ${court.facilityId.slice(0, 5)}`,
              address: 'Contact for address',
              description: 'Pickleball facility with multiple courts',
              imageUrl: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?q=80&w=600&auto=format&fit=crop',
              courtCount: 1
            });
          } else {
            // Increment court count for existing facility
            const facility = facilitiesMap.get(court.facilityId)!;
            facility.courtCount++;
            facilitiesMap.set(court.facilityId, facility);
          }
        });
        
        // Convert map to array
        const facilitiesList = Array.from(facilitiesMap.values());

        
        console.log("Derived facilities from courts:", facilitiesList);
        
        if (facilitiesList.length > 0) {
          console.log(`Created ${facilitiesList.length} facilities from court data`);
          setFacilities(facilitiesList);
          setCourts(courtsList);
          setIsLoading(false);
        } else {
          console.log("Failed to create facilities from courts");
          
          // Only use demo data if specifically requested
          const urlParams = new URLSearchParams(window.location.search);
          if (urlParams.get('demo') === 'true') {
            console.log("Demo mode requested, loading demo data");
            loadDemoData();
          } else {
            setFacilities([]);
            setCourts([]);
            setIsLoading(false);
            
            setNotification({
              show: true,
              type: 'info',
              message: 'No facilities could be derived from courts. Please contact support.'
            });
          }
        }
      } catch (error) {
        console.error('Error fetching facilities and courts:', error);
        
        // Only use demo data if specifically requested
        const urlParams = new URLSearchParams(window.location.search);
        if (urlParams.get('demo') === 'true') {
          console.log("Demo mode requested, loading demo data after error");
          loadDemoData();
        } else {
          setIsLoading(false);
          setNotification({
            show: true,
            type: 'error',
            message: 'Insufficient permissions to access court data. Please ensure you are logged in or try using demo mode with ?demo=true in the URL.'
          });
        }
      }
    };
    
    // Function to load demo data as fallback
    const loadDemoData = () => {
      console.log("Loading demo facilities and courts");
      
      // Create demo facilities
      const demoFacilities: Facility[] = [
        {
          id: 'demo-facility-1',
          name: 'PickleBall Paradise',
          address: '123 Main St, Anytown, USA',
          description: 'Premier indoor pickleball facility with 6 professional courts',
          imageUrl: 'https://images.unsplash.com/photo-1595435934249-5df7ed86e1c0?q=80&w=600&auto=format&fit=crop',
          courtCount: 3
        },
        {
          id: 'demo-facility-2',
          name: 'Sunset Pickleball Club',
          address: '456 Beach Road, Coastville, USA',
          description: 'Outdoor facility with beautiful ocean views and professional instruction',
          imageUrl: 'https://images.unsplash.com/photo-1599967728261-2f5d4531ad91?q=80&w=600&auto=format&fit=crop',
          courtCount: 4
        },
        {
          id: 'demo-facility-3',
          name: 'Downtown Pickleball Center',
          address: '789 Urban Ave, Metropolis, USA',
          description: 'Convenient urban location with both indoor and outdoor courts',
          imageUrl: 'https://images.unsplash.com/photo-1587399045742-39eaa0912bb5?q=80&w=600&auto=format&fit=crop',
          courtCount: 5
        }
      ];

      // Create demo courts for each facility
      const demoCourts: Court[] = [
        // PickleBall Paradise courts
        {
          id: 'demo-court-1',
          name: 'Court 1 - Indoor Pro',
          description: 'Professional indoor court with tournament-grade surface',
          pricePerHour: 30,
          amenities: ['indoor', 'Pro Equipment', 'Lighting', 'Score Display'],
          imageUrl: 'https://images.unsplash.com/photo-1625676751186-844340fdfdc3?q=80&w=600&auto=format&fit=crop',
          facilityId: 'demo-facility-1'
        },
        {
          id: 'demo-court-2',
          name: 'Court 2 - Indoor Standard',
          description: 'Standard indoor court with good lighting',
          pricePerHour: 25,
          amenities: ['indoor', 'Standard Equipment', 'Lighting'],
          imageUrl: 'https://images.unsplash.com/photo-1625676751186-844340fdfdc3?q=80&w=600&auto=format&fit=crop',
          facilityId: 'demo-facility-1'
        },
        {
          id: 'demo-court-3',
          name: 'Court 3 - Indoor Beginner',
          description: 'Perfect for beginners with coaching space',
          pricePerHour: 20,
          amenities: ['indoor', 'Beginner Equipment', 'Training Area'],
          imageUrl: 'https://images.unsplash.com/photo-1625676751186-844340fdfdc3?q=80&w=600&auto=format&fit=crop',
          facilityId: 'demo-facility-1'
        },
        // Sunset Pickleball Club courts
        {
          id: 'demo-court-4',
          name: 'Sunset Court 1',
          description: 'Outdoor court with ocean view',
          pricePerHour: 35,
          amenities: ['outdoor', 'Premium Surface', 'Shade Structure'],
          imageUrl: 'https://images.unsplash.com/photo-1613409450938-c5307d0a7767?q=80&w=600&auto=format&fit=crop',
          facilityId: 'demo-facility-2'
        },
        {
          id: 'demo-court-5',
          name: 'Sunset Court 2',
          description: 'Tournament-ready outdoor court',
          pricePerHour: 40,
          amenities: ['outdoor', 'Tournament Grade', 'Spectator Seating'],
          imageUrl: 'https://images.unsplash.com/photo-1613409450938-c5307d0a7767?q=80&w=600&auto=format&fit=crop',
          facilityId: 'demo-facility-2'
        },
        {
          id: 'demo-court-6',
          name: 'Sunset Court 3',
          description: 'Standard outdoor court',
          pricePerHour: 30,
          amenities: ['outdoor', 'Standard Equipment'],
          imageUrl: 'https://images.unsplash.com/photo-1613409450938-c5307d0a7767?q=80&w=600&auto=format&fit=crop',
          facilityId: 'demo-facility-2'
        },
        {
          id: 'demo-court-7',
          name: 'Sunset Court 4',
          description: 'Beginner-friendly outdoor court',
          pricePerHour: 25,
          amenities: ['outdoor', 'Beginner Equipment'],
          imageUrl: 'https://images.unsplash.com/photo-1613409450938-c5307d0a7767?q=80&w=600&auto=format&fit=crop',
          facilityId: 'demo-facility-2'
        },
        // Downtown Pickleball Center courts
        {
          id: 'demo-court-8',
          name: 'Downtown Indoor 1',
          description: 'Premium indoor court',
          pricePerHour: 35,
          amenities: ['indoor', 'Premium Surface', 'Air Conditioning'],
          imageUrl: 'https://images.unsplash.com/photo-1625676751186-844340fdfdc3?q=80&w=600&auto=format&fit=crop',
          facilityId: 'demo-facility-3'
        },
        {
          id: 'demo-court-9',
          name: 'Downtown Indoor 2',
          description: 'Standard indoor court',
          pricePerHour: 30,
          amenities: ['indoor', 'Standard Equipment'],
          imageUrl: 'https://images.unsplash.com/photo-1625676751186-844340fdfdc3?q=80&w=600&auto=format&fit=crop',
          facilityId: 'demo-facility-3'
        },
        {
          id: 'demo-court-10',
          name: 'Downtown Outdoor 1',
          description: 'Premium outdoor court',
          pricePerHour: 25,
          amenities: ['outdoor', 'Premium Surface'],
          imageUrl: 'https://images.unsplash.com/photo-1613409450938-c5307d0a7767?q=80&w=600&auto=format&fit=crop',
          facilityId: 'demo-facility-3'
        },
        {
          id: 'demo-court-11',
          name: 'Downtown Outdoor 2',
          description: 'Outdoor court with night lighting',
          pricePerHour: 28,
          amenities: ['outdoor', 'Night Lighting'],
          imageUrl: 'https://images.unsplash.com/photo-1613409450938-c5307d0a7767?q=80&w=600&auto=format&fit=crop',
          facilityId: 'demo-facility-3'
        },
        {
          id: 'demo-court-12',
          name: 'Downtown Outdoor 3',
          description: 'Outdoor court with spectator seating',
          pricePerHour: 30,
          amenities: ['outdoor', 'Spectator Seating'],
          imageUrl: 'https://images.unsplash.com/photo-1613409450938-c5307d0a7767?q=80&w=600&auto=format&fit=crop',
          facilityId: 'demo-facility-3'
        }
      ];

      // Set the demo data
      setFacilities(demoFacilities);
      setCourts(demoCourts);
      setIsLoading(false);
    };

    // Fetch real data from Firestore
    fetchFacilitiesAndCourts();
  }, []);

  // Mock bookings data - in a real app, this would come from Firestore
  useEffect(() => {
    if (!currentUser) return;
    
    // Get all bookings to find unavailable slots
    const fetchAllBookings = async () => {
      try {
        const allBookingsQuery = query(
          collection(db, 'bookings'),
          where('status', '==', 'confirmed')
        );
        
        const allBookingsSnapshot = await getDocs(allBookingsQuery);
        const allBookings = allBookingsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        })) as Booking[];
        
        // Calculate unavailable time slots
        const unavailable: Record<string, string[]> = {};
        allBookings.forEach(booking => {
          if (booking.status === 'confirmed') {
            if (!unavailable[`${booking.date}-${booking.courtId}`]) {
              unavailable[`${booking.date}-${booking.courtId}`] = [];
            }
            unavailable[`${booking.date}-${booking.courtId}`].push(booking.timeSlot);
          }
        });
        
        setUnavailableSlots(unavailable);
      } catch (error) {
        console.error('Error fetching all bookings:', error);
      }
    };
    
    // Fetch all bookings initially
    fetchAllBookings();
    
    // Setup real-time listener for user's bookings
    const userBookingsQuery = query(
      collection(db, 'bookings'),
      where('userId', '==', currentUser.uid)
    );
    
    const unsubscribe = onSnapshot(userBookingsQuery, (snapshot) => {
      const bookingsList = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Booking[];
      
      setBookings(bookingsList);
    });
    
    // Cleanup the listener when component unmounts
    return () => {
      unsubscribe();
    };
  }, [currentUser?.uid]);

  // Time slots for booking
  const timeSlots = [
    '08:00 - 09:00', '09:00 - 10:00', '10:00 - 11:00', '11:00 - 12:00',
    '12:00 - 13:00', '13:00 - 14:00', '14:00 - 15:00', '15:00 - 16:00',
    '16:00 - 17:00', '17:00 - 18:00', '18:00 - 19:00', '19:00 - 20:00'
  ];

  // Get all courts for a facility
  const getCourtsByFacility = (facilityId: string) => {
    return courts.filter(court => court.facilityId === facilityId);
  };

  // Check if a time slot is available
  const isTimeSlotAvailable = (timeSlot: string) => {
    if (!selectedCourt) return false;
    
    const dateFormatted = format(selectedDate, 'yyyy-MM-dd');
    const key = `${dateFormatted}-${selectedCourt.id}`;
    
    return !(unavailableSlots[key] && unavailableSlots[key].includes(timeSlot));
  };

  // Handle time slot selection with support for multiple hours
  const handleTimeSlotSelection = (timeSlot: string) => {
    // If the slot is already selected, deselect it and all subsequent slots
    if (selectedTimeSlots.includes(timeSlot)) {
      setSelectedTimeSlots([]);
      return;
    }

    // Find the index of the selected time slot
    const slotIndex = timeSlots.findIndex(slot => slot === timeSlot);
    if (slotIndex === -1) return;

    // Check if we can book the requested number of consecutive hours
    const consecutiveSlots: string[] = [];
    for (let i = 0; i < bookingHours; i++) {
      const nextSlotIndex = slotIndex + i;
      if (nextSlotIndex >= timeSlots.length) break;
      
      const nextSlot = timeSlots[nextSlotIndex];
      if (!isTimeSlotAvailable(nextSlot)) break;
      
      consecutiveSlots.push(nextSlot);
    }

    // If we couldn't get all the hours requested, only select what's available
    setSelectedTimeSlots(consecutiveSlots);
  };

  // Dates for the date picker
  const dates = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i));

  // Handle booking submission
  const handleBookCourt = async () => {
    if (!currentUser || !selectedCourt || selectedTimeSlots.length === 0) return;
    
    setIsSubmitting(true);
    
    try {
      // For multiple hours, create one booking that spans the entire time
      const startTime = selectedTimeSlots[0].split(' - ')[0];
      const endTime = selectedTimeSlots[selectedTimeSlots.length - 1].split(' - ')[1];
      const timeSlot = `${startTime} - ${endTime}`;
      
      const newBooking = {
        userId: currentUser.uid,
        courtId: selectedCourt.id,
        courtName: selectedCourt.name,
        facilityId: selectedCourt.facilityId,
        facilityName: selectedFacility?.name || '',
        date: format(selectedDate, 'yyyy-MM-dd'),
        timeSlot: timeSlot,
        status: 'confirmed' as const,
        createdAt: Timestamp.now(),
        price: selectedCourt.pricePerHour * selectedTimeSlots.length
      };
      
      // Save booking to Firestore
      const docRef = await addDoc(collection(db, 'bookings'), newBooking);
      
      // Update user's bookings array in their profile
      await updateDoc(doc(db, 'users', currentUser.uid), {
        bookings: arrayUnion(docRef.id)
      });
      
      // Update unavailable slots
      setUnavailableSlots(prev => {
        const key = `${newBooking.date}-${newBooking.courtId}`;
        const slots = prev[key] ? [...prev[key]] : [];
        return {
          ...prev,
          [key]: [...slots, newBooking.timeSlot]
        };
      });
      
      setSelectedTimeSlots([]);
      setNotification({
        show: true,
        type: 'success',
        message: 'Court booked successfully! You can view it in your bookings.'
      });
      
      // Notification component will auto-hide after the specified duration
    } catch (error) {
      console.error('Error creating booking:', error);
      setNotification({
        show: true,
        type: 'error',
        message: 'Failed to book court. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Handle booking cancellation
  const handleCancelBooking = async (bookingId: string) => {
    if (!currentUser) return;
    
    try {
      // Update the booking status in Firestore
      await updateDoc(doc(db, 'bookings', bookingId), {
        status: 'cancelled'
      });
      
      // Update local state
      setBookings(bookings.map(booking =>
        booking.id === bookingId
          ? { ...booking, status: 'cancelled' as const }
          : booking
      ));
      
      // Update unavailable slots
      const cancelledBooking = bookings.find(b => b.id === bookingId);
      if (cancelledBooking) {
        setUnavailableSlots(prev => {
          const key = `${cancelledBooking.date}-${cancelledBooking.courtId}`;
          if (!prev[key]) return prev;
          
          return {
            ...prev,
            [key]: prev[key].filter(slot => slot !== cancelledBooking.timeSlot)
          };
        });
      }
    } catch (error) {
      console.error('Error cancelling booking:', error);
      setNotification({
        show: true,
        type: 'error',
        message: 'Failed to cancel booking. Please try again.'
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

  // Filter facilities based on search query
  const filteredFacilities = facilities.filter(facility =>
    facility.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    facility.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    facility.address.toLowerCase().includes(searchQuery.toLowerCase()) ||
    // Also check if any courts in this facility match the search
    getCourtsByFacility(facility.id).some(court =>
      court.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      court.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      court.amenities.some(amenity => amenity.toLowerCase().includes(searchQuery.toLowerCase()))
    )
  );

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
        <h1 className="text-2xl font-bold text-gray-800">Book a Court</h1>
        <p className="text-gray-600">Reserve your court time and get ready to play!</p>
      </div>

      {/* Search Input */}
      <div className="glass-card p-4">
        <div className="relative">
          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
            <BsSearch className="text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search courts by name, location, amenities..."
            className="pl-10 w-full py-2 border border-gray-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Facility/Court Selection and Booking Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Notification Component */}
          <Notification
            show={notification.show}
            type={notification.type}
            message={notification.message}
            duration={3000}
            onClose={() => setNotification({ ...notification, show: false })}
          />

          {/* Facility Cards */}
          {!selectedFacility && (
            <div className="glass-card p-6">
              <h2 className="text-lg font-medium text-gray-800 mb-4">Select a Facility</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {filteredFacilities.map(facility => (
                  <div
                    key={facility.id}
                    onClick={() => {
                      setIsLoadingCourts(true);
                      setSelectedFacility(facility);
                      // Simulate loading for smoother transition
                      setTimeout(() => setIsLoadingCourts(false), 500);
                    }}
                    className="rounded-lg transition-all border overflow-hidden cursor-pointer hover:bg-white/30 hover:shadow-lg border-transparent group transform hover:scale-105 active:scale-95"
                    data-testid={`facility-card-${facility.id}`}
                  >
                    <div className="h-40 overflow-hidden relative">
                      <img
                        src={facility.imageUrl}
                        alt={facility.name}
                        className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-2">
                        <span className="text-white font-medium px-3 py-1 bg-primary-500 rounded-full text-sm">
                          View Courts
                        </span>
                      </div>
                    </div>
                    <div className="p-4">
                      <h3 className="font-medium text-gray-800">{facility.name}</h3>
                      <p className="text-sm text-gray-500 mt-1">{facility.address}</p>
                      <p className="text-sm text-gray-600 mt-2 line-clamp-2">{facility.description || 'Pickleball facility offering court bookings'}</p>
                      <div className="mt-2 flex items-center gap-1">
                        <GiTennisCourt className="text-primary-500" />
                        <span className="text-sm text-gray-600">{facility.courtCount} courts available</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              
              {filteredFacilities.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  No facilities match your search. Try a different query.
                </div>
              )}
            </div>
          )}

          {/* Court Cards (shown after facility selection) */}
          {selectedFacility && (
            <div className="glass-card p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-medium text-gray-800">Select a Court at {selectedFacility.name}</h2>
                <button
                  onClick={() => {
                    setSelectedFacility(null);
                    setSelectedCourt(null);
                    setSelectedTimeSlots([]);
                  }}
                  className="text-sm text-primary-600 hover:underline"
                >
                  Change Facility
                </button>
              </div>
              
              {isLoadingCourts ? (
                <div className="flex items-center justify-center h-40">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary-500"></div>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {getCourtsByFacility(selectedFacility.id).length === 0 ? (
                    <div className="col-span-2 text-center py-6 text-gray-500">
                      No courts available for this facility.
                    </div>
                  ) : (
                    getCourtsByFacility(selectedFacility.id).map(court => (
                      <div
                        key={court.id}
                        onClick={() => {
                          console.log("Court selected:", court.name);
                          setSelectedCourt(court);
                          setSelectedTimeSlots([]);
                          // Scroll to the date selection section
                          setTimeout(() => {
                            document.getElementById('date-selection')?.scrollIntoView({ behavior: 'smooth' });
                          }, 100);
                        }}
                        className={`rounded-lg transition-all transform border overflow-hidden cursor-pointer ${
                          selectedCourt?.id === court.id
                            ? 'ring-2 ring-primary-500 border-primary-300 scale-105'
                            : 'hover:bg-white/30 border-transparent hover:scale-105 active:scale-95'
                        }`}
                        data-testid={`court-card-${court.id}`}
                      >
                        <div className="h-40 overflow-hidden">
                          <img
                            src={court.imageUrl}
                            alt={court.name}
                            className="w-full h-full object-cover transition-transform duration-300 hover:scale-105"
                          />
                        </div>
                        <div className="p-4">
                          <div className="flex justify-between items-start">
                            <h3 className="font-medium text-gray-800">{court.name}</h3>
                            <span className="text-primary-600 font-medium">₹{court.pricePerHour}/hr</span>
                          </div>
                          <p className="text-sm text-gray-600 mt-2 line-clamp-2">{court.description}</p>
                          <div className="flex flex-wrap mt-2 gap-1">
                            {court.amenities.slice(0, 3).map((amenity, index) => (
                              <span
                                key={index}
                                className="inline-block bg-gray-100 rounded-full px-2 py-0.5 text-xs text-gray-700"
                              >
                                {amenity}
                              </span>
                            ))}
                            {court.amenities.length > 3 && (
                              <span className="inline-block bg-gray-100 rounded-full px-2 py-0.5 text-xs text-gray-700">
                                +{court.amenities.length - 3} more
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {selectedCourt && (
            <>
              {/* Date Selection */}
              <div id="date-selection" className="glass-card p-6">
                <h2 className="text-lg font-medium text-gray-800 mb-4">Select Date</h2>
                <div className="flex overflow-x-auto pb-2 space-x-2">
                  {dates.map((date, index) => (
                    <button
                      key={index}
                      onClick={() => setSelectedDate(date)}
                      className={`flex-shrink-0 px-4 py-2 rounded-lg transition-colors flex flex-col items-center min-w-[80px] ${
                        isSameDay(selectedDate, date)
                          ? 'bg-primary-100 text-primary-700 border border-primary-300'
                          : 'hover:bg-white/30 border border-transparent'
                      }`}
                    >
                      <span className="text-sm font-medium">
                        {format(date, 'EEE')}
                      </span>
                      <span className="text-2xl font-bold my-1">
                        {format(date, 'd')}
                      </span>
                      <span className="text-xs">
                        {format(date, 'MMM')}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Time Slot Selection */}
              <div className="glass-card p-6">
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-lg font-medium text-gray-800">Select Time Slot</h2>
                  <div className="flex items-center space-x-2">
                    <label htmlFor="booking-hours" className="text-sm text-gray-600">Hours:</label>
                    <select
                      id="booking-hours"
                      value={bookingHours}
                      onChange={(e) => {
                        setBookingHours(Number(e.target.value));
                        setSelectedTimeSlots([]);
                      }}
                      className="border border-gray-300 rounded px-2 py-1 text-sm"
                    >
                      {[1, 2, 3].map(num => (
                        <option key={num} value={num}>{num} {num === 1 ? 'hour' : 'hours'}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                  {timeSlots.map(timeSlot => {
                    const available = isTimeSlotAvailable(timeSlot);
                    const isSelected = selectedTimeSlots.includes(timeSlot);
                    
                    // Find if this is part of a consecutive selection
                    let isPartOfSelection = false;
                    if (selectedTimeSlots.length > 0) {
                      const timeSlotIndex = timeSlots.indexOf(timeSlot);
                      const firstSelectedIndex = timeSlots.indexOf(selectedTimeSlots[0]);
                      const lastSelectedIndex = timeSlots.indexOf(selectedTimeSlots[selectedTimeSlots.length - 1]);
                      
                      isPartOfSelection = timeSlotIndex >= firstSelectedIndex && timeSlotIndex <= lastSelectedIndex;
                    }
                    
                    return (
                      <button
                        key={timeSlot}
                        onClick={() => available && handleTimeSlotSelection(timeSlot)}
                        disabled={!available}
                        className={`
                          py-3 px-4 rounded-lg text-center transition-colors flex flex-col items-center
                          ${
                            !available
                              ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                              : isSelected || isPartOfSelection
                                ? 'bg-primary-100 text-primary-700 border border-primary-300'
                                : 'hover:bg-white/30 border border-transparent'
                          }
                        `}
                      >
                        <BsClock className="mb-1" />
                        <span className="text-sm">{timeSlot}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Booking Summary */}
              {selectedTimeSlots.length > 0 && (
                <div className="glass-card p-6">
                  <h2 className="text-lg font-medium text-gray-800 mb-4">Booking Summary</h2>
                  <div className="space-y-3">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Date:</span>
                      <span className="font-medium">{format(selectedDate, 'EEEE, MMMM d, yyyy')}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Time:</span>
                      <span className="font-medium">
                        {selectedTimeSlots[0].split(' - ')[0]} - {selectedTimeSlots[selectedTimeSlots.length - 1].split(' - ')[1]}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Court:</span>
                      <span className="font-medium">{selectedCourt.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Facility:</span>
                      <span className="font-medium">{selectedFacility?.name}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Price:</span>
                      <span className="font-medium">₹{selectedCourt.pricePerHour * selectedTimeSlots.length}</span>
                    </div>
                    <div className="pt-4 mt-4 border-t border-gray-200">
                      <button
                        onClick={handleBookCourt}
                        disabled={isSubmitting}
                        className="w-full bg-primary-600 text-white py-2 px-4 rounded-md hover:bg-primary-700 focus:outline-none transition disabled:opacity-50"
                      >
                        {isSubmitting ? 'Processing...' : 'Confirm Booking'}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* Your Bookings */}
        <div className="space-y-6">
          <div className="glass-card p-6">
            <h2 className="text-lg font-medium text-gray-800 mb-4">Your Bookings</h2>
            {bookings.length === 0 ? (
              <p className="text-gray-600 text-center py-6">You don't have any bookings yet.</p>
            ) : (
              <div className="space-y-4">
                {bookings
                  .filter(booking => booking.status !== 'cancelled')
                  .sort((a, b) => a.date.localeCompare(b.date) || a.timeSlot.localeCompare(b.timeSlot))
                  .map(booking => {
                    const isPast = isBookingPast(booking.date, booking.timeSlot);
                    return (
                      <div 
                        key={booking.id} 
                        className={`p-4 rounded-lg border ${
                          isPast ? 'bg-gray-50 border-gray-200' : 'bg-white/50 border-white/60'
                        }`}
                      >
                        <div className="flex justify-between items-start">
                          <div>
                            <h3 className="font-medium">{booking.courtName}</h3>
                            <p className="text-sm text-gray-600">
                              {format(parseISO(booking.date), 'EEEE, MMM d')}
                            </p>
                            <p className="text-sm text-gray-600">{booking.timeSlot}</p>
                          </div>
                          {!isPast && (
                            <button
                              onClick={() => handleCancelBooking(booking.id)}
                              className="text-red-500 hover:text-red-700 transition"
                              aria-label="Cancel booking"
                            >
                              <BsTrash />
                            </button>
                          )}
                        </div>
                        {isPast && (
                          <div className="mt-2 text-xs text-gray-500">
                            This booking is in the past
                          </div>
                        )}
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}