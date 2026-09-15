# SCA Election 2026 — Nomination Filing

A one-page site for CSE III Year students to file for **Vice President**,
**Vice Secretary**, or **Vice Treasurer** (3 seats each). Names are picked
from the class roster; once someone files for a seat, they disappear from
every dropdown — so the same person can't accidentally (or deliberately)
file for two offices.

Live shared state (so everyone sees the same seats fill up in real time)
needs a small database. This uses **Firebase Firestore**, which is free at
this scale and needs no server of your own — just a static site, which is
exactly what GitHub Pages hosts.

## Files

| File | Purpose |
|---|---|
| `index.html` | Page structure |
| `style.css` | All styling |
| `app.js` | Logic — **you edit the config block at the top of this file** |
| `students.js` | The eligible roster (64 III Year students), generated from your contact sheet |
| `firestore.rules` | Security rules to paste into Firebase |

## 1. Create a Firebase project (5 minutes, free)

1. Go to [console.firebase.google.com](https://console.firebase.google.com) → **Add project** → name it (e.g. `sca-election-2026`) → skip Google Analytics if you don't need it → **Create project**.
2. In the left sidebar: **Build → Firestore Database → Create database**. Choose **Start in production mode**, pick a region close to you (e.g. `asia-south1` for India), → **Enable**.
3. Left sidebar → **Firestore Database → Rules** tab. Delete the default contents and paste in everything from `firestore.rules`. Click **Publish**.
4. Left sidebar → **Project settings** (gear icon) → scroll to **Your apps** → click the **</>** (web) icon → give it a nickname → **Register app**. You'll see a `firebaseConfig` object — copy it.

## 2. Wire up `app.js`

Open `app.js`, find this block near the top, and replace it with the object you copied:

```js
const FIREBASE_CONFIG = {
  apiKey: "YOUR_API_KEY",
  authDomain: "YOUR_PROJECT.firebaseapp.com",
  projectId: "YOUR_PROJECT",
  storageBucket: "YOUR_PROJECT.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID",
};
```

This config is **safe to commit and safe to be public** — it's not a
secret key, it just tells the browser which Firebase project to talk to.
Access control is handled entirely by `firestore.rules`, not by hiding
this object.

Until you do this, the page will show a plain notice instead of crashing,
so you'll know at a glance if a deploy went out unconfigured.

## 3. Test locally before deploying

Browsers block `type="module"` scripts from loading over `file://`, so
you need a tiny local server — don't just double-click `index.html`.

```bash
cd sca-election
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Try filing a nomination, and open a
second tab to confirm it disappears from the roster there too.

## 4. Deploy on GitHub Pages

1. Create a new **public** GitHub repo (e.g. `sca-election-2026`).
2. Push these five files to the repo root (no build step, no `node_modules` — they're plain static files):
   ```bash
   git init
   git add index.html style.css app.js students.js firestore.rules README.md
   git commit -m "SCA election nomination site"
   git branch -M main
   git remote add origin https://github.com/<your-username>/sca-election-2026.git
   git push -u origin main
   ```
3. On GitHub: **Settings → Pages** → under **Build and deployment**, set **Source** to `Deploy from a branch`, branch `main`, folder `/ (root)` → **Save**.
4. Wait ~1 minute, then your site is live at:
   `https://<your-username>.github.io/sca-election-2026/`
5. In the Firebase console, go to **Project settings → General**, scroll to **Your apps**, and note there's no domain restriction needed for Firestore itself — but if you later add Firebase Auth, you'd add this GitHub Pages URL under **Authentication → Settings → Authorized domains**. Not required for this setup.

Share that `github.io` link with your III Year classmates — that's the
whole deployment.

## Updating the roster later

If the class list changes, edit `students.js` — it's a plain array of
`{ name, reg }` objects. No other file needs to change.

## Resetting for a new election

The nomination data lives in the Firestore document `election/nominations2026`.
To start a fresh round:
- Go to Firestore Database → Data tab → open `election/nominations2026` → delete it, **or**
- Change `DOC_PATH` in `app.js` to a new document id (e.g. `nominations2027`) — this keeps last year's data untouched as a record.

## Optional hardening

The rules in `firestore.rules` stop the document from exceeding 3 seats
per office or being overwritten wholesale, but they don't check that a
submitted name/register number is actually on the roster — that check
currently only happens in `app.js`, which a determined person could
bypass by calling the Firestore API directly. For an internal link shared
within one class WhatsApp group, this is usually fine. If you want to
close that gap, the two common options are:
- Upload the roster into a `roster` collection in Firestore and have the
  rules check `exists()` against it before accepting a write.
- Add Firebase Authentication (e.g. restrict sign-in to `@college-domain`
  emails) so only verified students can write at all.

Either is a reasonable next step if this becomes a recurring tool rather
than a one-off election — happy to help wire either up if you want it.
