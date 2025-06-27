import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { Button, Avatar, User } from '@heroui/react';
import {
  RiCalendarEventLine,
  RiTrophyLine,
  RiShoppingCartLine,
  RiBarChartBoxLine,
  RiUser3Line,
  RiLogoutBoxRLine,
  RiMenuLine,
  RiCloseLine,
  RiProfileLine,
  RiTableLine,
  RiSettings3Line
} from 'react-icons/ri';

interface SidebarProps {
  isMobile: boolean;
}

export default function Sidebar({ isMobile }: SidebarProps) {
  const [isOpen, setIsOpen] = useState(!isMobile);
  const { currentUser, userData, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    try {
      await logout();
      navigate('/login');
    } catch (error) {
      console.error('Failed to log out', error);
    }
  };

  const toggleSidebar = () => {
    setIsOpen(!isOpen);
  };

  // Define different navigation items based on user role
  const getNavItems = () => {
    const userRole = userData?.role || 'player';

    if (userRole === 'facility_manager') {
      return [
        {
          name: 'Dashboard',
          icon: <RiCalendarEventLine className="text-xl" />,
          path: '/dashboard'
        },
        {
          name: 'Manage Bookings',
          icon: <RiCalendarEventLine className="text-xl" />,
          path: '/dashboard/manage-bookings'
        },
        {
          name: 'Courts',
          icon: <RiTableLine className="text-xl" />,
          path: '/dashboard/courts'
        },
        {
          name: 'Tournaments',
          icon: <RiTrophyLine className="text-xl" />,
          path: '/dashboard/tournaments'
        },
        {
          name: 'Promotions',
          icon: <RiBarChartBoxLine className="text-xl" />,
          path: '/dashboard/promotions'
        },
        {
          name: 'Settings',
          icon: <RiSettings3Line className="text-xl" />,
          path: '/dashboard/settings'
        }
      ];
    } else {
      // Default navigation for players and brands
      return [
        {
          name: 'Dashboard',
          icon: <RiCalendarEventLine className="text-xl" />,
          path: '/dashboard'
        },
        {
          name: 'Book Court',
          icon: <RiCalendarEventLine className="text-xl" />,
          path: '/dashboard/book'
        },
        {
          name: 'Tournaments',
          icon: <RiTrophyLine className="text-xl" />,
          path: '/dashboard/tournaments'
        },
        {
          name: 'Shop',
          icon: <RiShoppingCartLine className="text-xl" />,
          path: '/dashboard/shop'
        },
        {
          name: 'Analytics',
          icon: <RiBarChartBoxLine className="text-xl" />,
          path: '/dashboard/analytics'
        },
        {
          name: 'DUPR Profile',
          icon: <RiProfileLine className="text-xl" />,
          path: '/dashboard/dupr-profile'
        }
      ];
    }
  };

  const navItems = getNavItems();

  return (
    <>
      {/* Mobile Hamburger Menu */}
      {isMobile && (
        <Button
          isIconOnly
          variant="flat"
          onClick={toggleSidebar}
          className="fixed top-4 left-4 z-50 p-2 rounded-full bg-court-green shadow-court text-white hover:bg-accent-orange transition-colors"
          aria-label={isOpen ? "Close Menu" : "Open Menu"}
        >
          {isOpen ?
            <RiCloseLine className="text-2xl transform transition-transform duration-200 hover:rotate-90" /> :
            <RiMenuLine className="text-2xl" />
          }
        </Button>
      )}

      {/* Sidebar */}
      <aside
        className={`
          fixed h-full overflow-y-auto transition-all duration-300 z-40
          ${isMobile ? (isOpen ? 'left-0' : '-left-64') : 'left-0'}
          ${isMobile ? 'w-64' : 'w-64'}
          pt-6 pb-8 flex flex-col
          bg-[#2d8659] court-bg-green shadow-md
        `}
      >
        {/* Logo */}
        <div className="px-6 mb-10">
          <div className="flex justify-center">
            <img
              src="/dist/assets/logo.png"
              alt="PickleBall Pro Logo"
              className="h-12 w-auto"
            />
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.path}>
                <NavLink
                  to={item.path}
                  className={({ isActive }) => `
                    flex items-center px-4 py-3 rounded-lg transition-all duration-200
                    ${isActive
                      ? 'bg-[rgba(255,255,255,0.15)] text-white font-medium shadow-sm transform translate-x-1'
                      : 'text-white/80 hover:bg-[rgba(255,255,255,0.1)] hover:text-white'
                    }
                  `}
                  onClick={() => isMobile && setIsOpen(false)}
                >
                  {({ isActive }) => (
                    <>
                      <span className={`transform transition-transform duration-200 ${isActive ? 'scale-110' : ''}`}>
                        {item.icon}
                      </span>
                      <span className="ml-3">{item.name}</span>
                      {isActive && (
                        <span className="ml-auto w-1.5 h-1.5 rounded-full bg-accent-orange"></span>
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* User Profile & Logout */}
        <div className="px-4 mt-6">
          <div className="pt-4 border-t border-white/20">
            <div className="px-4 py-3 bg-white/10 rounded-lg mb-3 hover:bg-white/15 transition-colors">
              <User
                name={currentUser?.displayName || 'User'}
                description={currentUser?.email}
                className="font-medium text-white"
                avatarProps={{
                  src: currentUser?.photoURL || undefined,
                  className: "border-2 border-white/30",
                  fallback: <RiUser3Line className="text-xl text-white" />
                }}
              />
            </div>

            <Button
              onClick={handleLogout}
              variant="flat"
              className="mt-2 w-full flex items-center justify-start px-4 py-3 text-white rounded-lg hover:bg-accent-orange/20 hover:text-white transition-all duration-200 font-medium"
              startContent={<RiLogoutBoxRLine className="text-xl" />}
            >
              Logout
            </Button>
          </div>
        </div>
      </aside>
    </>
  );
}