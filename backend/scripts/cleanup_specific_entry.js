require('dotenv').config();
const mongoose = require('mongoose');
const SemesterSchedule = require('../models/SemesterSchedule');
const Booking = require('../models/Booking');

async function cleanupSpecificEntry() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB.');

        // Target: Room 205, Course CSE 4540
        const roomNumber = '205';
        const course = 'CSE 4540';

        // 1. Find and delete from SemesterSchedule
        const schedResult = await SemesterSchedule.deleteMany({
            roomNumber: roomNumber,
            course: course
        });
        console.log(`Deleted ${schedResult.deletedCount} semester schedule entries for Room ${roomNumber}, Course ${course}.`);

        // 2. Find and delete from Booking (in case there's an associated one)
        const bookingResult = await Booking.deleteMany({
            roomNumber: roomNumber,
            purpose: course // In the new transient model, purpose = course
        });
        console.log(`Deleted ${bookingResult.deletedCount} booking records for Room ${roomNumber}, Course ${course}.`);

        console.log('Done.');
        process.exit(0);
    } catch (error) {
        console.error('Error during cleanup:', error);
        process.exit(1);
    }
}

cleanupSpecificEntry();
