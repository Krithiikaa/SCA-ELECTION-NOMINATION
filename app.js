// ============================================================
// SCA Election — CSE III Year Nomination Filing
// ============================================================
// Setup required before this works:
//   1. Create a free Firebase project → console.firebase.google.com
//   2. Enable Firestore (Native mode, any nearby region).
//   3. Project settings → your web app → copy the config object
//      below into FIREBASE_CONFIG.
//   4. Paste the rules from firestore.rules into
//      Firestore → Rules, and publish.
// Full walkthrough is in README.md.
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getFirestore,
  doc,
  onSnapshot,
  runTransaction,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";

import { STUDENTS } from "./students.js";

// ---- 1. Fill this in with YOUR Firebase project's web config ----
// This page is a static site, so use the browser-compatible CDN imports above.
// Firebase configuration is safe to expose in client-side code; Firestore rules
// are what control access to the data.
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyAviDumCgTeSpFwMfGimIYCLGTQ5W4-tV8",
  authDomain: "sca-election-2026.firebaseapp.com",
  projectId: "sca-election-2026",
  storageBucket: "sca-election-2026.firebasestorage.app",
  messagingSenderId: "304304361916",
  appId: "1:304304361916:web:3e2ce1b76c25e14502dbb9",
  measurementId: "G-ZW3D31V6G5"
};

const POSITIONS = [
  { key: "vicePresident", label: "Vice President" },
  { key: "viceSecretary", label: "Vice Secretary" },
  { key: "viceTreasurer", label: "Vice Treasurer" },
];
const SEATS_PER_POSITION = 3;
const DOC_PATH = ["election", "nominations2026"]; // change the doc id per election year if reused

// ------------------------------------------------------------

const positionsRoot = document.getElementById("positions");
const toastEl = document.getElementById("toast");
let toastTimer = null;

function showToast(message, type) {
  toastEl.textContent = message;
  toastEl.className = "toast is-visible" + (type ? ` is-${type}` : "");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toastEl.classList.remove("is-visible");
  }, 3400);
}

function emptyState() {
  const state = {};
  POSITIONS.forEach((p) => (state[p.key] = []));
  return state;
}

function svgCheck() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 12l2 2 4-4"/><circle cx="12" cy="12" r="10"/></svg>`;
}

function svgLock() {
  return `<svg viewBox="0 0 24 24" fill="none" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="10" width="16" height="10" rx="2"/><path d="M8 10V7a4 4 0 018 0v3"/></svg>`;
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

// ---- Render ----

function takenRegs(state) {
  const set = new Set();
  POSITIONS.forEach((p) => (state[p.key] || []).forEach((c) => set.add(c.reg)));
  return set;
}

function render(state) {
  const taken = takenRegs(state);
  positionsRoot.innerHTML = "";

  POSITIONS.forEach((position) => {
    const candidates = state[position.key] || [];
    const isFull = candidates.length >= SEATS_PER_POSITION;

    const section = document.createElement("section");
    section.className = "position";
    section.dataset.position = position.key;

    const seatsHtml = Array.from({ length: SEATS_PER_POSITION }).map((_, i) => {
      const c = candidates[i];
      if (c) {
        return `<div class="seat seat--filled">
          <div class="seat__name">${svgCheck()}<span>${escapeHtml(c.name)}</span></div>
          <div class="seat__reg">${escapeHtml(c.reg)}</div>
        </div>`;
      }
      return `<div class="seat seat--open">Open seat</div>`;
    }).join("");

    section.innerHTML = `
      <div class="position__head">
        <h2 class="position__name">${position.label}</h2>
        <span class="position__status ${isFull ? "is-full" : ""}">
          ${isFull ? "All 3 seats filled" : `${candidates.length} of 3 filled`}
        </span>
      </div>
      <div class="seats">${seatsHtml}</div>
      <div class="position__body"></div>
    `;

    const body = section.querySelector(".position__body");

    if (isFull) {
      const note = document.createElement("div");
      note.className = "position__closed-note";
      note.innerHTML = `${svgLock()}<span>Nominations closed for this office — all three seats are filled.</span>`;
      body.appendChild(note);
    } else {
      body.appendChild(buildFilingRow(position, taken));
    }

    positionsRoot.appendChild(section);
  });
}

// ---- Combobox + filing row ----

function buildFilingRow(position, taken) {
  const available = STUDENTS.filter((s) => !taken.has(s.reg));

  const wrap = document.createElement("div");
  wrap.className = "file-row";

  const combo = document.createElement("div");
  combo.className = "combobox";

  const input = document.createElement("input");
  input.type = "text";
  input.className = "combobox__input";
  input.placeholder = "Type your name or register number…";
  input.autocomplete = "off";
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-expanded", "false");

  const list = document.createElement("ul");
  list.className = "combobox__list";
  list.setAttribute("role", "listbox");

  combo.appendChild(input);
  combo.appendChild(list);

  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "btn";
  btn.textContent = "File Nomination";
  btn.disabled = true;

  wrap.appendChild(combo);
  wrap.appendChild(btn);

  let selected = null;
  let activeIndex = -1;
  let currentMatches = [];

  function closeList() {
    list.classList.remove("is-open");
    input.setAttribute("aria-expanded", "false");
    activeIndex = -1;
  }

  function openList(matches) {
    currentMatches = matches;
    if (!matches.length) {
      list.innerHTML = `<li class="combobox__empty">No matching name in the III Year roster.</li>`;
    } else {
      list.innerHTML = matches.map((s, i) => `
        <li class="combobox__option" role="option" data-index="${i}">
          <span>${escapeHtml(s.name)}</span>
          <span class="reg">${escapeHtml(s.reg)}</span>
        </li>
      `).join("");
    }
    list.classList.add("is-open");
    input.setAttribute("aria-expanded", "true");
  }

  function setActive(i) {
    const opts = list.querySelectorAll(".combobox__option");
    opts.forEach((o) => o.classList.remove("is-active"));
    if (opts[i]) {
      opts[i].classList.add("is-active");
      opts[i].scrollIntoView({ block: "nearest" });
    }
    activeIndex = i;
  }

  function choose(student) {
    selected = student;
    input.value = `${student.name} (${student.reg})`;
    closeList();
    btn.disabled = false;
  }

  function onType() {
    selected = null;
    btn.disabled = true;
    const q = input.value.trim().toLowerCase();
    if (!q) {
      closeList();
      return;
    }
    const matches = available
      .filter((s) => s.name.toLowerCase().includes(q) || s.reg.includes(q))
      .slice(0, 30);
    openList(matches);
  }

  input.addEventListener("input", onType);
  input.addEventListener("focus", () => {
    if (input.value.trim()) onType();
  });

  input.addEventListener("keydown", (e) => {
    if (!list.classList.contains("is-open")) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActive(Math.min(activeIndex + 1, currentMatches.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActive(Math.max(activeIndex - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      const pick = currentMatches[activeIndex] || currentMatches[0];
      if (pick) choose(pick);
    } else if (e.key === "Escape") {
      closeList();
    }
  });

  list.addEventListener("mousedown", (e) => {
    const li = e.target.closest(".combobox__option");
    if (!li) return;
    const pick = currentMatches[Number(li.dataset.index)];
    if (pick) choose(pick);
  });

  document.addEventListener("click", (e) => {
    if (!combo.contains(e.target)) closeList();
  });

  btn.addEventListener("click", () => {
    if (!selected) return;
    btn.disabled = true;
    btn.textContent = "Filing…";
    fileNomination(position.key, position.label, selected)
      .then(() => {
        showToast(`Nomination filed — ${selected.name} for ${position.label}.`, "success");
      })
      .catch((err) => {
        showToast(err.message || "Could not file that nomination. Try again.", "error");
        btn.disabled = false;
        btn.textContent = "File Nomination";
      });
  });

  return wrap;
}

// ---- Firestore ----

let db, docRef;

async function fileNomination(positionKey, positionLabel, student) {
  const result = await runTransaction(db, async (txn) => {
    const snap = await txn.get(docRef);
    const data = snap.exists() ? snap.data() : emptyState();
    POSITIONS.forEach((p) => {
      if (!Array.isArray(data[p.key])) data[p.key] = [];
    });

    const allTaken = new Set();
    POSITIONS.forEach((p) => data[p.key].forEach((c) => allTaken.add(c.reg)));
    if (allTaken.has(student.reg)) {
      throw new Error(`${student.name} has already filed for an office.`);
    }
    if (data[positionKey].length >= SEATS_PER_POSITION) {
      throw new Error(`${positionLabel} already has its three candidates.`);
    }

    data[positionKey] = [...data[positionKey], { name: student.name, reg: student.reg }];
    txn.set(docRef, data);
    return data;
  });
  return result;
}

function showConfigNotice() {
  positionsRoot.innerHTML = `
    <section class="position">
      <div class="position__closed-note" style="margin-top:4px;">
        ${svgLock()}
        <span>This page isn't connected to a database yet. Open <code>app.js</code>,
        fill in <code>FIREBASE_CONFIG</code> with your Firebase project's web config,
        and add the Firestore rules from <code>firestore.rules</code> — steps are in
        <code>README.md</code>.</span>
      </div>
    </section>
  `;
}

function init() {
  const isPlaceholder = FIREBASE_CONFIG.apiKey === "YOUR_API_KEY";
  if (isPlaceholder) {
    showConfigNotice();
    return;
  }

  try {
    const firebaseApp = initializeApp(FIREBASE_CONFIG);
    db = getFirestore(firebaseApp);
    docRef = doc(db, DOC_PATH[0], DOC_PATH[1]);
  } catch (err) {
    showConfigNotice();
    return;
  }

  onSnapshot(
    docRef,
    (snap) => {
      const state = snap.exists() ? snap.data() : emptyState();
      POSITIONS.forEach((p) => {
        if (!Array.isArray(state[p.key])) state[p.key] = [];
      });
      render(state);
    },
    (err) => {
      positionsRoot.innerHTML = `<section class="position"><div class="position__closed-note">${svgLock()}<span>Could not reach the nomination database — check your connection and Firestore rules. (${escapeHtml(err.message)})</span></div></section>`;
    }
  );
}

init();
