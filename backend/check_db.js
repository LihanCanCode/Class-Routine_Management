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

        if (scheduleCount > 0) {
            const sample = await Schedule.findOne();
            console.log('Sample Schedule:', JSON.stringify(sample, null, 2));
        }

        process.exit();
    })
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
