---
name: gloobal-review-zip
description: Review founder-sent WhatsApp/downloaded zip/code package safely before integrating into Gloobal.
---

When reviewing a founder zip or code folder:

1. Find newest zip in:
   C:\Users\Chanchal Sharma\Downloads
   C:\Users\Chanchal Sharma\Desktop
   C:\Users\Chanchal Sharma\Desktop\Gloobal\incoming

2. Extract separately to Desktop preview folder:
   C:\Users\Chanchal Sharma\Desktop\<zip-name-preview>

3. Never extract directly over the Gloobal repo.

4. Inspect:
   - package.json
   - vite config
   - src folder
   - services/api files
   - .env usage
   - PWA config
   - routing
   - hardcoded OTP/PIN/secrets
   - demo API endpoints

5. Run:
   npm install
   npm run build

6. Report:
   - framework
   - dependencies
   - entry file
   - API base URL
   - demo/fake APIs found
   - what can be copied
   - what must be patched
   - integration risk

7. Do not modify Gloobal repo until user approves.
