---
name: gloobal-safe-git
description: Safe Git workflow for Gloobal: branch, stash, build, diff, commit, merge, push only after approval.
---

Always follow this Gloobal Git workflow:

1. Start with:
   git status
   git log --oneline -5

2. If uncommitted changes exist:
   - Ask whether to continue, stash, or discard.
   - Prefer stash for WIP:
     git stash push -u -m "WIP <clear reason>"

3. Work on a branch:
   git checkout main
   git pull origin main
   git checkout -b <feature-branch>

4. Before commit:
   cd Frontend
   npm run build
   cd ..
   git status
   git diff --stat
   git diff --check

5. Ask before:
   - git add
   - git commit
   - git checkout main + merge
   - git push

6. Never push directly without explicit approval.

7. Never run npm audit fix unless explicitly asked.
