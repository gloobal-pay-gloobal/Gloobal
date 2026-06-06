const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const User = require('./models/User'); // Ensure this path points to your User.js file

const app = express();
app.use(express.json());
app.use(cors());

// --- REGISTRATION ROUTE ---
app.post('/api/register-symbol', async (req, res) => {
  try {
    const { fullName, symbolId } = req.body;

    // 1. Basic validation to ensure fields aren't empty
    if (!fullName || !symbolId) {
      return res.status(400).json({ message: 'Full name and Symbol ID are required.' });
    }

    // 2. Format the Symbol ID to avoid capitalization mismatches
    const formattedSymbolId = symbolId.toLowerCase().trim();

    // 3. Database Check: Is this Symbol ID already taken?
    const existingUser = await User.findOne({ symbolId: formattedSymbolId });
    if (existingUser) {
      return res.status(409).json({ message: 'That Symbol ID is already taken. Please choose another.' });
    }

    // 4. Create the new user document
    const newUser = new User({
      fullName: fullName,
      symbolId: formattedSymbolId
    });

    // 5. Save to MongoDB
    await newUser.save();

    // 6. Return success message back to the frontend
    res.status(201).json({ 
      message: 'Symbol ID successfully claimed!',
      user: {
        symbolId: newUser.symbolId,
        fullName: newUser.fullName
      }
    });

  } catch (error) {
    console.error('Registration Error:', error);
    res.status(500).json({ message: 'Server error during registration. Please try again.' });
  }
});

// --- SERVER INITIALIZATION ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});