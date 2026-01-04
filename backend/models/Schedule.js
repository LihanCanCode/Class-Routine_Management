const mongoose = require('mongoose');

const scheduleSchema = new mongoose.Schema({
    roomNumber: {
        type: String,
        required: function() {
            return !this.semesterPageNumber; // Required only for room-wise schedules
        }
    },
    semesterPageNumber: {
        type: Number,
        default: null // For semester-wise schedules
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
    section: {
        type: String,
        default: '' // Optional section name for split slots
    },
    batch: {
        type: String,
        default: ''
    },
    teacher: {
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

// Create compound indexes for efficient queries
scheduleSchema.index({ roomNumber: 1, day: 1, 'timeSlot.start': 1, subSlotIndex: 1 });
scheduleSchema.index({ semesterPageNumber: 1, day: 1, 'timeSlot.start': 1, subSlotIndex: 1 });
scheduleSchema.index({ semesterPageNumber: 1, weekStartDate: 1, day: 1 }); // For weekly schedule queries

module.exports = mongoose.model('Schedule', scheduleSchema);
