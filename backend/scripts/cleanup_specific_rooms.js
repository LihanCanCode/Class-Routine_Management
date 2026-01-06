require('dotenv').config();
const mongoose = require('mongoose');
const Schedule = require('../models/Schedule');
const SemesterSchedule = require('../models/SemesterSchedule');

async function removeEntries() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB.');

        const rooms = ['508', '106'];

        // 1. Remove from static Schedule (PDF source)
        const staticResult = await Schedule.deleteMany({ roomNumber: { $in: rooms } });
        console.log(`Removed ${staticResult.deletedCount} entries from static Schedule collection.`);

        // 2. Remove from SemesterSchedule (Manual source)
        const manualResult = await SemesterSchedule.deleteMany({ roomNumber: { $in: rooms } });
        console.log(`Removed ${manualResult.deletedCount} entries from SemesterSchedule collection.`);

        console.log('Cleanup complete.');
        process.exit(0);
    } catch (error) {
        console.error('Error during cleanup:', error);
        process.exit(1);
    }
}

removeEntries();
