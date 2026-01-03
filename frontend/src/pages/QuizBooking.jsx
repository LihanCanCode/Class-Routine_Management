import React, { useState, useEffect } from 'react';
import { getQuizConfig, getQuizBookings, createQuizBooking, updateQuizBooking, deleteQuizBooking, getCoursesByBatch } from '../services/api';
import { Calendar, Clock, Users, BookOpen, Plus, X, Save, Trash2, ChevronLeft, ChevronRight, Filter, ChevronDown, Eye, Edit3 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { useTutorial } from '../context/TutorialContext';

const QuizBooking = () => {
    const { user } = useAuth();
    const { hideDemoRoom } = useTutorial();
    const [config, setConfig] = useState({ rooms: [], timeSlots: [] });
    const [bookings, setBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [startDate, setStartDate] = useState(() => {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return today;
    });
    const [availableCourses, setAvailableCourses] = useState([]);
    const [loadingCourses, setLoadingCourses] = useState(false);

    // Helper to format batch display
    const formatBatch = (batch) => {
        // If batch is just a number, prepend "CSE "
        if (batch && /^\d+$/.test(batch)) {
            return `CSE ${batch}`;
        }
        return batch;
    };

    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [formData, setFormData] = useState({
        course: '',
        batch: '',
        syllabus: '',
        teacherComment: ''
    });
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');

    // Batch options
    const batchOptions = ['CSE 24', 'SWE 24', 'CSE 23', 'SWE 23', 'CSE 22', 'SWE 22', 'CSE 21', 'SWE 21', 'MSc(CSE)', 'All'];

    // Always show 7 days
    const daysToShow = 7;

    useEffect(() => {
        fetchConfig();
    }, []);

    useEffect(() => {
        if (config.rooms.length > 0) {
            fetchBookings();
        }
    }, [startDate, config]);

    const fetchConfig = async () => {
        try {
            const response = await getQuizConfig();
            let configData = response.data;
            
            // Hide DEMO-101 after tutorial completion or skip
            if (hideDemoRoom && configData.rooms) {
                configData.rooms = configData.rooms.filter(room => room !== 'DEMO-101');
            }
            
            setConfig(configData);
        } catch (err) {
            console.error('Failed to fetch config:', err);
            setConfig({
                rooms: [],
                timeSlots: [
                    { start: '13:30', end: '14:00', label: '1:30 - 2:00' },
                    { start: '14:00', end: '14:30', label: '2:00 - 2:30' }
                ]
            });
        }
    };

    const fetchBookings = async () => {
        setLoading(true);
        try {
            const endDate = new Date(startDate);
            endDate.setDate(endDate.getDate() + daysToShow);

            const response = await getQuizBookings(
                startDate.toISOString().split('T')[0],
                endDate.toISOString().split('T')[0]
            );
            setBookings(response.data.bookings || []);
        } catch (err) {
            console.error('Failed to fetch bookings:', err);
        } finally {
            setLoading(false);
        }
    };

    // Generate dates array
    const getDates = () => {
        const dates = [];
        for (let i = 0; i < daysToShow; i++) {
            const date = new Date(startDate);
            date.setDate(date.getDate() + i);
            dates.push(date);
        }
        return dates;
    };

    // Get booking for a specific cell
    const getBooking = (date, roomNumber, slotStart) => {
        const dateStr = date.toISOString().split('T')[0];
        return bookings.find(b => {
            const bookingDate = new Date(b.date).toISOString().split('T')[0];
            return bookingDate === dateStr &&
                b.roomNumber === roomNumber &&
                b.timeSlot.start === slotStart;
        });
    };

    // Format date for display
    const formatDate = (date) => {
        return date.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric', year: 'numeric' });
    };

    // Get day name
    const getDayName = (date) => {
        return date.toLocaleDateString('en-US', { weekday: 'long' });
    };

    // Handle cell click
    const handleCellClick = (date, roomNumber, slot, booking) => {
        setSelectedSlot({
            date,
            roomNumber,
            slot
        });
        setError('');

        if (booking) {
            setModalMode('edit');
            setFormData({
                id: booking._id,
                course: booking.course || '',
                batch: booking.batch || '',
                syllabus: booking.syllabus || '',
                teacherComment: booking.teacherComment || ''
            });
            // Load courses for the batch
            if (booking.batch) {
                fetchCoursesForBatch(booking.batch);
            }
        } else {
            setModalMode('create');
            const defaultBatch = user?.role === 'cr' && user?.batch ? user.batch : 'CSE 24';
            setFormData({
                course: '',
                batch: defaultBatch,
                syllabus: '',
                teacherComment: ''
            });
            // Load courses for default batch
            fetchCoursesForBatch(defaultBatch);
        }
        setShowModal(true);
    };

    // Fetch courses for a specific batch
    const fetchCoursesForBatch = async (batch) => {
        if (!batch || batch === 'All') {
            setAvailableCourses([]);
            return;
        }
        
        setLoadingCourses(true);
        try {
            const response = await getCoursesByBatch(batch);
            setAvailableCourses(response.data.courses || []);
        } catch (err) {
            console.error('Failed to fetch courses:', err);
            setAvailableCourses([]);
        } finally {
            setLoadingCourses(false);
        }
    };

    // Handle batch change
    const handleBatchChange = (newBatch) => {
        setFormData({ ...formData, batch: newBatch, course: '' });
        fetchCoursesForBatch(newBatch);
    };

    // Save booking
    const handleSave = async () => {
        const batchValue = user?.role === 'cr' && user?.batch ? user.batch : formData.batch;
        
        if (!batchValue.trim()) {
            setError('Batch is required');
            return;
        }

        if (!formData.course.trim()) {
            setError('Course is required');
            return;
        }

        setSaving(true);
        setError('');

        try {
            if (modalMode === 'create') {
                await createQuizBooking({
                    roomNumber: selectedSlot.roomNumber,
                    date: selectedSlot.date.toISOString().split('T')[0],
                    timeSlot: {
                        start: selectedSlot.slot.start,
                        end: selectedSlot.slot.end
                    },
                    course: formData.course,
                    batch: batchValue,
                    syllabus: formData.syllabus || '',
                    teacherComment: formData.teacherComment || ''
                });
            } else {
                await updateQuizBooking(formData.id, {
                    course: formData.course,
                    batch: batchValue,
                    syllabus: formData.syllabus || '',
                    teacherComment: formData.teacherComment || ''
                });
            }

            setShowModal(false);
            fetchBookings();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save booking');
        } finally {
            setSaving(false);
        }
    };

    // Delete booking
    const handleDelete = async () => {
        if (!formData.id) return;
        if (!window.confirm('Delete this booking?')) return;

        setSaving(true);
        try {
            await deleteQuizBooking(formData.id);
            setShowModal(false);
            fetchBookings();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to delete booking');
        } finally {
            setSaving(false);
        }
    };

    // Navigate dates
    const navigateDates = (direction) => {
        const newDate = new Date(startDate);
        newDate.setDate(newDate.getDate() + (direction * 7));
        setStartDate(newDate);
    };

    const dates = getDates();

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-orange-500 to-red-500 bg-clip-text text-transparent">
                        Quiz Room Booking
                    </h1>
                    <p className="text-slate-500">
                        Next 7 days quiz schedule - Click any slot to book or edit
                    </p>
                </div>

                <div className="flex items-center gap-4">
                    {/* Date Navigation */}
                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => navigateDates(-1)}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <ChevronLeft size={20} />
                        </button>
                        <span className="text-sm font-medium text-slate-600 min-w-[180px] text-center">
                            {formatDate(dates[0])} - {formatDate(dates[dates.length - 1])}
                        </span>
                        <button
                            onClick={() => navigateDates(1)}
                            className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
                        >
                            <ChevronRight size={20} />
                        </button>
                        <button
                            onClick={() => setStartDate(new Date())}
                            className="px-3 py-1 text-sm bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors"
                        >
                            Today
                        </button>
                    </div>
                </div>
            </div>

            {/* Table */}
            {config.rooms.length === 0 ? (
                <div className="text-center p-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                    <p className="text-slate-500 text-lg">No rooms found. Please upload a PDF routine first.</p>
                </div>
            ) : (
                <div className="bg-white rounded-xl shadow-lg border border-slate-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse">
                            <thead className="bg-slate-800 text-white sticky top-0 z-10">
                                <tr>
                                    <th className="p-3 text-left font-semibold border-r border-slate-700 min-w-[100px]">
                                        Room
                                    </th>
                                    {dates.map((date, idx) => (
                                        <th key={idx} colSpan={2} className="p-2 text-center font-semibold border-r border-slate-700 min-w-[160px]">
                                            <div>{formatDate(date)}</div>
                                            <div className="text-xs font-normal text-slate-300">{getDayName(date)}</div>
                                        </th>
                                    ))}
                                </tr>
                                <tr className="bg-slate-700">
                                    <th className="p-2 border-r border-slate-600"></th>
                                    {dates.map((date, idx) => (
                                        <React.Fragment key={idx}>
                                            {config.timeSlots.map(slot => (
                                                <th key={`${idx}-${slot.start}`} className="p-1 text-center text-xs font-medium border-r border-slate-600 min-w-[80px]">
                                                    {slot.label}
                                                </th>
                                            ))}
                                        </React.Fragment>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={1 + dates.length * 2} className="p-8 text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-600 border-t-transparent"></div>
                                                Loading...
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    config.rooms.map((room, roomIdx) => (
                                        <tr key={room} className={`border-b border-slate-100 ${roomIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/50'}`}>
                                            <td className="p-3 font-medium text-slate-700 border-r border-slate-200 whitespace-nowrap">
                                                {room}
                                            </td>
                                            {dates.map((date, dateIdx) => (
                                                <React.Fragment key={dateIdx}>
                                                    {config.timeSlots.map(slot => {
                                                        const booking = getBooking(date, room, slot.start);
                                                        return (
                                                            <td
                                                                key={`${dateIdx}-${slot.start}`}
                                                                className="p-1 border-r border-slate-200 min-w-[80px] cursor-pointer hover:bg-orange-100 transition-colors"
                                                                onClick={() => handleCellClick(date, room, slot, booking)}
                                                            >
                                                                {booking ? (
                                                                    <div className="bg-orange-100 border border-orange-200 rounded px-1 py-0.5 text-center">
                                                                        <span className="text-xs font-semibold text-orange-800">
                                                                            {formatBatch(booking.batch)}
                                                                        </span>
                                                                        {booking.course && (
                                                                            <p className="text-[10px] text-orange-600 truncate mt-0.5">
                                                                                {booking.course}
                                                                            </p>
                                                                        )}
                                                                    </div>
                                                                ) : (
                                                                    <div className="h-8 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                                        <Plus size={14} className="text-slate-400" />
                                                                    </div>
                                                                )}
                                                            </td>
                                                        );
                                                    })}
                                                </React.Fragment>
                                            ))}
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Booking Modal */}
            {showModal && selectedSlot && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-fade-in">
                        <div className="p-6 border-b border-slate-100">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-slate-800">
                                    {modalMode === 'create' ? 'Book Quiz Slot' : 'Edit Booking'}
                                </h2>
                                <button
                                    onClick={() => setShowModal(false)}
                                    className="text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                            <div className="mt-2 flex items-center gap-4 text-sm text-slate-500">
                                <span className="flex items-center gap-1">
                                    <Calendar size={14} />
                                    {formatDate(selectedSlot.date)}
                                </span>
                                <span className="flex items-center gap-1">
                                    <Clock size={14} />
                                    {selectedSlot.slot.label}
                                </span>
                                <span className="font-medium text-orange-600">
                                    Room {selectedSlot.roomNumber}
                                </span>
                            </div>
                        </div>

                        <div className="p-6 space-y-4">
                            {error && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                                    {error}
                                </div>
                            )}

                            {/* Show batch info for CRs, otherwise show selector */}
                            {user?.role === 'cr' && user?.batch ? (
                                <div className="p-4 bg-orange-50 border border-orange-200 rounded-lg">
                                    <p className="text-sm text-orange-700">
                                        <strong>Booking for:</strong> Batch {user.batch}
                                    </p>
                                </div>
                            ) : (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Batch *
                                    </label>
                                    <select
                                        value={formData.batch}
                                        onChange={(e) => handleBatchChange(e.target.value)}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                    >
                                        {batchOptions.filter(b => b !== 'All').map(batch => (
                                            <option key={batch} value={batch}>{batch}</option>
                                        ))}
                                    </select>
                                    <input
                                        type="text"
                                        value={formData.batch}
                                        onChange={(e) => handleBatchChange(e.target.value)}
                                        placeholder="Or type custom batch (e.g., C3S1, SW3)..."
                                        className="w-full mt-2 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm"
                                    />
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Course *
                                </label>
                                {loadingCourses ? (
                                    <div className="flex items-center gap-2 p-3 text-sm text-slate-500">
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-orange-500 border-t-transparent"></div>
                                        Loading courses...
                                    </div>
                                ) : availableCourses.length > 0 ? (
                                    <select
                                        value={formData.course}
                                        onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                                    >
                                        <option value="">Select a course</option>
                                        {availableCourses.map(course => (
                                            <option key={course} value={course}>{course}</option>
                                        ))}
                                    </select>
                                ) : null}
                                <input
                                    type="text"
                                    value={formData.course}
                                    onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                                    placeholder={availableCourses.length > 0 ? "Or type course code manually..." : "e.g., CSE 4307"}
                                    className={`w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 ${availableCourses.length > 0 ? 'mt-2 text-sm' : ''}`}
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Syllabus (Optional)
                                </label>
                                <textarea
                                    value={formData.syllabus}
                                    onChange={(e) => setFormData({ ...formData, syllabus: e.target.value })}
                                    placeholder="e.g., Chapter 1-3, Sorting Algorithms, etc."
                                    rows={3}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm resize-none"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Teacher's Comment (Optional)
                                </label>
                                <textarea
                                    value={formData.teacherComment}
                                    onChange={(e) => setFormData({ ...formData, teacherComment: e.target.value })}
                                    placeholder="Any additional notes or instructions..."
                                    rows={2}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-orange-500 focus:border-orange-500 text-sm resize-none"
                                />
                            </div>
                        </div>

                        <div className="p-6 border-t border-slate-100 flex items-center justify-between gap-3">
                            {modalMode === 'edit' && (
                                <button
                                    onClick={handleDelete}
                                    disabled={saving}
                                    className="px-4 py-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <Trash2 size={16} />
                                    Delete
                                </button>
                            )}
                            <div className="flex-1" />
                            <button
                                onClick={() => setShowModal(false)}
                                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                disabled={saving}
                                className="px-6 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {saving ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} />
                                        {modalMode === 'create' ? 'Book Slot' : 'Save Changes'}
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default QuizBooking;
