const mongoose = require('mongoose');
const Schedule = require('./models/Schedule');
const Room = require('./models/Room');

const checkDemoData = async () => {
    try {
        await mongoose.connect('mongodb://localhost:27017/room-booking', {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('🔗 Connected to MongoDB\n');

        // Check room
        const room = await Room.findOne({ roomNumber: 'DEMO-101' });
        console.log('📍 DEMO-101 Room:', room ? '✅ EXISTS' : '❌ NOT FOUND');
        
        // Check schedules
        const schedules = await Schedule.find({ roomNumber: 'DEMO-101' }).sort({ day: 1, 'timeSlot.start': 1 });
        console.log(`\n📋 DEMO-101 Schedules: ${schedules.length} found\n`);

        if (schedules.length > 0) {
            schedules.forEach((s, idx) => {
                console.log(`${idx + 1}. ${s.day} ${s.timeSlot.start}-${s.timeSlot.end}`);
                console.log(`   Course: ${s.course}`);
                console.log(`   Batch: ${s.batch}`);
                console.log(`   Teacher: ${s.teacher}`);
                console.log(`   Department: ${s.department}`);
                console.log(`   Needs Review: ${s.needsReview ? '🔴 YES' : '✅ NO'}`);
                console.log('');
            });
        }

        await mongoose.connection.close();
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
};

checkDemoData();
