import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getSemesterPages, getSemesterPageUrl, updateSemesterPageBatchName, deleteSemesterPage, getSemesterSchedule, createSemesterEntry, updateSemesterEntry, deleteSemesterEntry, getRooms, getCoursesByBatch, getCourseNicknames, splitSemesterSlot, createBooking, deleteBooking } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { FileText, Calendar, ChevronLeft, ChevronRight, Edit2, Save, X, Trash2, Plus, Download, Clock, BookOpen, Users, DoorOpen, User, Info, Globe } from 'lucide-react';

const ViewSemesterSchedule = () => {
    const { user } = useAuth();
    const navigate = useNavigate();
    const location = useLocation();
    const [pages, setPages] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedPage, setSelectedPage] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        const urlPage = parseInt(params.get('pageNumber'));
        if (urlPage) return urlPage;

        // If user has a preferred page saved (guest persistence), use it
        if (user?.preferredSemesterPage) return user.preferredSemesterPage;

        return 1;
    });
    const [totalPages, setTotalPages] = useState(0);
    const [exists, setExists] = useState(false);
    const [error, setError] = useState('');
    const [editingPage, setEditingPage] = useState(null);
    const [editValue, setEditValue] = useState('');
    const [saving, setSaving] = useState(false);

    // Week navigation state
    const [weekOffset, setWeekOffset] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        const urlOffset = params.get('weekOffset');
        if (urlOffset !== null) return parseInt(urlOffset);
        return 1; // Always default to current week (offset 1) if not specified in URL
    });
    const [currentWeekStart, setCurrentWeekStart] = useState(null);

    // Schedule grid state
    const [schedules, setSchedules] = useState([]);
    const [loadingSchedules, setLoadingSchedules] = useState(false);
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState('create');
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [formData, setFormData] = useState({
        course: '',
        courseNickname: '',
        section: '',
        batch: '',
        batchSelection: '', // For course fetching
        teacher: '',
        roomNumber: '',
        endTime: '',
        status: 'active',
        statusNote: '',
        roomAlreadyBooked: false,
        bookingId: null,
        pendingBookingAction: null
    });

    // Rooms state
    const [rooms, setRooms] = useState([]);
    const [loadingRooms, setLoadingRooms] = useState(false);

    // Courses state
    const [courses, setCourses] = useState([]);
    const [loadingCourses, setLoadingCourses] = useState(false);

    // Course nicknames state
    const [courseNicknames, setCourseNicknames] = useState([]);

    // Hover state for split control
    const [hoveredSlot, setHoveredSlot] = useState(null); // { day, start }

    // Pending booking return state
    const [pendingBookingReturn, setPendingBookingReturn] = useState(null);

    // Batch selection options
    const batchOptions = ['CSE 24', 'SWE 24', 'CSE 23', 'SWE 23', 'CSE 22', 'SWE 22', 'CSE 21', 'SWE 21'];

    const isAdmin = user?.role === 'admin' || user?.role === 'super-admin';
    const isCR = user?.role === 'cr';
    const canEdit = isAdmin || isCR;

    // Debug logging
    useEffect(() => {
        console.log('ViewSemesterSchedule - User:', user);
        console.log('ViewSemesterSchedule - isAdmin:', isAdmin, 'isCR:', isCR, 'canEdit:', canEdit);
        console.log('ViewSemesterSchedule - courseNicknames:', courseNicknames);
    }, [user, courseNicknames]);

    // Days and Time Slots for the grid
    const days = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'];
    const timeSlots = [
        { start: '08:00', end: '09:15', label: '8:00 - 9:15' },
        { start: '09:15', end: '10:30', label: '9:15 - 10:30' },
        { start: '10:30', end: '11:45', label: '10:30 - 11:45' },
        { start: '11:45', end: '13:00', label: '11:45 - 1:00' },
        { start: '14:30', end: '15:45', label: '2:30 - 3:45' },
        { start: '15:45', end: '17:00', label: '3:45 - 5:00' },
    ];

    // Calculate week start date from offset
    const getWeekStartDate = (offset = 0) => {
        const today = new Date();
        const day = today.getDay();
        const diff = today.getDate() - day; // Get to Sunday
        const weekStart = new Date(today.setDate(diff));
        weekStart.setHours(0, 0, 0, 0);
        weekStart.setDate(weekStart.getDate() + (offset * 7));
        return weekStart;
    };

    // Format week display
    const getWeekDisplay = (offset) => {
        if (offset === 0) {
            return 'Base Template';
        }

        const weekStart = getWeekStartDate(offset - 1);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 6);

        const formatDate = (date) => {
            const month = date.toLocaleString('default', { month: 'short' });
            const day = date.getDate();
            return `${month} ${day}`;
        };

        if (offset === 1) {
            return `This Week (${formatDate(weekStart)} - ${formatDate(weekEnd)})`;
        }
        return `Week ${offset} (${formatDate(weekStart)} - ${formatDate(weekEnd)})`;
    };

    useEffect(() => {
        fetchPages();
        fetchRooms();
        fetchCourseNicknames();
    }, []);

    useEffect(() => {
        if (selectedPage && exists) {
            fetchSchedules();
        }
    }, [selectedPage, weekOffset, exists]);

    useEffect(() => {
        if (pendingBookingReturn && !loadingSchedules && exists) {
            const { bookedRoom, returnDay, returnSlot, returnSubSlot, returnMode, returnEndTime, pendingBookingAction, savedFormData, savedBatch } = pendingBookingReturn;

            const slot = timeSlots.find(s => s.start === returnSlot);
            if (slot) {
                // Open modal first with minimal setup
                setSelectedSlot({
                    day: returnDay,
                    start: slot.start,
                    end: slot.end,
                    label: slot.label,
                    subSlotIndex: parseInt(returnSubSlot) || 0,
                    totalSubSlots: 1
                });
                setModalMode(returnMode || 'create');

                // Restore form data with booked room, saved batch, and returned end time
                const { _pageNumber, _weekOffset, _savedBatch, ...cleanFormData } = savedFormData;
                setFormData({
                    ...cleanFormData,
                    batch: savedBatch,
                    roomNumber: bookedRoom,
                    endTime: returnEndTime || cleanFormData.endTime || slot.end,
                    roomAlreadyBooked: true,
                    pendingBookingAction: pendingBookingAction,
                    privateBooking: weekOffset !== 0 // Flag for UI note
                });

                // Fetch courses for the batch selection if it exists
                if (cleanFormData.batchSelection) {
                    fetchCourses(cleanFormData.batchSelection);
                }

                setShowModal(true);

                // Clear localStorage and pending state
                localStorage.removeItem('semesterScheduleFormData');
                setPendingBookingReturn(null);
            }
        }
    }, [pendingBookingReturn, loadingSchedules, schedules]);

    const fetchSchedules = async () => {
        try {
            setLoadingSchedules(true);
            const weekStart = weekOffset >= 1 ? getWeekStartDate(weekOffset - 1) : null;
            const response = await getSemesterSchedule(selectedPage, weekStart?.toISOString());
            console.log('API returned schedules:', response.data.schedules.length, 'items');
            console.log('Monday 08:00 schedules:', response.data.schedules.filter(s => s.day === 'Monday' && s.timeSlot.start === '08:00'));
            setSchedules(response.data.schedules || []);
            setCurrentWeekStart(weekStart);
            setLoadingSchedules(false);
        } catch (err) {
            console.error('Failed to load schedules:', err);
            setSchedules([]);
            setLoadingSchedules(false);
        }
    };

    const fetchRooms = async () => {
        try {
            setLoadingRooms(true);
            const response = await getRooms();
            // Filter out DEMO-101
            const filteredRooms = (response.data.rooms || []).filter(room => room !== 'DEMO-101');
            setRooms(filteredRooms);
            setLoadingRooms(false);
        } catch (err) {
            console.error('Failed to load rooms:', err);
            setRooms([]);
            setLoadingRooms(false);
        }
    };

    const fetchCourses = async (batchSelection) => {
        if (!batchSelection) {
            setCourses([]);
            return;
        }
        try {
            setLoadingCourses(true);
            const response = await getCoursesByBatch(batchSelection);
            setCourses(response.data.courses || []);
            setLoadingCourses(false);
        } catch (err) {
            console.error('Failed to load courses:', err);
            setCourses([]);
            setLoadingCourses(false);
        }
    };

    const fetchCourseNicknames = async () => {
        try {
            console.log('Fetching course nicknames...');
            const response = await getCourseNicknames();
            console.log('Course nicknames response:', response.data);
            setCourseNicknames(response.data.nicknames || []);
        } catch (err) {
            console.error('Failed to load course nicknames:', err);
            setCourseNicknames([]);
        }
    };

    const fetchPages = async () => {
        try {
            setLoading(true);
            const response = await getSemesterPages();
            setPages(response.data.pages);
            setTotalPages(response.data.totalPages);
            setExists(response.data.exists);
            if (response.data.totalPages > 0) {
                // Preserve current selectedPage if it's valid, otherwise default to 1
                const currentParams = new URLSearchParams(window.location.search);
                const urlPage = parseInt(currentParams.get('pageNumber'));

                setSelectedPage(prev => {
                    if (urlPage && urlPage <= response.data.totalPages) return urlPage;
                    // If no URL page, check for user preference
                    if (user?.preferredSemesterPage && user.preferredSemesterPage <= response.data.totalPages) {
                        return user.preferredSemesterPage;
                    }
                    if (prev > 1 && prev <= response.data.totalPages) return prev;
                    return 1;
                });
            }
            setLoading(false);
        } catch (err) {
            setError('Failed to load semester pages');
            setLoading(false);
        }
    };

    const handlePrevPage = () => {
        if (selectedPage > 1) {
            setSelectedPage(selectedPage - 1);
        }
    };

    const handleNextPage = () => {
        if (selectedPage < totalPages) {
            setSelectedPage(selectedPage + 1);
        }
    };

    const getCurrentPageInfo = () => {
        const pageData = pages.find(p => p.pageNumber === selectedPage);
        return pageData?.fullText || `Page ${selectedPage}`;
    };

    const handleEditBatchName = (pageNumber, currentName) => {
        setEditingPage(pageNumber);
        setEditValue(currentName);
    };

    const handleSaveBatchName = async (pageNumber) => {
        if (!editValue.trim()) {
            setError('Batch name cannot be empty');
            return;
        }

        try {
            setSaving(true);
            await updateSemesterPageBatchName(pageNumber, editValue);

            // Update local state
            setPages(pages.map(p =>
                p.pageNumber === pageNumber
                    ? { ...p, fullText: editValue.trim() }
                    : p
            ));

            setEditingPage(null);
            setEditValue('');
            setError('');
        } catch (err) {
            setError('Failed to update batch name');
        } finally {
            setSaving(false);
        }
    };

    const handleCancelEdit = () => {
        setEditingPage(null);
        setEditValue('');
    };

    const handleDeletePage = async (pageNumber) => {
        if (!confirm(`Are you sure you want to delete page ${pageNumber}?`)) {
            return;
        }

        try {
            setLoading(true);
            await deleteSemesterPage(pageNumber);

            // Refresh pages
            await fetchPages();

            // Adjust selected page if necessary
            if (selectedPage === pageNumber && totalPages > 1) {
                setSelectedPage(Math.min(selectedPage, totalPages - 1));
            }
        } catch (err) {
            setError('Failed to delete page');
            setLoading(false);
        }
    };

    // Helper: Calculate actual date for a day in the current week
    const calculateDateForSlot = (day, weekOffsetValue = weekOffset) => {
        const weekStart = getWeekStartDate(weekOffsetValue >= 1 ? weekOffsetValue - 1 : 0);
        const dayMap = { 'Sunday': 0, 'Monday': 1, 'Tuesday': 2, 'Wednesday': 3, 'Thursday': 4, 'Friday': 5, 'Saturday': 6 };
        const targetDate = new Date(weekStart);
        targetDate.setDate(targetDate.getDate() + dayMap[day]);

        // Return YYYY-MM-DD in LOCAL time to avoid timezone shift issues with toISOString()
        const year = targetDate.getFullYear();
        const month = String(targetDate.getMonth() + 1).padStart(2, '0');
        const date = String(targetDate.getDate()).padStart(2, '0');
        return `${year}-${month}-${date}`;
    };

    // Helper: Handle return from room booking
    useEffect(() => {
        const params = new URLSearchParams(location.search);
        const bookedRoom = params.get('bookedRoom');
        const returnDay = params.get('day');
        const returnSlot = params.get('slot');
        const returnSubSlot = params.get('subSlot');
        const returnEndTime = params.get('endTime');
        const returnMode = params.get('mode');
        const pendingBookingAction = params.get('pendingBookingAction');

        if (bookedRoom && returnDay && returnSlot) {
            // Restore saved form data from localStorage
            const savedFormData = localStorage.getItem('semesterScheduleFormData');

            if (savedFormData) {
                const restoredData = JSON.parse(savedFormData);

                // Restore page and week first
                if (restoredData._pageNumber && restoredData._pageNumber !== selectedPage) {
                    setSelectedPage(restoredData._pageNumber);
                }
                if (restoredData._weekOffset !== undefined && restoredData._weekOffset !== weekOffset) {
                    setWeekOffset(restoredData._weekOffset);
                }

                // Store pending return to process after schedules load
                setPendingBookingReturn({
                    bookedRoom,
                    returnDay,
                    returnSlot,
                    returnSubSlot,
                    returnMode,
                    returnEndTime,
                    pendingBookingAction,
                    savedFormData: restoredData,
                    savedBatch: restoredData._savedBatch || getCurrentPageInfo()
                });
            }

            // Clean up URL
            navigate(location.pathname, { replace: true });
        }
    }, [location.search]);

    // Schedule Grid Helper Functions
    const getScheduleForSlot = (day, slotStart, slotEnd) => {
        const exactMatch = schedules.find(s =>
            s.semesterPageNumber === selectedPage &&
            s.day === day &&
            s.timeSlot.start === slotStart
        );

        if (exactMatch) return exactMatch;

        return schedules.find(s =>
            s.semesterPageNumber === selectedPage &&
            s.day === day &&
            s.timeSlot.start < slotStart &&
            s.timeSlot.end > slotStart
        );
    };

    // Get all sub-slots for a given time slot
    const getSubSlotsForSlot = (day, slotStart) => {
        const subSlots = schedules.filter(s =>
            s.semesterPageNumber === selectedPage &&
            s.day === day &&
            s.timeSlot.start === slotStart
        );

        // Sort by subSlotIndex
        return subSlots.sort((a, b) => (a.subSlotIndex || 0) - (b.subSlotIndex || 0));
    };

    // Get current totalSubSlots for a time slot
    const getTotalSubSlots = (day, slotStart) => {
        const subSlots = getSubSlotsForSlot(day, slotStart);
        return subSlots.length > 0 ? (subSlots[0].totalSubSlots || 1) : 1;
    };

    // Handle slot split
    const handleSplitSlot = async (day, slot) => {
        const currentTotal = getTotalSubSlots(day, slot.start);
        const nextTotal = currentTotal === 1 ? 2 : currentTotal === 2 ? 4 : 1;

        console.log(`Splitting slot ${day} ${slot.start}: ${currentTotal} → ${nextTotal}`);

        try {
            const response = await splitSemesterSlot(selectedPage, {
                day,
                timeSlot: { start: slot.start, end: slot.end },
                newTotalSubSlots: nextTotal,
                isTemplate: weekOffset === 0,
                weekStartDate: weekOffset >= 1 ? getWeekStartDate(weekOffset - 1).toISOString() : null
            });

            console.log('Split response:', response.data);

            await fetchSchedules();
        } catch (err) {
            console.error('Failed to split slot:', err);
            setError('Failed to split slot');
        }
    };

    const getColSpan = (schedule, currentIndex) => {
        if (!schedule) return 1;
        let span = 1;
        const endTime = schedule.timeSlot.end;

        for (let i = currentIndex + 1; i < timeSlots.length; i++) {
            if (timeSlots[i].end <= endTime) {
                span++;
            } else {
                break;
            }
        }
        return span;
    };

    // Handle slot click - open modal
    const handleSlotClick = (day, slot, schedule, subSlotIndex = 0, totalSubSlots = 1) => {
        console.log('handleSlotClick called:', { day, slotStart: slot.start, schedule: schedule?._id, subSlotIndex, totalSubSlots, hasSchedule: !!schedule });
        if (!canEdit) {
            console.log('Edit blocked - canEdit is false');
            return; // Only CR/Admin can edit
        }

        setSelectedSlot({
            day,
            start: slot.start,
            end: slot.end,
            label: slot.label,
            subSlotIndex,
            totalSubSlots
        });

        const currentBatch = getCurrentPageInfo(); // Pre-fill with page batch name

        // Auto-detect batch selection based on user role
        let defaultBatchSelection = '';
        if (isCR && user?.batch) {
            // Extract year from CR batch (e.g., "22" from user.batch)
            const yearMatch = user.batch.match(/(\d+)/);
            if (yearMatch) {
                defaultBatchSelection = `CSE ${yearMatch[1]}`;
            }
        }

        if (schedule) {
            console.log('Opening in EDIT mode for schedule:', schedule._id);
            setModalMode('edit');
            const editBatchSelection = schedule.batchSelection || defaultBatchSelection;
            setFormData({
                id: schedule._id,
                course: schedule.course || '',
                courseNickname: schedule.courseNickname || '',
                section: schedule.section || '',
                batch: schedule.batch || currentBatch,
                batchSelection: editBatchSelection,
                teacher: schedule.teacher || '',
                endTime: schedule.timeSlot.end,
                status: schedule.status || 'active',
                statusNote: schedule.statusNote || '',
                roomAlreadyBooked: !!(schedule.roomNumber),
                bookingId: schedule.bookingId || null,
                pendingBookingAction: null
            });
            // Fetch courses for the batch selection
            fetchCourses(editBatchSelection);
        } else {
            console.log('Opening in CREATE mode');
            setModalMode('create');
            setFormData({
                course: '',
                courseNickname: '',
                section: '',
                batch: currentBatch, // Auto-fill from page batch
                batchSelection: defaultBatchSelection,
                teacher: '',
                roomNumber: '',
                endTime: slot.end,
                status: 'active',
                statusNote: '',
                roomAlreadyBooked: false,
                bookingId: null,
                pendingBookingAction: null
            });
            // Fetch courses for default batch selection
            fetchCourses(defaultBatchSelection);
        }
        setShowModal(true);
    };

    // Save schedule entry
    const handleSave = async () => {
        console.log('handleSave called - modalMode:', modalMode, 'formData.id:', formData.id);

        if (!formData.course.trim()) {
            setError('Course name is required');
            return;
        }

        if (!formData.roomAlreadyBooked && !formData.roomNumber) {
            setError('Please book a room or check "Room Already Booked" to manually select');
            return;
        }

        setSaving(true);
        setError('');

        try {
            let currentBookingId = formData.bookingId;

            // 1. Handle Room Booking Synchronization
            if (formData.pendingBookingAction === 'create' && formData.roomNumber) {
                if (weekOffset === 0) {
                    console.log('Template entry: Room will be occupied via recurring routine, no specific booking doc needed.');
                    currentBookingId = null;
                } else {
                    console.log('Finalizing room booking for specific week...');
                    try {
                        const bookingResponse = await createBooking({
                            roomNumber: formData.roomNumber,
                            date: calculateDateForSlot(selectedSlot.day),
                            timeSlot: {
                                start: selectedSlot.start,
                                end: formData.endTime || selectedSlot.end
                            },
                            batch: formData.batch,
                            purpose: formData.course
                        });
                        currentBookingId = bookingResponse.data.booking._id;
                        console.log('Room booking confirmed:', currentBookingId);
                    } catch (bookingErr) {
                        console.error('Failed to create room booking:', bookingErr);
                        setError('Room booking failed: ' + (bookingErr.response?.data?.error || bookingErr.message));
                        setSaving(false);
                        return;
                    }
                }
            } else if (modalMode === 'edit' && formData.status === 'cancelled' && formData.bookingId) {
                // Automatically cancel booking if class is cancelled
                console.log('Class cancelled - cancelling associated room booking:', formData.bookingId);
                try {
                    await deleteBooking(formData.bookingId);
                    currentBookingId = null; // Unlink after cancellation
                } catch (cancelErr) {
                    console.error('Failed to cancel associated booking:', cancelErr);
                    // Continue anyway, just log it
                }
            }

            // 2. Save Schedule Entry
            if (modalMode === 'create') {
                const scheduleData = {
                    day: selectedSlot.day,
                    timeSlot: {
                        start: selectedSlot.start,
                        end: formData.endTime || selectedSlot.end
                    },
                    course: formData.course,
                    courseNickname: formData.courseNickname,
                    section: formData.section,
                    batch: formData.batch,
                    teacher: formData.teacher,
                    roomNumber: weekOffset === 0 ? formData.roomNumber : '', // Only save room for Base Template
                    status: formData.status,
                    statusNote: formData.statusNote,
                    subSlotIndex: selectedSlot.subSlotIndex || 0,
                    totalSubSlots: selectedSlot.totalSubSlots || 1,
                    isTemplate: weekOffset === 0,
                    weekStartDate: weekOffset >= 1 ? getWeekStartDate(weekOffset - 1).toISOString() : null,
                    bookingId: currentBookingId
                };

                console.log('Creating schedule entry:', scheduleData);
                await createSemesterEntry(selectedPage, scheduleData);
            } else {
                await updateSemesterEntry(formData.id, {
                    course: formData.course,
                    courseNickname: formData.courseNickname,
                    section: formData.section,
                    batch: formData.batch,
                    teacher: formData.teacher,
                    roomNumber: weekOffset === 0 ? formData.roomNumber : '',
                    status: formData.status,
                    statusNote: formData.statusNote,
                    timeSlot: { end: formData.endTime },
                    currentWeekStartDate: weekOffset >= 1 ? getWeekStartDate(weekOffset - 1).toISOString() : null,
                    bookingId: currentBookingId
                });
            }

            setShowModal(false);
            console.log('Entry saved, refreshing schedules...');
            await fetchSchedules();

            // Refresh course nicknames if a new nickname was added
            if (formData.courseNickname && formData.courseNickname.trim()) {
                fetchCourseNicknames();
            }
        } catch (err) {
            setError(err.response?.data?.error || 'Failed to save schedule');
        } finally {
            setSaving(false);
        }
    };

    // Delete schedule entry
    const handleDelete = async () => {
        if (!formData.id) return;
        if (!window.confirm('Are you sure you want to delete this entry?')) return;

        setSaving(true);
        try {
            // Delete associated room booking if it exists
            if (formData.bookingId) {
                console.log('Deleting entry - cancelling associated room booking:', formData.bookingId);
                try {
                    await deleteBooking(formData.bookingId);
                } catch (bookingErr) {
                    console.error('Failed to cancel associated booking during deletion:', bookingErr);
                }
            }

            await deleteSemesterEntry(formData.id);
            setShowModal(false);
            fetchSchedules();
        } catch (err) {
            setError('Failed to delete schedule entry');
        } finally {
            setSaving(false);
        }
    };

    // Download PDF
    const handleDownloadPDF = () => {
        const link = document.createElement('a');
        link.href = getSemesterPageUrl(selectedPage);
        link.download = `semester-schedule-page-${selectedPage}.pdf`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
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
                        Semester-wise Schedule
                    </h1>
                    <p className="text-slate-500">View class routines by batch and section</p>
                </div>
            </div>

            {error && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                    {error}
                </div>
            )}

            {!exists || totalPages === 0 ? (
                <div className="text-center p-12 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200">
                    <Calendar size={48} className="mx-auto text-slate-400 mb-4" />
                    <p className="text-slate-500 text-lg">No semester schedules found. Please upload a semester-wise PDF first.</p>
                </div>
            ) : (
                <div className="space-y-4">
                    {/* Page Navigation Tabs */}
                    <div className="glass-card rounded-xl p-4 border border-slate-100">
                        <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                                <FileText size={20} className="text-primary-600" />
                                <span className="font-semibold text-slate-700">
                                    {getCurrentPageInfo()}
                                </span>
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={handlePrevPage}
                                    disabled={selectedPage === 1}
                                    className={`p-2 rounded-lg transition-all ${selectedPage === 1
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                        : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                                        }`}
                                >
                                    <ChevronLeft size={20} />
                                </button>
                                <span className="text-sm text-slate-600 min-w-[80px] text-center">
                                    Page {selectedPage} of {totalPages}
                                </span>
                                <button
                                    onClick={handleNextPage}
                                    disabled={selectedPage === totalPages}
                                    className={`p-2 rounded-lg transition-all ${selectedPage === totalPages
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                        : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                                        }`}
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        </div>

                        {/* Page Tabs with Batch Names */}
                        <div className="flex flex-wrap gap-2">
                            {pages.map((pageData) => {
                                const pageNum = pageData.pageNumber;
                                const displayLabel = pageData?.fullText || `Page ${pageNum}`;
                                const isLongLabel = displayLabel.length > 20;
                                const isEditing = editingPage === pageNum;

                                return (
                                    <div key={pageNum} className="relative group">
                                        {isEditing ? (
                                            <div className="flex items-center gap-1 p-2 bg-white border-2 border-primary-500 rounded-lg shadow-lg">
                                                <input
                                                    type="text"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    className="w-40 px-2 py-1 text-sm border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                                                    autoFocus
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleSaveBatchName(pageNum);
                                                        if (e.key === 'Escape') handleCancelEdit();
                                                    }}
                                                />
                                                <button
                                                    onClick={() => handleSaveBatchName(pageNum)}
                                                    disabled={saving}
                                                    className="p-1 text-green-600 hover:bg-green-50 rounded disabled:opacity-50"
                                                    title="Save"
                                                >
                                                    <Save size={16} />
                                                </button>
                                                <button
                                                    onClick={handleCancelEdit}
                                                    className="p-1 text-red-600 hover:bg-red-50 rounded"
                                                    title="Cancel"
                                                >
                                                    <X size={16} />
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                <button
                                                    onClick={() => setSelectedPage(pageNum)}
                                                    className={`px-3 py-2 rounded-lg font-medium transition-all text-sm ${selectedPage === pageNum
                                                        ? 'bg-gradient-to-r from-primary-600 to-secondary-600 text-white shadow-lg'
                                                        : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                                        } ${isLongLabel ? 'max-w-[200px]' : ''}`}
                                                    title={`${displayLabel} (Page ${pageNum})`}
                                                >
                                                    <div className="flex flex-col items-start">
                                                        <span className={isLongLabel ? 'truncate w-full' : ''}>
                                                            {displayLabel}
                                                        </span>
                                                        <span className={`text-xs ${selectedPage === pageNum ? 'text-white/80' : 'text-slate-500'
                                                            }`}>
                                                            p.{pageNum}
                                                        </span>
                                                    </div>
                                                </button>
                                                {isAdmin && (
                                                    <div className="absolute -top-2 -right-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleEditBatchName(pageNum, displayLabel);
                                                            }}
                                                            className="p-1 bg-blue-500 text-white rounded-full shadow-lg hover:bg-blue-600"
                                                            title="Edit batch name"
                                                        >
                                                            <Edit2 size={12} />
                                                        </button>
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleDeletePage(pageNum);
                                                            }}
                                                            className="p-1 bg-red-500 text-white rounded-full shadow-lg hover:bg-red-600"
                                                            title="Delete page"
                                                        >
                                                            <Trash2 size={12} />
                                                        </button>
                                                    </div>
                                                )}
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* Week Navigation */}
                    <div className={`glass-card rounded-xl p-4 border ${weekOffset === 1 ? 'border-green-300 bg-green-50/30' : 'border-slate-100'}`}>
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                                <Calendar size={20} className={weekOffset === 1 ? 'text-green-600' : 'text-primary-600'} />
                                <span className="font-semibold text-slate-700">
                                    {getWeekDisplay(weekOffset)}
                                </span>
                                {weekOffset === 0 && (
                                    <>
                                        <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full font-medium">
                                            Default schedule template
                                        </span>
                                        <span className="text-xs text-slate-500 italic ml-2">
                                            Input class routine of your class here
                                        </span>
                                    </>
                                )}
                                {weekOffset === 1 && (
                                    <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-medium flex items-center gap-1">
                                        <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse"></span>
                                        Current Week
                                    </span>
                                )}
                                {weekOffset >= 2 && (
                                    <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-medium">
                                        Upcoming Week
                                    </span>
                                )}
                            </div>
                            <div className="flex items-center gap-2">
                                <button
                                    onClick={() => setWeekOffset(Math.max(user?.role === 'admin' || user?.role === 'cr' ? 0 : 1, weekOffset - 1))}
                                    disabled={weekOffset === 0 || (weekOffset === 1 && user?.role !== 'admin' && user?.role !== 'cr')}
                                    className={`px-3 py-1.5 rounded-lg transition-all text-sm font-medium ${weekOffset === 0 || (weekOffset === 1 && user?.role !== 'admin' && user?.role !== 'cr')
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                        : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                                        }`}
                                >
                                    ← Previous Week
                                </button>
                                <button
                                    onClick={() => setWeekOffset(Math.min(8, weekOffset + 1))}
                                    disabled={weekOffset === 8}
                                    className={`px-3 py-1.5 rounded-lg transition-all text-sm font-medium ${weekOffset === 8
                                        ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                        : 'bg-primary-100 text-primary-700 hover:bg-primary-200'
                                        }`}
                                >
                                    Next Week →
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Current Week Banner */}
                    {weekOffset === 1 && (
                        <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-4 shadow-md border border-green-400">
                            <div className="flex items-center gap-3 text-white">
                                <Calendar size={24} className="flex-shrink-0" />
                                <div>
                                    <p className="font-bold text-lg">📅 Viewing Current Week's Schedule</p>
                                    <p className="text-sm text-green-50">
                                        {new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })} - You are viewing this week's active schedule
                                    </p>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Schedule Grid */}
                    {loadingSchedules ? (
                        <div className="flex items-center justify-center p-12">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
                        </div>
                    ) : (
                        <div className="glass-card rounded-xl overflow-hidden shadow-lg border border-slate-100">
                            <div className="bg-gradient-to-r from-primary-600 to-secondary-600 p-4">
                                <h2 className="text-white font-bold text-lg">
                                    Class Schedule - {getCurrentPageInfo()}
                                </h2>
                                {canEdit && (
                                    <p className="text-white/80 text-sm mt-1">
                                        Click on any time slot to add or edit course information
                                    </p>
                                )}
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse min-w-[1000px]">
                                    <thead>
                                        <tr className="bg-slate-50/80 backdrop-blur">
                                            <th className="p-4 text-left font-semibold text-slate-600 border-b border-r sticky left-0 bg-slate-50 z-10 w-32">Day</th>
                                            {timeSlots.map((slot, index) => (
                                                <React.Fragment key={slot.start}>
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
                                            let skipUntilIndex = -1;
                                            const today = new Date().toLocaleDateString('en-US', { weekday: 'long' });
                                            const isToday = weekOffset === 1 && day === today;

                                            return (
                                                <tr key={day} className={`transition-colors ${isToday ? 'bg-green-50/50 hover:bg-green-50' : 'hover:bg-slate-50/50'}`}>
                                                    <td className={`p-4 font-medium border-r border-b sticky left-0 z-10 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)] ${isToday ? 'bg-green-100 text-green-800' : 'text-slate-700 bg-white'}`}>
                                                        <div className="flex items-center gap-2">
                                                            {day}
                                                            {isToday && (
                                                                <span className="px-2 py-0.5 text-xs font-semibold bg-green-500 text-white rounded-full">
                                                                    Today
                                                                </span>
                                                            )}
                                                        </div>
                                                    </td>

                                                    {timeSlots.map((slot, index) => {
                                                        const breakGap = index === 4 ? (
                                                            <td key={`break-${day}`} className="border-b bg-slate-100/50 relative">
                                                                {day === 'Monday' && (
                                                                    <div className="absolute inset-0 flex items-center justify-center writing-vertical-lr text-slate-400 font-bold tracking-widest uppercase text-xs opacity-50 h-[400px]">
                                                                        Lunch & Prayer
                                                                    </div>
                                                                )}
                                                            </td>
                                                        ) : null;

                                                        if (index <= skipUntilIndex) return breakGap;

                                                        const schedule = getScheduleForSlot(day, slot.start);
                                                        const colSpan = getColSpan(schedule, index);

                                                        if (colSpan > 1) {
                                                            skipUntilIndex = index + colSpan - 1;
                                                        }

                                                        // Get all sub-slots for this time slot
                                                        const subSlots = getSubSlotsForSlot(day, slot.start);
                                                        const totalSubSlots = getTotalSubSlots(day, slot.start);
                                                        const isHovered = hoveredSlot?.day === day && hoveredSlot?.start === slot.start;

                                                        // Debug: Log if this slot has sub-slots
                                                        if (totalSubSlots > 1 && day === 'Monday' && slot.start === '08:00') {
                                                            console.log('Rendering Monday 08:00 - totalSubSlots:', totalSubSlots, 'subSlots:', subSlots);
                                                        }

                                                        return (
                                                            <React.Fragment key={slot.start}>
                                                                {breakGap}
                                                                <td
                                                                    colSpan={colSpan}
                                                                    className={`p-0 border-b border-r border-slate-100 h-32 align-top relative ${colSpan > 1 ? 'z-20' : ''}`}
                                                                    onMouseEnter={() => canEdit && setHoveredSlot({ day, start: slot.start })}
                                                                    onMouseLeave={() => canEdit && setHoveredSlot(null)}
                                                                >
                                                                    {/* Split Control Icon */}
                                                                    {canEdit && isHovered && (
                                                                        <button
                                                                            onClick={(e) => {
                                                                                e.stopPropagation();
                                                                                handleSplitSlot(day, slot);
                                                                            }}
                                                                            className="absolute top-1 right-1 z-30 bg-white hover:bg-indigo-50 border border-indigo-200 rounded p-1 shadow-sm transition-colors"
                                                                            title={`Split: ${totalSubSlots === 1 ? '1→2' : totalSubSlots === 2 ? '2→4' : '4→1'}`}
                                                                        >
                                                                            <svg className="w-4 h-4 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                                                                            </svg>
                                                                        </button>
                                                                    )}

                                                                    {/* Render sub-slots */}
                                                                    <div className="h-full flex flex-col">
                                                                        {Array.from({ length: totalSubSlots }).map((_, subIndex) => {
                                                                            const subSlot = subSlots.find(s => (s.subSlotIndex || 0) === subIndex);
                                                                            const hasContent = !!(subSlot && subSlot.course);

                                                                            return (
                                                                                <div
                                                                                    key={subIndex}
                                                                                    className={`flex-1 ${subIndex < totalSubSlots - 1 ? 'border-b border-slate-200' : ''} ${canEdit ? 'cursor-pointer hover:bg-slate-50' : ''} transition-colors`}
                                                                                    style={{ minHeight: totalSubSlots === 4 ? '32px' : totalSubSlots === 2 ? '64px' : '128px' }}
                                                                                    onClick={() => canEdit && handleSlotClick(day, slot, subSlot, subIndex, totalSubSlots)}
                                                                                >
                                                                                    {hasContent ? (
                                                                                        <div className={`border rounded-lg p-2 h-full m-1 transition-all ${canEdit ? 'hover:shadow-md' : ''} ${subSlot.status === 'cancelled'
                                                                                            ? 'bg-red-50 hover:bg-red-100 border-red-200'
                                                                                            : subSlot.status === 'rescheduled'
                                                                                                ? 'bg-amber-50 hover:bg-amber-100 border-amber-200'
                                                                                                : colSpan > 1
                                                                                                    ? 'bg-indigo-50 hover:bg-indigo-100 border-indigo-100'
                                                                                                    : 'bg-primary-50 hover:bg-primary-100 border-primary-100'
                                                                                            }`}>
                                                                                            {(subSlot.status === 'cancelled' || subSlot.status === 'rescheduled') && (
                                                                                                <div className="flex items-center gap-1 mb-1">
                                                                                                    <span className={`text-xs font-bold px-1 py-0.5 rounded ${subSlot.status === 'cancelled'
                                                                                                        ? 'bg-red-200 text-red-800'
                                                                                                        : 'bg-amber-200 text-amber-800'
                                                                                                        }`}>
                                                                                                        {subSlot.status === 'cancelled' ? '✗ CANCELLED' : '⟲ RESCHEDULED'}
                                                                                                    </span>
                                                                                                </div>
                                                                                            )}
                                                                                            {subSlot.course && (
                                                                                                <div className="flex items-start gap-1 mb-1">
                                                                                                    <BookOpen size={totalSubSlots === 4 ? 10 : 12} className={`mt-0.5 flex-shrink-0 ${subSlot.status === 'cancelled' ? 'text-red-500' :
                                                                                                        subSlot.status === 'rescheduled' ? 'text-amber-500' :
                                                                                                            'text-primary-500'
                                                                                                        }`} />
                                                                                                    <div className="flex-1 min-w-0">
                                                                                                        <div className="flex items-center justify-between gap-1">
                                                                                                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                                                                                <span className={`font-bold leading-tight truncate ${totalSubSlots === 4 ? 'text-xs' : 'text-sm'
                                                                                                                    } ${subSlot.status === 'cancelled' ? 'text-red-900 line-through' :
                                                                                                                        subSlot.status === 'rescheduled' ? 'text-amber-900' :
                                                                                                                            'text-primary-900'
                                                                                                                    }`} title={subSlot.course}>
                                                                                                                    {subSlot.course}
                                                                                                                </span>
                                                                                                                {subSlot.section && (
                                                                                                                    <span className={`font-medium leading-tight flex-shrink-0 ${totalSubSlots === 4 ? 'text-xs' : 'text-sm'
                                                                                                                        } ${subSlot.status === 'cancelled' ? 'text-red-700 line-through' :
                                                                                                                            subSlot.status === 'rescheduled' ? 'text-amber-700' :
                                                                                                                                'text-primary-700'
                                                                                                                        }`} title={subSlot.section}>
                                                                                                                        | {subSlot.section}
                                                                                                                    </span>
                                                                                                                )}
                                                                                                            </div>
                                                                                                            {(subSlot.roomNumber || (subSlot.bookingId && subSlot.bookingId.roomNumber)) && (
                                                                                                                <span className={`text-xs font-medium flex-shrink-0 flex items-center gap-1 ${subSlot.status === 'cancelled' ? 'text-red-600' :
                                                                                                                    subSlot.status === 'rescheduled' ? 'text-amber-600' :
                                                                                                                        'text-primary-600'
                                                                                                                    }`} title={(subSlot.roomNumber || subSlot.bookingId?.roomNumber) + (subSlot.bookingId ? ' (Week-specific booking)' : '')}>
                                                                                                                    {subSlot.bookingId && <Globe size={10} className="text-indigo-500" />}
                                                                                                                    {subSlot.roomNumber || subSlot.bookingId?.roomNumber}
                                                                                                                </span>
                                                                                                            )}
                                                                                                        </div>
                                                                                                        {subSlot.courseNickname && totalSubSlots <= 2 && (
                                                                                                            <p className={`text-xs italic mt-0.5 truncate ${subSlot.status === 'cancelled' ? 'text-red-600' :
                                                                                                                subSlot.status === 'rescheduled' ? 'text-amber-600' :
                                                                                                                    'text-primary-600'
                                                                                                                }`} title={subSlot.courseNickname}>
                                                                                                                "{subSlot.courseNickname}"
                                                                                                            </p>
                                                                                                        )}
                                                                                                    </div>
                                                                                                </div>
                                                                                            )}

                                                                                            {subSlot.teacher && totalSubSlots <= 2 && (
                                                                                                <div className="flex items-center gap-1 mb-1">
                                                                                                    <User size={10} className={`${subSlot.status === 'cancelled' ? 'text-red-400' :
                                                                                                        subSlot.status === 'rescheduled' ? 'text-amber-400' :
                                                                                                            'text-primary-400'
                                                                                                        }`} />
                                                                                                    <span className={`text-xs font-medium truncate ${subSlot.status === 'cancelled' ? 'text-red-600' :
                                                                                                        subSlot.status === 'rescheduled' ? 'text-amber-600' :
                                                                                                            'text-primary-600'
                                                                                                        }`} title={subSlot.teacher}>
                                                                                                        {subSlot.teacher}
                                                                                                    </span>
                                                                                                </div>
                                                                                            )}
                                                                                        </div>
                                                                                    ) : (
                                                                                        canEdit && (
                                                                                            <div className="h-full w-full flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                                                                                                <span className="text-xs text-primary-500 font-medium flex items-center gap-1 bg-primary-50 px-2 py-1 rounded-full">
                                                                                                    <Plus size={12} /> Add
                                                                                                </span>
                                                                                            </div>
                                                                                        )
                                                                                    )}
                                                                                </div>
                                                                            );
                                                                        })}
                                                                    </div>
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

                    {/* PDF Viewer */}
                    <div className="glass-card rounded-xl overflow-hidden shadow-lg border border-slate-100">
                        <div className="bg-slate-50 p-3 border-b border-slate-200">
                            <div className="flex items-center justify-between">
                                <span className="text-sm font-medium text-slate-600">
                                    PDF Reference: {getCurrentPageInfo()}
                                </span>
                                <div className="flex items-center gap-3">
                                    <button
                                        onClick={handleDownloadPDF}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm font-medium"
                                    >
                                        <Download size={16} />
                                        Download PDF
                                    </button>
                                    <a
                                        href={getSemesterPageUrl(selectedPage)}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                                    >
                                        Open in new tab ↗
                                    </a>
                                </div>
                            </div>
                        </div>
                        <div className="bg-slate-100" style={{ height: '600px' }}>
                            <embed
                                src={getSemesterPageUrl(selectedPage)}
                                type="application/pdf"
                                width="100%"
                                height="100%"
                                className="border-0"
                            />
                        </div>
                    </div>
                </div>
            )}

            {/* Manual Entry Modal */}
            {showModal && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-xl shadow-2xl max-w-md w-full animate-fade-in my-8 max-h-[90vh] flex flex-col">
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
                                {selectedSlot?.day} • {selectedSlot?.label} • {formData.batch || getCurrentPageInfo()}
                                {selectedSlot?.totalSubSlots > 1 && (
                                    <span className="ml-2 px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                                        Division {(selectedSlot.subSlotIndex || 0) + 1}/{selectedSlot.totalSubSlots}
                                    </span>
                                )}
                            </p>
                            {weekOffset === 0 && modalMode === 'create' && (
                                <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                                    <p className="text-xs text-blue-700 font-medium">
                                        📋 This entry will be added to the base template (applies to all weeks by default)
                                    </p>
                                </div>
                            )}
                            {weekOffset >= 1 && modalMode === 'create' && (
                                <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded-lg">
                                    <p className="text-xs text-amber-700 font-medium">
                                        ⚠ This entry will only apply to {getWeekDisplay(weekOffset)} (does not affect base template)
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="p-6 space-y-4 overflow-y-auto flex-1">
                            {error && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                                    {error}
                                </div>
                            )}

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Batch Selection (for course list)
                                </label>
                                <select
                                    value={formData.batchSelection}
                                    onChange={(e) => {
                                        setFormData({ ...formData, batchSelection: e.target.value, course: '' });
                                        fetchCourses(e.target.value);
                                    }}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                >
                                    <option value="">Select batch to load courses...</option>
                                    {batchOptions.map(batch => (
                                        <option key={batch} value={batch}>{batch}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-slate-500 mt-1">
                                    {isCR ? '✓ Auto-detected from your CR role' : 'Select to load available courses'}
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Course Name *
                                </label>
                                {loadingCourses ? (
                                    <div className="w-full px-4 py-2 border border-slate-200 rounded-lg bg-slate-50 text-slate-500">
                                        Loading courses...
                                    </div>
                                ) : courses.length > 0 ? (
                                    <select
                                        value={formData.course}
                                        onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                        required
                                    >
                                        <option value="">Select a course...</option>
                                        {courses.map((course, index) => (
                                            <option key={index} value={course}>
                                                {course}
                                            </option>
                                        ))}
                                    </select>
                                ) : (
                                    <input
                                        type="text"
                                        value={formData.course}
                                        onChange={(e) => setFormData({ ...formData, course: e.target.value })}
                                        placeholder="e.g., CSE 4307 or Programming Training"
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                    />
                                )}
                                {courses.length > 0 && (
                                    <p className="text-xs text-green-600 mt-1">
                                        ✓ {courses.length} courses loaded for {formData.batchSelection}
                                    </p>
                                )}
                                {courses.length === 0 && formData.batchSelection && !loadingCourses && (
                                    <p className="text-xs text-amber-600 mt-1">
                                        No courses found. Enter manually.
                                    </p>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Course Nickname (Optional)
                                </label>
                                <input
                                    type="text"
                                    list="nickname-suggestions"
                                    value={formData.courseNickname}
                                    onChange={(e) => setFormData({ ...formData, courseNickname: e.target.value })}
                                    placeholder="e.g., Programming, Data Structures"
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                />
                                <datalist id="nickname-suggestions">
                                    {courseNicknames.map((nickname, index) => (
                                        <option key={index} value={nickname} />
                                    ))}
                                </datalist>
                                <p className="text-xs text-slate-400 mt-1">
                                    Short name to display in schedule. Start typing to see suggestions.
                                </p>
                            </div>

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Section (Optional)
                                </label>
                                <input
                                    type="text"
                                    value={formData.section}
                                    onChange={(e) => setFormData({ ...formData, section: e.target.value })}
                                    placeholder="e.g., A, B, Section 1"
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                />
                                <p className="text-xs text-slate-400 mt-1">
                                    Section name for split slots (shown next to course name).
                                </p>
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
                                <label className="flex items-center gap-2 text-sm font-medium text-slate-700 mb-2">
                                    <input
                                        type="checkbox"
                                        checked={formData.roomAlreadyBooked}
                                        onChange={(e) => setFormData({ ...formData, roomAlreadyBooked: e.target.checked, roomNumber: e.target.checked ? formData.roomNumber : '' })}
                                        className="w-4 h-4 text-primary-600 border-slate-300 rounded focus:ring-primary-500"
                                    />
                                    Room Already Booked
                                </label>

                                {formData.roomAlreadyBooked ? (
                                    <div>
                                        <label className="block text-sm font-medium text-slate-700 mb-1">
                                            Room Number *
                                        </label>
                                        <select
                                            value={formData.roomNumber}
                                            onChange={(e) => setFormData({ ...formData, roomNumber: e.target.value })}
                                            className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                            required
                                        >
                                            <option value="">Select a room...</option>
                                            {rooms.map(room => (
                                                <option key={room} value={room}>{room}</option>
                                            ))}
                                        </select>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Manually select from available rooms
                                        </p>
                                        {formData.privateBooking && weekOffset !== 0 && (
                                            <div className="mt-2 p-2 bg-blue-50 border border-blue-200 rounded-lg">
                                                <div className="flex items-center gap-2 text-blue-700 font-medium text-xs">
                                                    <Info size={14} />
                                                    <span>This room will be privately booked for this week only.</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                // Save current form data with page, week, and batch info to localStorage
                                                const currentBatch = getCurrentPageInfo();
                                                localStorage.setItem('semesterScheduleFormData', JSON.stringify({
                                                    ...formData,
                                                    _pageNumber: selectedPage,
                                                    _weekOffset: weekOffset,
                                                    _savedBatch: currentBatch
                                                }));

                                                const slotDate = calculateDateForSlot(selectedSlot.day);
                                                const startTime = selectedSlot.start;
                                                const endTime = formData.endTime || selectedSlot.end;
                                                const returnUrl = `/view-semester?pageNumber=${selectedPage}&weekOffset=${weekOffset}&day=${selectedSlot.day}&slot=${selectedSlot.start}&subSlot=${selectedSlot.subSlotIndex}&mode=${modalMode}`;
                                                navigate(`/book?date=${slotDate}&startTime=${startTime}&endTime=${endTime}&returnTo=semester&returnUrl=${encodeURIComponent(returnUrl)}`);
                                            }}
                                            className="w-full px-4 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center justify-center gap-2"
                                        >
                                            <DoorOpen size={18} />
                                            Book Room for This Slot
                                        </button>
                                        <p className="text-xs text-slate-400 mt-1">
                                            Date: {calculateDateForSlot(selectedSlot?.day || 'Monday')} • Time: {selectedSlot?.start || '08:00'}
                                        </p>
                                    </div>
                                )}
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

                            <div>
                                <label className="block text-sm font-medium text-slate-700 mb-1">
                                    Class Status
                                </label>
                                <select
                                    value={formData.status}
                                    onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                    className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                >
                                    <option value="active">✓ Active (Normal)</option>
                                    <option value="cancelled">✗ Cancelled</option>
                                    <option value="rescheduled">⟲ Rescheduled</option>
                                </select>
                            </div>

                            {(formData.status === 'cancelled' || formData.status === 'rescheduled') && (
                                <div>
                                    <label className="block text-sm font-medium text-slate-700 mb-1">
                                        Reason/Note (Optional)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.statusNote}
                                        onChange={(e) => setFormData({ ...formData, statusNote: e.target.value })}
                                        placeholder="e.g., Teacher unavailable, Moved to next week"
                                        className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                                    />
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-slate-100 flex items-center justify-between gap-3 flex-shrink-0 bg-white rounded-b-xl">
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

export default ViewSemesterSchedule;
