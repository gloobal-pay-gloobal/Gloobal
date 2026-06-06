const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: {
    type: String,
    required: true,
    trim: true
  },
  symbolId: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  devices: {
    type: Array,
    default: [] 
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);