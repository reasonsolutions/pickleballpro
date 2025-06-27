import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/common/ProtectedRoute';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import DashboardLayout from './components/dashboard/DashboardLayout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import BookCourt from './pages/BookCourt';
import Tournaments from './pages/Tournaments';
import TournamentDetails from './pages/TournamentDetails';
import FacilityTournamentDetails from './pages/FacilityTournamentDetails';
import Shop from './pages/Shop';
import Analytics from './pages/Analytics';
import Promotions from './pages/Promotions';
import DuprProfile from './pages/DuprProfile';
import Courts from './pages/Courts';
import Settings from './pages/Settings';
import ManageBookings from './pages/ManageBookings';

function App() {
  return (
    <Router>
      <AuthProvider>
        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Protected Routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<DashboardLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/dashboard/book" element={<BookCourt />} />
              <Route path="/dashboard/tournaments" element={<Tournaments />} />
              <Route path="/dashboard/tournaments/:id" element={<TournamentDetails />} />
              <Route path="/dashboard/tournaments/facility/:id" element={<FacilityTournamentDetails />} />
              <Route path="/dashboard/shop" element={<Shop />} />
              <Route path="/dashboard/analytics" element={<Analytics />} />
              <Route path="/dashboard/promotions" element={<Promotions />} />
              <Route path="/dashboard/dupr-profile" element={<DuprProfile />} />
              <Route path="/dashboard/courts" element={<Courts />} />
              <Route path="/dashboard/settings" element={<Settings />} />
              <Route path="/dashboard/manage-bookings" element={<ManageBookings />} />
            </Route>
          </Route>
          
          {/* Redirect to login for root path */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          
          {/* Catch all - redirect to dashboard */}
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AuthProvider>
    </Router>
  );
}

export default App;
