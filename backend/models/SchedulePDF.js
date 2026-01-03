const mongoose = require('mongoose');

const schedulePDFSchema = new mongoose.Schema({
    filename: {
        type: String,
        required: true
    },
    originalName: {
        type: String,
        required: true
    },
    filePath: {
        type: String,
        required: true
    },
    type: {
        type: String,
        enum: ['routine-wise', 'semester-wise'],
        required: true
    },
    department: {
        type: String,
        default: 'CSE',
        enum: ['CSE', 'EEE', 'MPE', 'CEE', 'BTM']
    },
    uploadedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    },
    pageMapping: [{
        pageNumber: Number,
        batch: String,
        section: String,
        semester: String,
        fullText: String,
        rawText: String,
        pageFilePath: String
    }],
    totalPages: {
        type: Number,
        default: 0
    }
}, {
    timestamps: true
});

// Only one active PDF per type per department
schedulePDFSchema.index({ type: 1, department: 1 }, { unique: true });

module.exports = mongoose.model('SchedulePDF', schedulePDFSchema);
