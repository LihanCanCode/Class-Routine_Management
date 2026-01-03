// Seed script to create a CR user
// Run: node seedCR.js
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');

const createCR = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI, {
            useNewUrlParser: true,
            useUnifiedTopology: true
        });
        console.log(' MongoDB connected');

        // Create CR users for CSE and SWE batches
        const batches = [
            { dept: 'CSE', year: '21', fullBatch: 'CSE 21' },
            { dept: 'SWE', year: '21', fullBatch: 'SWE 21' },
            { dept: 'CSE', year: '22', fullBatch: 'CSE 22' },
            { dept: 'SWE', year: '22', fullBatch: 'SWE 22' },
            { dept: 'CSE', year: '23', fullBatch: 'CSE 23' },
            { dept: 'SWE', year: '23', fullBatch: 'SWE 23' },
            { dept: 'CSE', year: '24', fullBatch: 'CSE 24' },
            { dept: 'SWE', year: '24', fullBatch: 'SWE 24' }
        ];
        const createdCRs = [];

        for (const batchInfo of batches) {
            const email = `${batchInfo.dept.toLowerCase()}${batchInfo.year}cr@cse.edu`;
            
            // Check if CR already exists
            const existingCR = await User.findOne({ email });
            if (existingCR) {
                console.log(`  CR ${batchInfo.fullBatch} already exists (${email})`);
                continue;
            }

            // Create CR user
            const cr = new User({
                name: `${batchInfo.dept} ${batchInfo.year} CR`,
                email,
                password: `${batchInfo.dept.toLowerCase()}${batchInfo.year}cr`,
                department: 'CSE',
                role: 'cr',
                batch: batchInfo.fullBatch
            });

            await cr.save();
            createdCRs.push(cr);
        }

        if (createdCRs.length === 0) {
            console.log('All CR users already exist.');
        } else {
            console.log(` ${createdCRs.length} CR user(s) created successfully!`);
            console.log('');
            createdCRs.forEach(cr => {
                const batchParts = cr.batch.split(' ');
                const dept = batchParts[0].toLowerCase();
                const year = batchParts[1];
                console.log(' Email:', cr.email);
                console.log(' Password:', `${dept}${year}cr`);
                console.log(' Department:', cr.department);
                console.log(' Batch:', cr.batch);
                console.log(' Role:', cr.role);
                console.log('');
            });
            console.log('ℹ  CRs can: Book rooms, book quiz rooms, view schedules');
            console.log('ℹ  CRs cannot: Upload PDFs, manually edit schedules');
        }

        process.exit(0);
    } catch (error) {
        console.error(' Error creating CR:', error);
        process.exit(1);
    }
};

createCR();
