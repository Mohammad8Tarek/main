import { useState, useEffect, useCallback } from 'react';
import { employeeApi, roomApi, maintenanceApi, assignmentApi, buildingApi, userApi, activityLogApi, floorApi, settingsApi, getApiPropertyId, reservationApi } from '../services/apiService';
import { Employee, Room, MaintenanceRequest, Building, Assignment, User, ActivityLog, Floor, Reservation } from '../types';

export interface DepartureAlert {
    assignment: Assignment;
    employee: Employee;
    room: Room;
    daysRemaining: number;
    status: 'overdue' | 'today' | 'soon';
}

export interface ArrivalAlert {
    reservation: Reservation;
    room: Room;
    daysUntilArrival: number;
    status: 'overdue' | 'today' | 'soon';
}

export interface DashboardData {
    employees: Employee[];
    rooms: Room[];
    maintenanceRequests: MaintenanceRequest[];
    buildings: Building[];
    assignments: Assignment[];
    users: User[];
    activityLogs: ActivityLog[];
    floors: Floor[];
    departureAlerts: DepartureAlert[];
    arrivalAlerts: ArrivalAlert[];
    
    stats: {
        totalEmployees: number;
        activeEmployees: number;
        unhousedEmployees: number;
        totalRooms: number;
        totalBuildings: number;
        occupiedRooms: number;
        availableRooms: number;
        occupancyRate: number;
        openMaintenance: number;
        overdueMaintenance: MaintenanceRequest[];
        upcomingReservationsCount: number;
    };

    charts: {
        occupancyByBuilding: { name: string; occupancy: number; total: number }[];
        employeeDistributionByDept: { name: string; value: number }[];
        userRoleDistribution: { name: string; value: number }[];
        maintenanceStatusDistribution: { name: string; value: number }[];
    };
}

const useDashboardData = () => {
    const [data, setData] = useState<DashboardData | null>(null);
    const [loading, setLoading] = useState(true);
    const activePropertyId = getApiPropertyId();

    const fetchData = useCallback(async () => {
        try {
            const [employees, rooms, maintenanceRequests, buildings, assignments, users, activityLogs, floors, settings, reservations] = await Promise.all([
                employeeApi.getAll(),
                roomApi.getAll(),
                maintenanceApi.getAll(),
                buildingApi.getAll(),
                assignmentApi.getAll(),
                userApi.getAll(),
                activityLogApi.getAll(),
                floorApi.getAll(),
                settingsApi.getSettings(),
                reservationApi.getAll()
            ]);

            const activeAssignments = assignments.filter(a => !a.checkOutDate);
            const employeeMap = new Map<number, Employee>(employees.map(e => [e.id, e]));
            const roomMap = new Map<number, Room>(rooms.map(r => [r.id, r]));

            const threshold = settings.departureAlertThreshold || 3;
            const today = new Date();
            today.setHours(0,0,0,0);

            // Departure Alerts Logic
            const departureAlerts: DepartureAlert[] = [];
            activeAssignments.forEach(assign => {
                if (!assign.expectedCheckOutDate) return;
                const expDate = new Date(assign.expectedCheckOutDate);
                expDate.setHours(0,0,0,0);
                const diffTime = expDate.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                if (diffDays <= threshold) {
                    const emp = employeeMap.get(assign.employeeId);
                    const rm = roomMap.get(assign.roomId);
                    if (emp && rm) {
                        departureAlerts.push({
                            assignment: assign,
                            employee: emp,
                            room: rm,
                            daysRemaining: diffDays,
                            status: diffDays < 0 ? 'overdue' : diffDays === 0 ? 'today' : 'soon'
                        });
                    }
                }
            });

            // Arrival Alerts Logic (NEW)
            const arrivalAlerts: ArrivalAlert[] = [];
            reservations.forEach(res => {
                if (!res.checkInDate) return;
                const checkInDate = new Date(res.checkInDate);
                checkInDate.setHours(0,0,0,0);
                const diffTime = checkInDate.getTime() - today.getTime();
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                
                if (diffDays <= threshold) {
                    const rm = roomMap.get(res.roomId);
                    if (rm) {
                        arrivalAlerts.push({
                            reservation: res,
                            room: rm,
                            daysUntilArrival: diffDays,
                            status: diffDays < 0 ? 'overdue' : diffDays === 0 ? 'today' : 'soon'
                        });
                    }
                }
            });

            const activeEmployees = employees.filter(e => e.status === 'active');
            const housedEmployeeIds = new Set(activeAssignments.map(a => a.employeeId));
            const unhousedEmployees = activeEmployees.filter(e => !housedEmployeeIds.has(e.id)).length;
            
            const totalBedCapacity = rooms.reduce((sum, r) => sum + r.capacity, 0);
            const currentOccupantsCount = rooms.reduce((sum, r) => sum + r.currentOccupancy, 0);
            const occupancyRate = totalBedCapacity > 0 ? Math.round((currentOccupantsCount / totalBedCapacity) * 100) : 0;

            const occupiedOrReservedRooms = rooms.filter(r => r.status === 'occupied' || r.status === 'reserved').length;
            const availableRooms = rooms.filter(r => r.status === 'available').length;
            
            const overdueMaintenance = maintenanceRequests.filter(req => 
                req.status !== 'resolved' && req.dueDate && new Date(req.dueDate) < today
            );

            const floorToBuildingMap = new Map(floors.map(f => [f.id, f.buildingId]));
            const occupancyByBuilding = buildings.map(building => {
                const buildingRooms = rooms.filter(r => floorToBuildingMap.get(r.floorId) === building.id);
                const occupiedBeds = buildingRooms.reduce((sum, r) => sum + r.currentOccupancy, 0);
                const totalBeds = buildingRooms.reduce((sum, r) => sum + r.capacity, 0);
                return { name: building.name, occupancy: occupiedBeds, total: totalBeds };
            });

            const employeeDistributionByDept = activeEmployees.reduce((acc: Record<string, number>, emp) => {
                acc[emp.department] = (acc[emp.department] || 0) + 1;
                return acc;
            }, {} as Record<string, number>);

            setData({
                employees, rooms, maintenanceRequests, buildings, assignments, users, activityLogs, floors, departureAlerts, arrivalAlerts,
                stats: {
                    totalEmployees: employees.length,
                    activeEmployees: activeEmployees.length,
                    unhousedEmployees,
                    totalRooms: rooms.length,
                    totalBuildings: buildings.length,
                    occupiedRooms: occupiedOrReservedRooms,
                    availableRooms,
                    occupancyRate,
                    openMaintenance: maintenanceRequests.filter(m => m.status === 'open' || m.status === 'in_progress').length,
                    overdueMaintenance,
                    upcomingReservationsCount: arrivalAlerts.length
                },
                charts: {
                    occupancyByBuilding,
                    employeeDistributionByDept: Object.entries(employeeDistributionByDept).map(([name, value]) => ({ name, value })),
                    userRoleDistribution: [],
                    maintenanceStatusDistribution: [],
                }
            });
        } catch (error) {
            console.error("Failed to fetch dashboard data", error);
        } finally {
            setLoading(false);
        }
    }, [activePropertyId]);

    useEffect(() => {
        fetchData();
        const handleDataChange = () => fetchData();
        window.addEventListener('datachanged', handleDataChange);
        window.addEventListener('settingschanged', handleDataChange);
        return () => {
            window.removeEventListener('datachanged', handleDataChange);
            window.removeEventListener('settingschanged', handleDataChange);
        };
    }, [fetchData]);

    return { data, loading, refresh: fetchData };
};

export default useDashboardData;
