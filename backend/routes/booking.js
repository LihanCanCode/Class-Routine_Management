const express = require('express');
const router = express.Router();
const Booking = require('../models/Booking');
const Schedule = require('../models/Schedule');
const auth = require('../middleware/auth');

// Create a new booking
router.post('/', auth, async (req, res) => {
    try {
        const { roomNumber, date, timeSlot, batch, purpose, numberOfPeople } = req.body;

        console.log('Booking request:', { roomNumber, date, timeSlot, batch, purpose });
        console.log('User:', { name: req.user?.name, batch: req.user?.batch, role: req.user?.role });

        // Get bookedBy info from authenticated user
        const bookedBy = {
            name: req.user.name,
            contact: req.user.email
        };

        // Use user's batch if they are a CR, otherwise use provided batch
        let bookingBatch;
        if (req.user.role === 'cr' && req.user.batch) {
            // CR batch is just the number (21, 22, etc), need to format it
            bookingBatch = `CSE ${req.user.batch}`;
        } else {
            bookingBatch = batch;
        }

        console.log('Final booking batch:', bookingBatch);

        // Validate required fields
        if (!roomNumber || !date || !timeSlot || !bookingBatch) {
            return res.status(400).json({
                error: 'Missing required fields: roomNumber, date, timeSlot, batch'
            });
        }

        const bookingDate = new Date(date);
        const dayOfWeek = bookingDate.toLocaleDateString('en-US', { weekday: 'long' });

        // Check if room has a scheduled class at this time
        const existingSchedule = await Schedule.findOne({
            roomNumber,
            day: dayOfWeek,
            $or: [
                {
                    'timeSlot.start': { $lte: timeSlot.start },
                    'timeSlot.end': { $gt: timeSlot.start }
                },
                {
                    'timeSlot.start': { $lt: timeSlot.end },
                    'timeSlot.end': { $gte: timeSlot.end }
                },
                {
                    'timeSlot.start': { $gte: timeSlot.start },
                    'timeSlot.end': { $lte: timeSlot.end }
                }
            ]
        });

        if (existingSchedule) {
            return res.status(409).json({
                error: 'Room is occupied by a scheduled class',
                schedule: existingSchedule
            });
        }

        // Check if room is already booked
        const existingBooking = await Booking.findOne({
            roomNumber,
            date: {
                $gte: new Date(bookingDate.setHours(0, 0, 0, 0)),
                $lt: new Date(bookingDate.setHours(23, 59, 59, 999))
            },
            status: { $ne: 'cancelled' },
            $or: [
                {
                    'timeSlot.start': { $lte: timeSlot.start },
                    'timeSlot.end': { $gt: timeSlot.start }
                },
                {
                    'timeSlot.start': { $lt: timeSlot.end },
                    'timeSlot.end': { $gte: timeSlot.end }
                },
                {
                    'timeSlot.start': { $gte: timeSlot.start },
                    'timeSlot.end': { $lte: timeSlot.end }
                }
            ]
        });

        if (existingBooking) {
            return res.status(409).json({
                error: 'Room is already booked for this time slot',
                booking: existingBooking
            });
        }

        // Create the booking
        const booking = new Booking({
            roomNumber,
            date: bookingDate,
            timeSlot,
            batch: bookingBatch,
            bookedBy,
            purpose: purpose || '',
            numberOfPeople: numberOfPeople || 1,
            status: 'confirmed'
        });

        await booking.save();

        res.status(201).json({
            success: true,
            message: 'Room booked successfully',
            booking
        });

    } catch (error) {
        console.error('Booking creation error:', error);

        if (error.code === 11000) {
            return res.status(409).json({
                error: 'This room is already booked for the selected time slot'
            });
        }

        res.status(500).json({
            error: 'Failed to create booking',
            details: error.message
        });
    }
});

// Get all bookings
router.get('/', async (req, res) => {
    try {
        const { date, roomNumber, batch, status } = req.query;

        const filter = {};

        if (date) {
            const selectedDate = new Date(date);
            filter.date = {
                $gte: new Date(selectedDate.setHours(0, 0, 0, 0)),
                $lt: new Date(selectedDate.setHours(23, 59, 59, 999))
            };
        }

        if (roomNumber) filter.roomNumber = roomNumber;
        if (batch) filter.batch = batch;
        if (status) filter.status = status;

        const bookings = await Booking.find(filter)
            .sort({ date: 1, 'timeSlot.start': 1 });

        res.json({
            success: true,
            count: bookings.length,
            bookings
        });

    } catch (error) {
        console.error('Get bookings error:', error);
        res.status(500).json({ error: 'Failed to fetch bookings' });
    }
});

// Check if a specific slot is available
router.get('/check', async (req, res) => {
    try {
        const { roomNumber, date, startTime, endTime } = req.query;

        if (!roomNumber || !date || !startTime || !endTime) {
            return res.status(400).json({
                error: 'Missing required parameters: roomNumber, date, startTime, endTime'
            });
        }

        const bookingDate = new Date(date);
        const dayOfWeek = bookingDate.toLocaleDateString('en-US', { weekday: 'long' });

        // Check schedule
        const schedule = await Schedule.findOne({
            roomNumber,
            day: dayOfWeek,
            $or: [
                {
                    'timeSlot.start': { $lte: startTime },
                    'timeSlot.end': { $gt: startTime }
                },
                {
                    'timeSlot.start': { $lt: endTime },
                    'timeSlot.end': { $gte: endTime }
                },
                {
                    'timeSlot.start': { $gte: startTime },
                    'timeSlot.end': { $lte: endTime }
                }
            ]
        });

        // Check bookings
        const booking = await Booking.findOne({
            roomNumber,
            date: {
                $gte: new Date(bookingDate.setHours(0, 0, 0, 0)),
                $lt: new Date(bookingDate.setHours(23, 59, 59, 999))
            },
            status: { $ne: 'cancelled' },
            $or: [
                {
                    'timeSlot.start': { $lte: startTime },
                    'timeSlot.end': { $gt: startTime }
                },
                {
                    'timeSlot.start': { $lt: endTime },
                    'timeSlot.end': { $gte: endTime }
                },
                {
                    'timeSlot.start': { $gte: startTime },
                    'timeSlot.end': { $lte: endTime }
                }
            ]
        });

        const isAvailable = !schedule && !booking;

        res.json({
            success: true,
            available: isAvailable,
            reason: schedule ? 'scheduled_class' : (booking ? 'already_booked' : null),
            conflictingSchedule: schedule || null,
            conflictingBooking: booking || null
        });

    } catch (error) {
        console.error('Availability check error:', error);
        res.status(500).json({ error: 'Failed to check availability' });
    }
});

// Cancel a booking
router.delete('/:id', async (req, res) => {
    try {
        const booking = await Booking.findById(req.params.id);

        if (!booking) {
            return res.status(404).json({ error: 'Booking not found' });
        }

        booking.status = 'cancelled';
        await booking.save();

        res.json({
            success: true,
            message: 'Booking cancelled successfully',
            booking
        });

    } catch (error) {
        console.error('Cancel booking error:', error);
        res.status(500).json({ error: 'Failed to cancel booking' });
    }
});

module.exports = router;
