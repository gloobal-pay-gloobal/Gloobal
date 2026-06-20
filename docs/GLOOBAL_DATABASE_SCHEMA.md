\# Gloobal Database Schema



\## Purpose



This document defines the planned MongoDB collections for the Gloobal UPI-style app prototype.



The goal is to keep the backend clean, scalable, and ready for future payment, bank, wallet, KYC, and UPI integration.



\---



\## 1. users



Purpose:



Stores the main user identity.



Current status:



This collection already exists through `Backend/models/User.js`.



Fields:



```js

{

&#x20; \_id,

&#x20; fullName,

&#x20; mobileNumber,

&#x20; symbolId,

&#x20; referredBy,

&#x20; referralChain,

&#x20; referralCount,

&#x20; passkeys,

&#x20; currentChallenge,

&#x20; createdAt

}

```



Future fields:



```js

{

&#x20; status,

&#x20; kycStatus,

&#x20; profileImage,

&#x20; lastLoginAt,

&#x20; updatedAt

}

```



Rules:



```text

One mobile number can be linked to only one Symbol ID.

One Symbol ID can be linked to only one mobile number.

Same mobile number + same Symbol ID can continue login.

```



\---



\## 2. otps



Purpose:



Stores OTP verification attempts.



Prototype:



OTP can stay `0000`.



Future:



Use real SMS provider and store hashed OTP.



Fields:



```js

{

&#x20; \_id,

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



Purposes:



```text

registration

login

pin\_reset

mobile\_change

```



\---



\## 3. pins



Purpose:



Stores user PIN authentication data.



Prototype:



Default PIN can remain `1234`.



Future:



Store hashed PIN only.



Fields:



```js

{

&#x20; \_id,

&#x20; userId,

&#x20; pinHash,

&#x20; failedAttempts,

&#x20; lockedUntil,

&#x20; updatedAt,

&#x20; createdAt

}

```



Rules:



```text

Too many wrong PIN attempts should temporarily lock PIN login.

PIN reset should require OTP and/or passkey verification.

```



\---



\## 4. devices



Purpose:



Stores trusted devices and passkey credentials.



Current status:



Passkeys currently exist inside the User model.



Future:



Move passkeys into a separate `devices` collection.



Fields:



```js

{

&#x20; \_id,

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



Rules:



```text

One user may have multiple trusted devices later.

A lost device should be revocable.

```



\---



\## 5. sessions



Purpose:



Stores active login sessions.



Fields:



```js

{

&#x20; \_id,

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



Rules:



```text

Logout should revoke the session.

Old sessions should expire automatically.

```



\---



\## 6. transactions



Purpose:



Stores user-facing payment records.



Prototype:



No real money movement. Only mock payment records.



Fields:



```js

{

&#x20; \_id,

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



Types:



```text

send

receive

request

qr\_payment

refund

reversal

```



Statuses:



```text

created

pending

success

failed

cancelled

refunded

reversed

```



\---



\## 7. ledger\_entries



Purpose:



Stores audit-friendly debit and credit entries.



Fields:



```js

{

&#x20; \_id,

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



Rules:



```text

Every successful transaction should create ledger entries.

Ledger should not be edited casually.

Corrections should use reversal entries.

```



\---



\## 8. referrals



Purpose:



Stores referral relationships and future referral rewards.



Current status:



Basic referral fields already exist in the User model.



Future:



Use separate referral collection for rewards and tracking.



Fields:



```js

{

&#x20; \_id,

&#x20; referrerUserId,

&#x20; referredUserId,

&#x20; status,

&#x20; rewardStatus,

&#x20; createdAt,

&#x20; updatedAt

}

```



Statuses:



```text

pending

completed

cancelled

```



Reward statuses:



```text

not\_eligible

eligible

credited

expired

```



\---



\## 9. notifications



Purpose:



Stores user notifications.



Fields:



```js

{

&#x20; \_id,

&#x20; userId,

&#x20; title,

&#x20; message,

&#x20; type,

&#x20; readAt,

&#x20; createdAt

}

```



Types:



```text

login

payment

security

referral

system

offer

```



\---



\## 10. audit\_logs



Purpose:



Stores security and backend action logs.



Fields:



```js

{

&#x20; \_id,

&#x20; userId,

&#x20; action,

&#x20; metadata,

&#x20; ipAddress,

&#x20; userAgent,

&#x20; createdAt

}

```



Actions:



```text

user\_registered

otp\_requested

otp\_verified

pin\_set

pin\_failed

pin\_verified

passkey\_registered

passkey\_verified

profile\_viewed

transaction\_created

transaction\_success

transaction\_failed

login\_success

login\_failed

```



\---



\## First Model Build Order



Build actual backend model files in this order:



```text

1\. Otp.js

2\. Pin.js

3\. Transaction.js

4\. LedgerEntry.js

5\. Notification.js

6\. AuditLog.js

7\. Device.js later

8\. Session.js later

```



Reason:



```text

OTP and PIN are needed for registration/login.

Transaction and Ledger are needed for UPI-style mock payments.

Notification and AuditLog are needed for dashboard/security.

Device and Session can be improved after login structure is stable.

```



