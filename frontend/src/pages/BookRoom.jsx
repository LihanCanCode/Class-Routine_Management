import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Calendar from 'react-calendar';
import 'react-calendar/dist/Calendar.css';
import { checkAvailability, createBooking, getBatches, deleteBooking } from '../services/api';
import { Clock, MapPin, Users, Calendar as CalendarIcon, Check, X } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTutorial } from '../context/TutorialContext';

const BookRoom = () => {
    const { user } = useAuth();
    const { hideDemoRoom } = useTutorial();
    const navigate = useNavigate();
    const location = useLocation();
    const [date, setDate] = useState(new Date());
    const [selectedSlot, setSelectedSlot] = useState(null);

    const [availability, setAvailability] = useState(null);
    const [loading, setLoading] = useState(false);

    // Booking Form State
    const [selectedRoom, setSelectedRoom] = useState(null);
    const [batch, setBatch] = useState(user?.batch || 'CSE 21');
    const [name, setName] = useState(user?.name || '');
    const [purpose, setPurpose] = useState('');
    const [bookingStatus, setBookingStatus] = useState('idle'); // idle, submitting, success, error
    const [bookingMessage, setBookingMessage] = useState('');

    // Dynamic batches from database
    const [batches, setBatches] = useState(['CSE 21', 'CSE 22', 'CSE 23', 'CSE 24', 'MSc(CSE)']); // Default fallback

    // End time state for range search
    const [endTime, setEndTime] = useState('');

    const timeSlots = [
        { start: '08:00', end: '09:15', label: '8:00 AM - 9:15 AM' },
        { start: '09:15', end: '10:30', label: '9:15 AM - 10:30 AM' },
        { start: '10:30', end: '11:45', label: '10:30 AM - 11:45 AM' },
        { start: '11:45', end: '13:00', label: '11:45 AM - 1:00 PM' },
        { start: '14:30', end: '15:45', label: '2:30 PM - 3:45 PM' },
        { start: '15:45', end: '17:00', label: '3:45 PM - 5:00 PM' },
    ];

    const endTimes = [
        { value: '09:15', label: '9:15 AM' },
        { value: '10:30', label: '10:30 AM' },
        { value: '11:45', label: '11:45 AM' },
        { value: '13:00', label: '1:00 PM' },
        { value: '15:45', label: '3:45 PM' },
        { value: '17:00', label: '5:00 PM' },
    ];

    // Fetch batches from database
    useEffect(() => {
        const fetchBatches = async () => {
            try {
                const response = await getBatches();
                if (response.data && response.data.length > 0) {
                    setBatches(response.data);
                }
            } catch (error) {
                console.error('Failed to fetch batches:', error);
            }
        };
        fetchBatches();
    }, []);

    // Helper to format date as YYYY-MM-DD in local time
    const formatLocalDate = (d) => {
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const date = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${date}`;
    };

    // Handle URL parameters for auto-fill from semester schedule
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const urlDate = params.get('date');
        const urlStartTime = params.get('startTime');
        const urlEndTime = params.get('endTime');

        if (urlDate) {
            // Parse YYYY-MM-DD as local date by adding time part
            setDate(new Date(urlDate + 'T00:00:00'));
        }

        if (urlStartTime) {
            const slot = timeSlots.find(s => s.start === urlStartTime);
            if (slot) {
                setSelectedSlot(slot);
                // Default end time to this slot's end, unless provided in URL
                setEndTime(urlEndTime || slot.end);
            }
        }
    }, [location.search]);

    useEffect(() => {
        if (date && selectedSlot && endTime) {
            fetchAvailability();
        } else {
            setAvailability(null);
        }
    }, [date, selectedSlot, endTime]);

    const fetchAvailability = async () => {
        setLoading(true);
        try {
            const formattedDate = formatLocalDate(date);
            const response = await checkAvailability(formattedDate, selectedSlot.start, endTime);
            let availabilityData = response.data;

            if (hideDemoRoom && availabilityData.available) {
                availabilityData.available = availabilityData.available.filter(room => room.roomNumber !== 'DEMO-101');
            }

            setAvailability(availabilityData);
        } catch (error) {
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleBook = async (e) => {
        e.preventDefault();
        if (!selectedRoom) return;

        const params = new URLSearchParams(location.search);
        const returnTo = params.get('returnTo');
        const returnUrl = params.get('returnUrl');

        if (returnTo === 'semester' && returnUrl) {
            // SELECTION MODE: Don't create booking yet, just return the data
            setBookingStatus('success');
            setBookingMessage(`Selected ${selectedRoom.roomNumber}. Saving entry will confirm booking.`);

            setTimeout(() => {
                const decodedUrl = decodeURIComponent(returnUrl);
                const urlObj = new URL(decodedUrl, window.location.origin);
                urlObj.searchParams.set('bookedRoom', selectedRoom.roomNumber);
                urlObj.searchParams.set('endTime', endTime);
                urlObj.searchParams.set('pendingBookingAction', 'create'); // Signal that we need to create a booking on save
                navigate(urlObj.pathname + urlObj.search);
            }, 1000);
            return;
        }

        setBookingStatus('submitting');
        try {
            await createBooking({
                roomNumber: selectedRoom.roomNumber,
                date: formatLocalDate(date),
                timeSlot: { start: selectedSlot.start, end: endTime },
                batch: user?.role === 'cr' && user?.batch ? user.batch : batch,
                purpose
            });

            setBookingStatus('success');
            setBookingMessage(`Successfully booked ${selectedRoom.roomNumber}!`);

            fetchAvailability();
            setTimeout(() => {
                setBookingStatus('idle');
                setSelectedRoom(null);
                setPurpose('');
            }, 3000);

        } catch (error) {
            setBookingStatus('error');
            const errorMsg = error.response?.data?.details || error.response?.data?.error || 'Booking failed';
            setBookingMessage(errorMsg);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8 animate-fade-in">
            <div className="text-center mb-8">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent mb-2">
                    Find & Book a Room
                </h1>
                <p className="text-slate-500">Select a date and time to see available classrooms</p>
            </div>

            <div className="grid md:grid-cols-12 gap-8" data-tutorial="booking-form">
                {/* Left Column: Controls */}
                <div className="md:col-span-4 space-y-6">
                    {/* Calendar */}
                    <div className="glass-card p-6 rounded-2xl">
                        <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                            <CalendarIcon size={18} className="text-primary-500" />
                            Select Date
                        </h3>
                        <div className="calendar-wrapper" data-tutorial="select-date">
                            <Calendar
                                onChange={setDate}
                                value={date}
                                minDate={new Date()}
                                className="w-full border-none rounded-lg text-sm"
                            />
                        </div>
                    </div>

                    {/* Time Slots */}
                    <div className="glass-card p-6 rounded-2xl">
                        <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                            <Clock size={18} className="text-primary-500" />
                            Select Start Time
                        </h3>
                        <div className="grid grid-cols-2 gap-3" data-tutorial="select-time">
                            {timeSlots.map(slot => (
                                <button
                                    key={slot.start}
                                    onClick={() => {
                                        setSelectedSlot(slot);
                                        setEndTime(slot.end);
                                    }}
                                    className={`p-3 rounded-lg text-sm font-medium transition-all text-center
                                        ${selectedSlot?.start === slot.start
                                            ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30 scale-105'
                                            : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                        }`}
                                >
                                    {slot.label.split(' - ')[0]}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* End Time Selection */}
                    {selectedSlot && (
                        <div className="glass-card p-6 rounded-2xl animate-fade-in shadow-inner bg-slate-50/50 border border-slate-100">
                            <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                <Clock size={18} className="text-secondary-500" />
                                Select Duration (Until)
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                {endTimes
                                    .filter(t => t.value > selectedSlot.start)
                                    .map(t => (
                                        <button
                                            key={t.value}
                                            onClick={() => setEndTime(t.value)}
                                            className={`p-3 rounded-lg text-sm font-medium transition-all text-center
                                                ${endTime === t.value
                                                    ? 'bg-secondary-500 text-white shadow-lg shadow-secondary-500/30 scale-105'
                                                    : 'bg-white text-slate-600 border border-slate-200 hover:border-secondary-300 hover:text-secondary-600'
                                                }`}
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                            </div>
                            <div className="mt-4 pt-3 border-t border-slate-200/50 flex flex-col items-center">
                                <p className="text-[10px] text-slate-400">Selected Range:</p>
                                <p className="text-xs font-bold text-slate-700">
                                    <span className="text-primary-600">{selectedSlot.start}</span>
                                    <span className="mx-2 text-slate-300">→</span>
                                    <span className="text-secondary-600">{endTime}</span>
                                </p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Right Column: Results */}
                <div className="md:col-span-8">
                    {!selectedSlot ? (
                        <div className="h-full flex flex-col items-center justify-center p-12 glass-card rounded-2xl border-2 border-dashed border-slate-200 text-slate-400">
                            <Clock size={48} className="mb-4 opacity-50" />
                            <p className="text-lg">Please select a time slot to check availability</p>
                        </div>
                    ) : loading ? (
                        <div className="h-full flex items-center justify-center">
                            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
                        </div>
                    ) : (
                        <div className="space-y-6">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xl font-bold text-slate-800">
                                    Available Rooms
                                    <span className="ml-2 text-sm font-normal text-slate-500 bg-slate-100 px-2 py-1 rounded-full">
                                        {date.toDateString()} • {selectedSlot.start} - {endTime}
                                    </span>
                                </h3>
                                <span className="text-sm font-medium text-green-600 bg-green-50 px-3 py-1 rounded-full">
                                    {availability?.available?.length || 0} Free
                                </span>
                            </div>

                            <div className="grid grid-cols-2 lg:grid-cols-3 gap-4" data-tutorial="available-rooms">
                                {availability?.available?.map(room => (
                                    <button
                                        key={room._id}
                                        onClick={() => setSelectedRoom(room)}
                                        className="group relative p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md hover:border-primary-300 transition-all text-left"
                                        data-tutorial={room.roomNumber === 'DEMO-101' ? 'demo-room-card' : undefined}
                                    >
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="font-bold text-lg text-slate-700 group-hover:text-primary-600">
                                                {room.roomNumber}
                                            </span>
                                            <span className="bg-green-100 text-green-700 text-xs px-2 py-0.5 rounded font-medium">Free</span>
                                        </div>
                                        <div className="text-xs text-slate-500 flex items-center gap-1">
                                            <Users size={12} /> Capacity: {room.capacity}
                                        </div>
                                    </button>
                                ))}
                            </div>

                            {/* Student Bookings Section */}
                            {availability?.occupied?.some(o => o.reason === 'booked') && (
                                <div className="mt-10 pt-6 border-t border-slate-200">
                                    <h4 className="text-md font-bold text-orange-700 mb-4 flex items-center gap-2">
                                        <CalendarIcon size={18} className="text-orange-500" />
                                        Student Bookings
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                        {availability.occupied.filter(o => o.reason === 'booked').map((occ, idx) => (
                                            <div key={`booked-${idx}`} className="p-4 bg-orange-50/50 border border-orange-100 rounded-xl flex flex-col justify-between hover:shadow-sm transition-all relative overflow-hidden">
                                                                                    {/* Removed BOOKED label */}
                                                <div className="mb-3 flex items-center justify-between gap-2">
                                                    <span className="font-bold text-lg text-slate-800">{occ.roomNumber}</span>
                                                    {occ.routineType && (
                                                        <span className="ml-2 px-2 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-700">
                                                            {occ.routineType === 'room-based' ? 'Room Routine' : occ.routineType === 'semester-wise' ? 'Semester Routine' : 'Booked'}
                                                        </span>
                                                    )}
                                                    {/* Cancel button for own booking */}
                                                    {user && occ.bookedBy === user.name && (
                                                        <button
                                                            className="text-xs px-2 py-1 rounded bg-red-100 text-red-700 font-bold hover:bg-red-200 transition-colors"
                                                            title="Cancel this booking"
                                                            onClick={async () => {
                                                                if (window.confirm('Are you sure you want to cancel this booking?')) {
                                                                    await deleteBooking(occ.bookingId);
                                                                    fetchAvailability();
                                                                }
                                                            }}
                                                        >
                                                            Cancel
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="space-y-2">
                                                    <div className="flex items-start gap-2 text-sm font-medium text-slate-800">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-orange-500 mt-1.5 shrink-0"></span>
                                                        <span className="leading-tight">{occ.purpose || 'Private Booking'}</span>
                                                    </div>
                                                    <div className="pl-3.5 space-y-1">
                                                        <div className="text-xs text-slate-600">
                                                            <span className="font-medium text-slate-400">By:</span> {occ.bookedBy || 'Unknown'}
                                                        </div>
                                                        <div className="text-xs text-slate-500 bg-white/50 inline-block px-1.5 py-0.5 rounded border border-orange-100">
                                                            Batch: {occ.batch}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}

                            {/* Scheduled Classes Section */}
                            {availability?.occupied?.some(o => o.reason === 'scheduled_class') && (
                                <div className="mt-10 pt-6 border-t border-slate-200">
                                    <h4 className="text-md font-bold text-slate-600 mb-4 flex items-center gap-2">
                                        <div className="w-4 h-4 rounded bg-slate-200 flex items-center justify-center text-[10px] font-bold text-slate-500">C</div>
                                        Scheduled Classes
                                    </h4>
                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 opacity-80 hover:opacity-100 transition-opacity">
                                        {availability.occupied.filter(o => o.reason === 'scheduled_class').map((occ, idx) => (
                                            <div key={`class-${idx}`} className="p-4 bg-slate-50 border border-slate-100 rounded-xl flex flex-col justify-between">
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="font-bold text-lg text-slate-700">{occ.roomNumber}</span>
                                                    {occ.routineType && (
                                                        <span className={`ml-2 px-2 py-0.5 rounded-full text-xs font-semibold ${occ.routineType === 'room-based' ? 'bg-purple-100 text-purple-700' : 'bg-green-100 text-green-700'}`}>
                                                            {occ.routineType === 'room-based' ? 'Room Routine' : occ.routineType === 'semester-wise' ? 'Semester Routine' : 'Other'}
                                                        </span>
                                                    )}
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full uppercase tracking-wider bg-slate-200 text-slate-600">
                                                        Class
                                                    </span>
                                                </div>
                                                <div className="space-y-1.5">
                                                    <div className="flex items-start gap-2 text-sm font-medium text-slate-800">
                                                        <span className="w-1.5 h-1.5 rounded-full bg-slate-400 mt-1.5 shrink-0"></span>
                                                        <span className="leading-tight">{occ.course || 'Scheduled Class'}</span>
                                                    </div>
                                                    {occ.batch && (
                                                        <div className="text-xs text-slate-500 pl-3.5">
                                                            Batch: {occ.batch}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Booking Modal */}
            {selectedRoom && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in" style={{ marginTop: '-80px' }}>
                        <div className="p-6 bg-gradient-to-r from-primary-600 to-secondary-600 text-white flex justify-between items-start">
                            <div>
                                <h3 className="text-xl font-bold">Book {selectedRoom.roomNumber}</h3>
                                <p className="text-white/80 text-sm mt-1">
                                    {date.toDateString()} • {selectedSlot.start} - {endTime}
                                </p>
                            </div>
                            <button onClick={() => setSelectedRoom(null)} className="text-white/70 hover:text-white transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <form onSubmit={handleBook} className="p-6 space-y-4">
                            {!(user?.role === 'cr' && user?.batch) && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">Select Batch</label>
                                    <select
                                        value={batch}
                                        onChange={(e) => setBatch(e.target.value)}
                                        className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-white focus:ring-2 focus:ring-primary-500 focus:outline-none text-slate-700"
                                    >
                                        {batches.map(b => (
                                            <option key={b} value={b}>{b}</option>
                                        ))}
                                    </select>
                                </div>
                            )}

                            {user?.role === 'cr' && user?.batch && (
                                <div className="p-3 bg-primary-50 border border-primary-200 rounded-lg">
                                    <p className="text-sm text-primary-700">
                                        <strong>Booking for:</strong> Batch {user.batch}
                                    </p>
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Booked By</label>
                                <input
                                    type="text"
                                    value={name}
                                    disabled
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-slate-50 text-slate-600"
                                />
                                <p className="text-xs text-slate-500 mt-1">Auto-filled from your account</p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">Purpose (Optional)</label>
                                <input
                                    type="text"
                                    value={purpose}
                                    onChange={(e) => setPurpose(e.target.value)}
                                    className="w-full px-4 py-2 rounded-lg border border-slate-300 focus:ring-2 focus:ring-primary-500 focus:outline-none"
                                    placeholder="e.g. Class makeup, Meeting"
                                />
                            </div>

                            {bookingStatus === 'error' && (
                                <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">
                                    {bookingMessage}
                                </div>
                            )}

                            {bookingStatus === 'success' && (
                                <div className="p-3 bg-green-50 text-green-600 text-sm rounded-lg flex items-center gap-2">
                                    <Check size={16} /> {bookingMessage}
                                </div>
                            )}

                            <button
                                type="submit"
                                disabled={bookingStatus === 'submitting' || bookingStatus === 'success'}
                                className={`w-full py-3 rounded-xl font-bold text-white transition-all shadow-lg shadow-primary-500/30 mt-4
                                    ${bookingStatus === 'submitting'
                                        ? 'bg-slate-400 cursor-not-allowed'
                                        : bookingStatus === 'success'
                                            ? 'bg-green-500 hover:bg-green-600'
                                            : 'bg-gradient-to-r from-primary-600 to-primary-500 hover:scale-[1.02] active:scale-[0.98]'
                                    }`}
                            >
                                {bookingStatus === 'submitting'
                                    ? 'Confirming...'
                                    : bookingStatus === 'success'
                                        ? 'Confirmed!'
                                        : new URLSearchParams(location.search).get('returnTo') === 'semester'
                                            ? 'Confirm Selection'
                                            : 'Confirm Booking'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};

export default BookRoom;
