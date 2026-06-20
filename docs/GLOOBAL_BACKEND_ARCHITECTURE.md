\# Gloobal Backend Architecture



\## Backend Goal



The backend should support a UPI-style app prototype first, while keeping the structure ready for future payment, bank, wallet, KYC, and compliance integrations.



The backend should not be treated as only a login server. It should become the foundation for:



\* User identity

\* Mobile verification

\* Symbol ID ownership

\* PIN authentication

\* Passkey/device security

\* Profile

\* Payment actions

\* Transaction ledger

\* Referral system

\* Notifications

\* Audit/security logs



\---



\## Main Backend Modules



\### 1. User Identity Module



Responsible for:



\* Mobile number

\* Full name if needed later

\* Symbol ID

\* Referral ID

\* Profile data

\* Account creation date

\* User status



Current completed work:



\* `mobileNumber` added to User model

\* One mobile number can link with only one Symbol ID

\* One Symbol ID cannot be used by another mobile number

\* Same mobile number + same Symbol ID can continue login

\* Profile API added



\---



\### 2. OTP Module



Responsible for:



\* Sending OTP

\* Verifying OTP

\* Limiting OTP attempts

\* OTP expiry

\* Preventing abuse



Prototype:



\* OTP can remain `0000`



Future:



\* Integrate real SMS provider

\* Store hashed OTP, not plain OTP

\* Add resend limit

\* Add mobile number cooldown



Suggested collection:



```text

otps

```



Suggested fields:



```js

{

&#x20; mobileNumber,

&#x20; otpHash,

&#x20; purpose,

&#x20; attempts,

&#x20; maxAttempts,

&#x20; expiresAt,

&#x20; verifiedAt,

&#x20; createdAt

}

```



\---



\### 3. Symbol ID Module



Responsible for:



\* Creating user-chosen 12-symbol ID

\* Checking availability

\* Validating symbol format

\* Preventing duplicate ownership

\* Locking ID permanently after registration



Rules:



```text

Mobile number + OTP verified → user creates Symbol ID

Backend checks Symbol ID availability

If available, register it permanently

If already linked to same mobile, allow login

If linked to different mobile, block

```



Future optional feature:



```text

Generate for me

```



This can create a random Symbol ID, but user-created Symbol ID should remain the main flow.



\---



\### 4. PIN Module



Responsible for:



\* User PIN setup

\* PIN verification

\* PIN retry count

\* Temporary account lock after too many wrong attempts



Prototype:



\* Default PIN can remain `1234`



Future:



\* Store only hashed PIN

\* Require 4 or 6 digit PIN

\* Add wrong PIN lock

\* Add reset PIN flow using OTP + passkey



Suggested collection:



```text

pins

```



Suggested fields:



```js

{

&#x20; userId,

&#x20; pinHash,

&#x20; failedAttempts,

&#x20; lockedUntil,

&#x20; updatedAt,

&#x20; createdAt

}

```



\---



\### 5. Device / Passkey Module



Responsible for:



\* Face/fingerprint/passkey registration

\* Device authentication

\* Device trust

\* Multiple device support later

\* Removing lost devices later



Current completed work:



\* Passkey registration exists

\* Passkey status API exists

\* Passkey authentication exists



Suggested collection:



```text

devices

```



Suggested fields:



```js

{

&#x20; userId,

&#x20; deviceName,

&#x20; credentialId,

&#x20; publicKey,

&#x20; counter,

&#x20; transports,

&#x20; lastUsedAt,

&#x20; createdAt,

&#x20; revokedAt

}

```



\---



\### 6. Session Module



Responsible for:



\* Login sessions

\* Access tokens

\* Refresh tokens later

\* Logout

\* Session expiry



Suggested collection:



```text

sessions

```



Suggested fields:



```js

{

&#x20; userId,

&#x20; deviceId,

&#x20; sessionTokenHash,

&#x20; ipAddress,

&#x20; userAgent,

&#x20; expiresAt,

&#x20; revokedAt,

&#x20; createdAt

}

```



\---



\### 7. Profile Module



Responsible for:



\* Showing user profile on dashboard

\* Showing mobile number

\* Showing Symbol ID

\* Showing referral count

\* Showing passkey/device status



Current completed API:



```text

GET /api/profile/:symbolId

```



Future profile fields:



```js

{

&#x20; userId,

&#x20; displayName,

&#x20; avatar,

&#x20; mobileNumber,

&#x20; symbolId,

&#x20; kycStatus,

&#x20; accountStatus,

&#x20; referralCount,

&#x20; createdAt

}

```



\---



\### 8. Payment Action Module



Prototype payment actions:



\* Send money

\* Receive money

\* Scan QR

\* Request money

\* Pay to Symbol ID

\* Pay to mobile number



Important prototype rule:



```text

No real money movement in prototype.

Only mock payment records and ledger entries.

```



Future real payment integration:



\* Bank/UPI partner APIs

\* NPCI/PSP layer

\* Payment gateway or banking partner

\* Compliance checks

\* Settlement/reconciliation



\---



\### 9. Transaction Module



Responsible for:



\* Creating payment records

\* Tracking status

\* Showing transaction history

\* Handling pending/success/failed states



Suggested collection:



```text

transactions

```



Suggested fields:



```js

{

&#x20; fromUserId,

&#x20; toUserId,

&#x20; amount,

&#x20; currency,

&#x20; type,

&#x20; status,

&#x20; note,

&#x20; referenceId,

&#x20; failureReason,

&#x20; createdAt,

&#x20; updatedAt

}

```



Transaction statuses:



```text

created

pending

success

failed

cancelled

reversed

refunded

```



\---



\### 10. Ledger Module



Responsible for:



\* Accurate debit/credit records

\* Internal accounting

\* Audit-friendly transaction entries



Suggested collection:



```text

ledger\_entries

```



Suggested fields:



```js

{

&#x20; transactionId,

&#x20; userId,

&#x20; entryType,

&#x20; amount,

&#x20; balanceBefore,

&#x20; balanceAfter,

&#x20; currency,

&#x20; createdAt

}

```



Entry types:



```text

debit

credit

hold

release

refund

reversal

```



\---



\### 11. Referral Module



Responsible for:



\* Referral ID

\* Referral chain

\* Referral count

\* Future rewards



Current backend already has:



```text

referredBy

referralChain

referralCount

```



Future collection:



```text

referrals

```



Suggested fields:



```js

{

&#x20; referrerUserId,

&#x20; referredUserId,

&#x20; status,

&#x20; rewardStatus,

&#x20; createdAt

}

```



\---



\### 12. Notification Module



Responsible for:



\* Login alerts

\* Payment alerts

\* Referral alerts

\* Security alerts

\* Offer/reward alerts



Suggested collection:



```text

notifications

```



Suggested fields:



```js

{

&#x20; userId,

&#x20; title,

&#x20; message,

&#x20; type,

&#x20; readAt,

&#x20; createdAt

}

```



\---



\### 13. Audit Log Module



Responsible for:



\* Security tracking

\* Important backend actions

\* Login attempts

\* Profile changes

\* PIN changes

\* Payment events



Suggested collection:



```text

audit\_logs

```



Suggested fields:



```js

{

&#x20; userId,

&#x20; action,

&#x20; metadata,

&#x20; ipAddress,

&#x20; userAgent,

&#x20; createdAt

}

```



\---



\## First Backend Build Order



\### Step 1



Keep current User model stable.



\### Step 2



Add OTP model.



\### Step 3



Add PIN model.



\### Step 4



Move passkeys into cleaner Device model later.



\### Step 5



Add Profile dashboard API.



\### Step 6



Add mock Transaction model.



\### Step 7



Add Ledger model.



\### Step 8



Add transaction history API.



\### Step 9



Add send/receive mock payment API.



\### Step 10



Add audit logs and security limits.



