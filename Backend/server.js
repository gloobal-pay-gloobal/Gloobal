require('dotenv').config();
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
      return res.status(200).json({
        message: 'This Secure ID is already registered. Continue to login.',
        alreadyRegistered: true,
        user: {
          fullName: existingUser.fullName,
          symbolId: existingUser.symbolId
        }
      });
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



// --- 3. SECURE LOGIN PROTOTYPE ---
app.post('/api/login', async (req, res) => {
  try {
    const { secureId, symbolId, pin } = req.body;
    const loginSymbolId = secureId || symbolId;

    if (!loginSymbolId || !pin) {
      return res.status(400).json({ message: 'Secure ID and PIN are required.' });
    }

    const user = await User.findOne({ symbolId: loginSymbolId });

    if (!user) {
      return res.status(404).json({ message: 'Secure ID not found.' });
    }

    const prototypePin = process.env.DEFAULT_LOGIN_PIN || '1234';

    if (String(pin) !== prototypePin) {
      return res.status(401).json({ message: 'Invalid PIN.' });
    }

    return res.status(200).json({
      message: 'Login successful.',
      user: {
        fullName: user.fullName,
        symbolId: user.symbolId,
        referralCount: user.referralCount,
        referredBy: user.referredBy
      }
    });
  } catch (error) {
    console.error('Login Error:', error);
    return res.status(500).json({ message: 'Server error during login.' });
  }
});



async function getWebAuthnServer() {
  return await import('@simplewebauthn/server');
}

function getWebAuthnConfig(req) {
  const requestOrigin = req.get('origin') || 'https://gloobal.netlify.app';
  const parsedOrigin = new URL(requestOrigin);

  return {
    rpName: 'Gloobal Pay',
    rpID: parsedOrigin.hostname,
    origin: requestOrigin
  };
}

// --- 3. DEVICE AUTHENTICATION PROTOTYPE ---
app.post('/api/passkey/register/options', async (req, res) => {
  try {
    const { symbolId } = req.body;

    if (!symbolId) {
      return res.status(400).json({ message: 'Secure ID is required.' });
    }

    const user = await User.findOne({ symbolId });

    if (!user) {
      return res.status(404).json({ message: 'Secure ID not found.' });
    }

    const {
      generateRegistrationOptions
    } = await getWebAuthnServer();

    const { rpName, rpID } = getWebAuthnConfig(req);
    const existingPasskeys = Array.isArray(user.passkeys) ? user.passkeys : [];

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new Uint8Array(Buffer.from(user.symbolId, 'utf8')),
      userName: user.symbolId,
      userDisplayName: user.fullName,
      attestationType: 'none',
      excludeCredentials: existingPasskeys.map((passkey) => ({
        id: passkey.id,
        transports: passkey.transports || []
      })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
        authenticatorAttachment: 'platform'
      }
    });

    user.currentChallenge = options.challenge;
    await user.save();

    return res.status(200).json(options);
  } catch (error) {
    console.error('Passkey registration options error:', error);
    return res.status(500).json({ message: `Could not create passkey registration options: ${error.message}` });
  }
});

app.post('/api/passkey/register/verify', async (req, res) => {
  try {
    const { symbolId, response } = req.body;

    if (!symbolId || !response) {
      return res.status(400).json({ message: 'Secure ID and device response are required.' });
    }

    const user = await User.findOne({ symbolId });

    if (!user || !user.currentChallenge) {
      return res.status(400).json({ message: 'Passkey registration was not started.' });
    }

    const {
      verifyRegistrationResponse
    } = await getWebAuthnServer();

    const { rpID, origin } = getWebAuthnConfig(req);

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: user.currentChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID
    });

    if (!verification.verified) {
      return res.status(400).json({ verified: false, message: 'Device authentication setup failed.' });
    }

    const { registrationInfo } = verification;
    const { credential, credentialDeviceType, credentialBackedUp } = registrationInfo;

    const passkeys = Array.isArray(user.passkeys) ? user.passkeys : [];

    passkeys.push({
      id: credential.id,
      publicKey: Buffer.from(credential.publicKey),
      counter: credential.counter,
      transports: credential.transports || response.response?.transports || [],
      deviceType: credentialDeviceType,
      backedUp: credentialBackedUp
    });

    user.passkeys = passkeys;
    user.currentChallenge = null;
    await user.save();

    return res.status(200).json({
      verified: true,
      message: 'Device authentication enabled.'
    });
  } catch (error) {
    console.error('Passkey registration verify error:', error);
    return res.status(500).json({ verified: false, message: `Could not verify device authentication setup: ${error.message}` });
  }
});

app.post('/api/passkey/auth/options', async (req, res) => {
  try {
    const { symbolId } = req.body;

    if (!symbolId) {
      return res.status(400).json({ message: 'Secure ID is required.' });
    }

    const user = await User.findOne({ symbolId });

    if (!user) {
      return res.status(404).json({ message: 'Secure ID not found.' });
    }

    const passkeys = Array.isArray(user.passkeys) ? user.passkeys : [];

    if (passkeys.length === 0) {
      return res.status(404).json({ message: 'No device authentication is registered yet.' });
    }

    const {
      generateAuthenticationOptions
    } = await getWebAuthnServer();

    const { rpID } = getWebAuthnConfig(req);

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: passkeys.map((passkey) => ({
        id: passkey.id,
        transports: passkey.transports || []
      })),
      userVerification: 'preferred'
    });

    user.currentChallenge = options.challenge;
    await user.save();

    return res.status(200).json(options);
  } catch (error) {
    console.error('Passkey authentication options error:', error);
    return res.status(500).json({ message: `Could not create device authentication options: ${error.message}` });
  }
});

app.post('/api/passkey/auth/verify', async (req, res) => {
  try {
    const { symbolId, response } = req.body;

    if (!symbolId || !response) {
      return res.status(400).json({ message: 'Secure ID and device response are required.' });
    }

    const user = await User.findOne({ symbolId });

    if (!user || !user.currentChallenge) {
      return res.status(400).json({ message: 'Device authentication was not started.' });
    }

    const passkeys = Array.isArray(user.passkeys) ? user.passkeys : [];
    const passkey = passkeys.find((item) => item.id === response.id);

    if (!passkey) {
      return res.status(404).json({ message: 'Registered device was not found.' });
    }

    const {
      verifyAuthenticationResponse
    } = await getWebAuthnServer();

    const { rpID, origin } = getWebAuthnConfig(req);

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: user.currentChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID,
      credential: {
        id: passkey.id,
        publicKey: passkey.publicKey,
        counter: passkey.counter,
        transports: passkey.transports || []
      }
    });

    if (!verification.verified) {
      return res.status(400).json({ verified: false, message: 'Device authentication failed.' });
    }

    passkey.counter = verification.authenticationInfo.newCounter;
    user.passkeys = passkeys;
    user.currentChallenge = null;
    await user.save();

    return res.status(200).json({
      verified: true,
      message: 'Device authentication successful.',
      user: {
        fullName: user.fullName,
        symbolId: user.symbolId
      }
    });
  } catch (error) {
    console.error('Passkey authentication verify error:', error);
    return res.status(500).json({ verified: false, message: `Could not verify device authentication: ${error.message}` });
  }
});

// --- 4. START SERVER ---
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
