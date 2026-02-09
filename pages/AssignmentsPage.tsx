
import React, { useState, useEffect, useMemo } from 'react';
import { Assignment, Employee, Room, Building, Floor, Reservation, Property, EmployeeHosting, ReservationGuest } from '../types';
import { assignmentApi, employeeApi, roomApi, buildingApi, floorApi, reservationApi, employeeHostingApi, housingHistoryApi } from '../services/apiService';
import { useAuth } from '../hooks/useAuth';
import { useLanguage } from '../context/LanguageContext';
import { useToast } from '../context/ToastContext';
import { useProperty } from '../context/PropertyContext';
import { usePermissions } from '../hooks/usePermissions';

// Modals
import AssignModal from '../components/modals/AssignModal';
import ReserveModal from '../components/modals/ReserveModal';
import HostingModal from '../components/modals/HostingModal';
import CheckoutModal from '../components/modals/CheckoutModal';
import EndHostingModal from '../components/modals/EndHostingModal';
import GuestManifestModal from '../components/modals/GuestManifestModal';

type ActiveTab = 'residents' | 'bookings' | 'hosting';

const AssignmentsPage: React.FC = () => {
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [reservations, setReservations] = useState<Reservation[]>([]);
    const [familyHostings, setFamilyHostings] = useState<EmployeeHosting[]>([]);
    const [employees, setEmployees] = useState<Employee[]>([]);
    const [rooms, setRooms] = useState<Room[]>([]);
    const [buildings, setBuildings] = useState<Building[]>([]);
    const [floors, setFloors] = useState<Floor[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Tab & Filter States
    const [activeTab, setActiveTab] = useState<ActiveTab>('residents');
    const [filterProperty, setFilterProperty] = useState<string>('all');

    // Pagination States
    const [currentPage, setCurrentPage] = useState(1);
    const [itemsPerPage, setItemsPerPage] = useState(10);

    const { user } = useAuth();
    const { language, t } = useLanguage();
    const { showToast } = useToast();
    const { allProperties } = useProperty();
    const perms = usePermissions();

    // Modal states
    const [modalState, setModalState] = useState({ 
        assign: false, reserve: false, hosting: false, checkout: false, endHosting: false, viewManifest: false 
    });
    const [activeItem, setActiveItem] = useState<any>(null);

    const fetchData = async () => {
        setLoading(true);
        try {
            const [assignData, reservData, localEmpData, roomData, buildingData, floorData, hostData] = await Promise.all([
                assignmentApi.getAll(), 
                reservationApi.getAll(), 
                employeeApi.getAll(), 
                roomApi.getAll(), 
                buildingApi.getAll(), 
                floorApi.getAll(), 
                employeeHostingApi.getAll()
            ]);
            
            // Only show active or upcoming. Completed ones go to reports.
            setAssignments(assignData.filter(a => !a.checkOutDate));
            setReservations(reservData);
            setFamilyHostings(hostData.filter(h => h.status !== 'COMPLETED' && !h.actualCheckOut));
            setEmployees(localEmpData);
            setRooms(roomData);
            setBuildings(buildingData);
            setFloors(floorData);
        } catch (error) { 
            showToast(t('errors.fetchFailed'), 'error'); 
        } finally { 
            setLoading(false); 
        }
    };

    useEffect(() => { 
        fetchData(); 
        const handleRefresh = () => fetchData();
        window.addEventListener('datachanged', handleRefresh);
        return () => window.removeEventListener('datachanged', handleRefresh);
    }, []);

    useEffect(() => { setCurrentPage(1); }, [activeTab, filterProperty, itemsPerPage]);

    // Data Lookups
    const employeeMap = useMemo(() => new Map(employees.map(e => [e.id, e])), [employees]);
    const roomMap = useMemo(() => new Map(rooms.map(r => [r.id, r])), [rooms]);
    const floorMap = useMemo(() => new Map(floors.map(f => [f.id, f])), [floors]);
    const propMap = useMemo(() => new Map(allProperties.map(p => [p.id, p])), [allProperties]);

    const filteredSourceData = useMemo(() => {
        const propId = filterProperty === 'all' ? null : parseInt(filterProperty);
        if (activeTab === 'residents') return assignments.filter(a => propId === null || a.propertyId === propId);
        if (activeTab === 'bookings') return reservations.filter(r => propId === null || r.propertyId === propId);
        return familyHostings.filter(h => propId === null || h.propertyId === propId);
    }, [activeTab, assignments, reservations, familyHostings, filterProperty]);

    const paginatedData = useMemo(() => {
        const start = (currentPage - 1) * itemsPerPage;
        return filteredSourceData.slice(start, start + itemsPerPage);
    }, [filteredSourceData, currentPage, itemsPerPage]);

    const totalPages = Math.ceil(filteredSourceData.length / itemsPerPage);

    const getHostingStatus = (h: EmployeeHosting) => {
        if (h.actualCheckOut) return 'ENDED';
        if (h.actualCheckIn) {
            const today = new Date();
            const expTo = new Date(h.expectedTo);
            return today > expTo ? 'OVERDUE' : 'ACTIVE';
        }
        return 'UPCOMING';
    };

    const handleBookingCheckIn = async (res: Reservation) => {
        if (!window.confirm(language === 'ar' ? 'تأكيد تسكين الموظف وتحويل الحجز إلى سكن نشط؟' : 'Confirm staff check-in and convert booking to active housing?')) return;
        try {
            const targetEmpId = res.employeeId || employees.find(e => e.nationalId === res.guestIdCardNumber)?.id;
            if (!targetEmpId) {
                showToast(language === 'ar' ? 'يجب ربط الحجز بملف موظف أولاً' : 'Booking must be linked to an employee profile for check-in', 'error');
                return;
            }
            await assignmentApi.create({
                employeeId: targetEmpId, roomId: res.roomId, propertyId: res.propertyId,
                checkInDate: new Date().toISOString(), expectedCheckOutDate: res.checkOutDate,
                checkOutDate: null, notes: `System Arrival: Converted from Booking #${res.id}`
            });
            const room = await roomApi.getById(res.roomId);
            if (room) {
                await roomApi.update(room.id, { 
                    currentOccupancy: room.currentOccupancy + 1,
                    status: (room.currentOccupancy + 1) >= room.capacity ? 'occupied' : 'available'
                });
            }
            await reservationApi.delete(res.id);
            await housingHistoryApi.log(targetEmpId, res.roomId, 'ASSIGN', 'Check-In completed from arrival queue', user?.username || 'system');
            showToast(t('reservations.resConverted'), 'success');
            fetchData();
        } catch (e) { showToast(t('errors.generic'), 'error'); }
    };

    const handleHostingArrival = async (h: EmployeeHosting) => {
        if (!window.confirm(language === 'ar' ? 'تأكيد وصول ضيوف الاستضافة؟' : 'Confirm arrival for this hosting session?')) return;
        try {
            await employeeHostingApi.update(h.id, { status: 'ACTIVE', actualCheckIn: new Date().toISOString() });
            if (h.hostingType === 'SEPARATE_ROOM' && h.roomId) {
                const room = await roomApi.getById(h.roomId);
                if (room) await roomApi.update(room.id, { currentOccupancy: room.currentOccupancy + 1 });
            }
            await housingHistoryApi.log(h.employeeId, h.roomId || 0, 'HOSTING_START', 'Family hosting session activated', user?.username || 'system');
            showToast(t('reservations.resConverted'), 'success');
            fetchData();
        } catch (e) { showToast(t('errors.generic'), 'error'); }
    };

    const thClass = "px-6 py-4 text-[10px] font-black uppercase text-slate-500 tracking-widest bg-slate-50 dark:bg-slate-700/50 border-b dark:border-slate-700 sticky top-0 z-20 whitespace-nowrap";
    const tdClass = "px-6 py-4 text-[11px] font-bold text-slate-700 dark:text-slate-300 border-b dark:border-slate-700/50";

    return (
        <div className="space-y-6">
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-black text-hotel-navy dark:text-white uppercase tracking-tighter">Housing Ledger</h1>
                    <p className="text-hotel-muted dark:text-slate-400 text-xs mt-1 font-bold uppercase tracking-widest opacity-70">Operational occupancy, staff queue, and guest hosting.</p>
                </div>
                <div className="flex gap-2">
                    {perms.actions.reservations.create && (
                        <div className="flex gap-2">
                            {activeTab === 'hosting' && (
                                <button onClick={() => { setActiveItem(null); setModalState(p=>({...p, hosting: true}))}} className="px-6 py-2.5 bg-hotel-navy text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:brightness-110 active:scale-95 transition-all">
                                    <i className="fas fa-users mr-2"></i> Book Guest
                                </button>
                            )}
                            {(activeTab === 'residents' || activeTab === 'bookings') && (
                                <button onClick={() => { setActiveItem(null); setModalState(p=>({...p, reserve: true}))}} className="px-6 py-2.5 bg-primary-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-xl hover:brightness-110 active:scale-95 transition-all">
                                    <i className="fas fa-calendar-plus mr-2"></i> Book Staff
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>

            <div className="bg-white dark:bg-slate-800 rounded-3xl shadow-xl border border-slate-100 dark:border-slate-700 overflow-hidden flex flex-col min-h-[600px]">
                <div className="p-5 border-b dark:border-slate-700 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/30">
                    <div className="flex p-1 bg-slate-100 dark:bg-slate-900 rounded-2xl border dark:border-slate-800">
                        {(['residents', 'bookings', 'hosting'] as ActiveTab[]).map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)}
                                className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === tab ? 'bg-hotel-navy text-white shadow-lg' : 'text-slate-400 hover:text-hotel-navy dark:hover:text-white'}`}>
                                {tab === 'residents' ? 'Active Residents' : tab === 'bookings' ? 'Upcoming Bookings' : 'Guest Housing'}
                            </button>
                        ))}
                    </div>
                    <div className="flex items-center gap-3">
                        <select value={filterProperty} onChange={e => setFilterProperty(e.target.value)} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl px-4 py-2 text-[10px] font-black uppercase shadow-sm outline-none">
                            <option value="all">Global Ledger</option>
                            {allProperties.map(p => <option key={p.id} value={p.id}>{p.code}</option>)}
                        </select>
                    </div>
                </div>

                <div className="flex-1 overflow-x-auto custom-scrollbar">
                    {loading ? (
                        <div className="p-20 text-center flex flex-col items-center">
                            <div className="w-12 h-12 border-4 border-hotel-navy border-t-hotel-gold rounded-full animate-spin mb-4"></div>
                            <p className="text-slate-400 font-black uppercase text-xs tracking-widest">Accessing Secure Ledger...</p>
                        </div>
                    ) : (
                        <table className="w-full text-left rtl:text-right border-collapse">
                            <thead>
                                {activeTab === 'residents' && (
                                    <tr>
                                        <th className={thClass}>Resident Name</th>
                                        <th className={thClass}>Department</th>
                                        <th className={thClass}>Job Title</th>
                                        <th className={thClass}>Property</th>
                                        <th className={thClass}>Room</th>
                                        <th className={thClass}>Arrival</th>
                                        <th className={thClass}>Exp. End</th>
                                        <th className={thClass}>Actions</th>
                                    </tr>
                                )}
                                {activeTab === 'bookings' && (
                                    <tr>
                                        <th className={thClass}>Future Resident</th>
                                        <th className={thClass}>Department</th>
                                        <th className={thClass}>Job Title</th>
                                        <th className={thClass}>Property</th>
                                        <th className={thClass}>ETA Date</th>
                                        <th className={thClass}>Room</th>
                                        <th className={thClass}>Actions</th>
                                    </tr>
                                )}
                                {activeTab === 'hosting' && (
                                    <tr>
                                        <th className={thClass}>Host Employee</th>
                                        <th className={thClass}>Property</th>
                                        <th className={thClass}>Room</th>
                                        <th className={thClass}>Manifest</th>
                                        <th className={thClass}>Dates</th>
                                        <th className={thClass}>Status</th>
                                        <th className={thClass}>Actions</th>
                                    </tr>
                                )}
                            </thead>
                            <tbody className="divide-y divide-slate-100 dark:divide-slate-700/50">
                                {activeTab === 'residents' && (paginatedData as Assignment[]).map(a => {
                                    const e = employeeMap.get(a.employeeId);
                                    const r = roomMap.get(a.roomId);
                                    return (
                                        <tr key={a.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                            <td className={tdClass + " uppercase font-black"}>{e?.firstName} {e?.lastName}</td>
                                            <td className={tdClass}><span className="text-[9px] uppercase font-black text-slate-500 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded">{t(`departments.${e?.department}`)}</span></td>
                                            <td className={tdClass}>{e?.jobTitle}</td>
                                            <td className={tdClass + " text-hotel-gold"}>{propMap.get(a.propertyId)?.code}</td>
                                            <td className={tdClass + " text-primary-600 font-black"}>{r?.roomNumber}</td>
                                            <td className={tdClass}>{new Date(a.checkInDate).toLocaleDateString()}</td>
                                            <td className={tdClass + " text-rose-500"}>{a.expectedCheckOutDate ? new Date(a.expectedCheckOutDate).toLocaleDateString() : '—'}</td>
                                            <td className={tdClass}>
                                                <button onClick={() => { setActiveItem(a); setModalState(p=>({...p, checkout: true})) }} className="px-3 py-1 bg-rose-50 text-rose-600 border border-rose-100 rounded text-[9px] font-black uppercase hover:bg-rose-600 hover:text-white transition-all">End Stay</button>
                                            </td>
                                        </tr>
                                    );
                                })}

                                {activeTab === 'bookings' && (paginatedData as Reservation[]).map(res => (
                                    <tr key={res.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                        <td className={tdClass + " uppercase font-black"}>{res.firstName} {res.lastName}</td>
                                        <td className={tdClass}><span className="text-[9px] uppercase font-black text-slate-500 bg-slate-100 dark:bg-slate-900 px-2 py-0.5 rounded">{t(`departments.${res.department}`)}</span></td>
                                        <td className={tdClass}>{res.jobTitle}</td>
                                        <td className={tdClass + " text-hotel-gold"}>{propMap.get(res.propertyId)?.code}</td>
                                        <td className={tdClass + " text-emerald-600"}>{new Date(res.checkInDate).toLocaleDateString()}</td>
                                        <td className={tdClass + " font-black"}>{roomMap.get(res.roomId)?.roomNumber}</td>
                                        <td className={tdClass}>
                                            <div className="flex gap-2">
                                                <button onClick={() => handleBookingCheckIn(res)} className="px-3 py-1 bg-emerald-600 text-white rounded text-[9px] font-black uppercase shadow">Check-In</button>
                                                <button onClick={() => { setActiveItem(res); setModalState(p=>({...p, reserve: true})); }} className="p-2 text-slate-400 hover:text-hotel-navy"><i className="fas fa-edit"></i></button>
                                                <button onClick={async () => { if(window.confirm('Cancel?')) { await reservationApi.delete(res.id); fetchData(); } }} className="p-2 text-rose-500 hover:bg-rose-50 rounded"><i className="fas fa-trash-alt"></i></button>
                                            </div>
                                        </td>
                                    </tr>
                                ))}

                                {activeTab === 'hosting' && (paginatedData as EmployeeHosting[]).map(h => {
                                    const e = employeeMap.get(h.employeeId);
                                    const r = roomMap.get(h.roomId || 0);
                                    const status = getHostingStatus(h);
                                    const guests: ReservationGuest[] = JSON.parse(h.guests || '[]');
                                    const adults = guests.filter(g => g.guestType === 'adult').length;
                                    const children = guests.filter(g => g.guestType === 'child').length;
                                    
                                    return (
                                        <tr key={h.id} className="hover:bg-slate-50 dark:hover:bg-slate-700/30">
                                            <td className={tdClass + " uppercase font-black"}>{e?.firstName} {e?.lastName}</td>
                                            <td className={tdClass + " text-hotel-gold"}>{propMap.get(h.propertyId)?.code}</td>
                                            <td className={tdClass + " text-primary-600 font-black"}>{r?.roomNumber || 'Shared'}</td>
                                            <td className={tdClass}>
                                                <div className="flex flex-col">
                                                    <span className="font-black text-slate-800 dark:text-white">{guests.length} Persons</span>
                                                    <span className="text-[9px] text-slate-400 uppercase font-bold">{adults} A • {children} C</span>
                                                </div>
                                            </td>
                                            <td className={tdClass + " text-[10px]"}>{new Date(h.expectedFrom).toLocaleDateString()} - {new Date(h.expectedTo).toLocaleDateString()}</td>
                                            <td className={tdClass}>
                                                <span className={`px-2 py-1 rounded text-[9px] font-black uppercase border ${status === 'ACTIVE' ? 'bg-emerald-50 text-emerald-700 border-emerald-100' : 'bg-amber-50 text-amber-600 border-amber-100'}`}>{status}</span>
                                            </td>
                                            <td className={tdClass}>
                                                <div className="flex gap-2">
                                                    <button onClick={() => { setActiveItem(h); setModalState(p=>({...p, viewManifest: true})) }} className="p-2 text-hotel-navy hover:bg-slate-100 rounded" title="View & Print Guest Manifest"><i className="fas fa-eye text-xs"></i></button>
                                                    {status === 'UPCOMING' && (
                                                        <>
                                                            <button onClick={() => handleHostingArrival(h)} className="px-3 py-1 bg-emerald-600 text-white rounded text-[9px] font-black uppercase shadow">Arrive</button>
                                                            <button onClick={() => { setActiveItem(h); setModalState(p=>({...p, hosting: true})) }} className="p-2 text-slate-400 hover:text-hotel-navy"><i className="fas fa-edit text-xs"></i></button>
                                                            <button onClick={async () => { if(window.confirm('Delete?')) { await employeeHostingApi.delete(h.id); fetchData(); } }} className="p-2 text-rose-500 hover:bg-rose-50 rounded"><i className="fas fa-trash-alt text-xs"></i></button>
                                                        </>
                                                    )}
                                                    {status === 'ACTIVE' && <button onClick={() => { setActiveItem(h); setModalState(p=>({...p, endHosting: true})) }} className="px-3 py-1 bg-hotel-navy text-white rounded text-[9px] font-black uppercase shadow">Check-Out</button>}
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    )}
                    
                    {!loading && filteredSourceData.length === 0 && (
                        <div className="p-32 text-center">
                            <i className="fas fa-layer-group text-5xl text-slate-100 dark:text-slate-800 mb-4 block"></i>
                            <p className="text-slate-300 dark:text-slate-600 font-black uppercase tracking-[0.3em] text-xs">Queue Clear.</p>
                        </div>
                    )}
                </div>

                {/* PAGINATION FOOTER */}
                <div className="p-6 border-t dark:border-slate-700 bg-slate-50/50 dark:bg-slate-900/30 flex flex-col md:flex-row justify-between items-center gap-4">
                    <div className="flex items-center gap-6">
                        <div className="flex flex-col">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Per Page</p>
                            <select value={itemsPerPage} onChange={e => setItemsPerPage(parseInt(e.target.value))} className="bg-white dark:bg-slate-800 border dark:border-slate-700 rounded-lg px-2 py-1 text-xs font-black outline-none focus:ring-1 focus:ring-hotel-gold">
                                {[10, 20, 50].map(limit => <option key={limit} value={limit}>{limit}</option>)}
                            </select>
                        </div>
                        <div className="flex flex-col">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total</p>
                            <p className="text-sm font-black text-hotel-navy dark:text-white">{filteredSourceData.length}</p>
                        </div>
                        <div className="flex flex-col">
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">On Page</p>
                            <p className="text-sm font-black text-hotel-gold">{paginatedData.length}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 disabled:opacity-30 transition-all"><i className="fas fa-chevron-left text-xs"></i></button>
                        <div className="flex gap-1">
                            {Array.from({ length: totalPages }, (_, i) => i + 1).map(pageNum => (
                                <button key={pageNum} onClick={() => setCurrentPage(pageNum)}
                                    className={`w-10 h-10 rounded-xl text-[10px] font-black transition-all ${currentPage === pageNum ? 'bg-hotel-navy text-white shadow-lg' : 'bg-white dark:bg-slate-800 border text-slate-400'}`}>
                                    {pageNum}
                                </button>
                            )).slice(Math.max(0, currentPage - 3), Math.min(totalPages, currentPage + 2))}
                        </div>
                        <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages || totalPages === 0} className="w-10 h-10 flex items-center justify-center rounded-xl border border-slate-200 dark:border-slate-700 text-slate-400 disabled:opacity-30 transition-all"><i className="fas fa-chevron-right text-xs"></i></button>
                    </div>
                </div>
            </div>

            {/* Modals */}
            <AssignModal isOpen={modalState.assign} onClose={() => setModalState(p=>({...p, assign: false}))} onSuccess={() => { setModalState(p=>({...p, assign: false})); fetchData(); }} employees={employees} rooms={rooms} buildings={buildings} floors={floors} allProperties={allProperties} />
            <ReserveModal isOpen={modalState.reserve} onClose={() => setModalState(p=>({...p, reserve: false}))} onSuccess={() => { setModalState(p=>({...p, reserve: false})); fetchData(); }} editingItem={activeItem} rooms={rooms} buildings={buildings} floors={floors} allProperties={allProperties} getRoomLocation={(rid) => { const r = roomMap.get(rid); return { buildingId: r ? floorMap.get(r.floorId)?.buildingId || 0 : 0, floorId: r?.floorId || 0 }; }} />
            <HostingModal isOpen={modalState.hosting} onClose={() => setModalState(p=>({...p, hosting: false}))} onSuccess={() => { setModalState(p=>({...p, hosting: false})); fetchData(); }} editingItem={activeItem} employees={employees} rooms={rooms} buildings={buildings} floors={floors} allProperties={allProperties} getRoomLocation={(rid) => { const r = roomMap.get(rid); return { buildingId: r ? floorMap.get(r.floorId)?.buildingId || 0 : 0, floorId: r?.floorId || 0 }; }} />
            <CheckoutModal isOpen={modalState.checkout} onClose={() => setModalState(p=>({...p, checkout: false}))} onSuccess={() => { setModalState(p=>({...p, checkout: false})); fetchData(); }} assignment={activeItem} rooms={rooms} />
            <EndHostingModal isOpen={modalState.endHosting} onClose={() => setModalState(p=>({...p, endHosting: false}))} onSuccess={() => { setModalState(p=>({...p, endHosting: false})); fetchData(); }} hosting={activeItem} />
            <GuestManifestModal isOpen={modalState.viewManifest} onClose={() => setModalState(p=>({...p, viewManifest: false}))} hosting={activeItem} host={activeItem ? employeeMap.get(activeItem.employeeId) : undefined} room={activeItem ? roomMap.get(activeItem.roomId) : undefined} />
        </div>
    );
};

export default AssignmentsPage;
