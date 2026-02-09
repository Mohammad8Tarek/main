import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';

type ToastType = 'success' | 'error' | 'info';

export interface Notification {
  id: number;
  message: string;
  type: ToastType;
  read: boolean;
  timestamp: Date;
}

interface ToastContextType {
  showToast: (message: string, type: ToastType) => void;
  notifications: Notification[];
  unreadCount: number;
  markAllAsRead: () => void;
}

const ToastContext = createContext<ToastContextType | undefined>(undefined);

let notificationId = 0;

export const ToastProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Pick<Notification, 'id' | 'message' | 'type'>[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  
  const unreadCount = notifications.filter(n => !n.read).length;

  const showToast = useCallback((message: string, type: ToastType) => {
    const id = notificationId++;
    setToasts(prevToasts => [...prevToasts, { id, message, type }]);
    
    if (type === 'success') {
        const newNotification: Notification = { id, message, type, read: false, timestamp: new Date() };
        setNotifications(prev => [newNotification, ...prev].slice(0, 20)); // Keep last 20
    }

    setTimeout(() => {
      setToasts(prevToasts => prevToasts.filter(toast => toast.id !== id));
    }, 4000);
  }, []);
  
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const getIcon = (type: ToastType) => {
    switch(type) {
      case 'success': return 'fa-check-circle';
      case 'error': return 'fa-times-circle';
      case 'info': return 'fa-info-circle';
    }
  };
  
  const getColors = (type: ToastType) => {
    switch(type) {
        case 'success': return 'bg-green-500';
        case 'error': return 'bg-red-500';
        case 'info': return 'bg-primary-500';
    }
  }

  return (
    <ToastContext.Provider value={{ showToast, notifications, unreadCount, markAllAsRead }}>
      {children}
      <div className="fixed bottom-5 right-5 z-[100] space-y-3">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-center w-full max-w-xs p-4 text-white ${getColors(toast.type)} rounded-lg shadow-lg animate-fade-in-up`}
            role="alert"
          >
            <div className={`inline-flex items-center justify-center flex-shrink-0 w-8 h-8 rounded-lg`}>
                <i className={`fas ${getIcon(toast.type)}`}></i>
            </div>
            <div className="ms-3 text-sm font-normal">{toast.message}</div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = (): ToastContextType => {
  const context = useContext(ToastContext);
  if (context === undefined) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};