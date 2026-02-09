
import { 
    User, Property, Building, Floor, Room, Employee, Assignment, 
    MaintenanceRequest, ActivityLog, EmployeeHosting, Reservation, 
    HousingHistory, HistoryEventType, AppSettings, DEFAULT_SETTINGS
} from '../types';

const DB_PREFIX = 'sunrise_v1_';
let ACTIVE_PROPERTY_ID = 1;

export const getApiPropertyId = () => ACTIVE_PROPERTY_ID;
export const setApiPropertyId = (id: number) => { 
    ACTIVE_PROPERTY_ID = id; 
    sessionStorage.setItem('activePropertyId', id.toString());
};

const getTable = <T>(tableName: string): T[] => {
    const data = localStorage.getItem(DB_PREFIX + tableName);
    return data ? JSON.parse(data) : [];
};

const saveTable = <T>(tableName: string, data: T[]) => {
    localStorage.setItem(DB_PREFIX + tableName, JSON.stringify(data));
};

export function createApiService<T extends { id: number, propertyId?: number }>(tableName: string) {
    return {
        getAll: async (allProperties: boolean = false): Promise<T[]> => {
            const items = getTable<T>(tableName);
            if (allProperties) return items;
            return items.filter(item => !item.propertyId || item.propertyId === ACTIVE_PROPERTY_ID);
        },
        getById: async (id: number): Promise<T | undefined> => {
            const items = getTable<T>(tableName);
            return items.find(i => i.id === id);
        },
        create: async (data: Omit<T, 'id'>): Promise<T> => {
            const items = getTable<T>(tableName);
            const newItem = { 
                ...data, 
                id: items.length > 0 ? Math.max(...items.map(i => i.id)) + 1 : 1,
                propertyId: (data as any).propertyId || ACTIVE_PROPERTY_ID
            } as T;
            saveTable(tableName, [...items, newItem]);
            window.dispatchEvent(new CustomEvent('datachanged', { detail: { table: tableName } }));
            return newItem;
        },
        update: async (id: number, data: Partial<T>): Promise<T> => {
            const items = getTable<T>(tableName);
            const index = items.findIndex(i => i.id === id);
            if (index === -1) throw new Error('Item not found');
            const updatedItem = { ...items[index], ...data };
            items[index] = updatedItem;
            saveTable(tableName, items);
            window.dispatchEvent(new CustomEvent('datachanged', { detail: { table: tableName } }));
            return updatedItem;
        },
        delete: async (id: number): Promise<void> => {
            const items = getTable<T>(tableName);
            const filtered = items.filter(i => i.id !== id);
            saveTable(tableName, filtered);
            window.dispatchEvent(new CustomEvent('datachanged', { detail: { table: tableName } }));
        },
        updateMany: async (ids: number[], data: Partial<T>): Promise<void> => {
            const items = getTable<T>(tableName);
            const updated = items.map(i => ids.includes(i.id) ? { ...i, ...data } : i);
            saveTable(tableName, updated);
            window.dispatchEvent(new CustomEvent('datachanged', { detail: { table: tableName } }));
        },
        deleteMany: async (ids: number[]): Promise<void> => {
            const items = getTable<T>(tableName);
            const filtered = items.filter(i => !ids.includes(i.id));
            saveTable(tableName, filtered);
            window.dispatchEvent(new CustomEvent('datachanged', { detail: { table: tableName } }));
        }
    };
}

export const activityLogApi = createApiService<ActivityLog>('ActivityLog');
export const userApi = {
    ...createApiService<User>('Users'),
    checkUsernameExists: async (username: string): Promise<boolean> => {
        const users = getTable<User>('Users');
        return users.some(u => u.username.toLowerCase() === username.toLowerCase());
    },
    getAll: async (isSuperAdmin: boolean = false): Promise<User[]> => {
        const users = getTable<User>('Users');
        if (isSuperAdmin) return users;
        return users.filter(u => u.propertyId === ACTIVE_PROPERTY_ID);
    }
};

export const logActivity = async (username: string, action: string, type: string = 'INFO', module: string = 'system', severity: string = 'info') => {
    const users = getTable<User>('Users');
    const user = users.find(u => u.username === username);
    await activityLogApi.create({
        username, userId: user?.id, userRole: user?.roles?.[0], action, actionType: type as any,
        module: module as any, severity: severity as any, timestamp: new Date().toISOString(), propertyId: user?.propertyId || ACTIVE_PROPERTY_ID
    });
};

export const authApi = {
    login: async ({ username, password }: any) => {
        const users = getTable<User>('Users');
        const user = users.find(u => u.username === username && u.password === password);
        if (!user) throw new Error('Invalid credentials');
        if (user.status === 'inactive') throw new Error('Account disabled');
        return { user, token: 'mock-jwt-token' };
    }
};

export const employeeApi = {
    ...createApiService<Employee>('Employees'),
    searchGlobal: async (query: string, propertyId?: number): Promise<Employee[]> => {
        const emps = getTable<Employee>('Employees');
        return emps.filter(e => {
            const matchesQuery = e.firstName.toLowerCase().includes(query.toLowerCase()) || 
                                 e.lastName.toLowerCase().includes(query.toLowerCase()) ||
                                 e.nationalId.includes(query) ||
                                 (e.employeeId && e.employeeId.includes(query));
            const matchesProp = propertyId ? e.propertyId === propertyId : true;
            return matchesQuery && matchesProp;
        });
    }
};

export const roomApi = createApiService<Room>('Rooms');
export const buildingApi = createApiService<Building>('Buildings');
export const floorApi = createApiService<Floor>('Floors');
export const assignmentApi = createApiService<Assignment>('Assignments');
export const reservationApi = createApiService<Reservation>('Reservations');
export const employeeHostingApi = createApiService<EmployeeHosting>('EmployeeHosting');
export const maintenanceApi = createApiService<MaintenanceRequest>('MaintenanceRequests');

// Added missing housingHistoryApi
export const housingHistoryApi = {
    ...createApiService<HousingHistory>('HousingHistory'),
    log: async (employeeId: number, roomId: number, eventType: HistoryEventType, details: string, createdBy: string) => {
        const service = createApiService<HousingHistory>('HousingHistory');
        return service.create({
            propertyId: ACTIVE_PROPERTY_ID,
            employeeId,
            roomId,
            eventType,
            details,
            createdBy,
            timestamp: new Date().toISOString()
        });
    }
};

export const propertyApi = {
    ...createApiService<Property>('Properties'),
    checkCodeExists: async (code: string): Promise<boolean> => {
        const props = getTable<Property>('Properties');
        return props.some(p => p.code.toLowerCase() === code.toLowerCase());
    },
    create: async (data: Omit<Property, 'id'>): Promise<Property> => {
        const props = getTable<Property>('Properties');
        const newId = props.length > 0 ? Math.max(...props.map(i => i.id)) + 1 : 1;
        const newProp = { ...data, id: newId } as Property;
        saveTable('Properties', [...props, newProp]);

        if (data.adminUsername && data.adminPassword) {
            const users = getTable<User>('Users');
            const nextUserId = users.length > 0 ? Math.max(...users.map(u => u.id)) + 1 : 1;
            const newUser: User = {
                id: nextUserId,
                propertyId: newId,
                username: data.adminUsername,
                password: data.adminPassword,
                roles: ['admin'],
                status: 'active'
            };
            saveTable('Users', [...users, newUser]);
        }

        window.dispatchEvent(new CustomEvent('datachanged', { detail: { table: 'Properties' } }));
        return newProp;
    }
};

export const settingsApi = {
    getSettings: async (): Promise<AppSettings> => {
        const data = localStorage.getItem(DB_PREFIX + 'Settings_' + ACTIVE_PROPERTY_ID);
        return data ? JSON.parse(data) : DEFAULT_SETTINGS;
    },
    updateSettings: async (settings: Partial<AppSettings>): Promise<void> => {
        const current = await settingsApi.getSettings();
        const updated = { ...current, ...settings };
        localStorage.setItem(DB_PREFIX + 'Settings_' + ACTIVE_PROPERTY_ID, JSON.stringify(updated));
        window.dispatchEvent(new CustomEvent('settingschanged'));
    }
};

export const reportsApi = {
    getOccupancyReport: async (propertyId?: number): Promise<any[]> => {
        const targetId = propertyId || ACTIVE_PROPERTY_ID;
        const items = getTable<Room>('Rooms').filter(r => r.propertyId === targetId);
        const floors = getTable<Floor>('Floors').filter(f => f.propertyId === targetId);
        const buildings = getTable<Building>('Buildings').filter(b => b.propertyId === targetId);
        const properties = getTable<Property>('Properties');
        const prop = properties.find(p => p.id === targetId);
        
        return items.map(r => {
            const f = floors.find(fl => fl.id === r.floorId);
            const b = buildings.find(bu => bu.id === f?.buildingId);
            return {
                'Property': prop?.displayName || prop?.name || 'Unknown',
                'Building': b?.name || 'Unknown',
                'Floor': f?.floorNumber || '—',
                'Room': r.roomNumber,
                'Type': r.roomType,
                'Capacity': r.capacity,
                'Occupants': r.currentOccupancy,
                'Available': r.capacity - r.currentOccupancy,
                'Empty': r.currentOccupancy === 0 ? 'YES' : 'NO',
                'Full': r.currentOccupancy >= r.capacity ? 'YES' : 'NO',
                'Status': r.status.toUpperCase()
            };
        });
    },
    getEmployeeHousingReport: async (propertyId?: number): Promise<any[]> => {
        const targetId = propertyId || ACTIVE_PROPERTY_ID;
        const emps = getTable<Employee>('Employees').filter(e => e.propertyId === targetId);
        const assigns = getTable<Assignment>('Assignments').filter(a => a.propertyId === targetId && !a.checkOutDate);
        const rooms = getTable<Room>('Rooms').filter(r => r.propertyId === targetId);
        const buildings = getTable<Building>('Buildings').filter(b => b.propertyId === targetId);
        const floors = getTable<Floor>('Floors').filter(f => f.propertyId === targetId);
        const properties = getTable<Property>('Properties');
        const prop = properties.find(p => p.id === targetId);

        return assigns.map(a => {
            const emp = emps.find(e => e.id === a.employeeId);
            const room = rooms.find(r => r.id === a.roomId);
            const floor = floors.find(f => f.id === room?.floorId);
            const b = buildings.find(bu => bu.id === floor?.buildingId);
            
            return {
                'Property': prop?.displayName || prop?.name || '—',
                'Clock ID': emp?.employeeId || '—',
                'First Name': emp?.firstName || '—',
                'Last Name': emp?.lastName || '—',
                'Nationality': emp?.nationality || '—',
                'National ID': emp?.nationalId || '—',
                'Gender': emp?.gender?.toUpperCase() || '—',
                'Department': emp?.department?.toUpperCase() || '—',
                'Position': emp?.jobTitle || '—',
                'Level': emp?.level || '—',
                'Phone': emp?.phone || '—',
                'Hire Date': emp?.hireDate ? new Date(emp.hireDate).toLocaleDateString() : '—',
                'Address': emp?.address || '—',
                'Building': b?.name || '—',
                'Room': room?.roomNumber || '—',
                'Check-In': new Date(a.checkInDate).toLocaleDateString()
            };
        });
    },
    getMaintenanceStatusReport: async (propertyId?: number): Promise<any[]> => {
        const targetId = propertyId || ACTIVE_PROPERTY_ID;
        const items = getTable<MaintenanceRequest>('MaintenanceRequests').filter(r => r.propertyId === targetId);
        const rooms = getTable<Room>('Rooms').filter(r => r.propertyId === targetId);
        
        return items.map(req => {
            const room = rooms.find(r => r.id === req.roomId);
            return {
                'Room': room?.roomNumber || '—',
                'Problem': req.problemType,
                'Priority': req.priority.toUpperCase(),
                'Status': req.status.toUpperCase(),
                'Reported': new Date(req.reportedAt).toLocaleDateString(),
                'Due Date': req.dueDate ? new Date(req.dueDate).toLocaleDateString() : '—'
            };
        });
    }
};

// Added missing resetDatabase for tests
export const resetDatabase = async () => {
    localStorage.removeItem(DB_PREFIX + 'Initialized');
    const keys = Object.keys(localStorage);
    keys.forEach(key => {
        if (key.startsWith(DB_PREFIX)) {
            localStorage.removeItem(key);
        }
    });
    await initDb();
};

export const initDb = async () => {
    if (localStorage.getItem(DB_PREFIX + 'Initialized')) return;

    const props: Property[] = [
        { id: 1, name: 'Headquarters', code: 'HQ-01', displayName: 'Sunrise Grand Palace', logo: null, primaryColor: '#0F2A44', defaultLanguage: 'en', enabledModules: ['dashboard', 'housing', 'employees', 'reservations', 'maintenance', 'reports', 'users', 'settings', 'activity_log'], status: 'active', createdAt: new Date().toISOString() },
    ];
    saveTable('Properties', props);

    const users: User[] = [{ id: 1, propertyId: 1, username: 'admin', password: 'admin', roles: ['super_admin'], status: 'active' }];
    saveTable('Users', users);

    localStorage.setItem(DB_PREFIX + 'Initialized', 'true');
};
