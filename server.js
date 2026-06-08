const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const User = require('./models/User'); // Ensure your User.js model is inside the 'models' folder

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// --- 1. MONGODB CONNECTION ---
// Replace 'YOUR_MONGODB_CONNECTION_STRING_HERE' with your actual Atlas string!
const mongoURI = process.env.MONGO_URI || 'YOUR_MONGODB_CONNECTION_STRING_HERE';
mongoose.connect(mongoURI)
  .then(() => console.log('✅ Connected to MongoDB Atlas'))
  .catch((err) => console.error('❌ MongoDB Connection Error:', err));


// --- 2. REGISTRATION & MULTI-LEVEL REFERRAL ENGINE ---
app.post('/api/register-symbol', async (req, res) => {
  try {
    const { fullName, symbolId, referredBy } = req.body;

    // Basic validation
    if (!fullName || !symbolId) {
      return res.status(400).json({ message: 'Documented Name and Symbol ID are required.' });
    }

    // Ensure the 12-Symbol ID isn't already taken by someone else
    const existingUser = await User.findOne({ symbolId: symbolId });
    if (existingUser) {
      return res.status(409).json({ message: 'This Secure ID is already registered.' });
    }

    let validReferrerId = null;
    let newReferralChain = []; // This array will hold the user's "ancestors"
    
    // The Multi-Level Referral Logic
    if (referredBy) {
      // Look up the database to see if the friend's ID actually exists
      const referrerUser = await User.findOne({ symbolId: referredBy });
      
      if (referrerUser) {
        validReferrerId = referrerUser.symbolId;
        
        // Add +1 to the direct friend's referral count
        referrerUser.referralCount += 1;
        await referrerUser.save();

        // THE MAGIC TRICK: 
        // Build the deep network chain: [The Direct Parent] + [The Parent's Entire Chain]
        newReferralChain = [referrerUser.symbolId, ...referrerUser.referralChain];
      }
    }

    // Create and save the brand new user with their full family tree attached
    const newUser = new User({
      fullName: fullName,
      symbolId: symbolId,
      referredBy: validReferrerId,
      referralChain: newReferralChain // Saves the deep network for future transaction cuts!
    });

    await newUser.save();

    // Send success back to the frontend
    res.status(201).json({ 
      message: 'Registration complete!', 
      user: newUser 
    });

  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ message: 'Server error during registration.' });
  }
});


// --- 3. START SERVER ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});