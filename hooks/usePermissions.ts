import { useAuth } from './useAuth';
import { User } from '../types';

export const usePermissions = () => {
    const { user } = useAuth();
    const roles = user?.roles || [];

    const hasRole = (allowedRoles: User['roles'][number][]) => {
        return roles.some(role => allowedRoles.includes(role));
    };

    const isPowerUser = hasRole(['super_admin', 'admin']);
    const isManagement = hasRole(['super_admin', 'admin', 'manager']);
    const isHR = hasRole(['hr', 'super_admin', 'admin']);

    return {
        // Core View Permissions
        canViewDashboard: true,
        canViewHousing: hasRole(['super_admin', 'admin', 'manager', 'supervisor', 'viewer']),
        canViewEmployees: isHR || hasRole(['manager', 'viewer']),
        canViewReservations: hasRole(['super_admin', 'admin', 'manager', 'supervisor', 'viewer']),
        canViewMaintenance: hasRole(['super_admin', 'admin', 'supervisor', 'maintenance', 'viewer']),
        canViewReports: hasRole(['super_admin', 'admin', 'manager', 'hr', 'viewer']),
        canViewSettings: isPowerUser,
        canViewUsers: isPowerUser,
        canViewActivityLog: isPowerUser,

        // Specific Action Permissions
        actions: {
            employees: {
                create: isHR,
                edit: isHR,
                delete: isPowerUser,
                import: isHR
            },
            housing: {
                manage: isManagement,
                delete: isPowerUser
            },
            reservations: {
                create: isManagement || hasRole(['supervisor']),
                checkout: isManagement || hasRole(['supervisor']),
                delete: isPowerUser
            },
            hosting: {
                create: isManagement || hasRole(['supervisor', 'hr']),
                end: isManagement || hasRole(['supervisor', 'hr']),
                viewLedger: true
            },
            reports: {
                exportPdf: isManagement || isHR,
                exportExcel: isManagement || isHR
            }
        },

        // Legacy accessors
        canManageEmployees: isHR,
        canDeleteEmployees: isPowerUser,
        canManageHousing: isManagement,
        canDeleteHousing: isPowerUser,
        canManageReservations: isManagement || hasRole(['supervisor']),
        canDeleteReservations: isPowerUser,
        canManageMaintenance: hasRole(['super_admin', 'admin', 'supervisor', 'maintenance']),
        canDeleteMaintenance: isPowerUser,
        
        canAccessGlobalStaff: isManagement || isHR,
        isSuperAdmin: hasRole(['super_admin']),
        isAdmin: isPowerUser,
    };
};