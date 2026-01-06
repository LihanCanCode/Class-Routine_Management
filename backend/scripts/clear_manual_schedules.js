require('dotenv').config();
const mongoose = require('mongoose');
const SemesterSchedule = require('../models/SemesterSchedule');

async function clearManualSchedules() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB.');

        // Delete all entries from SemesterSchedule collection
        const result = await SemesterSchedule.deleteMany({});
        console.log(`Deleted ${result.deletedCount} manual semester schedule entries.`);

        console.log('Done.');
        process.exit(0);
    } catch (error) {
        console.error('Error clearing schedules:', error);
        process.exit(1);
    }
}

clearManualSchedules();
