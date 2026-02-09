
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { Property } from '../types';
import { propertyApi, setApiPropertyId } from '../services/apiService';
import { useAuth } from '../hooks/useAuth';

interface PropertyContextType {
    currentProperty: Property | null;
    allProperties: Property[];
    switchProperty: (id: number) => Promise<void>;
    loading: boolean;
    refreshProperties: () => Promise<void>;
}

const PropertyContext = createContext<PropertyContextType | undefined>(undefined);

export const PropertyProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const { user } = useAuth();
    const [currentProperty, setCurrentProperty] = useState<Property | null>(null);
    const [allProperties, setAllProperties] = useState<Property[]>([]);
    const [loading, setLoading] = useState(true);

    const refreshProperties = async () => {
        try {
            const props = await propertyApi.getAll();
            setAllProperties(props);
        } catch (e) {
            console.error("Failed to load properties");
        }
    };

    // Initial Load based on User
    useEffect(() => {
        const init = async () => {
            if (!user) {
                setLoading(false);
                return;
            }

            // Load all properties if Super Admin, otherwise just the user's property logic is handled by API defaulting to 1 or user.propertyId
            // However, propertyApi.getAll() returns ALL properties (it is not scoped by propertyId in implementation, but we should verify)
            // Actually, `executeQueries` in `propertyApi` does `SELECT * FROM Properties`, so it returns all.
            const props = await propertyApi.getAll();
            setAllProperties(props);

            let activeId = user.propertyId || 1;
            
            // Check if super admin has a stored preference in session
            const storedPropId = sessionStorage.getItem('activePropertyId');
            if (user.roles.includes('super_admin') && storedPropId) {
                activeId = parseInt(storedPropId);
            }

            const activeProp = props.find(p => p.id === activeId) || props[0];
            
            if (activeProp) {
                setCurrentProperty(activeProp);
                setApiPropertyId(activeProp.id);
            }
            setLoading(false);
        };
        init();
    }, [user]);

    const switchProperty = async (id: number) => {
        if (!user?.roles.includes('super_admin')) return;
        
        const target = allProperties.find(p => p.id === id);
        if (target) {
            setCurrentProperty(target);
            setApiPropertyId(target.id);
            sessionStorage.setItem('activePropertyId', id.toString());
            // Trigger a reload of data events
            window.dispatchEvent(new CustomEvent('datachanged'));
            window.dispatchEvent(new CustomEvent('settingschanged'));
        }
    };

    return (
        <PropertyContext.Provider value={{ currentProperty, allProperties, switchProperty, loading, refreshProperties }}>
            {children}
        </PropertyContext.Provider>
    );
};

export const useProperty = (): PropertyContextType => {
    const context = useContext(PropertyContext);
    if (context === undefined) {
        throw new Error('useProperty must be used within a PropertyProvider');
    }
    return context;
};
