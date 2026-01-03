const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
    roomNumber: {
        type: String,
        required: true
    },
    day: {
        type: String,
        required: true,
        enum: ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    },
    timeSlot: {
        start: {
            type: String,
            required: true
        },
        end: {
            type: String,
            required: true
        }
    },
    course: {
        type: String,
        default: ''
    },
    batch: {
        type: String,
        default: ''
    },
    teacher: {
        type: String,
        default: ''
    },
    isBiWeekly: {
        type: Boolean,
        default: false
    },
    needsReview: {
        type: Boolean,
        default: false
    },
    semester: {
        type: String,
        default: 'Current'
    },
    department: {
        type: String,
        default: 'CSE',
        enum: ['CSE', 'EEE', 'MPE', 'CEE', 'BTM']
    }
}, {
    timestamps: true
});

// Create compound index for efficient queries
scheduleSchema.index({ roomNumber: 1, day: 1, 'timeSlot.start': 1 });

module.exports = mongoose.model('Schedule', scheduleSchema);
