import { useEffect, useState } from 'react';
import { BsCheckCircle, BsXCircle, BsInfoCircle, BsX } from 'react-icons/bs';

type NotificationType = 'success' | 'error' | 'info';

interface NotificationProps {
  type: NotificationType;
  message: string;
  duration?: number;
  onClose?: () => void;
  show: boolean;
}

export default function Notification({
  type,
  message,
  duration = 3000,
  onClose,
  show
}: NotificationProps) {
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(show);
    
    if (show && duration > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false);
        if (onClose) onClose();
      }, duration);
      
      return () => clearTimeout(timer);
    }
  }, [show, duration, onClose]);

  if (!isVisible) return null;

  const getIcon = () => {
    switch (type) {
      case 'success':
        return <BsCheckCircle className="text-green-500" />;
      case 'error':
        return <BsXCircle className="text-red-500" />;
      case 'info':
        return <BsInfoCircle className="text-blue-500" />;
      default:
        return null;
    }
  };

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return 'bg-green-50 border-green-200';
      case 'error':
        return 'bg-red-50 border-red-200';
      case 'info':
        return 'bg-blue-50 border-blue-200';
      default:
        return 'bg-gray-50 border-gray-200';
    }
  };

  const getTextColor = () => {
    switch (type) {
      case 'success':
        return 'text-green-700';
      case 'error':
        return 'text-red-700';
      case 'info':
        return 'text-blue-700';
      default:
        return 'text-gray-700';
    }
  };

  return (
    <div className={`fixed top-4 right-4 z-50 max-w-md animate-slide-in`}>
      <div className={`glass-card p-4 ${getBackgroundColor()} ${getTextColor()} flex items-center justify-between rounded-lg shadow-lg border`}>
        <div className="flex items-center">
          {getIcon()}
          <span className="ml-2">{message}</span>
        </div>
        <button
          onClick={() => {
            setIsVisible(false);
            if (onClose) onClose();
          }}
          className="ml-4 text-gray-400 hover:text-gray-600 transition-colors"
        >
          <BsX />
        </button>
      </div>
    </div>
  );
}