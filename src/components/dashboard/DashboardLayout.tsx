import { useState, useEffect } from 'react';
import { Outlet } from 'react-router-dom';
import Sidebar from './Sidebar';
import { Card } from '@heroui/react';

export default function DashboardLayout() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 1024);

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth < 1024);
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row court-bg-blue font-sans text-white">
      <Sidebar isMobile={isMobile} />
      
      <main className={`flex-1 transition-all duration-300 ${isMobile ? 'ml-0' : 'ml-64'} border-l-4 border-white court-border`}>
        <div className="min-h-screen p-5 md:p-8 lg:p-10">
          <div className="max-w-7xl mx-auto">
            <Outlet />
          </div>
        </div>
      </main>
    </div>
  );
}