import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getSchedules, createScheduleEntry, updateScheduleEntry, deleteScheduleEntry, getPDFInfo, getBatchList, getFilteredPDFUrl, getPDFUrl } from '../services/api';
import { Filter, ChevronDown, ChevronRight, Clock, Users, BookOpen, Plus, X, Edit2, Trash2, Save, FileText, Calendar } from 'lucide-react';
import { useTutorial } from '../context/TutorialContext';

const ViewSchedule = () => {
    const navigate = useNavigate();
    const { hideDemoRoom } = useTutorial();
    const [schedules, setSchedules] = useState([]);
    const [loading, setLoading] = useState(true);
    const [rooms, setRooms] = useState([]);
    const [selectedRoom, setSelectedRoom] = useState('');
    const [error, setError] = useState('');
    const [semesterPDFExists, setSemesterPDFExists] = useState(false);
    
    // Modal state
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('create'); // 'create' or 'edit'
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [formData, setFormData] = useState({
        course: '',
        batch: '',
        teacher: '',
        endTime: ''
    });
    const [saving, setSaving] = useState(false);

    // Batch options
    const batchOptions = ['CSE 24', 'SWE 24', 'CSE 23', 'SWE 23', 'CSE 22', 'SWE 22', 'CSE 21', 'SWE 21', 'MSc(CSE)', 'All'];

    // Days and Time Slots for the grid
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    // Time Slots for the grid logic
    const timeSlots = [
        { start: '08:00', end: '09:15', label: '8:00 - 9:15' },
        { start: '09:15', end: '10:30', label: '9:15 - 10:30' },
        { start: '10:30', end: '11:45', label: '10:30 - 11:45' },
        { start: '11:45', end: '13:00', label: '11:45 - 1:00' },
        // Break is handled as a Gap, not a slot with data usually
        { start: '14:30', end: '15:45', label: '2:30 - 3:45' },
        { start: '15:45', end: '17:00', label: '3:45 - 5:00' },
    ];

    // Helper to determine colSpan
    const getColSpan = (schedule, currentIndex) => {
        if (!schedule) return 1;
        let span = 1;
        const endTime = schedule.timeSlot.end;

        // Check next slots to see if they are covered
        for (let i = currentIndex + 1; i < timeSlots.length; i++) {
            if (timeSlots[i].end <= endTime) {
                span++;
            } else {
                break;
            }
        }
        return span;
    };

    useEffect(() => {
        fetchSchedules();
        checkSemesterPDF();
    }, []);

    const checkSemesterPDF = async () => {
        try {
            const response = await getPDFInfo('semester-wise');
            setSemesterPDFExists(response.data.exists);
        } catch (err) {
            console.error('Failed to check semester PDF:', err);
        }
    };

    const fetchSchedules = async () => {
        try {
            const response = await getSchedules();

            // Extract unique rooms
            const allSchedules = response.data.schedules;
            let uniqueRooms = [...new Set(allSchedules.map(s => s.roomNumber))].sort();
            
            // Hide DEMO-101 after tutorial completion or skip
            if (hideDemoRoom) {
                uniqueRooms = uniqueRooms.filter(room => room !== 'DEMO-101');
            }

            setRooms(uniqueRooms);
            setSchedules(allSchedules);

            // Default to first room if available
            if (uniqueRooms.length > 0 && !selectedRoom) {
                setSelectedRoom(uniqueRooms[0]);
            }

            setLoading(false);
        } catch (err) {
            setError('Failed to load schedules');
            setLoading(false);
        }
    };

    const getScheduleForSlot = (day, slotStart, slotEnd) => {
        // Find schedule that covers this time slot
        // Priority: 1) Exact start match, 2) Schedule that contains this slot
        const exactMatch = schedules.find(s =>
            s.roomNumber === selectedRoom &&
            s.day === day &&
            s.timeSlot.start === slotStart
        );
        
        if (exactMatch) return exactMatch;
        
        // Find schedule that spans over this slot
        return schedules.find(s =>
            s.roomNumber === selectedRoom &&
            s.day === day &&
            s.timeSlot.start < slotStart &&
            s.timeSlot.end > slotStart
        );
    };

    // Handle slot click - open modal
    const handleSlotClick = (day, slot, schedule) => {
        setSelectedSlot({
            day,
            start: slot.start,
            end: slot.end,
            label: slot.label
        });

        if (schedule) {
            // Edit mode
            setModalMode('edit');
            setFormData({
                id: schedule._id,
                course: schedule.course || '',
                batch: schedule.batch || 'All',
                teacher: schedule.teacher || '',
                endTime: schedule.timeSlot.end
            });
        } else {
            // Create mode
            setModalMode('create');
            setFormData({
                course: '',
                batch: 'All',
                teacher: '',
                endTime: slot.end
            });
        }
        setShowModal(true);
    };

    // Save schedule entry
    const handleSave = async () => {
        if (!formData.course.trim()) {
            setError('Course name is required');
            return;
        }

        setSaving(true);
        setError('');

        try {
            if (modalMode === 'create') {
                await createScheduleEntry({
                    roomNumber: selectedRoom,
                    day: selectedSlot.day,
                    timeSlot: {
                        start: selectedSlot.start,
                        end: formData.endTime || selectedSlot.end
                    },
                    course: formData.course,
                    batch: formData.batch,
                    teacher: formData.teacher
                });
            } else {
                await updateScheduleEntry(formData.id, {
                    course: formData.course,
                    batch: formData.batch,
                    teacher: formData.teacher,
                    timeSlot: { end: formData.endTime }
                });
            }

            setShowModal(false);
            fetchSchedules(); // Refresh
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save schedule');
        } finally {
            setSaving(false);
        }
    };

    // Delete schedule entry
    const handleDelete = async () => {
        if (!formData.id) return;
        
        if (!window.confirm('Are you sure you want to delete this schedule entry?')) {
            return;
        }

        setSaving(true);
        try {
            await deleteScheduleEntry(formData.id);
            setShowModal(false);
            fetchSchedules();
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to delete schedule');
        } finally {
            setSaving(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
        </div>
    );

    return (
        <div className="space-y-6 animate-fade-in">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent">
                        Class Routine
                    </h1>
                    <p className="text-slate-500">View weekly schedules by room</p>
                </div>

                <div className="flex items-center gap-3">
                    {semesterPDFExists && (
                        <button
                            onClick={() => navigate('/view-semester')}
                            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-lg hover:from-blue-700 hover:to-blue-800 transition-all duration-200 shadow-md hover:shadow-lg"
                        >
                            <Calendar size={18} />
                            <span className="font-medium">View Semester Schedule</span>
                        </button>
                    )}

                    <div className="relative group">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <Filter size={18} className="text-slate-400" />
                        </div>
                        <select
                            value={selectedRoom}
                            onChange={(e) => setSelectedRoom(e.target.value)}
                            className="pl-10 pr-10 py-2 bg-white border border-slate-200 rounded-lg shadow-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500 appearance-none min-w-[200px] cursor-pointer"
                        >
                            {rooms.map(room => (
                                <option key={room} value={room}>{room}</option>
                            ))}
                        </select>
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
                            <ChevronDown size={18} className="text-slate-400" />
                        </div>
                    </div>
                </div>
            </div>

            {rooms.length === 0 ? (
                <div className="text-center p-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                    <p className="text-slate-500 text-lg">No schedules found. Please upload a PDF routine first.</p>
                </div>
            ) : (
                <div className="glass-card rounded-xl overflow-hidden shadow-lg border border-slate-100">
                    <div className="overflow-x-auto">
                        <table className="w-full border-collapse min-w-[1000px]">
                            <thead>
                                <tr className="bg-slate-50/80 backend-blur">
                                    <th className="p-4 text-left font-semibold text-slate-600 border-b border-r sticky left-0 bg-slate-50 z-10 w-32">Day</th>
                                    {timeSlots.map((slot, index) => (
                                        <React.Fragment key={slot.start}>
                                            {/* Insert Break Header after 4th slot (11:45-1:00) */}
                                            {index === 4 && (
                                                <th className="p-4 text-center font-bold text-slate-400 border-b bg-slate-100/30 w-16">
                                                    Break
                                                </th>
                                            )}
                                            <th className="p-4 text-center font-semibold text-slate-600 border-b min-w-[140px]">
                                                {slot.label}
                                            </th>
                                        </React.Fragment>
                                    ))}
                                </tr>
                            </thead>
                            <tbody>
                                {days.map(day => {
                                    // Track covered slots to skip rendering
                                    let skipUntilIndex = -1;

                                    return (
                                        <tr key={day} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4 font-medium text-slate-700 border-r border-b bg-white sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
                                                {day}
                                            </td>

                                            {timeSlots.map((slot, index) => {
                                                // Render Break Gap
                                                const breakGap = index === 4 ? (
                                                    <td key={`break-${day}`} className="border-b bg-slate-100/50 relative">
                                                        {day === 'Monday' && (
                                                            <div className="absolute inset-0 flex items-center justify-center writing-vertical-lr text-slate-400 font-bold tracking-widest uppercase text-xs opacity-50 h-[400px]">
                                                                Lunch & Prayer
                                                            </div>
                                                        )}
                                                    </td>
                                                ) : null;

                                                if (index <= skipUntilIndex) return breakGap; // Just potentially render break, skip slot

                                                const schedule = getScheduleForSlot(day, slot.start);
                                                const colSpan = getColSpan(schedule, index);

                                                // If bridging, updating skip index
                                                if (colSpan > 1) {
                                                    skipUntilIndex = index + colSpan - 1;
                                                }

                                                return (
                                                    <React.Fragment key={slot.start}>
                                                        {breakGap}
                                                        <td
                                                            colSpan={colSpan}
                                                            className={`p-2 border-b border-r border-slate-100 h-32 align-top cursor-pointer hover:bg-slate-50 transition-colors ${colSpan > 1 ? 'z-20' : ''}`}
                                                            onClick={() => handleSlotClick(day, slot, schedule)}
                                                        >
                                                            {schedule ? (
                                                                <div className={`${schedule.needsReview ? 'bg-red-50 hover:bg-red-100 border-red-200' : 'bg-primary-50 hover:bg-primary-100 border-primary-100'} border rounded-lg p-3 h-full transition-all hover:shadow-md ${colSpan > 1 ? 'bg-indigo-50 border-indigo-100' : ''}`}>
                                                                    {schedule.needsReview && (
                                                                        <div className="flex items-center gap-1 mb-1">
                                                                            <span className="text-xs font-bold text-red-600 bg-red-100 px-2 py-0.5 rounded">
                                                                                ⚠ NEEDS REVIEW
                                                                            </span>
                                                                        </div>
                                                                    )}
                                                                    {/* Show course name, or fallback to rawContent if no course code */}
                                                                    {(schedule.course || schedule.rawContent) && (
                                                                        <div className="flex items-start gap-2 mb-2">
                                                                            <BookOpen size={14} className={`${schedule.needsReview ? 'text-red-500' : 'text-primary-500'} mt-0.5 flex-shrink-0`} />
                                                                            <span className={`font-bold ${schedule.needsReview ? 'text-red-900' : 'text-primary-900'} text-sm leading-tight`} title={schedule.rawContent}>
                                                                                {schedule.course || schedule.rawContent?.slice(0, 50)}
                                                                                {schedule.isBiWeekly && (
                                                                                    <span className="ml-1 text-xs text-orange-600 font-normal">(bi-weekly)</span>
                                                                                )}
                                                                            </span>
                                                                        </div>
                                                                    )}

                                                                    {schedule.batch && (
                                                                        <div className="flex items-center gap-2 mb-1">
                                                                            <Users size={14} className={schedule.needsReview ? 'text-red-400' : 'text-primary-400'} />
                                                                            <span className={`text-xs font-semibold ${schedule.needsReview ? 'text-red-700 bg-red-200/50' : 'text-primary-700 bg-primary-200/50'} px-1.5 py-0.5 rounded`}>
                                                                                {schedule.batch}
                                                                            </span>
                                                                        </div>
                                                                    )}

                                                                    {schedule.teacher && (
                                                                        <p className="text-xs text-primary-600 mt-1 truncate" title={schedule.teacher}>
                                                                            {schedule.teacher}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            ) : (
                                                                <div className="h-full w-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                                    <span className="text-xs text-primary-500 font-medium flex items-center gap-1 bg-primary-50 px-2 py-1 rounded-full">
                                                                        <Plus size={12} /> Add
                                                                    </span>
                                                                </div>
                                                            )}
                                                        </td>
                                                    </React.Fragment>
                                                );
                                            })}
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Manual Entry Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-fade-in">
                        <div className="p-6 border-b border-slate-100">
                            <div className="flex items-center justify-between">
                                <h2 className="text-xl font-bold text-slate-800">
                                    {modalMode === 'create' ? 'Add Schedule Entry' : 'Edit Schedule Entry'}
                                </h2>
                                <button 
                                    onClick={() => setShowModal(false)}
                                    className="text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                            <p className="text-sm text-slate-500 mt-1">
                                {selectedSlot?.day} • {selectedSlot?.label} • Room {selectedRoom}
                            </p>
                        </div>

                        <div className="p-6 space-y-4">
                            {error && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Course Name *
                                </label>
                                <input
                                    type="text"
                                    value={formData.course}
                                    onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                                    placeholder="e.g., CSE 4307 or Programming Training"
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Batch
                                </label>
                                <select
                                    value={formData.batch}
                                    onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                >
                                    {batchOptions.map(batch => (
                                        <option key={batch} value={batch}>{batch}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-slate-400 mt-1">
                                    Or type custom batch (e.g., C1S1/C1S2/SW1)
                                </p>
                                <input
                                    type="text"
                                    value={formData.batch}
                                    onChange={(e) => setFormData({ ...formData, batch: e.target.value })}
                                    placeholder="Custom batch..."
                                    className="w-full mt-1 px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Teacher (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={formData.teacher}
                                    onChange={(e) => setFormData({ ...formData, teacher: e.target.value })}
                                    placeholder="Teacher name or initials"
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    End Time
                                </label>
                                <select
                                    value={formData.endTime}
                                    onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                >
                                    {timeSlots.map(slot => (
                                        <option key={slot.end} value={slot.end}>
                                            {slot.end} ({slot.label.split(' - ')[1]})
                                        </option>
                                    ))}
                                </select>
                                <p className="text-xs text-slate-400 mt-1">
                                    Extend to span multiple slots (e.g., for 100 min classes)
                                </p>
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
                                className="px-6 py-2 bg-primary-600 hover:bg-primary-700 text-white rounded-lg transition-colors flex items-center gap-2 disabled:opacity-50"
                            >
                                {saving ? (
                                    <>
                                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                                        Saving...
                                    </>
                                ) : (
                                    <>
                                        <Save size={16} />
                                        {modalMode === 'create' ? 'Add Entry' : 'Save Changes'}
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

export default ViewSchedule;
