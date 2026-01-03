const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  roomNumber: {
    type: String,
    required: true,
    unique: true,
    trim: true
  },
  building: {
    type: String,
    default: 'Main Building'
  },
  capacity: {
    type: Number,
    default: 40
  },
  floor: {
    type: String
  },
  type: {
    type: String,
    enum: ['classroom', 'lab', 'seminar', 'other'],
    default: 'classroom'
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('Room', roomSchema);
