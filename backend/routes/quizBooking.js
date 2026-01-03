const express = require('express');
const router = express.Router();
const QuizBooking = require('../models/QuizBooking');
const Room = require('../models/Room');
const auth = require('../middleware/auth');
const { authOrGuest } = require('../middleware/auth');

const Schedule = require('../models/Schedule');

// Quiz time slots (fixed)
const QUIZ_SLOTS = [
    { start: '13:30', end: '14:00', label: '1:30 - 2:00' },
    { start: '14:00', end: '14:30', label: '2:00 - 2:30' }
];

// Get quiz rooms config - fetch rooms from database
router.get('/config', async (req, res) => {
    try {
        const rooms = await Room.find({}).sort({ roomNumber: 1 });
        const roomNumbers = rooms.map(r => r.roomNumber);
        
        res.json({
            rooms: roomNumbers,
            timeSlots: QUIZ_SLOTS
        });
    } catch (error) {
        console.error('Get quiz config error:', error);
        res.json({
            rooms: [],
            timeSlots: QUIZ_SLOTS
        });
    }
});

// Get courses by batch from schedules
router.get('/courses-by-batch', auth, async (req, res) => {
    try {
        const { batch } = req.query;
        if (!batch) {
            return res.json({ courses: [] });
        }

        console.log('Fetching courses for batch:', batch);

        // Determine department and year from batch
        // Format can be "CSE 23", "SWE 22", or legacy "23", "22"
        let department = null;
        let year = null;
        
        const cseSweMatch = batch.match(/^(CSE|SWE)\s+(\d+)$/i);
        if (cseSweMatch) {
            department = cseSweMatch[1].toUpperCase();
            year = parseInt(cseSweMatch[2]);
        } else {
            const yearMatch = batch.match(/\d+/);
            if (yearMatch) {
                year = parseInt(yearMatch[0]);
                // Legacy format - include both CSE and SWE
                department = null;
            }
        }

        if (!year) {
            return res.json({ courses: [] });
        }

        // Map year to batch codes
        // Year 24: C1, C2, SW1, SW2
        // Year 23: C3, C4, SW3, SW4
        // Year 22: C5, C6, SW5, SW6
        // Year 21: C7, C8, SW7, SW8
        const cseOffset = (24 - year) * 2 + 1;
        const sweOffset = (24 - year) * 2 + 1;
        
        let batchCodes = [];
        
        if (department === 'CSE') {
            // Only CSE batches (C codes)
            const cCodes = [cseOffset, cseOffset + 1];
            for (const c of cCodes) {
                batchCodes.push(`C${c}S1`, `C${c}S2`, `C${c}B1`, `C${c}B2`);
            }
        } else if (department === 'SWE') {
            // Only SWE batches (SW codes)
            const swCodes = [sweOffset, sweOffset + 1];
            for (const sw of swCodes) {
                batchCodes.push(`SW${sw}`);
            }
        } else {
            // Legacy - include both CSE and SWE
            const cCodes = [cseOffset, cseOffset + 1];
            const swCodes = [sweOffset, sweOffset + 1];
            
            for (const c of cCodes) {
                batchCodes.push(`C${c}S1`, `C${c}S2`, `C${c}B1`, `C${c}B2`);
            }
            for (const sw of swCodes) {
                batchCodes.push(`SW${sw}`);
            }
        }

        console.log('Searching for batch codes:', batchCodes);

        // Find all schedules with matching batch codes
        const schedules = await Schedule.find({
            batch: { $in: batchCodes }
        }).select('course batch');
        
        console.log(`Found ${schedules.length} schedules`);
        
        // Extract and filter courses
        const courses = schedules
            .map(s => s.course)
            .filter(c => {
                if (!c || typeof c !== 'string') return false;
                
                const cleaned = c.trim();
                
                // Exclude empty, very short, or invalid entries
                if (cleaned.length < 3) return false;
                
                // Exclude patterns like "//", "bscte", etc.
                if (/^\/+$/.test(cleaned)) return false; // Only slashes
                if (/^bscte$/i.test(cleaned)) return false;
                if (/^[^a-zA-Z0-9\s]+$/.test(cleaned)) return false; // Only special chars
                
                // Exclude L-pattern entries (L-1, L-2, L-3, etc.)
                if (/^L-\d+/i.test(cleaned)) return false;
                
                return true;
            });
        
        // Get unique courses
        const uniqueCourses = [...new Set(courses)];
        
        console.log('Filtered unique courses:', uniqueCourses);
        res.json({ courses: uniqueCourses.sort() });
    } catch (error) {
        console.error('Get courses by batch error:', error);
        res.json({ courses: [] });
    }
});

// Get all quiz bookings for a date range (accessible to viewers/guests)
router.get('/', authOrGuest, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;

        let filter = {};
        if (startDate && endDate) {
            filter.date = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        } else if (startDate) {
            // Default to 60 days from start date
            const start = new Date(startDate);
            const end = new Date(startDate);
            end.setDate(end.getDate() + 60);
            filter.date = { $gte: start, $lte: end };
        }

        const bookings = await QuizBooking.find(filter).sort({ date: 1, 'timeSlot.start': 1 });

        res.json({
            success: true,
            count: bookings.length,
            bookings
        });
    } catch (error) {
        console.error('Get quiz bookings error:', error);
        res.status(500).json({ error: 'Failed to fetch quiz bookings' });
    }
});

// Create a new quiz booking
router.post('/', auth, async (req, res) => {
    try {
        const { roomNumber, date, timeSlot, course, batch, syllabus, teacherComment } = req.body;

        // Get bookedBy info from authenticated user
        const bookedBy = {
            name: req.user.name,
            email: req.user.email
        };

        // Use user's batch if they are a CR, otherwise use provided batch
        let bookingBatch;
        if (req.user.role === 'cr' && req.user.batch) {
            // CR batch is now in format "CSE 22" or "SWE 22"
            bookingBatch = req.user.batch;
        } else {
            bookingBatch = batch;
        }

        // Validate required fields
        if (!roomNumber || !date || !timeSlot?.start || !course || !bookingBatch) {
            return res.status(400).json({
                error: 'Missing required fields: roomNumber, date, timeSlot.start, course, batch'
            });
        }

        // Check if slot is already booked
        const existing = await QuizBooking.findOne({
            roomNumber,
            date: new Date(date),
            'timeSlot.start': timeSlot.start
        });

        if (existing) {
            return res.status(400).json({
                error: 'This slot is already booked',
                existingBooking: {
                    course: existing.course,
                    batch: existing.batch
                }
            });
        }

        const booking = new QuizBooking({
            roomNumber,
            date: new Date(date),
            timeSlot,
            course,
            batch: bookingBatch,
            syllabus: syllabus || '',
            teacherComment: teacherComment || '',
            bookedBy
        });

        await booking.save();

        res.json({
            success: true,
            message: 'Quiz room booked successfully',
            booking
        });
    } catch (error) {
        console.error('Create quiz booking error:', error);
        if (error.code === 11000) {
            return res.status(400).json({ error: 'This slot is already booked' });
        }
        res.status(500).json({ error: 'Failed to create booking' });
    }
});

// Update a quiz booking
router.put('/:id', async (req, res) => {
    try {
        const { id } = req.params;
        const { course, batch, syllabus, teacherComment } = req.body;

        const booking = await QuizBooking.findById(id);
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        if (course) booking.course = course;
        if (batch) booking.batch = batch;
        if (syllabus !== undefined) booking.syllabus = syllabus;
        if (teacherComment !== undefined) booking.teacherComment = teacherComment;

        await booking.save();

        res.json({
            success: true,
            message: 'Booking updated successfully',
            booking
        });
    } catch (error) {
        console.error('Update quiz booking error:', error);
        res.status(500).json({ error: 'Failed to update booking' });
    }
});

// Delete a quiz booking
router.delete('/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const booking = await QuizBooking.findByIdAndDelete(id);
        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        res.json({
            success: true,
            message: 'Booking deleted successfully'
        });
    } catch (error) {
        console.error('Delete quiz booking error:', error);
        res.status(500).json({ error: 'Failed to delete booking' });
    }
});

// Get bookings for a specific date
router.get('/date/:date', async (req, res) => {
    try {
        const date = new Date(req.params.date);
        date.setHours(0, 0, 0, 0);

        const nextDay = new Date(date);
        nextDay.setDate(nextDay.getDate() + 1);

        const bookings = await QuizBooking.find({
            date: { $gte: date, $lt: nextDay }
        });

        res.json({
            success: true,
            date: req.params.date,
            bookings
        });
    } catch (error) {
        console.error('Get date bookings error:', error);
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
});

module.exports = router;
