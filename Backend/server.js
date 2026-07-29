require('dotenv').config();

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bcrypt = require('bcrypt');
const User = require('./models/User');
const Otp = require('./models/Otp');
const Pin = require('./models/Pin');
const Transaction = require('./models/Transaction');
const LedgerEntry = require('./models/LedgerEntry');
const Referral = require('./models/Referral');
const AssetSeed = require('./models/AssetSeed');
const { nationalNumberFrom } = require('./constants/dialCodes');


// The prototype float every account opens with. Kept here rather than only on
// the schema so accounts written before the field existed read back the same
// number a new one does, instead of undefined.
const DEFAULT_ACCOUNT_BALANCE = 10000;

const accountBalanceOf = (user) => {
  const raw = Number(user?.balance);
  return Number.isFinite(raw) ? raw : DEFAULT_ACCOUNT_BALANCE;
};

// Money is held as a Number, so every derived figure gets rounded to the
// minor unit before it is stored. 1000 * 0.0157 is 15.700000000000001 in
// binary floating point, and a balance carrying that dust would drift a
// little further with every payment.
const toMinorUnit = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

const app = express();

// Middleware
app.use(express.json());
app.use(cors());

// MongoDB Connection
const mongoURI = process.env.MONGO_URI || 'YOUR_MONGODB_CONNECTION_STRING_HERE';

mongoose.connect(mongoURI)
  .then(() => console.log('Connected to MongoDB Atlas'))
  .catch((err) => console.error('MongoDB Connection Error:', err));

const normalizeText = (value) =>
  String(value || '').trim().replace(/\s+/g, ' ').toLowerCase();

const normalizeMobileNumber = (value) => {
  const raw = String(value || '').trim();
  const digits = raw.replace(/\D/g, '');

  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 11 && digits.startsWith('0')) return `+91${digits.slice(1)}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;

  return raw;
};

// The shortest national number we'll treat as identifying on its own. Any
// shorter and a suffix match says nothing useful — plenty of unrelated
// numbers share their last few digits.
const MIN_IDENTIFYING_NATIONAL_LENGTH = 7;

const escapeRegExp = (value) => String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

// Finds an account whose stored number carries the same subscriber digits
// as the one submitted, regardless of which country calling code sits in
// front of them. Used to tell "you picked the wrong flag" apart from "this
// number has never been registered", which a plain exact-match lookup
// can't distinguish.
const findUserByNationalNumber = async (mobileNumber) => {
  const national = nationalNumberFrom(mobileNumber);

  if (!national || national.length < MIN_IDENTIFYING_NATIONAL_LENGTH) return null;

  return User.findOne({
    mobileNumber: new RegExp(`^\\+\\d{1,4}${escapeRegExp(national)}$`)
  });
};

const publicUserPayload = async (user) => {
  const hasPin = Boolean(await Pin.exists({ userId: user._id }));
  const hasPasskey = Array.isArray(user.passkeys) && user.passkeys.length > 0;
  const joinedDate = user.createdAt || null;

  return {
    fullName: user.fullName,
    email: user.email || '',
    mobileNumber: user.mobileNumber || user.fullName,
    symbolId: user.symbolId,
    referredBy: user.referredBy || null,
    referralCount: user.referralCount || 0,
    cashbackRate: Number(user.cashbackRate) || 0,
    // Accounts created before the balance field existed have no value stored,
    // and `undefined` would render as a blank balance card rather than a
    // number. They open at the same float a new account does.
    balance: Number.isFinite(Number(user.balance)) ? Number(user.balance) : DEFAULT_ACCOUNT_BALANCE,
    symbolIdHistory: Array.isArray(user.symbolIdHistory)
      ? user.symbolIdHistory.map((entry) => ({
          symbolId: entry.symbolId,
          changedAt: entry.changedAt,
          replacedBy: entry.replacedBy || null
        }))
      : [],
    hasPin,
    hasPasskey,
    createdAt: joinedDate,
    joinedDate
  };
};


// OTP Prototype APIs
const validOtpPurposes = ['registration', 'login', 'pin_reset', 'mobile_change'];

const resolveOtpPurpose = (purpose) => {
  const cleanPurpose = String(purpose || 'registration').trim();

  return validOtpPurposes.includes(cleanPurpose) ? cleanPurpose : 'registration';
};

const REGISTRATION_OTP_WINDOW_MS = 10 * 60 * 1000;

const findVerifiedRegistrationOtp = async (mobileNumber) => {
  const verifiedAfter = new Date(Date.now() - REGISTRATION_OTP_WINDOW_MS);

  return Otp.findOne({
    mobileNumber,
    purpose: 'registration',
    verifiedAt: { $ne: null, $gte: verifiedAfter },
    consumedAt: null
  }).sort({ verifiedAt: -1 });
};

const consumeOtp = async (otpRecord) => {
  otpRecord.consumedAt = new Date();
  await otpRecord.save();
};

const PIN_RESET_OTP_WINDOW_MS = 10 * 60 * 1000;

const findVerifiedPinResetOtp = async (mobileNumber) => {
  const verifiedAfter = new Date(Date.now() - PIN_RESET_OTP_WINDOW_MS);

  return Otp.findOne({
    mobileNumber,
    purpose: 'pin_reset',
    verifiedAt: { $ne: null, $gte: verifiedAfter },
    consumedAt: null
  }).sort({ verifiedAt: -1 });
};

app.post('/api/otp/send', async (req, res) => {
  try {
    const { mobileNumber, purpose } = req.body;
    const cleanMobileNumber = normalizeMobileNumber(mobileNumber);
    const cleanPurpose = resolveOtpPurpose(purpose);

    if (!cleanMobileNumber) {
      return res.status(400).json({
        message: 'Mobile number is required.'
      });
    }

    // Country-code lock. An account is identified by its *full* stored
    // number including the calling code, so the same subscriber digits
    // submitted under a different flag ("+91 8114491364" registered,
    // "+44 8114491364" submitted) must not be treated as the same person.
    // Runs before the OTP is generated, so a mismatched country never gets
    // a code sent to it at all.
    const registeredUser = await User.findOne({ mobileNumber: cleanMobileNumber });

    // Registration must be blocked at step one for a number that already has
    // an account — otherwise the person gets an OTP, picks a Secure ID, and
    // only discovers the number is taken at the referral step. Send back a
    // 409 so the phone screen can stop the flow there and offer login
    // instead. Only applies to registration; login/pin_reset/mobile_change
    // all legitimately require an existing account.
    if (registeredUser && cleanPurpose === 'registration') {
      return res.status(409).json({
        error: 'This number is already registered. Please log in instead.',
        message: 'This number is already registered. Please log in instead.'
      });
    }

    if (!registeredUser) {
      const sameDigitsUser = await findUserByNationalNumber(cleanMobileNumber);

      if (sameDigitsUser) {
        return res.status(400).json({
          error: 'Country code does not match the registered number.',
          message: 'Country code does not match the registered number.'
        });
      }

      // Registration is the one purpose that legitimately has no account
      // yet — a brand-new number has to be allowed through here. Every
      // other purpose (login, PIN reset, mobile change) is only meaningful
      // for a number that already belongs to somebody.
      if (cleanPurpose !== 'registration') {
        return res.status(404).json({
          error: 'No account found for this number.',
          message: 'No account found for this number.'
        });
      }
    }

    const prototypeOtp = process.env.PROTOTYPE_OTP || '123456';
    const otpHash = await bcrypt.hash(prototypeOtp, 10);
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);

    await Otp.create({
      mobileNumber: cleanMobileNumber,
      otpHash,
      purpose: cleanPurpose,
      expiresAt
    });

    return res.status(200).json({
      message: 'Prototype OTP sent successfully.',
      mobileNumber: cleanMobileNumber,
      purpose: cleanPurpose,
      prototypeOtp
    });
  } catch (error) {
    console.error('OTP send error:', error);

    return res.status(500).json({
      message: 'Server error while sending OTP.'
    });
  }
});

app.post('/api/otp/verify', async (req, res) => {
  try {
    const { mobileNumber, otp, purpose } = req.body;
    const cleanMobileNumber = normalizeMobileNumber(mobileNumber);
    const cleanPurpose = resolveOtpPurpose(purpose);
    const cleanOtp = String(otp || '').trim();

    if (!cleanMobileNumber || !cleanOtp) {
      return res.status(400).json({
        verified: false,
        message: 'Mobile number and OTP are required.'
      });
    }

    const latestOtp = await Otp.findOne({
      mobileNumber: cleanMobileNumber,
      purpose: cleanPurpose,
      verifiedAt: null
    }).sort({ createdAt: -1 });

    if (!latestOtp) {
      return res.status(404).json({
        verified: false,
        message: 'OTP was not requested or already used.'
      });
    }

    if (latestOtp.expiresAt < new Date()) {
      return res.status(400).json({
        verified: false,
        message: 'OTP has expired. Please request a new OTP.'
      });
    }

    if (latestOtp.attempts >= latestOtp.maxAttempts) {
      return res.status(429).json({
        verified: false,
        message: 'Too many OTP attempts. Please request a new OTP.'
      });
    }

    const isMatch = await bcrypt.compare(cleanOtp, latestOtp.otpHash);

    if (!isMatch) {
      latestOtp.attempts += 1;
      await latestOtp.save();

      return res.status(401).json({
        verified: false,
        message: 'Invalid OTP.'
      });
    }

    latestOtp.verifiedAt = new Date();
    latestOtp.expiresAt = new Date(Date.now() + REGISTRATION_OTP_WINDOW_MS);
    await latestOtp.save();

    return res.status(200).json({
      verified: true,
      message: 'OTP verified successfully.',
      mobileNumber: cleanMobileNumber,
      purpose: cleanPurpose
    });
  } catch (error) {
    console.error('OTP verify error:', error);

    return res.status(500).json({
      verified: false,
      message: 'Server error while verifying OTP.'
    });
  }
});

// PIN Prototype APIs
const isValidPinFormat = (pin) => /^\d{4,6}$/.test(String(pin || '').trim());

app.post('/api/pin/set', async (req, res) => {
  try {
    const { symbolId, pin } = req.body;
    const cleanSymbolId = String(symbolId || '').trim();
    const cleanPin = String(pin || '').trim();

    if (!cleanSymbolId || !cleanPin) {
      return res.status(400).json({
        message: 'Secure ID and PIN are required.'
      });
    }

    if (!isValidPinFormat(cleanPin)) {
      return res.status(400).json({
        message: 'PIN must be 4 to 6 digits.'
      });
    }

    const user = await User.findOne({ symbolId: cleanSymbolId });

    if (!user) {
      return res.status(404).json({
        message: 'Secure ID not found.'
      });
    }

    const pinHash = await bcrypt.hash(cleanPin, 10);

    await Pin.findOneAndUpdate(
      { userId: user._id },
      {
        userId: user._id,
        pinHash,
        failedAttempts: 0,
        lockedUntil: null,
        changedAt: new Date()
      },
      {
        upsert: true,
        returnDocument: 'after',
        setDefaultsOnInsert: true
      }
    );

    return res.status(200).json({
      message: 'PIN set successfully.',
      user: await publicUserPayload(user)
    });
  } catch (error) {
    console.error('PIN set error:', error);

    return res.status(500).json({
      message: 'Server error while setting PIN.'
    });
  }
});

app.post('/api/pin/verify', async (req, res) => {
  try {
    const { symbolId, pin } = req.body;
    const cleanSymbolId = String(symbolId || '').trim();
    const cleanPin = String(pin || '').trim();

    if (!cleanSymbolId || !cleanPin) {
      return res.status(400).json({
        verified: false,
        message: 'Secure ID and PIN are required.'
      });
    }

    const user = await User.findOne({ symbolId: cleanSymbolId });

    if (!user) {
      return res.status(404).json({
        verified: false,
        message: 'Secure ID not found.'
      });
    }

    const pinRecord = await Pin.findOne({ userId: user._id });

    if (!pinRecord) {
      const prototypePin = process.env.DEFAULT_LOGIN_PIN || '1234';

      if (cleanPin === prototypePin) {
        return res.status(200).json({
          verified: true,
          prototypeFallback: true,
          message: 'Prototype PIN verified successfully.',
          user: await publicUserPayload(user)
        });
      }

      return res.status(404).json({
        verified: false,
        message: 'PIN is not set for this Secure ID.'
      });
    }

    if (pinRecord.lockedUntil && pinRecord.lockedUntil > new Date()) {
      return res.status(423).json({
        verified: false,
        message: 'PIN is temporarily locked. Please try again later.'
      });
    }

    const isMatch = await bcrypt.compare(cleanPin, pinRecord.pinHash);

    if (!isMatch) {
      pinRecord.failedAttempts += 1;

      if (pinRecord.failedAttempts >= 5) {
        pinRecord.lockedUntil = new Date(Date.now() + 10 * 60 * 1000);
      }

      await pinRecord.save();

      return res.status(401).json({
        verified: false,
        message: 'Invalid PIN.'
      });
    }

    pinRecord.failedAttempts = 0;
    pinRecord.lockedUntil = null;
    pinRecord.lastVerifiedAt = new Date();
    await pinRecord.save();

    return res.status(200).json({
      verified: true,
      message: 'PIN verified successfully.',
      user: await publicUserPayload(user)
    });
  } catch (error) {
    console.error('PIN verify error:', error);

    return res.status(500).json({
      verified: false,
      message: 'Server error while verifying PIN.'
    });
  }
});


// Reset PIN using verified OTP
app.post('/api/pin/reset', async (req, res) => {
  try {
    const { symbolId, mobileNumber, pin, newPin } = req.body;
    const cleanSymbolId = String(symbolId || '').trim();
    const cleanMobileNumber = normalizeMobileNumber(mobileNumber);
    const cleanPin = String(newPin || pin || '').trim();

    if (!cleanSymbolId || !cleanMobileNumber || !cleanPin) {
      return res.status(400).json({
        message: 'Secure ID, mobile number, and new PIN are required.'
      });
    }

    if (!isValidPinFormat(cleanPin)) {
      return res.status(400).json({
        message: 'PIN must be 4 to 6 digits.'
      });
    }

    const user = await User.findOne({ symbolId: cleanSymbolId });

    if (!user) {
      return res.status(404).json({
        message: 'Secure ID not found.'
      });
    }

    const userMobile = normalizeMobileNumber(user.mobileNumber || user.fullName);

    if (normalizeText(userMobile) !== normalizeText(cleanMobileNumber)) {
      return res.status(409).json({
        message: 'Mobile number does not match this Secure ID.'
      });
    }

    const verifiedPinResetOtp = await findVerifiedPinResetOtp(cleanMobileNumber);

    if (!verifiedPinResetOtp) {
      return res.status(403).json({
        message: 'Please verify OTP before resetting PIN.'
      });
    }

    const pinHash = await bcrypt.hash(cleanPin, 10);

    await Pin.findOneAndUpdate(
      { userId: user._id },
      {
        userId: user._id,
        pinHash,
        failedAttempts: 0,
        lockedUntil: null,
        lastVerifiedAt: null,
        changedAt: new Date()
      },
      {
        upsert: true,
        returnDocument: 'after',
        setDefaultsOnInsert: true
      }
    );

    await consumeOtp(verifiedPinResetOtp);

    return res.status(200).json({
      message: 'PIN reset successfully.',
      user: await publicUserPayload(user)
    });
  } catch (error) {
    console.error('PIN reset error:', error);

    return res.status(500).json({
      message: 'Server error while resetting PIN.'
    });
  }
});
// Registration and Multi-Level Referral Engine
app.post('/api/register-symbol', async (req, res) => {
  try {
    const { fullName, mobileNumber, symbolId, referredBy } = req.body;

    const cleanMobileNumber = normalizeMobileNumber(mobileNumber || fullName);
    const cleanFullName = cleanMobileNumber;
    const cleanSymbolId = String(symbolId || '').trim();
    const cleanReferrer = String(referredBy || '').trim();

    if (!cleanMobileNumber || !cleanSymbolId) {
      return res.status(400).json({
        message: 'Mobile number and Secure ID are required.'
      });
    }

    if (Array.from(cleanSymbolId).length !== 12) {
      return res.status(400).json({
        message: 'Secure ID must contain exactly 12 symbols.'
      });
    }

    const verifiedRegistrationOtp = await findVerifiedRegistrationOtp(cleanMobileNumber);

    if (!verifiedRegistrationOtp) {
      return res.status(403).json({
        message: 'Please verify OTP before registration.'
      });
    }

    const existingUserBySymbol = await User.findOne({ symbolId: cleanSymbolId });

    if (existingUserBySymbol) {
      const existingMobile = normalizeMobileNumber(
        existingUserBySymbol.mobileNumber || existingUserBySymbol.fullName
      );

      if (normalizeText(existingMobile) !== normalizeText(cleanMobileNumber)) {
        return res.status(409).json({
          message: 'This Secure ID is already registered with a different mobile number.',
          alreadyRegistered: true,
          ownerMismatch: true
        });
      }

      if (!existingUserBySymbol.mobileNumber) {
        existingUserBySymbol.mobileNumber = cleanMobileNumber;
        existingUserBySymbol.fullName = existingUserBySymbol.fullName || cleanFullName;
        await existingUserBySymbol.save();
      }

      await consumeOtp(verifiedRegistrationOtp);

      return res.status(200).json({
        message: 'This Secure ID is already registered. Continue to login.',
        alreadyRegistered: true,
        user: await publicUserPayload(existingUserBySymbol)
      });
    }

    const existingUserByMobile = await User.findOne({
      $or: [
        { mobileNumber: cleanMobileNumber },
        { fullName: cleanMobileNumber }
      ]
    });

    if (existingUserByMobile && existingUserByMobile.symbolId !== cleanSymbolId) {
      return res.status(409).json({
        message: 'This mobile number is already linked with another Secure ID. Please login with that Secure ID.'
      });
    }

    let validReferrerId = null;
    let referralChain = [];
    // Kept around past this block so the Referral edge can be written once
    // the new user actually exists and has an _id to point at.
    let referrerUser = null;

    if (cleanReferrer) {
      referrerUser = await User.findOne({ symbolId: cleanReferrer });

      if (referrerUser) {
        validReferrerId = referrerUser.symbolId;
        referralChain = [
          referrerUser.symbolId,
          ...(Array.isArray(referrerUser.referralChain) ? referrerUser.referralChain : [])
        ].slice(0, 3);
      }
    }

    const newUser = new User({
      fullName: cleanFullName,
      mobileNumber: cleanMobileNumber,
      symbolId: cleanSymbolId,
      referredBy: validReferrerId,
      referralChain
    });

    await newUser.save();

    if (validReferrerId) {
      await User.updateOne(
        { symbolId: validReferrerId },
        { $inc: { referralCount: 1 } }
      );
    }

    // The referral edge itself. Deliberately non-fatal: a referral code
    // that matches nobody, or a write that fails for any reason, must not
    // cost somebody their registration — they simply end up with no
    // referrer. A code that was supplied but matched nothing is logged so
    // the miss is at least visible server-side.
    let referralApplied = false;
    let referralWarning = null;

    if (cleanReferrer) {
      if (referrerUser) {
        try {
          await Referral.create({
            referrerId: referrerUser._id,
            referredId: newUser._id,
            referrerSymbolId: referrerUser.symbolId,
            referredSymbolId: newUser.symbolId,
            status: 'completed'
          });
          referralApplied = true;
        } catch (referralError) {
          console.warn('Referral save skipped:', referralError.message);
          referralWarning = 'Your referral code could not be recorded, but your Gloobal ID was created.';
        }
      } else {
        console.warn(`Referral code did not match any user: ${cleanReferrer}`);
        referralWarning = 'That referral code does not match any Gloobal ID, so no referrer was recorded.';
      }
    }

    await consumeOtp(verifiedRegistrationOtp);

    // referralApplied / referralWarning are reported back rather than kept
    // server-side only. The registration itself still succeeds either way —
    // a bad referral code must not cost somebody their account — but the
    // caller now has something to say about it, instead of the silent drop
    // that made a mistyped code look like it had been accepted.
    return res.status(201).json({
      message: 'Secure ID registered successfully.',
      referralApplied,
      referralWarning,
      user: await publicUserPayload(newUser)
    });
  } catch (error) {
    if (error.code === 11000) {
      const duplicateField = Object.keys(error.keyPattern || {})[0] || 'identity';

      return res.status(409).json({
        message:
          duplicateField === 'mobileNumber'
            ? 'This mobile number is already linked with another Secure ID. Please login.'
            : 'This Secure ID is already registered.'
      });
    }

    console.error('Registration Error:', error);

    return res.status(500).json({
      message: 'Server error during registration.'
    });
  }
});
// Secure Login
// Login by Gloobal ID + PIN.
//
// There is deliberately no country-code check here, and adding one would
// be checking nothing: this request carries no country at all. The Gloobal
// ID is globally unique and is itself the credential, so unlike
// /api/otp/send — where the same subscriber digits can legitimately exist
// under two different calling codes and the flag is the only thing telling
// them apart — there is no ambiguity for a country to resolve.
//
// What *was* wrong is presentational and lives on the client: after a
// successful login the app kept whatever flag the person happened to leave
// on the landing screen, so a +91 account could be shown as a UK one. The
// response below carries mobileNumber precisely so the client can derive
// the account's real country instead of guessing.
app.post('/api/login', async (req, res) => {
  try {
    const { secureId, symbolId, pin } = req.body;
    const loginSymbolId = String(secureId || symbolId || '').trim();
    const cleanPin = String(pin || '').trim();

    if (!loginSymbolId || !cleanPin) {
      return res.status(400).json({
        message: 'Secure ID and PIN are required.'
      });
    }

    if (!isValidPinFormat(cleanPin)) {
      return res.status(400).json({
        message: 'PIN must be 4 to 6 digits.'
      });
    }

    const user = await User.findOne({ symbolId: loginSymbolId });

    if (!user) {
      return res.status(404).json({
        message: 'Secure ID not found.'
      });
    }

    const pinRecord = await Pin.findOne({ userId: user._id });

    if (!pinRecord) {
      return res.status(404).json({
        message: 'PIN is not set for this Secure ID. Please set your PIN first.'
      });
    }

    if (pinRecord.lockedUntil && pinRecord.lockedUntil > new Date()) {
      return res.status(423).json({
        message: 'PIN is temporarily locked. Please try again later.'
      });
    }

    const isMatch = await bcrypt.compare(cleanPin, pinRecord.pinHash);

    if (!isMatch) {
      pinRecord.failedAttempts += 1;

      if (pinRecord.failedAttempts >= 5) {
        pinRecord.lockedUntil = new Date(Date.now() + 10 * 60 * 1000);
      }

      await pinRecord.save();

      return res.status(401).json({
        message: 'Invalid PIN.'
      });
    }

    pinRecord.failedAttempts = 0;
    pinRecord.lockedUntil = null;
    pinRecord.lastVerifiedAt = new Date();
    await pinRecord.save();

    return res.status(200).json({
      message: 'Login successful.',
      user: await publicUserPayload(user)
    });
  } catch (error) {
    console.error('Login Error:', error);

    return res.status(500).json({
      message: 'Server error during login.'
    });
  }
});

// Profile Details
app.get('/api/profile/:symbolId', async (req, res) => {
  try {
    const cleanSymbolId = String(req.params.symbolId || '').trim();

    if (!cleanSymbolId) {
      return res.status(400).json({
        message: 'Secure ID is required.'
      });
    }

    const user = await User.findOne({ symbolId: cleanSymbolId });

    if (!user) {
      return res.status(404).json({
        message: 'Profile not found.'
      });
    }

    return res.status(200).json({
      message: 'Profile loaded successfully.',
      user: await publicUserPayload(user)
    });
  } catch (error) {
    console.error('Profile Error:', error);

    return res.status(500).json({
      message: 'Server error while loading profile.'
    });
  }
});

// Everyone who registered using this Gloobal ID as their referral code.
// The response carries Gloobal IDs and join dates only — never mobile
// numbers, emails, or internal ObjectIds, since a referrer is not entitled
// to their referrals' contact details.
app.get('/api/referrals/:symbolId', async (req, res) => {
  try {
    const cleanSymbolId = String(req.params.symbolId || '').trim();

    if (!cleanSymbolId) {
      return res.status(400).json({
        message: 'Gloobal ID is required.'
      });
    }

    const referrer = await User.findOne({ symbolId: cleanSymbolId });

    if (!referrer) {
      return res.status(404).json({
        message: 'No account found for this Gloobal ID.'
      });
    }

    const referrals = await Referral.find({ referrerId: referrer._id }).sort({ createdAt: -1 });

    return res.status(200).json({
      referrals: referrals.map((referral) => ({
        referredSymbolId: referral.referredSymbolId,
        createdAt: referral.createdAt,
        status: referral.status
      })),
      total: referrals.length
    });
  } catch (error) {
    console.error('Referral list error:', error);

    return res.status(500).json({
      message: 'Server error while loading referrals.'
    });
  }
});

// The eight Gloobal Symbols a Secure ID is built from. Kept here rather
// than imported from the frontend so the server validates against its own
// copy of the alphabet.
const GLOOBAL_SYMBOLS = ['−', '+', '×', '=', '○', '□', '●', '■'];
const SYMBOL_ID_LENGTH = 12;

const isValidSymbolId = (value) => {
  const chars = Array.from(String(value || ''));

  return chars.length === SYMBOL_ID_LENGTH && chars.every((ch) => GLOOBAL_SYMBOLS.includes(ch));
};

// Changing the Gloobal ID someone signed up with. The ID is the identity
// every other route keys off, so the rename has to carry the referral
// graph with it — otherwise a changed ID silently detaches the person from
// everyone they referred and from whoever referred them.
//
// Identity proof here is the *current* symbolId, consistent with every
// other route in this prototype. That is not authentication: anyone who
// knows an ID can rename it. Recorded plainly rather than dressed up —
// this route inherits the codebase-wide missing auth layer and must be put
// behind real session checks along with the rest of them.
app.patch('/api/profile/change-symbol-id', async (req, res) => {
  try {
    const currentSymbolId = String(req.body.currentSymbolId || '').trim();
    const newSymbolId = String(req.body.newSymbolId || '').trim();

    if (!currentSymbolId || !newSymbolId) {
      return res.status(400).json({
        error: 'Current and new Gloobal ID are both required.',
        message: 'Current and new Gloobal ID are both required.'
      });
    }

    if (!isValidSymbolId(newSymbolId)) {
      return res.status(400).json({
        error: 'Invalid Gloobal ID format.',
        message: 'Invalid Gloobal ID format.'
      });
    }

    if (newSymbolId === currentSymbolId) {
      return res.status(400).json({
        error: 'That is already your Gloobal ID.',
        message: 'That is already your Gloobal ID.'
      });
    }

    const user = await User.findOne({ symbolId: currentSymbolId });

    if (!user) {
      return res.status(404).json({
        error: 'No account found for this Gloobal ID.',
        message: 'No account found for this Gloobal ID.'
      });
    }

    const taken = await User.findOne({ symbolId: newSymbolId });

    if (taken) {
      return res.status(409).json({
        error: 'This Gloobal ID is already taken. Please choose another.',
        message: 'This Gloobal ID is already taken. Please choose another.'
      });
    }

    // Record which ID this account used to be known by, and when — before
    // the new one is written, so the trail is complete and correctly dated.
    user.symbolIdHistory = [
      ...(Array.isArray(user.symbolIdHistory) ? user.symbolIdHistory : []),
      { symbolId: currentSymbolId, changedAt: new Date(), replacedBy: newSymbolId }
    ];
    user.symbolId = newSymbolId;
    // fullName mirrors the mobile number for these prototype accounts, so
    // it is deliberately left alone — only the ID changes.
    await user.save();

    // Re-point every place the old ID was written down. Transactions and
    // ledger entries key off ObjectIds, so they need no rewrite; these
    // three are the only symbolId-valued references in the schema.
    await Promise.all([
      Referral.updateMany({ referrerSymbolId: currentSymbolId }, { $set: { referrerSymbolId: newSymbolId } }),
      Referral.updateMany({ referredSymbolId: currentSymbolId }, { $set: { referredSymbolId: newSymbolId } }),
      User.updateMany({ referredBy: currentSymbolId }, { $set: { referredBy: newSymbolId } }),
      User.updateMany(
        { referralChain: currentSymbolId },
        { $set: { 'referralChain.$[entry]': newSymbolId } },
        { arrayFilters: [{ entry: currentSymbolId }] }
      )
    ]);

    return res.status(200).json({
      message: 'Gloobal ID updated.',
      newSymbolId,
      user: await publicUserPayload(user)
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        error: 'This Gloobal ID is already taken. Please choose another.',
        message: 'This Gloobal ID is already taken. Please choose another.'
      });
    }

    console.error('Change Gloobal ID error:', error);

    return res.status(500).json({
      error: 'Server error while updating Gloobal ID.',
      message: 'Server error while updating Gloobal ID.'
    });
  }
});

// The public referral deep link: https://gloobal.id/r/<encoded Gloobal ID>.
// The frontend builds the path with encodeURIComponent, so a Gloobal ID of
// ■■■■■■■■■■□+ arrives here as %E2%96%A0…%E2%96%A1%2B. Express decodes
// path params itself, but the decode is done again defensively below —
// nothing in the symbol alphabet is a '%', so a second pass over an
// already-decoded ID is a no-op, and the try/catch keeps a malformed
// sequence from throwing a 500 instead of the 404 it deserves.
const REFERRAL_APP_BASE_URL = process.env.APP_BASE_URL || 'https://gloobal.netlify.app';

const safeDecodeSymbolId = (raw) => {
  const value = String(raw || '');
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

app.get('/r/:symbolId', async (req, res) => {
  try {
    const symbolId = safeDecodeSymbolId(req.params.symbolId).trim();

    if (!symbolId) {
      return res.status(404).json({
        error: 'Referral link is invalid or expired.'
      });
    }

    const user = await User.findOne({ symbolId });

    if (!user) {
      return res.status(404).json({
        error: 'Referral link is invalid or expired.'
      });
    }

    // Hand the visitor to the app with the referrer pre-filled. Re-encoding
    // is required: the query value goes through the same symbol set, and an
    // unencoded '+' in a query string means a space.
    return res.redirect(`${REFERRAL_APP_BASE_URL}/?ref=${encodeURIComponent(symbolId)}`);
  } catch (error) {
    console.error('Referral link error:', error);

    return res.status(500).json({
      error: 'Server error while resolving referral link.'
    });
  }
});

app.put('/api/profile/:symbolId', async (req, res) => {
  try {
    const cleanSymbolId = String(req.params.symbolId || '').trim();

    if (!cleanSymbolId) {
      return res.status(400).json({
        message: 'Secure ID is required.'
      });
    }

    const user = await User.findOne({ symbolId: cleanSymbolId });

    if (!user) {
      return res.status(404).json({
        message: 'Profile not found.'
      });
    }

    const updates = {};

    if (Object.prototype.hasOwnProperty.call(req.body, 'fullName')) {
      const cleanFullName = String(req.body.fullName || '').trim();

      if (!cleanFullName) {
        return res.status(400).json({
          message: 'Name cannot be empty.'
        });
      }

      if (cleanFullName.length > 80) {
        return res.status(400).json({
          message: 'Name cannot be more than 80 characters.'
        });
      }

      updates.fullName = cleanFullName;
    }

    if (Object.prototype.hasOwnProperty.call(req.body, 'email')) {
      const cleanEmail = String(req.body.email || '').trim().toLowerCase();

      if (cleanEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return res.status(400).json({
          message: 'Please enter a valid email address.'
        });
      }

      if (cleanEmail.length > 120) {
        return res.status(400).json({
          message: 'Email cannot be more than 120 characters.'
        });
      }

      updates.email = cleanEmail;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        message: 'No profile changes provided.'
      });
    }

    Object.assign(user, updates);
    await user.save();

    return res.status(200).json({
      message: 'Profile updated successfully.',
      user: await publicUserPayload(user)
    });
  } catch (error) {
    console.error('Profile update error:', error);

    return res.status(500).json({
      message: 'Server error while updating profile.'
    });
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

// Passkey Status
app.post('/api/passkey/status', async (req, res) => {
  try {
    const { symbolId } = req.body;
    const cleanSymbolId = String(symbolId || '').trim();

    if (!cleanSymbolId) {
      return res.status(400).json({
        message: 'Secure ID is required.'
      });
    }

    const user = await User.findOne({ symbolId: cleanSymbolId });

    if (!user) {
      return res.status(404).json({
        message: 'Secure ID not found.'
      });
    }

    return res.status(200).json({
      hasPasskey: Array.isArray(user.passkeys) && user.passkeys.length > 0,
      user: await publicUserPayload(user)
    });
  } catch (error) {
    console.error('Passkey status error:', error);

    return res.status(500).json({
      message: 'Could not check device authentication status.'
    });
  }
});

// Device Authentication Prototype - Register Options
app.post('/api/passkey/register/options', async (req, res) => {
  try {
    const { symbolId } = req.body;
    const cleanSymbolId = String(symbolId || '').trim();

    if (!cleanSymbolId) {
      return res.status(400).json({
        message: 'Secure ID is required.'
      });
    }

    const user = await User.findOne({ symbolId: cleanSymbolId });

    if (!user) {
      return res.status(404).json({
        message: 'Secure ID not found.'
      });
    }

    const existingPasskeys = Array.isArray(user.passkeys) ? user.passkeys : [];

    if (existingPasskeys.length > 0) {
      return res.status(409).json({
        message: 'Device authentication is already registered for this Secure ID. Please verify existing device.'
      });
    }

    const { generateRegistrationOptions } = await getWebAuthnServer();
    const { rpName, rpID } = getWebAuthnConfig(req);

    const options = await generateRegistrationOptions({
      rpName,
      rpID,
      userID: new Uint8Array(Buffer.from(user.symbolId, 'utf8')),
      userName: user.symbolId,
      userDisplayName: user.mobileNumber || user.fullName,
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

    return res.status(500).json({
      message: `Could not create passkey registration options: ${error.message}`
    });
  }
});

// Device Authentication Prototype - Register Verify
app.post('/api/passkey/register/verify', async (req, res) => {
  try {
    const { symbolId, response } = req.body;
    const cleanSymbolId = String(symbolId || '').trim();

    if (!cleanSymbolId || !response) {
      return res.status(400).json({
        message: 'Secure ID and device response are required.'
      });
    }

    const user = await User.findOne({ symbolId: cleanSymbolId });

    if (!user || !user.currentChallenge) {
      return res.status(400).json({
        message: 'Passkey registration was not started.'
      });
    }

    const passkeys = Array.isArray(user.passkeys) ? user.passkeys : [];

    if (passkeys.length > 0) {
      user.currentChallenge = null;
      await user.save();

      return res.status(409).json({
        verified: false,
        message: 'Device authentication is already registered for this Secure ID. Please verify existing device.'
      });
    }

    const { verifyRegistrationResponse } = await getWebAuthnServer();
    const { rpID, origin } = getWebAuthnConfig(req);

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: user.currentChallenge,
      expectedOrigin: origin,
      expectedRPID: rpID
    });

    if (!verification.verified) {
      return res.status(400).json({
        verified: false,
        message: 'Device authentication setup failed.'
      });
    }

    const { registrationInfo } = verification;
    const { credential, credentialDeviceType, credentialBackedUp } = registrationInfo;

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
      message: 'Device authentication enabled.',
      user: await publicUserPayload(user)
    });
  } catch (error) {
    console.error('Passkey registration verify error:', error);

    return res.status(500).json({
      verified: false,
      message: `Could not verify device authentication setup: ${error.message}`
    });
  }
});

// Device Authentication Prototype - Auth Options
app.post('/api/passkey/auth/options', async (req, res) => {
  try {
    const { symbolId } = req.body;
    const cleanSymbolId = String(symbolId || '').trim();

    if (!cleanSymbolId) {
      return res.status(400).json({
        message: 'Secure ID is required.'
      });
    }

    const user = await User.findOne({ symbolId: cleanSymbolId });

    if (!user) {
      return res.status(404).json({
        message: 'Secure ID not found.'
      });
    }

    const passkeys = Array.isArray(user.passkeys) ? user.passkeys : [];

    if (passkeys.length === 0) {
      return res.status(404).json({
        message: 'No device authentication is registered yet.'
      });
    }

    const { generateAuthenticationOptions } = await getWebAuthnServer();
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

    return res.status(500).json({
      message: `Could not create device authentication options: ${error.message}`
    });
  }
});

// Device Authentication Prototype - Auth Verify
app.post('/api/passkey/auth/verify', async (req, res) => {
  try {
    const { symbolId, response } = req.body;
    const cleanSymbolId = String(symbolId || '').trim();

    if (!cleanSymbolId || !response) {
      return res.status(400).json({
        message: 'Secure ID and device response are required.'
      });
    }

    const user = await User.findOne({ symbolId: cleanSymbolId });

    if (!user || !user.currentChallenge) {
      return res.status(400).json({
        message: 'Device authentication was not started.'
      });
    }

    const passkeys = Array.isArray(user.passkeys) ? user.passkeys : [];
    const passkey = passkeys.find((item) => item.id === response.id);

    if (!passkey) {
      return res.status(404).json({
        message: 'Registered device was not found.'
      });
    }

    const { verifyAuthenticationResponse } = await getWebAuthnServer();
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
      return res.status(400).json({
        verified: false,
        message: 'Device authentication failed.'
      });
    }

    passkey.counter = verification.authenticationInfo.newCounter;
    user.passkeys = passkeys;
    user.currentChallenge = null;
    await user.save();

    return res.status(200).json({
      verified: true,
      message: 'Device authentication successful.',
      user: await publicUserPayload(user)
    });
  } catch (error) {
    console.error('Passkey authentication verify error:', error);

    return res.status(500).json({
      verified: false,
      message: `Could not verify device authentication: ${error.message}`
    });
  }
});

// Start Server
const PORT = process.env.PORT || 5000;



// -------------------------
// Transaction Prototype APIs
// -------------------------

function normalizeTransactionPhoneLookup(value) {
  const raw = String(value || '').trim();

  if (!raw) {
    return null;
  }

  const compact = raw.replace(/[\s\-()]/g, '');

  if (/^\+\d{7,15}$/.test(compact)) {
    return compact;
  }

  const digits = compact.replace(/\D/g, '');

  if (/^\d{10}$/.test(digits)) {
    return `+91${digits}`;
  }

  if (/^91\d{10}$/.test(digits)) {
    return `+${digits}`;
  }

  return null;
}

async function resolveTransactionUserByIdentifier(identifier) {
  const cleanIdentifier = String(identifier || '').trim();

  if (!cleanIdentifier) {
    return null;
  }

  const bySymbolId = await User.findOne({ symbolId: cleanIdentifier });

  if (bySymbolId) {
    return {
      user: bySymbolId,
      matchedBy: 'symbolId',
      normalizedIdentifier: cleanIdentifier,
    };
  }

  const normalizedPhone = normalizeTransactionPhoneLookup(cleanIdentifier);

  if (!normalizedPhone) {
    return null;
  }

  const byMobileNumber = await User.findOne({ mobileNumber: normalizedPhone });

  if (byMobileNumber) {
    return {
      user: byMobileNumber,
      matchedBy: 'mobileNumber',
      normalizedIdentifier: normalizedPhone,
    };
  }

  const byLegacyFullNamePhone = await User.findOne({ fullName: normalizedPhone });

  if (byLegacyFullNamePhone) {
    return {
      user: byLegacyFullNamePhone,
      matchedBy: 'mobileNumber',
      normalizedIdentifier: normalizedPhone,
    };
  }

  return null;
}

function cleanResolvedTransactionUserPayload(resolved) {
  if (!resolved || !resolved.user) {
    return null;
  }

  return {
    fullName: resolved.user.fullName,
    email: resolved.user.email || '',
    mobileNumber: resolved.user.mobileNumber || '',
    symbolId: resolved.user.symbolId,
    matchedBy: resolved.matchedBy,
    normalizedIdentifier: resolved.normalizedIdentifier,
  };
}
function createPrototypeTransactionReference() {
  return `GLOOBAL-TXN-${Date.now()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

function cleanTransactionUser(user) {
  if (!user) return null;

  return {
    fullName: user.fullName || '',
    symbolId: user.symbolId || '',
  };
}

function cleanTransactionPayload(transaction, sender, receiver) {
  return {
    id: transaction._id,
    referenceId: transaction.referenceId,
    amount: transaction.amount,
    currency: transaction.currency,
    type: transaction.type,
    status: transaction.status,
    note: transaction.note || '',
    sender: cleanTransactionUser(sender),
    receiver: cleanTransactionUser(receiver),
    createdAt: transaction.createdAt,
    updatedAt: transaction.updatedAt,
  };
}

app.get('/api/users/resolve', async (req, res) => {
  try {
    const identifier = String(req.query.identifier || '').trim();

    if (!identifier) {
      return res.status(400).json({
        success: false,
        message: 'Secure ID or mobile number is required.',
      });
    }

    const resolved = await resolveTransactionUserByIdentifier(identifier);

    if (!resolved) {
      return res.status(404).json({
        success: false,
        message: 'No registered user found for this Secure ID or mobile number.',
      });
    }

    return res.json({
      success: true,
      user: cleanResolvedTransactionUserPayload(resolved),
    });
  } catch (error) {
    console.error('Resolve user error:', error);
    return res.status(500).json({
      success: false,
      message: 'Could not resolve user right now.',
    });
  }
});
// --- My Assets --------------------------------------------------------------
// Cashback earned on a payment is "planted" and grows 1%/month, compounded,
// toward the original amount paid. Everything a client sees (current value,
// years accrued, years to full) is derived here from plantedAt on every read,
// so nothing about a seed's worth is ever stored and can never drift.
const ASSET_GROWTH_RATE_MONTHLY = 0.01; // 1% per month, internal compounding step
const MS_PER_YEAR = 1000 * 60 * 60 * 24 * 365.25;

function computeSeed(seed) {
  const cashback = Number(seed.cashback) || 0;
  const amountPaid = Number(seed.amountPaid) || 0;
  const plantedAt = seed.plantedAt ? new Date(seed.plantedAt) : new Date();
  const yearsAccrued = Math.max(0, (Date.now() - plantedAt.getTime()) / MS_PER_YEAR);
  const currentValue = cashback * Math.pow(1 + ASSET_GROWTH_RATE_MONTHLY, yearsAccrued * 12);

  // Months for the planted cashback to compound up to the full amount paid.
  // Guard the log against non-positive/degenerate inputs so a bad seed can
  // never yield NaN/Infinity in the response.
  let yearsToTarget = 0;
  if (cashback > 0 && amountPaid > cashback) {
    const monthsToTarget = Math.log(amountPaid / cashback) / Math.log(1 + ASSET_GROWTH_RATE_MONTHLY);
    yearsToTarget = monthsToTarget / 12;
  }

  return {
    id: String(seed._id || seed.id || ''),
    business: seed.business,
    category: seed.category || 'General',
    amountPaid,
    cashbackRate: Number(seed.cashbackRate) || 0,
    cashback,
    currentValue,
    yearsAccrued,
    yearsToTarget,
    plantedAt,
    currency: seed.currency || 'INR',
  };
}

// The ceiling on what a Gloobal Creator can choose to share back. The floor is
// zero — sharing nothing is a valid choice, and simply plants no seed.
const MAX_CREATOR_CASHBACK_RATE = 0.07;

// PATCH /api/creator/cashback-rate — a Creator sets the share of every payment
// they hand back to whoever paid them. Each Creator picks their own rate;
// Gloobal does not set one centrally. Stored as a decimal (1% = 0.01).
app.patch('/api/creator/cashback-rate', async (req, res) => {
  try {
    const cleanSymbolId = String(req.body?.symbolId || '').trim();
    const rate = Number(req.body?.cashbackRate);

    if (!cleanSymbolId) {
      return res.status(400).json({ message: 'Gloobal ID is required.' });
    }
    if (!Number.isFinite(rate) || rate < 0 || rate > MAX_CREATOR_CASHBACK_RATE) {
      return res.status(400).json({
        message: 'cashbackRate must be between 0 and 0.07 (0%–7%).'
      });
    }

    const user = await User.findOne({ symbolId: cleanSymbolId });
    if (!user) {
      return res.status(404).json({ message: 'No account found for this Gloobal ID.' });
    }

    user.cashbackRate = rate;
    await user.save();

    return res.status(200).json({ cashbackRate: user.cashbackRate });
  } catch (error) {
    console.error('Creator cashback rate error:', error);
    return res.status(500).json({ message: 'Server error while saving your cashback rate.' });
  }
});

// GET /api/assets/:symbolId — a user's planted seeds with live-derived values.
app.get('/api/assets/:symbolId', async (req, res) => {
  try {
    const cleanSymbolId = String(req.params.symbolId || '').trim();
    if (!cleanSymbolId) {
      return res.status(400).json({ message: 'Secure ID is required.' });
    }

    const user = await User.findOne({ symbolId: cleanSymbolId });
    if (!user) {
      return res.status(404).json({ message: 'Secure ID not found.' });
    }

    const rawSeeds = await AssetSeed.find({ userId: user._id }).sort({ plantedAt: -1 });
    if (rawSeeds.length === 0) {
      return res.status(200).json({
        totalAssets: 0, futureAssets: 0, seeds: [], avgYearsToTarget: 0, payLaterLimit: 0,
      });
    }

    const seeds = rawSeeds.map(computeSeed);
    const totalAssets = seeds.reduce((s, x) => s + x.currentValue, 0);
    const futureAssets = seeds.reduce((s, x) => s + x.amountPaid, 0);
    const avgYearsToTarget = seeds.reduce((s, x) => s + x.yearsToTarget, 0) / seeds.length;

    return res.status(200).json({
      totalAssets,
      futureAssets,
      seeds,
      avgYearsToTarget,
      payLaterLimit: totalAssets,
    });
  } catch (error) {
    console.error('Assets fetch error:', error);
    return res.status(500).json({ message: 'Server error while fetching assets.' });
  }
});

// POST /api/assets/plant-seed — plant a new seed from a cashback-earning
// payment. P2P sends carry cashbackRate 0 and are rejected here.
app.post('/api/assets/plant-seed', async (req, res) => {
  try {
    const { symbolId, business, category, amountPaid, cashbackRate, currency } = req.body || {};
    const cleanSymbolId = String(symbolId || '').trim();
    const numericAmount = Number(amountPaid);
    const numericRate = Number(cashbackRate);

    if (!cleanSymbolId) {
      return res.status(400).json({ message: 'Secure ID is required.' });
    }
    if (!Number.isFinite(numericRate) || numericRate <= 0) {
      return res.status(400).json({ message: 'cashbackRate must be greater than 0.' });
    }
    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({ message: 'A valid amountPaid is required.' });
    }

    const user = await User.findOne({ symbolId: cleanSymbolId });
    if (!user) {
      return res.status(404).json({ message: 'Secure ID not found.' });
    }

    const seed = await AssetSeed.create({
      userId: user._id,
      symbolId: user.symbolId,
      business: String(business || 'Payment').trim().slice(0, 80),
      category: String(category || 'General').trim().slice(0, 40),
      amountPaid: numericAmount,
      cashbackRate: numericRate,
      cashback: numericAmount * numericRate,
      currency: String(currency || user.currency || 'INR').trim().toUpperCase(),
    });

    return res.status(201).json({ seed: computeSeed(seed) });
  } catch (error) {
    console.error('Plant seed error:', error);
    return res.status(500).json({ message: 'Server error while planting seed.' });
  }
});

// GET /api/assets/paylater/:symbolId — PayLater limit is always the live
// total of the user's assets; the repayment ledger is a phase-2 feature.
app.get('/api/assets/paylater/:symbolId', async (req, res) => {
  try {
    const cleanSymbolId = String(req.params.symbolId || '').trim();
    if (!cleanSymbolId) {
      return res.status(400).json({ message: 'Secure ID is required.' });
    }

    const user = await User.findOne({ symbolId: cleanSymbolId });
    if (!user) {
      return res.status(404).json({ message: 'Secure ID not found.' });
    }

    const rawSeeds = await AssetSeed.find({ userId: user._id });
    const totalAssets = rawSeeds.map(computeSeed).reduce((s, x) => s + x.currentValue, 0);
    const pendingDues = 0;

    return res.status(200).json({
      limit: totalAssets,
      available: totalAssets - pendingDues,
      pendingDues,
      transactions: [],
    });
  } catch (error) {
    console.error('PayLater fetch error:', error);
    return res.status(500).json({ message: 'Server error while fetching PayLater.' });
  }
});

app.post('/api/transactions/send', async (req, res) => {
  let pendingTransaction = null;

  try {
    const {
      senderSymbolId,
      fromSymbolId,
      symbolId,
      receiverSymbolId,
      toSymbolId,
      to,
      amount,
      currency = 'INR',
      note = '',
      pin,
      idempotencyKey,
    } = req.body || {};

    const senderIdentifier = String(senderSymbolId || fromSymbolId || symbolId || '').trim();
    const receiverIdentifier = String(receiverSymbolId || toSymbolId || to || '').trim();
    const cleanPin = String(pin || '').trim();
    const numericAmount = Number(amount);
    const cleanCurrency = String(currency || 'INR').trim().toUpperCase() || 'INR';
    const cleanNote = String(note || '').trim().slice(0, 140);
    const cleanIdempotencyKey = String(idempotencyKey || '').trim().slice(0, 120);
    const maxPrototypeAmount = Number(process.env.PROTOTYPE_TRANSACTION_MAX_AMOUNT || 5000);

    if (!senderIdentifier) {
      return res.status(400).json({
        success: false,
        message: 'Sender Secure ID or mobile number is required.',
      });
    }

    if (!receiverIdentifier) {
      return res.status(400).json({
        success: false,
        message: 'Receiver Secure ID or mobile number is required.',
      });
    }

    if (normalizeText(senderIdentifier) === normalizeText(receiverIdentifier)) {
      return res.status(400).json({
        success: false,
        message: 'Self-transfer is not allowed.',
      });
    }

    if (!Number.isFinite(numericAmount) || numericAmount <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Valid amount greater than 0 is required.',
      });
    }

    if (Number.isFinite(maxPrototypeAmount) && maxPrototypeAmount > 0 && numericAmount > maxPrototypeAmount) {
      return res.status(400).json({
        success: false,
        message: `Prototype transaction limit is Rs. ${maxPrototypeAmount}.`,
      });
    }

    if (!cleanPin) {
      return res.status(400).json({
        success: false,
        message: 'PIN is required before sending transaction.',
      });
    }

    if (!isValidPinFormat(cleanPin)) {
      return res.status(400).json({
        success: false,
        message: 'PIN must be 4 to 6 digits.',
      });
    }

    const senderResolved = await resolveTransactionUserByIdentifier(senderIdentifier);
    const receiverResolved = await resolveTransactionUserByIdentifier(receiverIdentifier);

    const sender = senderResolved?.user;
    const receiver = receiverResolved?.user;

    if (!sender) {
      return res.status(404).json({
        success: false,
        message: 'Sender Secure ID or mobile number not found.',
      });
    }

    if (!receiver) {
      return res.status(404).json({
        success: false,
        message: 'Receiver Secure ID or mobile number not found.',
      });
    }

    if (String(sender._id) === String(receiver._id) || sender.symbolId === receiver.symbolId) {
      return res.status(400).json({
        success: false,
        message: 'Self-transfer is not allowed.',
      });
    }

    const pinRecord = await Pin.findOne({ userId: sender._id });

    if (!pinRecord) {
      return res.status(404).json({
        success: false,
        message: 'PIN is not set for this Secure ID.',
      });
    }

    if (pinRecord.lockedUntil && pinRecord.lockedUntil > new Date()) {
      return res.status(423).json({
        success: false,
        message: 'PIN is temporarily locked. Please try again later.',
      });
    }

    const isPinMatch = await bcrypt.compare(cleanPin, pinRecord.pinHash);

    if (!isPinMatch) {
      pinRecord.failedAttempts = (pinRecord.failedAttempts || 0) + 1;

      if (pinRecord.failedAttempts >= 5) {
        pinRecord.lockedUntil = new Date(Date.now() + 10 * 60 * 1000);
      }

      await pinRecord.save();

      return res.status(401).json({
        success: false,
        message: 'Invalid PIN.',
      });
    }

    pinRecord.failedAttempts = 0;
    pinRecord.lockedUntil = null;
    pinRecord.lastVerifiedAt = new Date();
    await pinRecord.save();

    // Checked after the PIN, not before it: the answer reveals roughly what
    // the account holds, which is not something to hand out to whoever can
    // guess a Gloobal ID.
    const senderBalanceBefore = accountBalanceOf(sender);

    if (senderBalanceBefore < numericAmount) {
      return res.status(400).json({
        success: false,
        message: 'Insufficient balance.',
        balance: senderBalanceBefore,
      });
    }

    if (cleanIdempotencyKey) {
      const existingIdempotentTransaction = await Transaction.findOne({
        fromUserId: sender._id,
        'metadata.idempotencyKey': cleanIdempotencyKey,
      }).sort({ createdAt: -1 });

      if (existingIdempotentTransaction) {
        return res.status(200).json({
          success: true,
          duplicate: true,
          message: 'Duplicate request ignored. Existing transaction returned.',
          transaction: cleanTransactionPayload(existingIdempotentTransaction, sender, receiver),
        });
      }
    }

    const duplicateWindowStartedAt = new Date(Date.now() - 15 * 1000);

    const recentDuplicate = await Transaction.findOne({
      fromUserId: sender._id,
      toUserId: receiver._id,
      amount: numericAmount,
      currency: cleanCurrency,
      note: cleanNote,
      status: { $in: ['pending', 'success'] },
      createdAt: { $gte: duplicateWindowStartedAt },
    }).sort({ createdAt: -1 });

    if (recentDuplicate) {
      return res.status(409).json({
        success: false,
        duplicate: true,
        message: 'Duplicate transaction blocked. Please wait before sending the same amount again.',
        transaction: cleanTransactionPayload(recentDuplicate, sender, receiver),
      });
    }

    pendingTransaction = await Transaction.create({
      fromUserId: sender._id,
      toUserId: receiver._id,
      amount: numericAmount,
      currency: cleanCurrency,
      type: 'send',
      status: 'pending',
      note: cleanNote,
      referenceId: createPrototypeTransactionReference(),
      metadata: {
        prototype: true,
        idempotencyKey: cleanIdempotencyKey || null,
        senderMatchedBy: senderResolved.matchedBy,
        receiverMatchedBy: receiverResolved.matchedBy,
        senderInput: senderIdentifier,
        receiverInput: receiverIdentifier,
        maxPrototypeAmount,
      },
    });

    // The payee's own cashback rate splits the payment. The full amount
    // leaves the sender; the payee is credited the amount minus their chosen
    // share, and that share comes back to the sender as a planted asset
    // rather than as spendable money. So a 1% Creator paid 1,000 receives
    // 990 and the payer holds 10 as a seed — the payer is out 1,000 either
    // way, and the 10 is the part that grows.
    const payeeCashbackRate = Number(receiver.cashbackRate) || 0;
    const cashback = toMinorUnit(numericAmount * payeeCashbackRate);
    const payeeReceives = toMinorUnit(numericAmount - cashback);

    const receiverBalanceBefore = accountBalanceOf(receiver);
    const senderBalanceAfter = toMinorUnit(senderBalanceBefore - numericAmount);
    const receiverBalanceAfter = toMinorUnit(receiverBalanceBefore + payeeReceives);

    sender.balance = senderBalanceAfter;
    receiver.balance = receiverBalanceAfter;
    await sender.save();
    await receiver.save();

    await LedgerEntry.create([
      {
        transactionId: pendingTransaction._id,
        userId: sender._id,
        entryType: 'debit',
        amount: numericAmount,
        balanceBefore: senderBalanceBefore,
        balanceAfter: senderBalanceAfter,
        currency: cleanCurrency,
        note: 'Prototype debit entry',
        metadata: {
          prototype: true,
          transactionReferenceId: pendingTransaction.referenceId,
          cashback,
          cashbackRate: payeeCashbackRate,
        },
      },
      {
        transactionId: pendingTransaction._id,
        // The credit is the amount minus the payee's own cashback share, so
        // the two entries deliberately do not carry the same figure — the
        // difference is what became the payer's asset seed below.
        userId: receiver._id,
        entryType: 'credit',
        amount: payeeReceives,
        balanceBefore: receiverBalanceBefore,
        balanceAfter: receiverBalanceAfter,
        currency: cleanCurrency,
        note: 'Prototype credit entry',
        metadata: {
          prototype: true,
          transactionReferenceId: pendingTransaction.referenceId,
          cashback,
          cashbackRate: payeeCashbackRate,
        },
      },
    ]);

    pendingTransaction.status = 'success';
    await pendingTransaction.save();

    // Plant a My Assets seed for cashback-earning payments. The rate is the
    // *payee's* own choice (User.cashbackRate, set via
    // PATCH /api/creator/cashback-rate) — never a figure the paying client
    // supplies, and never a hardcoded one. A plain person-to-person send is
    // simply a payee who never set a rate, so it stays at 0 and plants
    // nothing. Best-effort — a seed failure must never fail an
    // already-successful transaction.
    let plantedSeed = null;

    if (Number.isFinite(payeeCashbackRate) && payeeCashbackRate > 0) {
      try {
        plantedSeed = await AssetSeed.create({
          userId: sender._id,
          symbolId: sender.symbolId,
          business: String(req.body?.business || req.body?.payeeName || receiver.fullName || cleanNote || 'Payment').trim().slice(0, 80),
          category: String(req.body?.category || 'General').trim().slice(0, 40),
          amountPaid: numericAmount,
          cashbackRate: payeeCashbackRate,
          cashback,
          currency: cleanCurrency,
        });
      } catch (seedError) {
        console.error('Seed planting error (non-fatal):', seedError);
      }
    }

    return res.status(201).json({
      success: true,
      message: 'Prototype transaction completed successfully.',
      transaction: cleanTransactionPayload(pendingTransaction, sender, receiver),
      newBalance: senderBalanceAfter,
      cashback,
      cashbackRate: payeeCashbackRate,
      payeeReceives,
      assetSeed: plantedSeed ? computeSeed(plantedSeed) : null,
    });
  } catch (error) {
    if (pendingTransaction && pendingTransaction.status === 'pending') {
      try {
        pendingTransaction.status = 'failed';
        pendingTransaction.metadata = {
          ...(pendingTransaction.metadata || {}),
          failureMessage: error.message,
        };
        await pendingTransaction.save();
      } catch (statusError) {
        console.error('Transaction failure status update error:', statusError);
      }
    }

    console.error('Send transaction error:', error);
    return res.status(500).json({
      success: false,
      message: 'Could not send prototype transaction right now.',
    });
  }
});

app.get('/api/transactions/history/:symbolId', async (req, res) => {
  try {
    const symbolId = String(req.params.symbolId || '').trim();

    if (!symbolId) {
      return res.status(400).json({
        success: false,
        message: 'Secure ID is required.',
      });
    }

    const user = await User.findOne({ symbolId });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Secure ID not found.',
      });
    }

    const transactions = await Transaction.find({
      $or: [{ fromUserId: user._id }, { toUserId: user._id }],
    })
      .sort({ createdAt: -1 })
      .limit(50)
      .populate('fromUserId', 'fullName symbolId')
      .populate('toUserId', 'fullName symbolId')
      .lean();

    const history = transactions.map((transaction) => {
      const senderId = String(transaction.fromUserId?._id || transaction.fromUserId || '');
      const isSender = senderId === String(user._id);
      const counterparty = isSender ? transaction.toUserId : transaction.fromUserId;

      return {
        id: transaction._id,
        referenceId: transaction.referenceId,
        direction: isSender ? 'sent' : 'received',
        amount: transaction.amount,
        currency: transaction.currency,
        status: transaction.status,
        note: transaction.note || '',
        counterparty: cleanTransactionUser(counterparty),
        createdAt: transaction.createdAt,
      };
    });

    return res.json({
      success: true,
      symbolId: user.symbolId,
      count: history.length,
      transactions: history,
    });
  } catch (error) {
    console.error('Transaction history error:', error);
    return res.status(500).json({
      success: false,
      message: 'Could not load transaction history.',
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
