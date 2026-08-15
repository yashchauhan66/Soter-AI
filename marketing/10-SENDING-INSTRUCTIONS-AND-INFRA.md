# 10 — SENDING INFRA + INSTRUCTIONS (Send from YOUR Gmail)

**Goal:** Turn the leads in `08-LEADS-DATABASE.csv` into personalized Gmail drafts you can review and send in one click.

> **Real talk (no fluff):** Main aapke liye asli email *drafts* banaunga. Actual "send" ke liye aapka apna Google account chahiye — main bina credentials ke mails bhej nahi sakta, aur fake addresses bhejna galat hota (bounces, blacklist). Yeh system free hai, safe hai (DRY_RUN pehle), aur aapke Gmail se bhejta hai — yani deliverability bhi achhi.

---

## ⚙️ OPTION A (BEST) — Google Apps Script: Sheet → Drafts → Send

Free. Gmail quota: 100 recipients/day (free Gmail) ya 1,500/day (Workspace). Personalized, tracked, legal.

### Step 1 — Create the Sheet
1. Go to sheets.new → name it **SoterAI Leads**.
2. Add these columns in Row 1 (exact names):
   `email | name | org | subject | body | status | notes`
3. `status` values: `DRAFT`, `SKIP`, `SENT`, `REPLIED`, `BOUNCED`.

### Step 2 — Paste the script
Extensions → **Apps Script** → delete what's there → paste `11-soterai-mailmerge.gs` (in this file) → Save.

### Step 3 — Dry run first (safe)
In Apps Script, run `makeDrafts()` with `SEND=false` → it creates **drafts only**. Check your Gmail Drafts. If body/subject look right, flip to `SEND=true` and re-run to actually send.

### Step 4 — Automate follow-ups
Run `flagFollowups()` daily — it finds `SENT` rows older than 5 days with no reply and highlights them for your one bump.

---

## 📧 OPTION B — One-off sends (no script)
For the 15 HERO emails, just copy from `09-EMAIL-SEQUENCES.md` → paste into Gmail → send manually. Higher touch, better for warm leads (n8n, Portkey, SaaS founders).

---

## 🔐 Finding REAL email addresses (legally)
- **Newsletters / media:** listed on their site (advertise@tldr.tech, tips@, editor@).
- **Companies:** their "contact/partnerships/security" page. Or hunter.io (free 25/mo).
- **n8n / communities:** the forum contact form = best deliverability.
- **Founders (indie):** often list email in Twitter bio / personal site. DM first.
- **Never** guess patterns like firstname@company.com without verifying — bounces hurt your sender rep.

---

## 🧾 Compliance checklist (don't skip)
| Rule | Why |
|---|---|
| Send from your real name + soterai.in | Trust + legal |
| Include a one-line "why you" | Not spam |
| Honor "stop" instantly | Law (IT Act / DPDP spirit) + reputation |
| 1 bump max | Deliverability |
| ≤100/day on free Gmail | Avoid throttle |

---

<details>
<summary><b>11-soterai-mailmerge.gs — paste this entire script</b></summary>

```javascript
/**
 * SoterAI Mail Merge — Sheet -> Gmail Drafts / Send
 * Columns: email | name | org | subject | body | status | notes
 * Set SEND=false to create DRAFTS only (safe). SEND=true to actually send.
 */
const SEND = false;            // false = create drafts (review first). true = send now.
const STATUS_COL = 6;          // 'status' column index (1-based)
const EMAIL_COL  = 1;
const SUBJ_COL   = 4;
const BODY_COL   = 5;

function makeDrafts() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const rows = sheet.getDataRange().getValues();
  for (let i = 1; i < rows.length; i++) {           // skip header
    const [email, name, org, subject, body, status] = rows[i];
    if (!email || !subject || !body) continue;
    if (status !== 'DRAFT') continue;               // only process new ones
    if (SEND) {
      GmailApp.sendEmail(email, subject, body, { name: 'Yash Chauhan · SoterAI' });
      sheet.getRange(i + 1, STATUS_COL).setValue('SENT');
      sheet.getRange(i + 1, 7).setValue('sent ' + new Date());
    } else {
      GmailApp.createDraft(email, subject, body, { name: 'Yash Chauhan · SoterAI' });
      sheet.getRange(i + 1, STATUS_COL).setValue('DRAFTED');
    }
    Utilities.sleep(1200); // be gentle with quotas
  }
}

function flagFollowups() {
  const sheet = SpreadsheetApp.getActiveSpreadsheet().getActiveSheet();
  const rows = sheet.getDataRange().getValues();
  const now = new Date();
  for (let i = 1; i < rows.length; i++) {
    const status = rows[i][STATUS_COL - 1];
    const notes = String(rows[i][6] || '');
    const sentMatch = notes.match(/sent (.+)/);
    if (status === 'SENT' && sentMatch) {
      const sentDate = new Date(sentMatch[1]);
      const days = (now - sentDate) / (1000 * 60 * 60 * 24);
      if (days >= 5) sheet.getRange(i + 1, STATUS_COL).setValue('FOLLOW_UP').setBackground('#fff2cc');
    }
  }
}
```

</details>

---

## ➕ Lead tracker columns (already in CSV)
`not_sent → drafted → sent → replied → bounced` + `priority` + `verify` flags keep it honest.
