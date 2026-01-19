require('dotenv').config();
const mongoose = require('mongoose');
const Room = require('./models/Room');
const Schedule = require('./models/Schedule');

const seedTutorialDemo = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });

        console.log('🔗 Connected to MongoDB');

        // Delete existing demo schedules first (clean slate)
        const deleteResult = await Schedule.deleteMany({ roomNumber: 'DEMO-101' });
        if (deleteResult.deletedCount > 0) {
            console.log(`🗑️  Deleted ${deleteResult.deletedCount} existing DEMO-101 schedules`);
        }

        // Check if demo room already exists
        const existingDemoRoom = await Room.findOne({ roomNumber: 'DEMO-101' });

        // Create demo room if not exists
        if (!existingDemoRoom) {
            const demoRoom = new Room({
                roomNumber: 'DEMO-101',
                roomType: 'classroom',
                capacity: 60,
                building: 'Tutorial Building',
                floor: 1,
                facilities: ['Projector', 'Whiteboard', 'AC']
            });
            await demoRoom.save();
            console.log('✅ Created demo room: DEMO-101');
        } else {
            console.log('✅ Demo room DEMO-101 already exists');
        }

        // Get current date info for demo schedules
        const today = new Date();
        const nextMonday = new Date(today);
        nextMonday.setDate(today.getDate() + ((1 + 7 - today.getDay()) % 7 || 7));

        // Create demo schedules (Monday to Thursday, some slots)
        const demoSchedules = [
            // Monday - Normal schedule
            {
                roomNumber: 'DEMO-101',
                day: 'Monday',
                timeSlot: { start: '08:30', end: '10:00' },
                course: 'Data Structures',
                teacher: 'AB',
                batch: 'C5S1',
                semester: 'Spring 2026',
                department: 'CSE'
            },
            {
                roomNumber: 'DEMO-101',
                day: 'Monday',
                timeSlot: { start: '10:00', end: '11:30' },
                course: 'Database Management',
                teacher: 'CD',
                batch: 'C5S2',
                semester: 'Spring 2026',
                department: 'CSE'
            },
            // Monday 11:30-13:00 is FREE (for booking demo)
            {
                roomNumber: 'DEMO-101',
                day: 'Monday',
                timeSlot: { start: '13:00', end: '14:30' },
                course: 'Web Technologies',
                teacher: 'EF',
                batch: 'SW4',
                semester: 'Spring 2026',
                department: 'CSE'
            },

            // Tuesday - Has a RED FLAGGED schedule
            {
                roomNumber: 'DEMO-101',
                day: 'Tuesday',
                timeSlot: { start: '08:30', end: '10:00' },
                course: 'Algorithms',
                teacher: 'GH',
                batch: 'C4S1',
                semester: 'Spring 2026',
                department: 'CSE'
            },
            {
                roomNumber: 'DEMO-101',
                day: 'Tuesday',
                timeSlot: { start: '10:00', end: '11:30' },
                course: 'ME', // ⚠️ This will be flagged as RED (department code)
                teacher: 'IJ',
                batch: 'All', // ⚠️ Also flagged
                semester: 'Spring 2026',
                department: 'CSE',
                needsReview: true
            },
            {
                roomNumber: 'DEMO-101',
                day: 'Tuesday',
                timeSlot: { start: '13:00', end: '14:30' },
                course: 'Operating Systems',
                teacher: 'KL',
                batch: 'C5S1',
                semester: 'Spring 2026',
                department: 'CSE'
            },

            // Wednesday - Normal
            {
                roomNumber: 'DEMO-101',
                day: 'Wednesday',
                timeSlot: { start: '08:30', end: '10:00' },
                course: 'Computer Networks',
                teacher: 'MN',
                batch: 'SW5',
                semester: 'Spring 2026',
                department: 'CSE'
            },
            // Wednesday 10:00-11:30 is FREE
            {
                roomNumber: 'DEMO-101',
                day: 'Wednesday',
                timeSlot: { start: '13:00', end: '14:30' },
                course: 'Software Engineering',
                teacher: 'OP',
                batch: 'SW4',
                semester: 'Spring 2026',
                department: 'CSE'
            },

            // Thursday - Normal
            {
                roomNumber: 'DEMO-101',
                day: 'Thursday',
                timeSlot: { start: '10:00', end: '11:30' },
                course: 'Artificial Intelligence',
                teacher: 'QR',
                batch: 'C4S2',
                semester: 'Spring 2026',
                department: 'CSE'
            }
        ];

        await Schedule.insertMany(demoSchedules);
        console.log(`✅ Created ${demoSchedules.length} demo schedules`);
        console.log('');
        console.log('📋 Tutorial Demo Setup:');
        console.log('   - Demo Room: DEMO-101');
        console.log('   - Red Flagged Slot: Tuesday 10:00-11:30 (needs review)');
        console.log('   - Available for Booking: Monday 11:30-13:00');
        console.log('   - Alternative Slot: Wednesday 10:00-11:30');
        console.log('');

        await mongoose.connection.close();
        console.log('✅ Tutorial demo data seeded successfully!');
    } catch (error) {
        console.error('❌ Error seeding tutorial demo:', error);
        process.exit(1);
    }
};

// Run if called directly
if (require.main === module) {
    seedTutorialDemo();
}

module.exports = seedTutorialDemo;
