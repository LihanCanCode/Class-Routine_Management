import React, { useState, useEffect } from 'react';
import { getQuizBookings } from '../services/api';
import { Calendar, Clock, MapPin, BookOpen, Users, Filter, X, FileText, MessageSquare } from 'lucide-react';

const ViewQuizSchedule = () => {
    const [bookings, setBookings] = useState([]);
    const [filteredBookings, setFilteredBookings] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedBatch, setSelectedBatch] = useState('All');
    const [error, setError] = useState('');
    const [selectedBooking, setSelectedBooking] = useState(null);
    const [showDetailsModal, setShowDetailsModal] = useState(false);

    const batchOptions = ['All', 'CSE 24', 'SWE 24', 'CSE 23', 'SWE 23', 'CSE 22', 'SWE 22', 'CSE 21', 'SWE 21', 'MSc(CSE)'];

    useEffect(() => {
        fetchQuizBookings();
    }, []);

    useEffect(() => {
        filterBookings();
    }, [selectedBatch, bookings]);

    const fetchQuizBookings = async () => {
        setLoading(true);
        setError('');
        try {
            // Get bookings for next 60 days
            const startDate = new Date();
            const endDate = new Date();
            endDate.setDate(endDate.getDate() + 60);

            const response = await getQuizBookings(
                startDate.toISOString().split('T')[0],
                endDate.toISOString().split('T')[0]
            );

            setBookings(response.data.bookings || []);
        } catch (err) {
            console.error('Failed to fetch quiz bookings:', err);
            setError('Failed to load quiz schedules');
        } finally {
            setLoading(false);
        }
    };

    const filterBookings = () => {
        if (selectedBatch === 'All') {
            setFilteredBookings(bookings);
        } else {
            setFilteredBookings(bookings.filter(booking => {
                // Handle both "CSE 24" and "24" formats
                const bookingBatch = booking.batch.trim();
                const selected = selectedBatch.trim();

                return bookingBatch === selected ||
                    bookingBatch === selected.split(' ')[1] ||
                    `CSE ${bookingBatch}` === selected ||
                    `SWE ${bookingBatch}` === selected;
            }));
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const options = { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    };

    const formatTime = (start, end) => {
        return `${start} - ${end}`;
    };

    const formatBatch = (batch) => {
        // If batch is just a number, prepend "CSE "
        if (batch && /^\d+$/.test(batch)) {
            return `CSE ${batch}`;
        }
        return batch;
    };

    const handleBookingClick = (booking) => {
        setSelectedBooking(booking);
        setShowDetailsModal(true);
    };

    // Group bookings by date
    const groupedBookings = filteredBookings.reduce((acc, booking) => {
        const dateKey = new Date(booking.date).toDateString();
        if (!acc[dateKey]) {
            acc[dateKey] = [];
        }
        acc[dateKey].push(booking);
        return acc;
    }, {});

    // Sort dates
    const sortedDates = Object.keys(groupedBookings).sort((a, b) =>
        new Date(a) - new Date(b)
    );

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <div className="w-16 h-16 border-4 border-primary-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-slate-600">Loading quiz schedules...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto py-8 px-4">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-4xl font-bold bg-gradient-to-r from-primary-600 to-secondary-600 bg-clip-text text-transparent mb-2">
                    Quiz Schedule
                </h1>
                <p className="text-slate-600">View upcoming quiz exams and room assignments</p>
            </div>

            {/* Batch Filter */}
            <div className="glass-card rounded-xl p-6 mb-6">
                <div className="flex items-center gap-4">
                    <Filter className="text-primary-600" size={20} />
                    <label className="text-sm font-medium text-slate-700">Filter by Batch:</label>
                    <div className="flex flex-wrap gap-2">
                        {batchOptions.map(batch => (
                            <button
                                key={batch}
                                onClick={() => setSelectedBatch(batch)}
                                className={`px-4 py-2 rounded-lg font-medium transition-all ${selectedBatch === batch
                                    ? 'bg-primary-500 text-white shadow-lg shadow-primary-500/30'
                                    : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                                    }`}
                            >
                                {batch}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="glass-card rounded-xl p-6 mb-6 border-l-4 border-red-500">
                    <p className="text-red-600">{error}</p>
                </div>
            )}

            {/* Quiz Bookings List */}
            {filteredBookings.length === 0 ? (
                <div className="glass-card rounded-xl p-12 text-center">
                    <Calendar className="w-16 h-16 text-slate-300 mx-auto mb-4" />
                    <h3 className="text-xl font-semibold text-slate-700 mb-2">
                        No Quiz Schedules Found
                    </h3>
                    <p className="text-slate-500">
                        {selectedBatch === 'All'
                            ? 'There are no upcoming quiz exams scheduled.'
                            : `No quiz exams scheduled for ${selectedBatch}.`
                        }
                    </p>
                </div>
            ) : (
                <div className="space-y-6">
                    {sortedDates.map(dateKey => (
                        <div key={dateKey} className="glass-card rounded-xl overflow-hidden">
                            {/* Date Header */}
                            <div className="bg-gradient-to-r from-primary-500 to-secondary-500 px-6 py-4">
                                <div className="flex items-center gap-3 text-white">
                                    <Calendar size={24} />
                                    <h2 className="text-xl font-bold">
                                        {formatDate(dateKey)}
                                    </h2>
                                </div>
                            </div>

                            {/* Quiz List for this date */}
                            <div className="divide-y divide-slate-200">
                                {groupedBookings[dateKey].map((booking, index) => (
                                    <div
                                        key={booking._id || index}
                                        onClick={() => handleBookingClick(booking)}
                                        className="p-6 hover:bg-slate-50 transition-colors cursor-pointer"
                                    >
                                        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                            {/* Time */}
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center">
                                                    <Clock className="text-blue-600" size={20} />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500 font-medium">Time</p>
                                                    <p className="text-sm font-semibold text-slate-700">
                                                        {formatTime(booking.timeSlot.start, booking.timeSlot.end)}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Room */}
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                                                    <MapPin className="text-green-600" size={20} />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500 font-medium">Room</p>
                                                    <p className="text-sm font-semibold text-slate-700">
                                                        {booking.roomNumber}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Course */}
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-purple-100 flex items-center justify-center">
                                                    <BookOpen className="text-purple-600" size={20} />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500 font-medium">Course</p>
                                                    <p className="text-sm font-semibold text-slate-700">
                                                        {booking.course}
                                                    </p>
                                                </div>
                                            </div>

                                            {/* Batch */}
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-lg bg-orange-100 flex items-center justify-center">
                                                    <Users className="text-orange-600" size={20} />
                                                </div>
                                                <div>
                                                    <p className="text-xs text-slate-500 font-medium">Batch</p>
                                                    <p className="text-sm font-semibold text-slate-700">
                                                        {formatBatch(booking.batch)}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Classtime Quiz Badge */}
                                        {booking.quizType === 'classtime' && (
                                            <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 bg-gradient-to-r from-purple-100 to-indigo-100 border border-purple-200 rounded-lg">
                                                <span className="text-purple-700 text-xs font-semibold">🎓 Classtime Quiz</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Summary */}
            {filteredBookings.length > 0 && (
                <div className="mt-6 text-center text-sm text-slate-600">
                    Showing {filteredBookings.length} quiz exam{filteredBookings.length !== 1 ? 's' : ''}
                    {selectedBatch !== 'All' && ` for ${selectedBatch}`}
                </div>
            )}

            {/* Details Modal */}
            {showDetailsModal && selectedBooking && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full animate-fade-in max-h-[90vh] overflow-y-auto">
                        <div className="p-6 border-b border-slate-100 sticky top-0 bg-white">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-bold text-slate-800">Quiz Details</h2>
                                <button
                                    onClick={() => setShowDetailsModal(false)}
                                    className="text-slate-400 hover:text-slate-600 transition-colors"
                                >
                                    <X size={24} />
                                </button>
                            </div>
                        </div>

                        <div className="p-6 space-y-6">
                            {/* Basic Info Grid */}
                            <div className="grid grid-cols-2 gap-4">
                                <div className="bg-blue-50 rounded-lg p-4">
                                    <div className="flex items-center gap-3 mb-2">
                                        <Calendar className="text-blue-600" size={20} />
                                        <p className="text-sm font-medium text-blue-900">Date</p>
                                    </div>
                                    <p className="text-lg font-semibold text-blue-700">
                                        {formatDate(selectedBooking.date)}
                                    </p>
                                </div>

                                <div className="bg-purple-50 rounded-lg p-4">
                                    <div className="flex items-center gap-3 mb-2">
                                        <Clock className="text-purple-600" size={20} />
                                        <p className="text-sm font-medium text-purple-900">Time</p>
                                    </div>
                                    <p className="text-lg font-semibold text-purple-700">
                                        {formatTime(selectedBooking.timeSlot.start, selectedBooking.timeSlot.end)}
                                    </p>
                                </div>

                                <div className="bg-green-50 rounded-lg p-4">
                                    <div className="flex items-center gap-3 mb-2">
                                        <MapPin className="text-green-600" size={20} />
                                        <p className="text-sm font-medium text-green-900">Room</p>
                                    </div>
                                    <p className="text-lg font-semibold text-green-700">
                                        {selectedBooking.roomNumber}
                                    </p>
                                </div>

                                <div className="bg-orange-50 rounded-lg p-4">
                                    <div className="flex items-center gap-3 mb-2">
                                        <Users className="text-orange-600" size={20} />
                                        <p className="text-sm font-medium text-orange-900">Batch</p>
                                    </div>
                                    <p className="text-lg font-semibold text-orange-700">
                                        {formatBatch(selectedBooking.batch)}
                                    </p>
                                </div>
                            </div>

                            {/* Course Info */}
                            <div className="bg-gradient-to-r from-primary-50 to-secondary-50 rounded-lg p-4 border border-primary-100">
                                <div className="flex items-center gap-3 mb-2">
                                    <BookOpen className="text-primary-600" size={24} />
                                    <p className="text-sm font-medium text-primary-900">Course</p>
                                    {selectedBooking.quizType === 'classtime' && (
                                        <span className="ml-auto px-2 py-1 bg-gradient-to-r from-purple-100 to-indigo-100 border border-purple-200 rounded text-xs font-semibold text-purple-700">
                                            🎓 Classtime
                                        </span>
                                    )}
                                </div>
                                <p className="text-xl font-bold text-primary-700">
                                    {selectedBooking.course || 'Not specified'}
                                </p>
                            </div>

                            {/* Syllabus */}
                            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                                <div className="flex items-center gap-3 mb-3">
                                    <FileText className="text-slate-600" size={20} />
                                    <p className="text-sm font-semibold text-slate-700">Syllabus Coverage</p>
                                </div>
                                <p className="text-slate-700 whitespace-pre-wrap leading-relaxed">
                                    {selectedBooking.syllabus || 'No syllabus specified'}
                                </p>
                            </div>

                            {/* Teacher Comment */}
                            <div className="bg-amber-50 rounded-lg p-4 border border-amber-200">
                                <div className="flex items-center gap-3 mb-3">
                                    <MessageSquare className="text-amber-600" size={20} />
                                    <p className="text-sm font-semibold text-amber-900">Teacher's Comment</p>
                                </div>
                                <p className="text-amber-800 whitespace-pre-wrap leading-relaxed italic">
                                    {selectedBooking.teacherComment ? `"${selectedBooking.teacherComment}"` : 'No comment provided'}
                                </p>
                            </div>

                            {/* Booked By Info */}
                            {selectedBooking.bookedBy && (
                                <div className="pt-4 border-t border-slate-200">
                                    <p className="text-xs text-slate-500">
                                        Booked by: <span className="font-medium text-slate-700">{selectedBooking.bookedBy.name}</span>
                                        {selectedBooking.createdAt && (
                                            <span className="ml-2">
                                                on {new Date(selectedBooking.createdAt).toLocaleDateString('en-US', {
                                                    year: 'numeric',
                                                    month: 'short',
                                                    day: 'numeric',
                                                    hour: '2-digit',
                                                    minute: '2-digit'
                                                })}
                                            </span>
                                        )}
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="p-6 border-t border-slate-100 bg-slate-50">
                            <button
                                onClick={() => setShowDetailsModal(false)}
                                className="w-full px-6 py-3 bg-primary-500 hover:bg-primary-600 text-white rounded-lg transition-colors font-medium"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ViewQuizSchedule;