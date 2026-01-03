const mongoose = require('mongoose');

const quizBookingSchema = new mongoose.Schema({
    roomNumber: {
        type: String,
        required: true
    },
    date: {
        type: Date,
        required: true
    },
    timeSlot: {
        start: { type: String, required: true }, // "13:30" or "14:00"
        end: { type: String, required: true }    // "14:00" or "14:30"
    },
    course: {
        type: String,
        required: true
    },
    batch: {
        type: String,
        required: true
    },
    syllabus: {
        type: String,
        default: ''
    },
    teacherComment: {
        type: String,
        default: ''
    },
    bookedBy: {
        name: String,
        email: String
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

// Compound index to prevent double booking
quizBookingSchema.index(
    { roomNumber: 1, date: 1, 'timeSlot.start': 1 },
    { unique: true }
);

module.exports = mongoose.model('QuizBooking', quizBookingSchema);
