# Testing

ChorePal was tested in two rounds: an **Acceptance Test Procedure (ATP)** run by our team, then
**User Acceptance Testing (UAT)** run by other teams acting as real parents and children.
Each document has a signed PDF original and a Markdown copy you can read right here on GitHub.

```
Testing/
├── Test_Cases/
│   ├── ChorePal_ATP.md          Test cases, steps, expected and actual results (readable copy)
│   ├── ChorePal_ATP.pdf         Signed original
│   └── screenshots/             Screenshot for each test case, AT-001 to AT-009
└── Test_Results/
    ├── ChorePal_UAT_Report.md   UAT results, defect log, client feedback (readable copy)
    └── ChorePal_UAT_Report.pdf  Signed original
```

## Summary

| Round | Date | Who tested | Result |
|---|---|---|---|
| [Acceptance Test Procedure](Test_Cases/ChorePal_ATP.md) | Sept 25–27, 2026 | Team 2 (us), on iPhone with Expo Go | 9 test cases: 6 passed, 3 failed (66.7%) |
| [User Acceptance Testing](Test_Results/ChorePal_UAT_Report.md) | Oct 1 and Oct 8, 2026 | Team 1 and Team 3, using a parent phone and a child phone | 10 scenarios: all 10 passed. **Full Acceptance** signed 10/22/2026 |

## What was tested

- Parent and child sign-up, login, logout and password reset
- Creating child accounts and joining with the family code
- Creating chores (deadline, priority, coins) and rewards
- Child submitting a chore photo and the ChorePal AI photo check (Google Gemini)
- Parent approving or rejecting with feedback, coins being awarded, rewards being purchased
- Discipline system (removing coins)
- Notifications between parent and child

## How the rounds connect

The ATP found 3 defects (D-001 to D-003): missing push notifications to the parent and child, and
the discipline reason not showing to the child. <!-- TODO: say how D-001 to D-003 were resolved. -->
The UAT report's defect log (DEF-01 to DEF-11) records the bugs found in peer testing and how each
was fixed. Team 3 tested a week before Team 1, and every issue found was fixed and retested before
the final round.
