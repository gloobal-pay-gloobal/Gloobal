const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  fullName: { 
    type: String, 
    required: true 
  },
  symbolId: { 
    type: String, 
    required: true, 
    unique: true 
  },
  // The direct person who invited them
  referredBy: { 
    type: String, 
    default: null 
  },
  // NEW: The complete history of who invited who [Parent, Grandparent, Great-Grandparent]
  referralChain: { 
    type: Array, 
    default: [] 
  },
  referralCount: { 
    type: Number, 
    default: 0 
  },
  createdAt: { 
    type: Date, 
    default: Date.now 
  }
});

module.exports = mongoose.model('User', userSchema);