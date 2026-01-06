require('dotenv').config();
const mongoose = require('mongoose');
const Schedule = require('../models/Schedule');
const SemesterSchedule = require('../models/SemesterSchedule');

async function findEntries() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB.');

        const rooms = ['508', '106'];

        console.log('--- Checking Schedule (Static PDF) ---');
        const staticEntries = await Schedule.find({ roomNumber: { $in: rooms } });
        staticEntries.forEach(e => {
            console.log(`[Schedule] Room: ${e.roomNumber}, Day: ${e.day}, Course: ${e.course}, Time: ${e.timeSlot.start}-${e.timeSlot.end}`);
        });

        console.log('--- Checking SemesterSchedule (Manual) ---');
        const manualEntries = await SemesterSchedule.find({ roomNumber: { $in: rooms } });
        manualEntries.forEach(e => {
            console.log(`[SemesterSchedule] Room: ${e.roomNumber}, Day: ${e.day}, Course: ${e.course}, Time: ${e.timeSlot.start}-${e.timeSlot.end}, Page: ${e.semesterPageNumber}`);
        });

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

findEntries();
