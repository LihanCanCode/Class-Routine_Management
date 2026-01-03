const { parsePDFSchedule } = require('./utils/pdfParser');

const pdfPath = "E:\\3-1\\v1.3 classroom-wise.pdf";

async function verify() {
    try {
        console.log('Testing parser...');
        const result = await parsePDFSchedule(pdfPath);

        console.log(`\nSuccess! Parsed ${result.rooms.length} rooms.`);
        console.log(`Parsed ${result.schedules.length} schedule entries.`);

        if (result.schedules.length > 0) {
            console.log('\nSample Entries:');
            result.schedules.slice(0, 5).forEach(s => {
                console.log(`[${s.roomNumber}] ${s.day} ${s.timeSlot.start}-${s.timeSlot.end}: ${s.course} (${s.batch})`);
            });
        } else {
            console.error('No schedules found! Parser logic might be too strict.');
        }

    } catch (error) {
        console.error('Verification failed:', error);
    }
}

verify();
