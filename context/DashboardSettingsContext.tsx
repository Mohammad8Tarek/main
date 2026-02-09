import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useAuth } from '../hooks/useAuth';

export interface DashboardSettings {
    stats: boolean;
    alerts: boolean;
    occupancyChart: boolean;
    distributionChart: boolean;
    recentActivity: boolean;
    availableRooms: boolean;
    maintenanceList: boolean;
}

const defaultSettings: DashboardSettings = {
    stats: true,
    alerts: true,
    occupancyChart: true,
    distributionChart: true,
    recentActivity: true,
    availableRooms: true,
    maintenanceList: true,
};

interface DashboardSettingsContextType {
  settings: DashboardSettings;
  setSettings: React.Dispatch<React.SetStateAction<DashboardSettings>>;
  toggleWidget: (widget: keyof DashboardSettings) => void;
}

const DashboardSettingsContext = createContext<DashboardSettingsContextType | undefined>(undefined);

export const DashboardSettingsProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [settings, setSettings] = useState<DashboardSettings>(defaultSettings);
    const storageKey = `dashboard_settings_${user?.id}`;

    useEffect(() => {
        try {
            const savedSettings = localStorage.getItem(storageKey);
            if (savedSettings) {
                setSettings(JSON.parse(savedSettings));
            } else {
                setSettings(defaultSettings);
            }
        } catch (error) {
            console.error("Failed to load dashboard settings:", error);
            setSettings(defaultSettings);
        }
    }, [user]);

    useEffect(() => {
        try {
            localStorage.setItem(storageKey, JSON.stringify(settings));
        } catch (error) {
            console.error("Failed to save dashboard settings:", error);
        }
    }, [settings, user]);

    const toggleWidget = (widget: keyof DashboardSettings) => {
        setSettings(prev => ({
            ...prev,
            [widget]: !prev[widget],
        }));
    };

    return (
        <DashboardSettingsContext.Provider value={{ settings, setSettings, toggleWidget }}>
            {children}
        </DashboardSettingsContext.Provider>
    );
};

export const useDashboardSettings = (): DashboardSettingsContextType => {
    const context = useContext(DashboardSettingsContext);
    if (context === undefined) {
        throw new Error('useDashboardSettings must be used within a DashboardSettingsProvider');
    }
    return context;
};