\# Gloobal UPI-Style App Structure



\## Product Direction



Gloobal will be designed as a UPI-style financial app prototype first, with backend structure ready for future bank/UPI integration.



The app identity flow will be:



Mobile Number → OTP → User-created 12-symbol Symbol ID → PIN → Face/Fingerprint/Passkey → Dashboard



\## Core Identity Decision



Mobile number is used for verification and ownership.



Symbol ID is the permanent Gloobal identity created by the user.



The Symbol ID should not be randomly forced by backend because user-created patterns are easier to remember.



Backend responsibility:

\- Check Symbol ID uniqueness

\- Check mobile number ownership

\- Prevent one mobile number from creating multiple Symbol IDs

\- Prevent one Symbol ID from being linked to multiple mobile numbers



\## Main App Modules



1\. User Identity

2\. Authentication

3\. Profile

4\. Dashboard

5\. Payment Actions

6\. Transaction Ledger

7\. Referral System

8\. Device Security

9\. Notification System

10\. Future Bank/UPI Integration



\## Registration Flow



1\. User enters mobile number

2\. User verifies OTP

3\. User creates 12-symbol Symbol ID

4\. Backend checks availability

5\. User sets PIN

6\. User registers face/fingerprint/passkey

7\. User enters dashboard



\## Login Flow



1\. User opens login page

2\. User enters Symbol ID

3\. User enters PIN

4\. User verifies face/fingerprint/passkey

5\. Dashboard opens



\## Dashboard Features



Initial prototype dashboard should include:



\- Profile

\- Send

\- Receive

\- Scan

\- Transaction History

\- Rewards / Referral

\- Security Settings

\- Help / Support



\## Backend Collections



Suggested MongoDB collections:



\- users

\- otps

\- pins

\- devices

\- transactions

\- ledger\_entries

\- referrals

\- notifications

\- sessions

\- audit\_logs



\## Current Backend Status



Completed:

\- Mobile number field added to user model

\- One mobile number linked to one Symbol ID rule

\- One Symbol ID linked to one mobile rule

\- Same mobile + same Symbol ID can continue login

\- Profile API added



Latest safe commit:

5460276 Enforce mobile identity and add profile API



\## Next Development Order



1\. Add architecture docs

2\. Fix frontend current boxes safely

3\. Add separate login page

4\. Add profile button on dashboard

5\. Connect profile API to dashboard

6\. Design transaction model

7\. Add mock send/receive payment flow

8\. Add transaction history

9\. Add security limits

10\. Prepare future bank/UPI integration layer

