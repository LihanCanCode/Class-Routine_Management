const mongoose = require('mongoose');

const semesterScheduleSchema = new mongoose.Schema({
    semesterPageNumber: {
        type: Number,
        required: true
    },
    // Weekly scheduling fields
    isTemplate: {
        type: Boolean,
        default: true // true = base/template schedule, false = week-specific override
    },
    weekStartDate: {
        type: Date,
        default: null // null for templates, specific date (Sunday) for weekly overrides
    },
    // Sub-slot divisions for horizontal splitting
    subSlotIndex: {
        type: Number,
        default: 0 // 0-based index: 0, 1, 2, 3 for which division this is
    },
    totalSubSlots: {
        type: Number,
        default: 1, // 1 = no split, 2 = split in half, 4 = split in quarters
        enum: [1, 2, 4]
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
    courseNickname: {
        type: String,
        default: '' // Optional nickname/short name for the course
    },
    batch: {
        type: String,
        default: ''
    },
    teacher: {
        type: String,
        default: ''
    },
    roomNumber: {
        type: String,
        default: ''
    },
    // Class status for cancellation/rescheduling
    status: {
        type: String,
        enum: ['active', 'cancelled', 'rescheduled'],
        default: 'active'
    },
    statusNote: {
        type: String,
        default: '' // Optional note for cancellation/rescheduling reason
    },
    department: {
        type: String,
        default: 'CSE',
        enum: ['CSE', 'EEE', 'MPE', 'CEE', 'BTM']
    },
    rawContent: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

// Create compound indexes for efficient queries
semesterScheduleSchema.index({ semesterPageNumber: 1, day: 1, 'timeSlot.start': 1, subSlotIndex: 1 });
semesterScheduleSchema.index({ semesterPageNumber: 1, weekStartDate: 1, isTemplate: 1 });
semesterScheduleSchema.index({ semesterPageNumber: 1, isTemplate: 1, day: 1 });

module.exports = mongoose.model('SemesterSchedule', semesterScheduleSchema);
