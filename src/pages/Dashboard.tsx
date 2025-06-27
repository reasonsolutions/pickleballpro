import { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { collection, getDocs, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { format, parseISO, startOfWeek, addDays, differenceInDays } from 'date-fns';
import {
  BsCalendar2Check, BsTrophy, BsArrowRightShort, BsPercent,
  BsCheckCircle, BsXCircle, BsClock
} from 'react-icons/bs';
import { GiTennisCourt } from 'react-icons/gi';
import { RiTeamLine, RiMoneyDollarCircleLine } from 'react-icons/ri';
import DuprRatingsCard from '../components/dashboard/DuprRatingsCard';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line
} from 'recharts';
import { Card, Button, Table, Divider } from '@heroui/react';

// Court type for facility managers
interface Court {
  id: string;
  name: string;
  location: string;
  pricePerHour: number;
  indoorOutdoor: 'indoor' | 'outdoor';
}

// Booking type for facility managers
interface Booking {
  id: string;
  userId: string;
  courtId: string;
  date: Timestamp;
  startTime: string;
  endTime: string;
  totalCost: number;
  status: 'pending' | 'confirmed' | 'cancelled';
  createdAt: Timestamp;
  participants?: number;
}

// Colors for charts
const COLORS = ['#2563EB', '#059669', '#D97706', '#DC2626', '#8B5CF6', '#0891B2'];

export default function Dashboard() {
  const { currentUser, userData } = useAuth();
  const firstName = currentUser?.displayName?.split(' ')[0] || 'Player';
  const [courts, setCourts] = useState<Court[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(false);
  
  // Fetch courts and bookings data for facility managers
  useEffect(() => {
    if (userData?.role === 'facility_manager' || userData?.isAdmin) {
      const fetchData = async () => {
        setLoading(true);
        try {
          // Fetch courts
          const courtsRef = collection(db, 'courts');
          const courtsSnapshot = await getDocs(courtsRef);
          const courtsList = courtsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Court[];
          setCourts(courtsList);

          // Fetch all bookings (for facility manager)
          const bookingsRef = collection(db, 'bookings');
          const bookingsSnapshot = await getDocs(bookingsRef);
          const bookingsList = bookingsSnapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
          })) as Booking[];
          setBookings(bookingsList);
        } catch (err) {
          console.error('Error fetching data:', err);
        } finally {
          setLoading(false);
        }
      };

      fetchData();
    }
  }, [userData]);

  // Court Operations & Utilization Data Calculations
  
  // Calculate utilization rates by court
  const getCourtUtilization = () => {
    if (!courts.length || !bookings.length) return [];

    const courtBookings = courts.map(court => {
      const courtBookingsCount = bookings.filter(
        booking => booking.courtId === court.id && booking.status === 'confirmed'
      ).length;
      
      return {
        name: court.name,
        bookings: courtBookingsCount,
        utilizationRate: Math.round((courtBookingsCount / bookings.length) * 100)
      };
    });

    return courtBookings.sort((a, b) => b.utilizationRate - a.utilizationRate);
  };

  // Calculate utilization by time slot
  const getTimeSlotUtilization = () => {
    if (!bookings.length) return [];

    // Extract time slots and count bookings
    const timeSlotMap: Record<string, number> = {};
    
    bookings.forEach(booking => {
      if (booking.status === 'confirmed') {
        const timeSlot = booking.startTime;
        timeSlotMap[timeSlot] = (timeSlotMap[timeSlot] || 0) + 1;
      }
    });

    // Convert to array and sort by time
    return Object.entries(timeSlotMap)
      .map(([time, count]) => ({ time, count }))
      .sort((a, b) => {
        const hourA = parseInt(a.time.split(':')[0]);
        const hourB = parseInt(b.time.split(':')[0]);
        return hourA - hourB;
      });
  };

  // Calculate utilization by day of week
  const getDayOfWeekUtilization = () => {
    if (!bookings.length) return [];

    const daysOfWeek = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const dayCounts = Array(7).fill(0);

    bookings.forEach(booking => {
      if (booking.status === 'confirmed') {
        try {
          // Check if date has toDate method before calling it
          if (!booking.date || typeof booking.date.toDate !== 'function') {
            return; // Skip this booking
          }
          
          // Convert Firestore Timestamp to JavaScript Date
          const bookingDate = booking.date.toDate();
          const dayOfWeek = bookingDate.getDay(); // 0 = Sunday, 6 = Saturday
          dayCounts[dayOfWeek]++;
        } catch (error) {
          console.log('Error processing booking date in day of week calculation:', error);
          // Skip this booking if there's an error
        }
      }
    });

    return daysOfWeek.map((day, index) => ({
      day,
      bookings: dayCounts[index]
    }));
  };

  // Calculate cancellation rate
  const getCancellationData = () => {
    if (!bookings.length) return [];

    const confirmed = bookings.filter(b => b.status === 'confirmed').length;
    const cancelled = bookings.filter(b => b.status === 'cancelled').length;
    const pending = bookings.filter(b => b.status === 'pending').length;
    const total = confirmed + cancelled + pending;

    return [
      { name: 'Confirmed', value: confirmed, percentage: Math.round((confirmed / total) * 100) },
      { name: 'Cancelled', value: cancelled, percentage: Math.round((cancelled / total) * 100) },
      { name: 'Pending', value: pending, percentage: Math.round((pending / total) * 100) }
    ];
  };

  // Calculate average lead time (days between booking creation and actual booking date)
  const getAverageLeadTime = () => {
    if (!bookings.length) return "N/A";

    let totalDays = 0;
    let validBookings = 0;

    bookings.forEach(booking => {
      if (booking.status !== 'cancelled') {
        try {
          // Simple safety check - only process if toDate method exists
          if (!booking.date || !booking.createdAt ||
              typeof booking.date.toDate !== 'function' ||
              typeof booking.createdAt.toDate !== 'function') {
            // Skip this booking if we can't properly process the dates
            return;
          }
          
          const bookingDate = booking.date.toDate();
          const creationDate = booking.createdAt.toDate();
          const leadTimeDays = differenceInDays(bookingDate, creationDate);
          
          if (leadTimeDays >= 0) {
            totalDays += leadTimeDays;
            validBookings++;
          }
        } catch (error) {
          console.log('Error processing booking date:', error);
          // Skip this booking if there's an error processing its dates
        }
      }
    });

    return validBookings > 0
      ? `${(totalDays / validBookings).toFixed(1)} days`
      : "N/A";
  };

  // Player Dashboard Data
  
  // Mock data - would come from Firestore in a real app
  const nextGame = {
    league: 'Series A',
    date: '21:00, 8 November, 2023',
    teams: [
      { name: 'PicklePro', logo: '🏓' },
      { name: 'RivalTeam', logo: '🎾' }
    ]
  };

  const statistics = {
    matches: 8,
    victories: 6,
    draws: 1,
    losses: 1
  };

  const standings = [
    { position: 1, team: 'PicklePro', mp: 8, w: 6, d: 1, l: 1, gd: '13:5', pts: 19 },
    { position: 2, team: 'BallSlammers', mp: 8, w: 5, d: 1, l: 2, gd: '10:2', pts: 16 },
    { position: 3, team: 'CourtMasters', mp: 8, w: 5, d: 0, l: 3, gd: '10:3', pts: 15 },
    { position: 4, team: 'NetDominators', mp: 8, w: 4, d: 1, l: 3, gd: '14:6', pts: 13 },
    { position: 5, team: 'ServeKings', mp: 8, w: 4, d: 1, l: 3, gd: '8:4', pts: 13 },
    { position: 6, team: 'RallyChamps', mp: 8, w: 4, d: 0, l: 4, gd: '7:3', pts: 12 }
  ];

  const metrics = [
    { title: 'POSSESSION', value: '65%', icon: <BsPercent className="h-6 w-6" /> },
    { title: 'OVERALL PACE', value: '₹690.2m', icon: <RiMoneyDollarCircleLine className="h-6 w-6" /> },
    { title: 'TRANSFER BUDGET', value: '₹240.6m', icon: <RiMoneyDollarCircleLine className="h-6 w-6" /> },
    { title: 'AVERAGE SCORE', value: '7.2', icon: <BsTrophy className="h-6 w-6" /> },
  ];

  // Facility Manager Metrics
  const facilityMetrics = [
    { title: 'TOTAL COURTS', value: courts.length, icon: <GiTennisCourt className="h-6 w-6" /> },
    { title: 'TOTAL BOOKINGS', value: bookings.length, icon: <BsCalendar2Check className="h-6 w-6" /> },
    { title: 'CANCELLATION RATE', value: `${getCancellationData().find(item => item.name === 'Cancelled')?.percentage || 0}%`, icon: <BsXCircle className="h-6 w-6" /> },
    { title: 'AVG LEAD TIME', value: getAverageLeadTime(), icon: <BsClock className="h-6 w-6" /> },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  // Conditional rendering based on user role
  if (userData?.role === 'facility_manager' || userData?.isAdmin) {
    // Facility Manager Dashboard
    return (
      <div className="space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white font-mono tracking-tight">Welcome back, {firstName}</h1>
            <p className="text-white/80 mt-1">Court Operations & Utilization Dashboard</p>
          </div>
        </div>

        {/* Facility Manager Metrics Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {facilityMetrics.map((metric, index) => (
            <Card key={index}
              className="p-5 glass-effect card-hover rounded-lg overflow-hidden bg-opacity-40 backdrop-blur-sm border border-white/20 shadow-lg"
            >
              <div className="flex items-center mb-3">
                <div className="w-10 h-10 rounded-lg bg-accent-orange/20 flex items-center justify-center text-accent-orange mr-3">
                  {metric.icon}
                </div>
                <span className="text-xs font-medium uppercase tracking-wider text-white/80">{metric.title}</span>
              </div>
              <div className="text-2xl font-mono font-bold text-white">{metric.value}</div>
            </Card>
          ))}
        </div>

        {/* Court Operations & Utilization Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Court Utilization Rates */}
          <Card className="p-6 bg-opacity-40 backdrop-blur-sm border border-white/20 shadow-lg rounded-lg overflow-hidden">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-orange mr-2"></span>
              Court Utilization Rates
            </h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getCourtUtilization()} layout="vertical">
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    type="number"
                    unit="%"
                    domain={[0, 100]}
                    tick={{ fill: "#ffffff" }}
                    axisLine={{ stroke: '#ffffff20' }}
                  />
                  <YAxis
                    dataKey="name"
                    type="category"
                    width={100}
                    tick={{ fill: "#ffffff" }}
                    axisLine={{ stroke: '#ffffff20' }}
                  />
                  <Tooltip
                    formatter={(value: number) => [`${value}%`, 'Utilization']}
                    contentStyle={{
                      backgroundColor: 'rgba(30, 58, 95, 0.9)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '4px',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                      color: '#ffffff'
                    }}
                  />
                  <Bar
                    dataKey="utilizationRate"
                    fill="#ff7e1f"
                    name="Utilization Rate"
                    animationDuration={800}
                    radius={[0, 4, 4, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Time Slot Popularity */}
          <Card className="p-6 bg-opacity-40 backdrop-blur-sm border border-white/20 shadow-lg rounded-lg overflow-hidden">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-orange mr-2"></span>
              Time Slot Popularity
            </h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getTimeSlotUtilization()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="time"
                    tick={{ fill: "#ffffff" }}
                    axisLine={{ stroke: '#ffffff20' }}
                  />
                  <YAxis
                    tick={{ fill: "#ffffff" }}
                    axisLine={{ stroke: '#ffffff20' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(30, 58, 95, 0.9)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '4px',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                      color: '#ffffff'
                    }}
                  />
                  <Bar
                    dataKey="count"
                    fill="#2d8659"
                    name="Bookings"
                    animationDuration={800}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Day of Week Patterns */}
          <Card className="p-6 bg-opacity-40 backdrop-blur-sm border border-white/20 shadow-lg rounded-lg overflow-hidden">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-orange mr-2"></span>
              Day of Week Patterns
            </h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getDayOfWeekUtilization()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
                  <XAxis
                    dataKey="day"
                    tick={{ fill: "#ffffff" }}
                    axisLine={{ stroke: '#ffffff20' }}
                  />
                  <YAxis
                    tick={{ fill: "#ffffff" }}
                    axisLine={{ stroke: '#ffffff20' }}
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(30, 58, 95, 0.9)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '4px',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                      color: '#ffffff'
                    }}
                  />
                  <Bar
                    dataKey="bookings"
                    fill="#ff7e1f"
                    name="Bookings"
                    animationDuration={800}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* Booking Status Distribution */}
          <Card className="p-6 bg-opacity-40 backdrop-blur-sm border border-white/20 shadow-lg rounded-lg overflow-hidden">
            <h2 className="text-lg font-bold text-white mb-4 flex items-center">
              <span className="w-1.5 h-1.5 rounded-full bg-accent-orange mr-2"></span>
              Booking Status Distribution
            </h2>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={getCancellationData()}
                    cx="50%"
                    cy="50%"
                    labelLine={true}
                    outerRadius={90}
                    innerRadius={40}
                    fill="#8884d8"
                    dataKey="value"
                    nameKey="name"
                    label={({ name, percentage }: { name: string; percentage: number }) => `${name}: ${percentage}%`}
                    animationDuration={800}
                    animationBegin={200}
                  >
                    {getCancellationData().map((entry, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={[
                          '#2d8659',  // Confirmed - Green
                          '#ff7e1f',  // Cancelled - Orange
                          '#1e3a5f'   // Pending - Blue
                        ][index % 3]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      backgroundColor: 'rgba(30, 58, 95, 0.9)',
                      border: '1px solid rgba(255, 255, 255, 0.2)',
                      borderRadius: '4px',
                      boxShadow: '0 2px 5px rgba(0,0,0,0.2)',
                      color: '#ffffff'
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    iconType="circle"
                    formatter={(value) => <span style={{ color: '#ffffff' }}>{value}</span>}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </Card>
        </div>
      </div>
    );
  } else {
    // Player Dashboard
    return (
      <div className="space-y-8">
        {/* Header */}
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-3xl font-bold text-white font-mono tracking-tight">Welcome back, {firstName}</h1>
            <p className="text-white/80 mt-1">Here's what's happening with your games</p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left column - Next game & Standings */}
          <div className="lg:col-span-2 space-y-8">
            {/* Next Game Card */}
            <Card className="p-6 bg-opacity-40 backdrop-blur-sm border border-white/20 shadow-lg rounded-lg overflow-hidden card-hover">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-white flex items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-accent-orange mr-2"></span>
                  Next game
                </h2>
                <Button
                  as="a"
                  href="#"
                  variant="flat"
                  size="sm"
                  endContent={<BsArrowRightShort className="ml-1 text-lg" />}
                  className="bg-accent-orange text-white hover:bg-accent-orangeDark transition-colors"
                >
                  View calendar
                </Button>
              </div>
              
              <div className="flex items-center text-sm text-white/80 mb-6 font-medium">
                <span>{nextGame.league}</span>
                <span className="mx-2 text-accent-orange">•</span>
                <span>{nextGame.date}</span>
              </div>

              <div className="flex items-center justify-center space-x-16 py-6 bg-white/10 backdrop-blur-sm rounded-lg border border-white/10">
                <div className="flex flex-col items-center transform hover:scale-105 transition-transform duration-300">
                  <div className="text-6xl mb-4 bg-white p-4 rounded-full shadow-sm">{nextGame.teams[0].logo}</div>
                  <span className="font-bold text-gray-900">{nextGame.teams[0].name}</span>
                </div>

                <div className="flex flex-col items-center">
                  <span className="text-2xl font-mono font-extrabold bg-gradient-to-r from-blue-600 to-blue-800 text-transparent bg-clip-text">VS</span>
                </div>

                <div className="flex flex-col items-center transform hover:scale-105 transition-transform duration-300">
                  <div className="text-6xl mb-4 bg-white p-4 rounded-full shadow-sm">{nextGame.teams[1].logo}</div>
                  <span className="font-bold text-gray-900">{nextGame.teams[1].name}</span>
                </div>
              </div>
            </Card>

            {/* Standings Card */}
            <Card className="p-6 bg-opacity-40 backdrop-blur-sm border border-white/20 shadow-lg rounded-lg overflow-hidden card-hover">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-gray-900 flex items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 mr-2"></span>
                  Standings
                </h2>
                <Button
                  as="a"
                  href="#"
                  variant="light"
                  color="primary"
                  size="sm"
                  endContent={<BsArrowRightShort className="ml-1 text-lg" />}
                  className="text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  View all
                </Button>
              </div>

              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead>
                    <tr className="text-xs font-medium text-white/70 uppercase tracking-wider border-b border-white/10">
                      <th className="px-3 py-3 text-left">#</th>
                      <th className="px-3 py-3 text-left">Team</th>
                      <th className="px-3 py-3 text-center">MP</th>
                      <th className="px-3 py-3 text-center">W</th>
                      <th className="px-3 py-3 text-center">D</th>
                      <th className="px-3 py-3 text-center">L</th>
                      <th className="px-3 py-3 text-center">GD</th>
                      <th className="px-3 py-3 text-center">PTS</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {standings.map((team) => (
                      <tr
                        key={team.position}
                        className={`text-sm hover:bg-gray-50 transition-colors ${team.team === 'PicklePro' ? 'bg-blue-50' : ''}`}
                      >
                        <td className="px-3 py-4 text-gray-700 font-mono">{team.position}</td>
                        <td className="px-3 py-4 font-bold text-gray-900">{team.team}</td>
                        <td className="px-3 py-4 text-center text-gray-700 font-mono">{team.mp}</td>
                        <td className="px-3 py-4 text-center text-emerald-600 font-mono font-medium">{team.w}</td>
                        <td className="px-3 py-4 text-center text-gray-500 font-mono">{team.d}</td>
                        <td className="px-3 py-4 text-center text-red-500 font-mono">{team.l}</td>
                        <td className="px-3 py-4 text-center text-gray-700 font-mono">{team.gd}</td>
                        <td className="px-3 py-4 text-center font-bold text-gray-900 font-mono">{team.pts}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </div>

          {/* Right column - Game statistics & Metrics */}
          <div className="space-y-8">
            {/* Game Statistics Card */}
            <Card className="p-6 bg-opacity-40 backdrop-blur-sm border border-white/20 shadow-lg rounded-lg overflow-hidden card-hover">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-gray-900 flex items-center">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 mr-2"></span>
                  Games statistics
                </h2>
                <Button
                  as="a"
                  href="#"
                  variant="light"
                  color="primary"
                  size="sm"
                  endContent={<BsArrowRightShort className="ml-1 text-lg" />}
                  className="text-blue-600 hover:bg-blue-50 transition-colors"
                >
                  View all statistics
                </Button>
              </div>

              <div className="flex justify-between text-center">
                <div className="bg-gray-50 rounded-lg px-4 py-3 flex-1 mx-1 transform hover:scale-105 transition-transform duration-300">
                  <div className="text-blue-600 font-mono font-bold text-2xl">{statistics.matches}</div>
                  <div className="text-xs font-medium text-gray-500 mt-1 uppercase tracking-wider">Played</div>
                </div>
                <div className="bg-green-50 rounded-lg px-4 py-3 flex-1 mx-1 transform hover:scale-105 transition-transform duration-300">
                  <div className="text-green-600 font-mono font-bold text-2xl">{statistics.victories}</div>
                  <div className="text-xs font-medium text-gray-500 mt-1 uppercase tracking-wider">Victories</div>
                </div>
                <div className="bg-gray-50 rounded-lg px-4 py-3 flex-1 mx-1 transform hover:scale-105 transition-transform duration-300">
                  <div className="text-gray-500 font-mono font-bold text-2xl">{statistics.draws}</div>
                  <div className="text-xs font-medium text-gray-500 mt-1 uppercase tracking-wider">Draws</div>
                </div>
                <div className="bg-red-50 rounded-lg px-4 py-3 flex-1 mx-1 transform hover:scale-105 transition-transform duration-300">
                  <div className="text-red-600 font-mono font-bold text-2xl">{statistics.losses}</div>
                  <div className="text-xs font-medium text-gray-500 mt-1 uppercase tracking-wider">Lost</div>
                </div>
              </div>

              <div className="mt-6 bg-gray-100 h-3 rounded-full overflow-hidden">
                <div className="flex h-full">
                  <div className="bg-green-500 h-full transition-all duration-1000 ease-out" style={{ width: `${(statistics.victories / statistics.matches) * 100}%` }}></div>
                  <div className="bg-gray-400 h-full transition-all duration-1000 ease-out" style={{ width: `${(statistics.draws / statistics.matches) * 100}%` }}></div>
                  <div className="bg-red-500 h-full transition-all duration-1000 ease-out" style={{ width: `${(statistics.losses / statistics.matches) * 100}%` }}></div>
                </div>
              </div>
            </Card>
            
            {/* DUPR Ratings Card */}
            <DuprRatingsCard />
            
            {/* Metrics Grid */}
            <div className="grid grid-cols-2 gap-4">
              {metrics.map((metric, index) => (
                <Card key={index} className="p-5 glass-effect bg-opacity-40 backdrop-blur-sm border border-white/20 shadow-lg rounded-lg overflow-hidden transform hover:scale-[1.02]">
                  <div className="flex items-center mb-3">
                    <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600 mr-3">
                      {metric.icon}
                    </div>
                    <span className="text-xs font-medium uppercase tracking-wider text-gray-500">{metric.title}</span>
                  </div>
                  <div className="text-2xl font-mono font-bold text-gray-900">{metric.value}</div>
                </Card>
              ))}
            </div>

            {/* Training Card */}
            <div className="p-6 bg-gradient-to-r from-blue-600 to-blue-800 text-white rounded-lg shadow-md overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-xl font-bold mb-2">Setup training for next week</h3>
                <p className="text-white/90 text-sm mb-5">Plan your practice sessions</p>
                <button className="bg-white text-blue-700 px-5 py-2 rounded-md text-sm font-medium hover:bg-blue-50 transition-colors transform hover:scale-105 transition-transform duration-300 shadow-sm">
                  Create training plan
                </button>
              </div>
              <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500 rounded-full opacity-20 -mr-10 -mt-10"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-blue-500 rounded-full opacity-20 -ml-10 -mb-10"></div>
            </div>
          </div>
        </div>
      </div>
    );
  }
}