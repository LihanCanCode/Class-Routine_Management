require('dotenv').config();
const mongoose = require('mongoose');
const Schedule = require('./models/Schedule');
const Room = require('./models/Room');

mongoose.connect(process.env.MONGODB_URI)
    .then(async () => {
        console.log('Connected to MongoDB');

        const roomCount = await Room.countDocuments();
        const scheduleCount = await Schedule.countDocuments();

        console.log(`Rooms in DB: ${roomCount}`);
        console.log(`Schedules in DB: ${scheduleCount}`);

        // Check for specific IDs from the logs
        const testIds = ['695a5fa22ed7fd3d03fb0b0d', '695a5fa22ed7fd3d03fb0b0f', '695a620d2ed7fd3d03fb0ce8'];
        
        for (const id of testIds) {
            const schedule = await Schedule.findById(id);
            if (schedule) {
                console.log(`\nFound ${id}:`);
                console.log(`  Page: ${schedule.semesterPageNumber}, Template: ${schedule.isTemplate}`);
                console.log(`  Course: ${schedule.course || '(empty)'}, Room: ${schedule.roomNumber || '(empty)'}`);
                console.log(`  SubSlot: ${schedule.subSlotIndex}/${schedule.totalSubSlots}`);
            } else {
                console.log(`\n${id}: NOT FOUND`);
            }
        }

        process.exit();
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
