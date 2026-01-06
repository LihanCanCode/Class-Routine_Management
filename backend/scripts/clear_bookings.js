require('dotenv').config();
const mongoose = require('mongoose');
const Booking = require('../models/Booking');
const SemesterSchedule = require('../models/SemesterSchedule');

async function clearBookings() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB.');

        // 1. Delete all bookings
        const bookingResult = await Booking.deleteMany({});
        console.log(`Deleted ${bookingResult.deletedCount} bookings.`);

        // 2. Clear booking references in SemesterSchedule
        // We only clear the bookingId and roomNumber if the user wants a full reset of the booking part
        const scheduleResult = await SemesterSchedule.updateMany(
            {},
            { $set: { bookingId: null } }
        );
        console.log(`Cleared booking references in ${scheduleResult.modifiedCount} semester schedule entries.`);

        console.log('Done.');
        process.exit(0);
    } catch (error) {
        console.error('Error clearing bookings:', error);
        process.exit(1);
    }
}

clearBookings();
