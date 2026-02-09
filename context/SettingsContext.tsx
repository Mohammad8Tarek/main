
import React, { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { AppSettings, DEFAULT_SETTINGS } from '../types';
import { settingsApi } from '../services/apiService';
import { useLanguage } from './LanguageContext';
import { useProperty } from './PropertyContext';

interface SettingsContextType {
  settings: AppSettings;
  updateSettings: (newSettings: Partial<AppSettings>) => Promise<void>;
  loading: boolean;
  refreshSettings: () => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType | undefined>(undefined);

export const SettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const { setLanguage } = useLanguage();
  const { currentProperty } = useProperty();

  const applyBranding = useCallback((data: AppSettings) => {
    const root = document.documentElement;
    // نقوم فقط بتعيين المتغيرات. الـ CSS في index.html سيهتم بالباقي
    // وبالأخص الـ !important في الـ .dark سيتفوق على هذه القيم عند تفعيل الوضع الليلي
    root.style.setProperty('--primary-color', data.primaryColor || DEFAULT_SETTINGS.primaryColor);
    root.style.setProperty('--sidebar-color', data.sidebarColor || DEFAULT_SETTINGS.sidebarColor);
    root.style.setProperty('--button-color', data.buttonColor || DEFAULT_SETTINGS.buttonColor);
    root.style.setProperty('--header-color', data.headerColor || '#FFFFFF');
    root.style.setProperty('--bg-color', data.backgroundColor || '#E2E8F0');
    root.style.setProperty('--text-color', data.textColor || '#1A202C');
    
    document.title = `${data.systemName || 'Sunrise'} | Staff Housing`;
  }, []);

  const loadSettings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await settingsApi.getSettings();
      setSettings(data);
      if (data.defaultLanguage) {
        setLanguage(data.defaultLanguage);
      }
      applyBranding(data);
    } catch (error) {
      console.error("Failed to load app settings", error);
    } finally {
      setLoading(false);
    }
  }, [setLanguage, applyBranding]);

  useEffect(() => {
    if (currentProperty?.id) {
      loadSettings();
    }
  }, [currentProperty?.id, loadSettings]);

  useEffect(() => {
    const handleSettingsChange = () => loadSettings();
    window.addEventListener('settingschanged', handleSettingsChange);
    return () => window.removeEventListener('settingschanged', handleSettingsChange);
  }, [loadSettings]);

  const updateSettings = async (newSettings: Partial<AppSettings>) => {
    try {
      await settingsApi.updateSettings(newSettings);
      const nextSettings = { ...settings, ...newSettings };
      setSettings(nextSettings);
      applyBranding(nextSettings);
    } catch (error) {
      console.error("Failed to save settings:", error);
      throw error;
    }
  };

  return (
    <SettingsContext.Provider value={{ settings, updateSettings, loading, refreshSettings: loadSettings }}>
      {children}
    </SettingsContext.Provider>
  );
};

export const useSettings = (): SettingsContextType => {
  const context = useContext(SettingsContext);
  if (context === undefined) {
    throw new Error('useSettings must be used within a SettingsProvider');
  }
  return context;
};
