
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { useSettings } from '../context/SettingsContext';
import { usePermissions } from '../hooks/usePermissions';
import { useProperty } from '../context/PropertyContext'; 
import { ModuleType, Employee } from '../types';
import { reservationApi, assignmentApi, employeeApi } from '../services/apiService';

const Layout: React.FC<{ theme: string; toggleTheme: () => void }> = ({ theme, toggleTheme }) => {
  const { user, logout } = useAuth();
  const { language, t } = useLanguage();
  const { settings } = useSettings();
  const { notifications, unreadCount: toastUnread, markAllAsRead } = useToast();
  const { currentProperty, allProperties, switchProperty } = useProperty(); 
  const perms = usePermissions();
  const location = useLocation();
  const navigate = useNavigate();

  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [notifMenuOpen, setNotifMenuOpen] = useState(false);
  const [propMenuOpen, setPropMenuOpen] = useState(false); 

  const [systemAlerts, setSystemAlerts] = useState<any[]>([]);

  const userMenuRef = useRef<HTMLDivElement>(null);
  const notifMenuRef = useRef<HTMLDivElement>(null);
  const propMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) setUserMenuOpen(false);
      if (notifMenuRef.current && !notifMenuRef.current.contains(event.target as Node)) setNotifMenuOpen(false);
      if (propMenuRef.current && !propMenuRef.current.contains(event.target as Node)) setPropMenuOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchSystemAlerts = async () => {
      try {
          const [resData, assignData, empData] = await Promise.all([
              reservationApi.getAll(),
              assignmentApi.getAll(),
              employeeApi.getAll()
          ]);
          const threshold = settings.departureAlertThreshold || 3;
          const today = new Date();
          today.setHours(0,0,0,0);
          const alerts: any[] = [];
          const empMap = new Map<number, Employee>(empData.map(e => [e.id, e]));

          resData.forEach(r => {
              const checkIn = new Date(r.checkInDate);
              checkIn.setHours(0,0,0,0);
              const diff = Math.ceil((checkIn.getTime() - today.getTime()) / (1000 * 3600 * 24));
              if (diff <= threshold) {
                  alerts.push({ id: `arr-${r.id}`, type: 'arrival', message: `${r.firstName} ${r.lastName}`, date: r.checkInDate, link: '/reservations' });
              }
          });

          assignData.filter(a => !a.checkOutDate && a.expectedCheckOutDate).forEach(a => {
              const checkOut = new Date(a.expectedCheckOutDate!);
              checkOut.setHours(0,0,0,0);
              const diff = Math.ceil((checkOut.getTime() - today.getTime()) / (1000 * 3600 * 24));
              if (diff <= threshold) {
                  const emp = empMap.get(a.employeeId);
                  alerts.push({ id: `dep-${a.id}`, type: 'departure', message: `${emp?.firstName || ''} ${emp?.lastName || ''}`, date: a.expectedCheckOutDate, link: '/reservations' });
              }
          });
          setSystemAlerts(alerts);
      } catch (e) { console.error("Alerts failed"); }
  };

  useEffect(() => {
    fetchSystemAlerts();
    window.addEventListener('datachanged', fetchSystemAlerts);
    return () => window.removeEventListener('datachanged', fetchSystemAlerts);
  }, [settings.departureAlertThreshold, language]);

  useEffect(() => { setSidebarOpen(false); }, [location]);

  const isModuleEnabled = (moduleKey: ModuleType) => {
      if (!currentProperty?.enabledModules) return true; 
      return currentProperty.enabledModules.includes(moduleKey);
  };

  const navLinks = [
    { to: "/", icon: "fa-tachometer-alt", label: t('layout.dashboard'), visible: perms.canViewDashboard && isModuleEnabled('dashboard') },
    { to: "/housing", icon: "fa-hotel", label: t('layout.housing'), visible: perms.canViewHousing && isModuleEnabled('housing') },
    { to: "/employees", icon: "fa-user-tie", label: t('layout.employees'), visible: perms.canViewEmployees && isModuleEnabled('employees') },
    { to: "/reservations", icon: "fa-calendar-check", label: t('layout.reservations'), visible: perms.canViewReservations && isModuleEnabled('reservations') },
    { to: "/maintenance", icon: "fa-tools", label: t('layout.maintenance'), visible: perms.canViewMaintenance && isModuleEnabled('maintenance') },
    { to: "/reports", icon: "fa-chart-line", label: t('layout.reports'), visible: perms.canViewReports && isModuleEnabled('reports') },
    { to: "/users", icon: "fa-user-shield", label: t('layout.userManagement'), visible: perms.canViewUsers && isModuleEnabled('users') },
    { to: "/properties", icon: "fa-building", label: "Properties", visible: perms.isSuperAdmin }, 
    { to: "/settings", icon: "fa-cog", label: t('layout.settings'), visible: perms.canViewSettings && isModuleEnabled('settings') },
    { to: "/activity-log", icon: "fa-history", label: t('layout.activityLog'), visible: perms.canViewActivityLog && isModuleEnabled('activity_log') },
  ];

  const handleLogout = () => { logout(); navigate('/login'); };
  const totalUnreadCount = toastUnread + systemAlerts.length;
  const initials = user?.username?.substring(0, 2).toUpperCase() || 'U';

  return (
    <div className={`flex h-screen w-screen overflow-hidden transition-colors duration-300 ${language === 'ar' ? 'font-arabic' : 'font-sans'}`} dir={language === 'ar' ? 'rtl' : 'ltr'} style={{ backgroundColor: 'var(--bg-color)' }}>
      {/* Sidebar */}
      <aside className={`fixed inset-y-0 z-50 w-64 transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 border-r border-white/5 shadow-2xl ${language === 'ar' ? 'right-0' : 'left-0'} ${sidebarOpen ? 'translate-x-0' : (language === 'ar' ? 'translate-x-full' : '-translate-x-full')}`} style={{ backgroundColor: 'var(--sidebar-color)' }}>
        <div className="flex flex-col h-full">
          <div className="h-20 flex flex-col justify-center items-center px-4 border-b border-white/10 bg-black/5">
            <div className="w-32 h-10 flex items-center justify-center overflow-hidden">
                {settings.systemLogo ? <img src={settings.systemLogo} className="w-full h-full object-contain" alt="Logo" /> : <i className="fas fa-hotel text-white text-2xl"></i>}
            </div>
            <span className="text-[10px] font-black text-white uppercase tracking-tight mt-1.5">{settings.systemName}</span>
          </div>
          <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1 custom-scrollbar">
            {navLinks.map(link => link.visible && (
              <NavLink key={link.to} to={link.to} className={({ isActive }) => `flex items-center px-4 py-2.5 rounded-xl transition-all duration-200 group ${isActive ? 'bg-white/10 text-white shadow-lg border-l-4 border-hotel-gold' : 'text-slate-400 hover:text-white hover:bg-white/5'}`}>
                <i className={`fas ${link.icon} w-6 text-center text-base ${location.pathname === link.to ? 'text-hotel-gold' : 'group-hover:text-hotel-gold'}`}></i>
                <span className="mx-3 text-sm font-bold tracking-wide">{link.label}</span>
              </NavLink>
            ))}
          </nav>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex flex-col flex-1 min-w-0 h-full relative">
        <header className="h-20 flex-shrink-0 border-b border-slate-200 dark:border-white/5 px-4 lg:px-8 flex items-center justify-between z-40 shadow-sm transition-all" style={{ backgroundColor: 'var(--header-color)' }}>
          <div className="flex items-center gap-6 h-full">
            <button onClick={() => setSidebarOpen(!sidebarOpen)} className="lg:hidden p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl"><i className="fas fa-bars text-xl"></i></button>
            
            {/* Global Property Selector */}
            <div className="relative" ref={propMenuRef}>
              <button 
                onClick={() => perms.isSuperAdmin && setPropMenuOpen(!propMenuOpen)}
                className={`flex items-center gap-4 px-5 h-12 bg-slate-50/80 dark:bg-slate-900/50 rounded-2xl border border-slate-100 dark:border-slate-800 transition-all ${perms.isSuperAdmin ? 'hover:border-hotel-gold cursor-pointer' : 'cursor-default'}`}
              >
                  <div className="w-16 h-8 flex items-center justify-center">
                      {currentProperty?.logo ? <img src={currentProperty.logo} className="w-full h-full object-contain" /> : <i className="fas fa-building text-hotel-gold text-lg opacity-60"></i>}
                  </div>
                  <div className="h-6 w-[1px] bg-slate-200 dark:bg-slate-700 hidden sm:block"></div>
                  <div className="flex flex-col justify-center min-w-[120px]">
                      <span className="text-[13px] font-black uppercase truncate max-w-[200px] text-hotel-navy dark:text-slate-100 tracking-tight">{currentProperty?.displayName || currentProperty?.name}</span>
                      <span className="text-[9px] font-black uppercase text-hotel-gold tracking-widest mt-0.5 opacity-80">{currentProperty?.code}</span>
                  </div>
                  {perms.isSuperAdmin && <i className="fas fa-chevron-down text-[10px] text-slate-300 ml-2"></i>}
              </button>

              {propMenuOpen && perms.isSuperAdmin && (
                <div className={`absolute top-full left-0 mt-2 w-72 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-700 z-50 overflow-hidden animate-fade-in-up`}>
                  <div className="p-3 border-b dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50">
                    <span className="text-[9px] font-black uppercase text-slate-400 tracking-widest">Select Operational Context</span>
                  </div>
                  <div className="max-h-64 overflow-y-auto custom-scrollbar">
                    {allProperties.map(p => (
                      <button 
                        key={p.id} 
                        onClick={() => { switchProperty(p.id); setPropMenuOpen(false); }}
                        className={`w-full text-left px-4 py-3 flex items-center gap-3 hover:bg-slate-50 dark:hover:bg-slate-700/50 transition-colors ${currentProperty?.id === p.id ? 'bg-hotel-navy/5 border-l-4 border-hotel-gold' : ''}`}
                      >
                        <div className="w-8 h-8 rounded bg-white dark:bg-slate-900 border flex items-center justify-center overflow-hidden">
                          {p.logo ? <img src={p.logo} className="w-full h-full object-contain" /> : <i className="fas fa-hotel text-slate-300"></i>}
                        </div>
                        <div className="flex flex-col">
                          <span className="text-[11px] font-black uppercase text-slate-800 dark:text-white">{p.displayName || p.name}</span>
                          <span className="text-[9px] font-bold text-slate-400">{p.code}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3 lg:gap-4 h-full">
            <button onClick={toggleTheme} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-all border border-slate-100 dark:border-white/10 shadow-sm">
              <i className={`fas fa-${theme === 'light' ? 'moon' : 'sun'} text-lg`}></i>
            </button>

            <div className="relative" ref={notifMenuRef}>
              <button onClick={() => { setNotifMenuOpen(!notifMenuOpen); if(!notifMenuOpen) markAllAsRead(); }} className="p-2 text-slate-500 hover:bg-slate-100 dark:hover:bg-white/5 rounded-full transition-all relative border border-slate-100 dark:border-white/10 shadow-sm">
                <i className="far fa-bell text-xl"></i>
                {totalUnreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 min-w-[20px] h-[20px] px-1 bg-rose-500 text-white rounded-full flex items-center justify-center text-[10px] font-black border-2 border-white dark:border-slate-800 shadow-md">
                        {totalUnreadCount > 99 ? '99+' : totalUnreadCount}
                    </span>
                )}
              </button>
              {notifMenuOpen && (
                  <div className={`absolute top-full mt-2 w-80 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-white/10 z-50 overflow-hidden animate-fade-in-up ${language === 'ar' ? 'left-0' : 'right-0'}`}>
                      <div className="p-4 border-b dark:border-white/5 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50">
                          <span className="text-xs font-black uppercase text-slate-800 dark:text-white tracking-widest">{t('layout.latestNotifications')}</span>
                      </div>
                      <div className="max-h-96 overflow-y-auto custom-scrollbar">
                          {systemAlerts.map(alert => (
                              <button key={alert.id} onClick={() => { navigate(alert.link); setNotifMenuOpen(false); }} className="w-full text-left p-4 border-b dark:border-slate-700/50 flex gap-4 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition-colors">
                                  <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center ${alert.type === 'arrival' ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600'}`}>
                                      <i className={`fas ${alert.type === 'arrival' ? 'fa-plane-arrival' : 'fa-plane-departure'} text-sm`}></i>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                      <p className="text-xs font-black text-slate-700 dark:text-slate-200 line-clamp-2 leading-relaxed">{alert.message}</p>
                                      <p className="text-[9px] text-primary-600 mt-1 uppercase font-black">{alert.type === 'arrival' ? 'Arrival' : 'Departure'}</p>
                                  </div>
                              </button>
                          ))}
                          {notifications.map((n) => (
                                  <div key={n.id} className={`p-4 border-b last:border-none dark:border-slate-700/50 flex gap-4 hover:bg-slate-50 dark:hover:bg-slate-700/30 transition-colors`}>
                                      <div className={`w-10 h-10 rounded-xl flex-shrink-0 flex items-center justify-center ${n.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'}`}>
                                          <i className={`fas ${n.type === 'success' ? 'fa-check-circle' : 'fa-exclamation-circle'} text-sm`}></i>
                                      </div>
                                      <div className="flex-1 min-w-0">
                                          <p className="text-xs font-bold text-slate-700 dark:text-slate-200 line-clamp-2">{n.message}</p>
                                          <p className="text-[10px] text-slate-400 mt-1 font-mono">{new Date(n.timestamp).toLocaleTimeString()}</p>
                                      </div>
                                  </div>
                          ))}
                      </div>
                  </div>
              )}
            </div>

            <div className="h-8 w-[1px] bg-slate-200 dark:bg-white/10 hidden sm:block"></div>

            <div className="relative h-full flex items-center" ref={userMenuRef}>
              <button onClick={() => setUserMenuOpen(!userMenuOpen)} className="flex items-center gap-3 p-1.5 hover:bg-slate-50 dark:hover:bg-white/5 rounded-xl transition-all group">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center text-white font-black text-xs shadow-md" style={{ backgroundColor: 'var(--primary-color)' }}>{initials}</div>
                <div className="hidden sm:flex flex-col items-start leading-tight">
                  <span className="text-xs font-black dark:text-slate-100">{user?.username}</span>
                  <span className="text-[9px] font-black text-hotel-gold uppercase tracking-widest mt-0.5 opacity-80">{t(`roles.${user?.roles[0]}`)}</span>
                </div>
              </button>
              {userMenuOpen && (
                  <div className={`absolute top-full mt-1 w-64 bg-white dark:bg-slate-800 rounded-2xl shadow-2xl border border-slate-100 dark:border-white/10 z-50 overflow-hidden animate-fade-in-up ${language === 'ar' ? 'left-0' : 'right-0'}`}>
                      <div className="p-5 border-b dark:border-white/5 flex flex-col items-center bg-slate-50 dark:bg-slate-900/40">
                          <div className="w-16 h-16 rounded-2xl mb-3 flex items-center justify-center text-white font-black text-xl shadow-xl" style={{ backgroundColor: 'var(--primary-color)' }}>{initials}</div>
                          <p className="text-sm font-black text-slate-800 dark:text-white uppercase">{user?.username}</p>
                          <p className="text-[9px] font-bold text-slate-400 uppercase tracking-[0.2em] mt-1.5 bg-white dark:bg-slate-700 px-2.5 py-0.5 rounded-full">{t(`roles.${user?.roles[0]}`)}</p>
                      </div>
                      <div className="p-2">
                          <button onClick={() => navigate('/settings')} className="w-full text-left px-4 py-3 text-[11px] font-black text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-700/50 rounded-xl flex items-center gap-3">
                              <div className="w-7 h-7 rounded-lg bg-slate-100 dark:bg-slate-900 flex items-center justify-center text-hotel-gold"><i className="fas fa-key text-[10px]"></i></div>
                              <span>{t('layout.changePassword')}</span>
                          </button>
                          <button onClick={handleLogout} className="w-full text-left px-4 py-3 text-[11px] font-black text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-900/20 rounded-xl flex items-center gap-3 mt-1">
                              <div className="w-7 h-7 rounded-lg bg-rose-100 dark:bg-rose-900/40 flex items-center justify-center"><i className="fas fa-sign-out-alt text-[10px]"></i></div>
                              <span>{t('layout.signOut')}</span>
                          </button>
                      </div>
                  </div>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 lg:p-8 custom-scrollbar relative transition-colors duration-300">
          <div className="max-w-[1600px] mx-auto pb-12"><Outlet /></div>
        </main>
      </div>
      {sidebarOpen && <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-40 lg:hidden" onClick={() => setSidebarOpen(false)}></div>}
    </div>
  );
};

export default Layout;
