const mongoose = require('mongoose');

const bookingSchema = new mongoose.Schema({
    roomNumber: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        required: true
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
    batch: {
        type: String,
        required: true,
        enum: ['CSE 21', 'CSE 22', 'CSE 23', 'CSE 24', 'MSc(CSE)']
    },
    bookedBy: {
        name: {
            type: String,
            required: true
        },
        contact: {
            type: String
        }
    },
    purpose: {
        type: String,
        default: ''
    },
    numberOfPeople: {
        type: Number,
        default: 1
    },
    status: {
        type: String,
        enum: ['pending', 'confirmed', 'cancelled'],
        default: 'confirmed'
    }
}, {
    timestamps: true
});

// Prevent double bookings - unique combination of room, date, and time slot
bookingSchema.index({ roomNumber: 1, date: 1, 'timeSlot.start': 1 }, { unique: true });

module.exports = mongoose.model('Booking', bookingSchema);
