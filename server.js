const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const { 
  generateAuthenticationOptions, 
  verifyAuthenticationResponse,
  generateRegistrationOptions,  
  verifyRegistrationResponse    
} = require('@simplewebauthn/server');
require('dotenv').config();

const app = express();

// Middleware
app.use(cors({
  origin: ['https://gloobal.in', 'https://www.gloobal.in'],
  credentials: true
}));
app.use(express.json());

// ==========================================
// 1. DATABASE CONNECTION
// ==========================================
mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/gloobal_db')
  .then(() => console.log('✅ Connected to Gloobal Secure Database'))
  .catch((err) => console.error('❌ Database connection error:', err));

// ==========================================
// 2. DEFINE THE USER DATA MODEL
// ==========================================
const userSchema = new mongoose.Schema({
  secureId: { type: String, required: true, unique: true },
  documentedName: { type: String, required: true },
  pinHash: { type: String, required: true },
  biometricsEnabled: { type: Boolean, default: false },
  // Holds the hardware keys for Passkeys (WebAuthn)
  passkeys: [{
    credentialID: String,
    credentialPublicKey: Buffer,
    counter: Number,
  }],
  createdAt: { type: Date, default: Date.now }
});

const User = mongoose.model('User', userSchema);

// ==========================================
// 3. WEBAUTHN CONFIGURATION
// ==========================================
const rpID = 'gloobal.in'; // MUST match your live domain exactly
const expectedOrigin = ['https://gloobal.in', 'https://www.gloobal.in'];
const userChallenges = {}; // Temporary memory to hold challenges

// ==========================================
// 4. API ROUTE: SECURE REGISTRATION (PIN)
// ==========================================
app.post('/api/register', async (req, res) => {
  try {
    const { secureId, documentedName, pin, biometricsEnabled } = req.body;

    const existingUser = await User.findOne({ secureId });
    if (existingUser) {
      return res.status(400).json({ error: "Node ID already registered." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPin = await bcrypt.hash(pin, salt);

    const newUser = new User({
      secureId,
      documentedName,
      pinHash: hashedPin,
      biometricsEnabled
    });

    await newUser.save();
    res.status(201).json({ message: "User securely saved to database." });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error during registration." });
  }
});

// ==========================================
// 5. API ROUTE: SECURE LOGIN (PIN VERIFICATION)
// ==========================================
app.post('/api/login', async (req, res) => {
  try {
    const { secureId, pin } = req.body;

    const user = await User.findOne({ secureId });
    if (!user) {
      return res.status(404).json({ error: "Node ID not found." });
    }

    const isMatch = await bcrypt.compare(pin, user.pinHash);
    if (!isMatch) {
      return res.status(401).json({ error: "Invalid PIN." });
    }

    res.status(200).json({ 
      message: "Authentication successful",
      documentedName: user.documentedName 
    });

  } catch (error) {
    res.status(500).json({ error: "Server error during login." });
  }
});

// ==========================================
// 6. WEBAUTHN: DEVICE ENROLLMENT (BIND FACE/FINGER)
// ==========================================
app.post('/api/generate-registration-options', async (req, res) => {
  try {
    const { secureId } = req.body;
    const user = await User.findOne({ secureId });
    if (!user) return res.status(404).json({ error: "Node ID not found." });

    const options = await generateRegistrationOptions({
      rpName: 'Gloobal Network',
      rpID,
      userID: user._id.toString(),
      userName: user.documentedName,
      attestationType: 'none',
      authenticatorSelection: {
        residentKey: 'required',
        userVerification: 'preferred',
      },
    });

    userChallenges[secureId] = options.challenge;
    res.status(200).json(options);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to generate enrollment options." });
  }
});

app.post('/api/verify-registration', async (req, res) => {
  try {
    const { secureId, hardwareResponse } = req.body;
    const user = await User.findOne({ secureId });
    const expectedChallenge = userChallenges[secureId];

    if (!user || !expectedChallenge) {
      return res.status(400).json({ error: "Challenge expired or invalid." });
    }

    const verification = await verifyRegistrationResponse({
      response: hardwareResponse,
      expectedChallenge,
      expectedOrigin,
      expectedRPID: rpID,
    });

    if (verification.verified) {
      const { credentialPublicKey, credentialID, counter } = verification.registrationInfo;
      
      user.passkeys.push({
        credentialID: credentialID,
        credentialPublicKey: credentialPublicKey,
        counter: counter,
      });
      user.biometricsEnabled = true;
      await user.save();

      delete userChallenges[secureId];
      res.status(200).json({ verified: true, message: "Biometrics linked successfully!" });
    } else {
      res.status(400).json({ verified: false });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to verify hardware." });
  }
});

// ==========================================
// 7. WEBAUTHN: HARDWARE LOGIN (VERIFY FACE/FINGER)
// ==========================================
app.post('/api/generate-auth-options', async (req, res) => {
  try {
    const { secureId } = req.body;
    
    const user = await User.findOne({ secureId });
    if (!user) return res.status(404).json({ error: "Node ID not found." });

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: user.passkeys?.map(key => ({
        id: key.credentialID,
        type: 'public-key',
      })) || [],
      userVerification: 'preferred',
    });

    userChallenges[secureId] = options.challenge;
    res.status(200).json(options);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Failed to generate biometric options." });
  }
});

app.post('/api/verify-auth', async (req, res) => {
  try {
    const { secureId, hardwareResponse } = req.body;

    const user = await User.findOne({ secureId });
    const expectedChallenge = userChallenges[secureId];

    if (!user || !expectedChallenge) {
      return res.status(400).json({ error: "Challenge expired or invalid." });
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: hardwareResponse,
        expectedChallenge,
        expectedOrigin,
        expectedRPID: rpID,
        authenticator: {
           credentialPublicKey: hardwareResponse.response.authenticatorData, 
           credentialID: hardwareResponse.id,
           counter: 0
        }
      });
    } catch (err) {
      console.error("Verification Math Failed:", err);
      return res.status(400).json({ verified: false, error: err.message });
    }

    if (verification.verified) {
      delete userChallenges[secureId]; 
      res.status(200).json({ verified: true, documentedName: user.documentedName });
    } else {
      res.status(400).json({ verified: false });
    }
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error during verification." });
  }
});

// ==========================================
// 8. START THE SERVER
// ==========================================
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Gloobal Web2 Backend running on port ${PORT}`);
});