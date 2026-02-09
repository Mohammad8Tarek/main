
export interface Reservation {
    id: number;
    propertyId: number;
    roomId: number;
    employeeId?: number; 
    firstName: string;
    lastName: string;
    checkInDate: string;
    checkOutDate: string | null;
    notes: string;
    guestIdCardNumber: string;
    guestPhone: string;
    jobTitle: string;
    department: string;
    guests: string; 
    status?: 'UPCOMING' | 'COMPLETED' | 'CANCELLED';
}

// Added missing ReservationGuest interface
export interface ReservationGuest {
    firstName: string;
    lastName: string;
    guestIdCardNumber: string;
    guestPhone: string;
    jobTitle: string;
    department: string;
    guestType: 'adult' | 'child';
    age: string;
}

// Added missing EmployeeHosting interface
export interface EmployeeHosting {
    id: number;
    propertyId: number;
    employeeId: number;
    hostingType: 'SAME_ROOM' | 'SEPARATE_ROOM';
    guestsCount: number;
    expectedFrom: string;
    expectedTo: string;
    actualCheckIn: string | null;
    actualCheckOut: string | null;
    roomId: number | null;
    status: 'UPCOMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'OVERDUE';
    notes: string;
    createdBy: string;
    createdAt: string;
    guests: string; // JSON string of ReservationGuest[]
}

export type ModuleType = 'dashboard' | 'housing' | 'employees' | 'reservations' | 'maintenance' | 'reports' | 'users' | 'settings' | 'activity_log';

export const AVAILABLE_MODULES: { key: ModuleType; label: string }[] = [
    { key: 'dashboard', label: 'Dashboard' },
    { key: 'housing', label: 'Housing Management' },
    { key: 'employees', label: 'Employees' },
    { key: 'reservations', label: 'Reservations' },
    { key: 'maintenance', label: 'Maintenance' },
    { key: 'reports', label: 'Reports' },
    { key: 'users', label: 'User Management' },
    { key: 'settings', label: 'Settings' },
    { key: 'activity_log', label: 'Activity Log' },
];

export interface Property {
    id: number;
    name: string;
    code: string;
    displayName: string | null;
    logo: string | null;
    primaryColor: string;
    defaultLanguage: 'en' | 'ar';
    enabledModules: ModuleType[];
    status: 'active' | 'disabled';
    createdAt: string;
    adminUsername?: string;
    adminPassword?: string;
}

export type RoleType = 'super_admin' | 'admin' | 'manager' | 'supervisor' | 'hr' | 'maintenance' | 'viewer';

export interface User {
    id: number;
    propertyId: number;
    username: string;
    password?: string;
    roles: RoleType[];
    status: 'active' | 'inactive';
}

export interface Building {
    id: number;
    propertyId: number;
    name: string;
    location: string;
    capacity: number;
    status: 'active' | 'inactive';
}

export interface Floor {
    id: number;
    propertyId: number;
    buildingId: number;
    floorNumber: string;
    description: string;
}

export interface Room {
    id: number;
    propertyId: number;
    floorId: number;
    roomNumber: string;
    roomType: string;
    capacity: number;
    currentOccupancy: number;
    status: 'available' | 'occupied' | 'maintenance' | 'reserved';
}

export interface Employee {
    id: number;
    propertyId: number;
    employeeId: string;
    firstName: string;
    lastName: string;
    nationalId: string;
    nationality: string;
    address: string;
    jobTitle: string;
    level: string;
    phone: string;
    department: string;
    status: 'active' | 'left';
    hireDate: string;
    idImage?: string | null;
    gender: 'male' | 'female';
}

export interface Assignment {
    id: number;
    propertyId: number;
    employeeId: number;
    roomId: number;
    checkInDate: string;
    expectedCheckOutDate: string | null;
    checkOutDate: string | null;
    notes: string;
}

export interface MaintenanceRequest {
    id: number;
    propertyId: number;
    roomId: number;
    problemType: string;
    description: string;
    status: 'open' | 'in_progress' | 'resolved';
    priority: 'low' | 'medium' | 'high';
    reportedAt: string;
    dueDate: string | null;
}

export type LogSeverity = 'info' | 'warning' | 'critical';
export type LogActionType = 'CREATE' | 'UPDATE' | 'DELETE' | 'LOGIN' | 'LOGOUT' | 'EXPORT' | 'IMPORT' | 'APPROVE' | 'REJECT' | 'ERROR' | 'INFO';

export interface ActivityLog {
    id: number;
    propertyId: number;
    username: string;
    userId?: number;
    userRole?: string;
    action: string;
    actionType: LogActionType;
    module: ModuleType | 'auth' | 'system';
    severity: LogSeverity;
    timestamp: string;
    entityType?: string;
    entityId?: number;
    oldValues?: string;
    newValues?: string;
    sourcePropertyId?: number;
}

export type HistoryEventType = 'ASSIGN' | 'CHECKOUT' | 'HOSTING_START' | 'HOSTING_END' | 'TRANSFER';

export interface HousingHistory {
    id: number;
    propertyId: number;
    employeeId: number;
    roomId: number;
    eventType: HistoryEventType;
    timestamp: string;
    details: string | null;
    createdBy: string;
}

export interface RoomTypeConfig {
    name: string;
    description: string;
    defaultCapacity: number;
}

export interface AppSettings {
    systemName: string;
    systemLogo: string | null;
    defaultLanguage: 'en' | 'ar';
    primaryColor: string;
    sidebarColor: string;
    buttonColor: string;
    headerColor: string;
    backgroundColor: string;
    textColor: string;
    departureAlertsEnabled: boolean;
    departureAlertThreshold: number;
    reportLogo: string | null;
    reportFooter: string;
    pdfFontSize: number;
    pdfOrientation: 'p' | 'l';
    customTaxonomy: {
        departments?: string[];
        hiddenDepartments?: string[];
        jobTitles?: Record<string, string[]>;
        hiddenJobTitles?: Record<string, string[]>;
        roomTypes?: (string | RoomTypeConfig)[];
    };
}

export const DEFAULT_SETTINGS: AppSettings = {
    systemName: 'Sunrise Staff Housing',
    systemLogo: null,
    defaultLanguage: 'en',
    primaryColor: '#0F2A44',
    sidebarColor: '#1e293b',
    buttonColor: '#C9A24D',
    headerColor: '#FFFFFF',
    backgroundColor: '#F1F5F9',
    textColor: '#1e293b',
    departureAlertsEnabled: true,
    departureAlertThreshold: 3,
    reportLogo: null,
    reportFooter: 'Generated by Sunrise Housing System Audit',
    pdfFontSize: 9,
    pdfOrientation: 'l',
    customTaxonomy: {
        departments: [],
        hiddenDepartments: [],
        jobTitles: {},
        hiddenJobTitles: {},
        roomTypes: []
    }
};

export const DEPARTMENTS = [
    'reception', 'reservations', 'public_relations', 'concierge', 'housekeeping', 'laundry',
    'security_safety', 'food_beverage', 'kitchen', 'maintenance_engineering', 'it', 'hr',
    'admin_affairs', 'finance_accounting', 'purchasing', 'stores', 'transportation',
    'general_cleaning', 'sales', 'marketing', 'tour_programs', 'flight_reservations',
    'tour_guides', 'tourist_transport', 'international_relations', 'housing_section'
];

export const departmentJobTitles: Record<string, string[]> = {
    reception: ['Receptionist', 'Front Office Manager', 'Night Auditor'],
    it: ['IT Manager', 'Network Engineer', 'System Administrator', 'Support Technician'],
    maintenance_engineering: ['Chief Engineer', 'Electrician', 'Plumber', 'A/C Technician', 'Painter'],
    hr: ['HR Manager', 'Recruiter', 'Payroll Officer', 'Housing Supervisor'],
};
