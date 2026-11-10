/* AnswrIT redesign (preview).
 * A small single-page app on top of the existing Flask API (/api/...).
 * Routes live in the URL hash, e.g. #/exam/<filename>.
 */
"use strict";

// ─── Course catalog ─────────────────────────────────────────────────────────
// To add a course: add it here and to COURSE_ORDER. A course only shows once it has exams
// (retired courses always show, with their note).
const COURSE_ORDER = ["ite", "ccna", "comms", "ccna2"];

const COURSES = {
    ite: {
        id: "ite", name: "IT Essentials", icon: "monitor", tint: "blue",
        match: (f) => f.startsWith("it-essentials"),
        note: "Questions come straight from the test bank. About 50 of these will be on your test, picked at random. <strong>Pro tip:</strong> focus on the keywords in the correct answers. Most shipmates score 90–100% this way.",
    },
    ccna: {
        id: "ccna", name: "CCNA 1", icon: "network", tint: "green",
        match: (f) => f.startsWith("ccna-1"),
        note: "Questions come straight from the test bank. About 50 of these will be on your test, picked at random. <strong>Pro tip:</strong> focus on the keywords in the correct answers. Most shipmates score 90–100% this way.",
    },
    ccna2: {
        id: "ccna2", name: "CCNA 2", icon: "network", tint: "blue",
        match: (f) => f.startsWith("ccna-2"),
        labs: [
            { href: "packet-tracer/lab/ccna2-vlan", icon: "terminal", tint: "orange", title: "Packet Tracer 1", sub: "VLANs, trunks, router-on-a-stick, SSH and IPv6. New names and numbers every version." },
            { href: "packet-tracer/commands", icon: "cards", tint: "blue", title: "Packet Tracer 1: Command drill", sub: "Practice every command on your phone. Type it or pick it." },
        ],
        note: "Questions come straight from the test bank. About 50 of these will be on your test, picked at random. <strong>Pro tip:</strong> focus on the keywords in the correct answers. Most shipmates score 90–100% this way.",
    },
    comms: {
        id: "comms", name: "Comms", icon: "signal", tint: "orange", retired: true,
        match: () => false,
        subtitle: "Study with your peers",
    },
};

// Friendly names for each exam file. Anything missing falls back to the server's name.
const EXAM_NAMES = {
    "it-essentials-70-80-final-exam-modules-1-9-answers.json": { title: "Final Exam: Modules 1–9" },
    "it-essentials-70-80-final-exam-modules-10-14-answers.json": { title: "Final Exam: Modules 10–14" },
    "it-essentials-70-80-course-final-exam-answers.json": { title: "Course Final Exam", sub: "Modules 1–14" },
    "ccna-1-v7-modules-1-3-basic-network-connectivity-and-communications-exam-answers.json": { title: "Modules 1–3", sub: "Basic Network Connectivity and Communications" },
    "ccna-1-v7-modules-4-7-ethernet-concepts-exam-answers.json": { title: "Modules 4–7", sub: "Ethernet Concepts" },
    "ccna-1-v7-modules-8-10-communicating-between-networks-exam-answers.json": { title: "Modules 8–10", sub: "Communicating Between Networks" },
    "ccna-1-v7-modules-11-13-ip-addressing-exam-answers-full.json": { title: "Modules 11–13", sub: "IP Addressing" },
    "ccna-1-v7-modules-14-15-network-application-communications-exam-answers.json": { title: "Modules 14–15", sub: "Network Application Communications" },
    "ccna-1-v7-modules-16-17-building-and-securing-a-small-network-exam-answers.json": { title: "Modules 16–17", sub: "Building and Securing a Small Network" },
    "ccna-1-v70-final-exam-answers-full-introduction-to-networks.json": { title: "Final Exam", sub: "Introduction to Networks" },
    "ccna-2-v7-modules-1-4-switching-concepts-vlans-and-intervlan-routing-exam-answers.json": { title: "Modules 1–4", sub: "Switching Concepts, VLANs, and InterVLAN Routing" },
    "ccna-2-v7-modules-5-6-redundant-networks-exam-answers.json": { title: "Modules 5–6", sub: "Redundant Networks" },
    "ccna-2-v7-modules-7-9-available-and-reliable-networks-exam-answers.json": { title: "Modules 7–9", sub: "Available and Reliable Networks" },
    "ccna-2-v7-modules-10-13-l2-security-and-wlans-exam-answers.json": { title: "Modules 10–13", sub: "L2 Security and WLANs" },
    "ccna-2-v7-modules-14-16-routing-concepts-and-configuration-exam-answers.json": { title: "Modules 14–16", sub: "Routing Concepts and Configuration" },
    "ccna-2-v7-0-final-exam-answers-full-switching-routing-and-wireless-essentials.json": { title: "Final Exam", sub: "Switching, Routing, and Wireless Essentials" },
};

const DRILLS = () => (window.AnswritDrills && window.AnswritDrills.list) || [];

const COMMS_MESSAGE = `
    <p><strong>Comms study material has been removed.</strong></p>
    <p>We didn't have enough material for this section, and what we did have wasn't enough to get most students a good score, so we removed it.</p>
    <p>Please study with your peers for this section. It's not as hard as you think, and the final test is the easiest one you'll take in this class.</p>
    <p class="signoff">We'll see you in C school!</p>`;

const MASTERY_BATCH = 10;
const LAST_EXAM_KEY = "answrit:lastExam";

// ─── Icons ──────────────────────────────────────────────────────────────────
const ICONS = {
    monitor: '<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
    network: '<circle cx="12" cy="5" r="2.5"/><circle cx="5" cy="19" r="2.5"/><circle cx="19" cy="19" r="2.5"/><path d="M12 7.5v4M12 11.5l-5.5 5.5M12 11.5l5.5 5.5"/>',
    signal: '<path d="M4 12a8 8 0 0 1 16 0M8 12a4 4 0 0 1 8 0"/><circle cx="12" cy="12" r="1"/>',
    chevron: '<path d="M9 6l6 6-6 6"/>',
    back: '<path d="M15 6l-6 6 6 6"/>',
    close: '<path d="M6 6l12 12M18 6L6 18"/>',
    star: '<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>',
    check: '<path d="M20 6L9 17l-5-5"/>',
    refresh: '<path d="M20 12a8 8 0 1 1-2.3-5.7M20 4v5h-5"/>',
    test: '<path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/>',
    cards: '<rect x="3" y="6" width="14" height="14" rx="2"/><path d="M7 6V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2"/>',
    flame: '<path d="M12 3c1 3.5 5 5.5 5 10a5 5 0 0 1-10 0c0-2.2 1.2-3.6 2.4-4.6.3 1.6 1.1 2.6 2.1 3.1C11 9 11.2 5.6 12 3z"/>',
    send: '<path d="M5 12h14M13 6l6 6-6 6"/>',
    prev: '<path d="M15 6l-6 6 6 6"/>',
    next: '<path d="M9 6l6 6-6 6"/>',
    shuffle: '<path d="M16 3h5v5M4 20L21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>',
    terminal: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M6 9l3 3-3 3M13 15h5"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
    camera: '<path d="M4 8h3l2-3h6l2 3h3v11H4z"/><circle cx="12" cy="13" r="3.5"/>',
    people: '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M18 14.5a6.5 6.5 0 0 1 3.5 5.5"/>',
    pencil: '<path d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4"/>',
    megaphone: '<path d="M3 11v2a2 2 0 0 0 2 2h1l5 4V5L6 9H5a2 2 0 0 0-2 2zM15 9a3 3 0 0 1 0 6M18 6a7 7 0 0 1 0 12"/>',
    bubble: '<path d="M21 12a8 8 0 0 1-11.6 7.1L4 21l1.9-5.1A8 8 0 1 1 21 12z"/>',
    flag: '<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>',
    pin: '<path d="M9 4h6l-1 6 3 3H7l3-3zM12 13v8"/>',
    reply: '<path d="M10 8L5 12l5 4M5 12h9a5 5 0 0 1 5 5v1"/>',
    list: '<path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/>',
    game: '<rect x="2" y="7" width="20" height="10" rx="5"/><path d="M7 10v4M5 12h4M15.5 11h.01M18 13h.01"/>',
};
const icon = (name, cls = "") => `<svg aria-hidden="true" viewBox="0 0 24 24" class="${cls}">${ICONS[name] || ""}</svg>`;

// ─── Helpers ────────────────────────────────────────────────────────────────
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

function esc(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

async function api(path, { method = "GET", body } = {}) {
    const opts = { method, credentials: "same-origin", headers: {} };
    if (body !== undefined) {
        opts.headers["Content-Type"] = "application/json";
        opts.body = JSON.stringify(body);
    }
    let res, data = {};
    try {
        res = await fetch(path, opts);
        data = await res.json().catch(() => ({}));
    } catch (err) {
        return { ok: false, status: 0, data: { error: "Can't reach AnswrIT. Check your connection." } };
    }
    return { ok: res.ok && data.ok !== false, status: res.status, data };
}

function shuffle(list) {
    const a = list.slice();
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function pct(n) { return Math.round(Number(n) || 0); }
function scoreClass(score) { return score >= 85 ? "score-good" : score >= 70 ? "score-ok" : "score-low"; }

function initials(name) { return String(name || "?").slice(0, 2).toUpperCase(); }
function safeAvatar(src) { return typeof src === "string" && /^data:image\/(png|jpe?g|gif|webp);/.test(src) ? src : ""; }
function avatarHtml(username, src, cls = "avatar") {
    const img = safeAvatar(src);
    const tints = ["tint-blue", "tint-green", "tint-orange"];
    const tint = tints[[...String(username)].reduce((s, c) => s + c.charCodeAt(0), 0) % tints.length];
    return img
        ? `<span class="${cls}" aria-hidden="true"><img src="${img}" alt=""></span>`
        : `<span class="${cls} ${tint}" aria-hidden="true">${esc(initials(username))}</span>`;
}

function relDate(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d)) return "";
    const today = new Date();
    const days = Math.floor((new Date(today.toDateString()) - new Date(d.toDateString())) / 86400000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return d.toLocaleDateString(undefined, { weekday: "short" });
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
function timeOf(iso) {
    const d = new Date(iso);
    return isNaN(d) ? "" : d.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

function loading() { return '<div class="loading"><div class="spinner" role="status" aria-label="Loading"></div></div>'; }

// ─── App state ──────────────────────────────────────────────────────────────
const state = {
    user: null,
    profile: {},
    exams: [],
    examsLoaded: null,
    runner: null,        // active quiz/flashcard session
    lastResult: null,    // last practice results, for the review screen
    chatTimer: null,
    cleanup: null,       // called when leaving a screen (drills use it to stop timers)
    myDecks: null,       // My Flashcards decks, loaded on first use
};

function examMeta(filename) { return state.exams.find((e) => e.filename === filename); }
function courseOf(filename) { return Object.values(COURSES).find((c) => c.match(filename)); }
function examsFor(courseId) { return state.exams.filter((e) => COURSES[courseId].match(e.filename)); }
function examTitle(filename) {
    const named = EXAM_NAMES[filename];
    if (named) return named.title;
    const meta = examMeta(filename);
    return (meta && (meta.display_name || meta.title)) || filename;
}
function examSub(filename) { return (EXAM_NAMES[filename] || {}).sub || ""; }
function examFullName(filename) {
    const course = courseOf(filename);
    return `${course ? course.name + " · " : ""}${examTitle(filename)}`;
}

async function loadExams() {
    if (!state.examsLoaded) {
        state.examsLoaded = api("/api/exams").then((r) => {
            state.exams = (r.data && r.data.exams) || [];
        });
    }
    return state.examsLoaded;
}

async function loadMe() {
    const r = await api("/api/me");
    state.user = r.data && r.data.user ? r.data.user : null;
    state.profile = (r.data && r.data.profile) || {};
    state.isAdmin = !!(r.data && r.data.is_admin);
    applyTheme(state.profile.theme);
    renderAccountButton();
    refreshChatBadge();
}

function renderAccountButton() {
    const box = $("#topbar-account");
    if (state.user) {
        box.innerHTML = `<a class="avatar-btn" href="#/account" aria-label="Your account">${
            safeAvatar(state.profile.avatar_image) ? `<img src="${safeAvatar(state.profile.avatar_image)}" alt="">` : esc(initials(state.user))
        }</a>`;
    } else {
        box.innerHTML = `<a class="btn btn-secondary" style="min-height:40px;padding:0 16px;font-size:15px" href="#/login">Log in</a>`;
    }
}

function rememberExam(filename) {
    try { localStorage.setItem(LAST_EXAM_KEY, filename); } catch (e) { /* storage unavailable */ }
}
function lastExam() {
    try { return localStorage.getItem(LAST_EXAM_KEY); } catch (e) { return null; }
}

// ─── Router ─────────────────────────────────────────────────────────────────
const ROUTES = [
    [/^$/, viewHome, "home"],
    [/^study$/, viewStudy, "study"],
    [/^course\/([a-z0-9]+)$/, viewCourse, "study"],
    [/^exam\/(.+)$/, viewExam, "study"],
    [/^practice\/(.+)$/, viewPractice, "study"],
    [/^mastery\/(.+)$/, viewMastery, "study"],
    [/^flashcards\/(.+)$/, viewFlashcards, "study"],
    [/^answers\/(.+)$/, viewAnswers, "study"],
    [/^results$/, viewResults, "study"],
    [/^drills$/, viewDrills, "study"],
    [/^drills\/([A-Za-z0-9_-]+)$/, viewDrill, "study"],
    [/^packet-tracer$/, viewPacketTracer, "study"],
    [/^packet-tracer\/subnet$/, viewPtSubnet, "study"],
    [/^packet-tracer\/cli$/, viewPtCli, "study"],
    [/^packet-tracer\/lab\/([a-z0-9-]+)$/, viewPtLab, "study"],
    [/^packet-tracer\/commands$/, viewPtCmd, "study"],
    [/^my-flashcards$/, viewMyDecks, "study"],
    [/^my-flashcards\/(\d+)$/, viewMyDeck, "study"],
    [/^my-flashcards\/(\d+)\/study$/, viewMyDeckStudy, "study"],
    [/^progress$/, viewProgress, "progress"],
    [/^progress\/attempt\/(.+)$/, viewAttempt, "progress"],
    [/^chat$/, viewChatRooms, "chat"],
    [/^chat\/([a-z0-9]+)$/, viewChatRoom, "chat"],
    [/^chat-reports$/, viewChatReports, "chat"],
    [/^messages$/, viewMessages, "chat"],
    [/^messages\/([A-Za-z0-9_-]+)$/, viewConvo, "chat"],
    [/^login$/, viewLogin, ""],
    [/^account$/, viewAccount, ""],
];

function parseHash() {
    const raw = location.hash.replace(/^#\/?/, "");
    const [path, query = ""] = raw.split("?");
    return { path: decodeURI(path), query: new URLSearchParams(query) };
}

function go(path) { location.hash = "#/" + path; }

let renderToken = 0;
async function router() {
    const token = ++renderToken;
    const { path, query } = parseHash();
    stopChatPolling();
    if (state.cleanup) { try { state.cleanup(); } catch (e) { console.error(e); } state.cleanup = null; }
    document.onkeydown = null;
    document.body.classList.remove("focus-mode");
    const match = ROUTES.find(([re]) => re.test(path)) || ROUTES[0];
    const [re, view, tab] = match;
    const params = (path.match(re) || []).slice(1).map(decodeURIComponent);
    $$(".tabbar a").forEach((a) => {
        if (a.dataset.tab === tab) a.setAttribute("aria-current", "page");
        else a.removeAttribute("aria-current");
    });
    const root = $("#view");
    root.innerHTML = loading();
    window.scrollTo(0, 0);
    await loadExams();
    if (token !== renderToken) return;
    try {
        await view(root, params, query, () => token === renderToken);
    } catch (err) {
        console.error(err);
        root.innerHTML = `<div class="error-box">Something went wrong loading this page. Please try again.</div>`;
    }
}

function needLogin(root, what) {
    const next = encodeURIComponent(parseHash().path);
    root.innerHTML = `
        <div class="card empty">
            <h2 class="section-title">Log in to ${esc(what)}</h2>
            <p class="muted" style="margin:0">Your account saves your scores, mastery progress and chat name.</p>
            <a class="btn btn-primary" href="#/login?next=${next}">Log in or sign up</a>
        </div>`;
}

// ─── Views: Home ────────────────────────────────────────────────────────────
function courseRow(course) {
    const exams = examsFor(course.id);
    const total = exams.reduce((s, e) => s + (e.count || 0), 0);
    const sub = course.retired ? course.subtitle : `${exams.length} exam${exams.length === 1 ? "" : "s"} · ${total} questions`;
    return `
        <a class="row" href="#/course/${course.id}">
            <span class="icon-tile tint-${course.tint}">${icon(course.icon)}</span>
            <span class="row-body"><span class="row-title">${esc(course.name)}</span><span class="row-sub">${esc(sub)}</span></span>
            ${icon("chevron", "row-chevron")}
        </a>`;
}

function visibleCourses() {
    return COURSE_ORDER.map((id) => COURSES[id]).filter((c) => c && (c.retired || examsFor(c.id).length));
}

function courseSections() {
    return `
        <section class="section" aria-labelledby="courses-title">
            <div class="section-head"><h2 class="section-title" id="courses-title">Courses</h2></div>
            <div class="row-list">${visibleCourses().map(courseRow).join("")}</div>
        </section>`;
}

function toolRows() {
    const rows = [
        ["drills", "game", "blue", "Drills & games", `${DRILLS().length || 21} quick games: subnetting, ports, OSI, binary and more`],
        ["packet-tracer", "terminal", "green", "Packet Tracer practice", "Practice labs, subnetting and a CLI simulator"],
        ["my-flashcards", "cards", "orange", "My Flashcards", "Make your own decks and study them"],
    ];
    return `
        <section class="section" aria-labelledby="tools-title">
            <div class="section-head"><h2 class="section-title" id="tools-title">More ways to study</h2></div>
            <div class="row-list">${rows.map(([href, ic, tint, title, sub]) => `
                <a class="row" href="#/${href}">
                    <span class="icon-tile tint-${tint}">${icon(ic)}</span>
                    <span class="row-body"><span class="row-title">${esc(title)}</span><span class="row-sub">${esc(sub)}</span></span>
                    ${icon("chevron", "row-chevron")}
                </a>`).join("")}
            </div>
        </section>`;
}

function drillChips() {
    return `
        <section class="section" aria-labelledby="drills-title">
            <div class="section-head">
                <h2 class="section-title" id="drills-title">Quick drills</h2>
                <a href="#/drills">See all</a>
            </div>
            <div class="chip-row">${DRILLS().slice(0, 4).map((d) => `<a class="chip" href="#/drills/${esc(d.id)}">${esc(d.name)}</a>`).join("")}</div>
        </section>`;
}

async function viewHome(root, _p, _q, alive) {
    let continueCard = "";
    if (state.user) {
        let filename = lastExam();
        if (!filename || !examMeta(filename)) {
            const h = await api("/api/history");
            const first = h.ok && (h.data.attempts || []).find((a) => examMeta(a.filename));
            filename = first ? first.filename : null;
        }
        if (filename && examMeta(filename)) {
            const m = await api(`/api/mastery?filename=${encodeURIComponent(filename)}`);
            const progress = m.ok ? pct(m.data.summary.progress) : 0;
            continueCard = `
                <div class="card">
                    <div class="section-head"><span class="eyebrow">Pick up where you left off</span><span class="eyebrow">Mastery</span></div>
                    <div class="row-body">
                        <span style="font-size:18px;font-weight:700">${esc(examFullName(filename))}</span>
                        <span class="row-sub">${esc(examSub(filename) || "")}${examSub(filename) ? " · " : ""}${examMeta(filename).count} questions</span>
                    </div>
                    <div class="bar-row"><div class="bar"><span style="width:${progress}%"></span></div><strong>${progress}%</strong></div>
                    <a class="btn btn-primary btn-block" href="#/exam/${encodeURIComponent(filename)}">Keep going</a>
                </div>`;
        }
    } else {
        continueCard = `
            <div class="card">
                <h2 class="section-title">Study smarter for your IT exams</h2>
                <p class="muted" style="margin:0">Free practice tests, mastery mode and flashcards. Log in to save your progress and join the chat.</p>
                <div class="btn-row">
                    <a class="btn btn-primary" href="#/login">Log in</a>
                    <a class="btn btn-secondary" href="#/login?mode=signup">Create account</a>
                </div>
            </div>`;
    }
    if (!alive()) return;
    root.innerHTML = `
        <div class="page-head">
            <p>${state.user ? `Welcome back, ${esc(state.user)}` : "Welcome to AnswrIT"}</p>
            <h1 class="page-title">Ready to study?</h1>
        </div>
        ${continueCard}
        ${courseSections()}
        ${drillChips()}
        ${toolRows()}`;
}

// ─── Views: Study, course, exam ─────────────────────────────────────────────
async function viewStudy(root) {
    root.innerHTML = `
        <div class="page-head">
            <h1 class="page-title">Study</h1>
            <p>Pick a course, then an exam.</p>
        </div>
        ${courseSections()}
        ${toolRows()}`;
}

async function viewCourse(root, [courseId]) {
    const course = COURSES[courseId];
    if (!course) return go("study");
    if (course.retired) {
        root.innerHTML = `
            <a class="back-link" href="#/study">${icon("back")}Study</a>
            <div class="page-head"><h1 class="page-title">${esc(course.name)}</h1></div>
            <div class="note note-accent">${COMMS_MESSAGE}</div>`;
        return;
    }
    const exams = examsFor(courseId);
    let mastery = {};
    if (state.user) {
        const results = await Promise.all(exams.map((e) => api(`/api/mastery?filename=${encodeURIComponent(e.filename)}`)));
        results.forEach((r, i) => { if (r.ok) mastery[exams[i].filename] = pct(r.data.summary.progress); });
    }
    root.innerHTML = `
        <a class="back-link" href="#/study">${icon("back")}Study</a>
        <div class="page-head">
            <h1 class="page-title">${esc(course.name)}</h1>
            <p>${exams.length} exams</p>
        </div>
        <div class="row-list">
            ${exams.map((e) => `
                <a class="row" href="#/exam/${encodeURIComponent(e.filename)}">
                    <span class="row-body">
                        <span class="row-title">${esc(examTitle(e.filename))}</span>
                        <span class="row-sub">${esc(examSub(e.filename))}${examSub(e.filename) ? " · " : ""}${e.count} questions</span>
                    </span>
                    ${state.user ? `<span class="row-end">${mastery[e.filename] ?? 0}%</span>` : ""}
                    ${icon("chevron", "row-chevron")}
                </a>`).join("")}
        </div>
        ${(course.labs || []).length ? `
        <div class="section-head"><h2 class="section-title">Packet Tracer</h2></div>
        <div class="row-list">
            ${course.labs.map((l) => `
                <a class="row" href="#/${esc(l.href)}">
                    <span class="icon-tile tint-${esc(l.tint)}">${icon(l.icon)}</span>
                    <span class="row-body">
                        <span class="row-title">${esc(l.title)}</span>
                        <span class="row-sub">${esc(l.sub)}</span>
                    </span>
                    ${icon("chevron", "row-chevron")}
                </a>`).join("")}
        </div>` : ""}
        ${course.note ? `<div class="note">${course.note}</div>` : ""}`;
}

async function viewExam(root, [filename]) {
    const meta = examMeta(filename);
    if (!meta) return go("study");
    rememberExam(filename);
    const course = courseOf(filename);
    let progressCard = "";
    if (state.user) {
        const [m, h] = await Promise.all([
            api(`/api/mastery?filename=${encodeURIComponent(filename)}`),
            api("/api/history"),
        ]);
        const s = m.ok ? m.data.summary : { mastered: 0, total: meta.count, progress: 0 };
        const attempt = h.ok ? (h.data.attempts || []).find((a) => a.filename === filename) : null;
        progressCard = `
            <div class="card" style="flex-direction:row;align-items:center;gap:16px">
                <div class="ring" style="--p:${pct(s.progress)}" role="img" aria-label="${pct(s.progress)} percent mastered"><span>${pct(s.progress)}%</span></div>
                <div class="row-body">
                    <span class="row-title">${s.mastered} of ${s.total} mastered</span>
                    <span class="row-sub">${attempt ? `Last practice score: ${pct(attempt.score)}%` : "No practice tests yet"}</span>
                </div>
            </div>`;
    } else {
        progressCard = `<div class="note">${"<strong>Tip:</strong> "}<a href="#/login?next=${encodeURIComponent("exam/" + filename)}">Log in</a> to use Mastery mode and keep your scores.</div>`;
    }
    const enc = encodeURIComponent(filename);
    root.innerHTML = `
        <a class="back-link" href="#/course/${course ? course.id : ""}">${icon("back")}${esc(course ? course.name : "Study")}</a>
        <div class="page-head">
            ${examSub(filename) ? `<span class="eyebrow">${esc(examTitle(filename))}</span>` : ""}
            <h1 class="page-title">${esc(examSub(filename) || examTitle(filename))}</h1>
            <p>${meta.count} questions</p>
        </div>
        ${progressCard}
        <section class="section">
            <h2 class="section-title">How do you want to study?</h2>
            <a class="mode-btn featured" href="#/mastery/${enc}">
                <span class="icon-tile tint-white">${icon("star")}</span>
                <span class="row-body">
                    <span class="mode-title">Mastery mode <span class="badge">Best</span></span>
                    <span class="row-sub">Keep going until you know every question</span>
                </span>
            </a>
            <div class="card" style="gap:12px">
                <div style="display:flex;align-items:center;gap:14px">
                    <span class="icon-tile tint-blue">${icon("test")}</span>
                    <span class="row-body">
                        <span class="mode-title">Practice test</span>
                        <span class="row-sub">Pick how many questions, get a score</span>
                    </span>
                </div>
                <div class="chip-row" role="group" aria-label="Number of questions">
                    ${[10, 25, 50].filter((n) => n < meta.count).map((n) => `<a class="chip" href="#/practice/${enc}?n=${n}">${n} questions</a>`).join("")}
                    <a class="chip" href="#/practice/${enc}?n=${meta.count}">All ${meta.count}</a>
                </div>
            </div>
            <a class="mode-btn" href="#/flashcards/${enc}">
                <span class="icon-tile tint-blue">${icon("cards")}</span>
                <span class="row-body">
                    <span class="mode-title">Flashcards</span>
                    <span class="row-sub">Flip through answers to memorize them</span>
                </span>
            </a>
            <a class="mode-btn" href="#/answers/${enc}">
                <span class="icon-tile tint-green">${icon("list")}</span>
                <span class="row-body">
                    <span class="mode-title">All questions &amp; answers</span>
                    <span class="row-sub">Read or search every question with its answer</span>
                </span>
            </a>
        </section>`;
}

// ─── All questions & answers ────────────────────────────────────────────────
async function viewAnswers(root, [filename], query, alive) {
    const meta = examMeta(filename);
    if (!meta) return go("study");
    const enc = encodeURIComponent(filename);
    const r = await api("/api/exam-questions", { method: "POST", body: { filename } });
    if (!alive()) return;
    if (!r.ok) {
        root.innerHTML = `<div class="error-box">${esc(r.data.error || "Couldn't load the questions.")}</div>`;
        return;
    }
    const all = (r.data.questions || []).map((q, i) => ({ q, n: i + 1 }));
    const textOf = (q) => [q.question, ...(q.options || []), ...correctList(q), ...(q.terms || []), ...(q.definitions || [])].join(" ").toLowerCase();
    all.forEach((x) => { x.text = textOf(x.q); });
    const s = { query: "", hide: false, shown: new Set() };

    const answerHtml = (q) => {
        if (isMatching(q)) {
            const pairs = q.correct_pairs || {};
            const boxes = (q.definitions || [...new Set(Object.values(pairs))]).map((d) => {
                const items = Object.keys(pairs).filter((t) => pairs[t] === d);
                return `<div class="ans-box"><span class="ans-box-h">${esc(d)}</span>${items.map((t) => `<span class="ans-box-i">${esc(t)}</span>`).join("") || '<span class="ans-box-i muted">(nothing)</span>'}</div>`;
            }).join("");
            const unused = (q.terms || []).filter((t) => !(t in pairs));
            return `<div class="ans-boxes">${boxes}</div>${unused.length ? `<p class="ans-unused"><strong>Not used:</strong> ${unused.map(esc).join(" · ")}</p>` : ""}`;
        }
        const right = correctList(q);
        if (!(q.options || []).length) return `<ul class="ans-opts"><li class="ok"><span class="ans-mark" aria-hidden="true">✓</span><span>${esc(right.join(" · "))}</span></li></ul>`;
        return `<ul class="ans-opts">${q.options.map((o) => {
            const ok = right.includes(String(o).trim());
            const img = q.option_images && q.option_images[o];
            return `<li class="${ok ? "ok" : ""}"><span class="ans-mark" aria-hidden="true">${ok ? "✓" : ""}</span><span class="option-text">${img ? `<img class="option-img" src="${esc(img)}" alt="" loading="lazy">` : ""}${esc(o)}</span>${ok ? '<span class="sr-only">(correct)</span>' : ""}</li>`;
        }).join("")}</ul>`;
    };
    const cardHtml = ({ q, n }) => {
        const hidden = s.hide && !s.shown.has(n);
        const many = !isMatching(q) && correctList(q).length > 1;
        return `<article class="card ans-card" id="q-${n}" data-qid="${esc(q.id)}">
            <div class="ans-head"><span class="ans-num">Question ${n}</span>${isMatching(q) ? '<span class="ans-tag">Matching</span>' : many ? `<span class="ans-tag">Choose ${correctList(q).length}</span>` : ""}</div>
            <p class="question-text">${esc(q.question)}</p>
            ${q.image ? `<img class="question-img" src="${esc(q.image)}" alt="Exhibit for question ${n}" loading="lazy">` : ""}
            ${hidden ? `<button type="button" class="btn btn-secondary ans-reveal" data-n="${n}">Show answer</button>` : answerHtml(q)}
        </article>`;
    };
    function renderList() {
        const words = s.query.toLowerCase().split(/\s+/).filter(Boolean);
        const list = words.length ? all.filter((x) => words.every((w) => x.text.includes(w))) : all;
        $("#ans-count", root).textContent = words.length ? `${list.length} of ${all.length} questions match` : `${all.length} questions`;
        $("#ans-list", root).innerHTML = list.length ? list.map(cardHtml).join("") : `<div class="card empty"><p class="muted" style="margin:0">No questions match “${esc(s.query)}”.</p></div>`;
        $$(".ans-reveal", root).forEach((b) => { b.onclick = () => { s.shown.add(Number(b.dataset.n)); renderList(); }; });
    }
    root.innerHTML = `
        <a class="back-link" href="#/exam/${enc}">${icon("back")}${esc(examSub(filename) || examTitle(filename))}</a>
        <div class="page-head">
            <span class="eyebrow">${esc(examFullName(filename))}</span>
            <h1 class="page-title">All questions &amp; answers</h1>
        </div>
        <div class="ans-tools">
            <input class="input" id="ans-q" type="search" placeholder="Search questions or answers" aria-label="Search questions or answers" autocomplete="off">
            <label class="ans-toggle"><input type="checkbox" id="ans-hide"> Hide answers until I tap</label>
            <p class="small muted" id="ans-count" aria-live="polite" style="margin:0"></p>
        </div>
        <div class="ans-list" id="ans-list"></div>
        <button type="button" class="btn btn-secondary btn-block" id="ans-top">Back to top</button>`;
    let t = null;
    $("#ans-q", root).oninput = (e) => { clearTimeout(t); t = setTimeout(() => { s.query = e.target.value.trim(); renderList(); }, 150); };
    $("#ans-hide", root).onchange = (e) => { s.hide = e.target.checked; s.shown.clear(); renderList(); };
    $("#ans-top", root).onclick = () => { window.scrollTo({ top: 0, behavior: "smooth" }); };
    renderList();
    const jump = query && query.get("id");
    if (jump) {
        const el = $(`.ans-card[data-qid="${CSS.escape(jump)}"]`, root);
        if (el) { el.classList.add("ans-focus"); setTimeout(() => el.scrollIntoView({ block: "start" }), 50); }
    }
}

// ─── Quiz runner (practice & mastery) ───────────────────────────────────────
function correctList(q) {
    return String(q._correct_answer || q.correct_answer || "").split("|").map((s) => s.trim()).filter(Boolean);
}
function isMatching(q) { return q.type === "matching"; }

// ─── Matching board (looks like the drag-and-drop on the real Cisco exam) ───
// Items start in the left column. Each answer box on the right gets as many
// slots as items belong in it. Tap an item, then tap a slot (or drag on desktop).
// Items that aren't used simply stay on the left, like on the real exam.
function matchTargets(q) {
    const pairs = q.correct_pairs || {};
    const labels = [...new Set([...(q.definitions || []), ...Object.values(pairs)])];
    return labels.map((label) => ({ label, slots: Math.max(1, Object.values(pairs).filter((v) => v === label).length) }));
}
function boardAnswers(q, b) {
    const targets = matchTargets(q);
    return Object.fromEntries(Object.entries(b.placed).map(([key, term]) => [term, targets[Number(key.split(":")[0])].label]));
}
function boardHtml(q, b, checked) {
    const pairs = q.correct_pairs || {};
    const placedTerms = new Set(Object.values(b.placed));
    // Items are shuffled once per question so their order never gives the answer away.
    const pool = (b.order || q.terms || []).filter((t) => !placedTerms.has(t));
    const ready = !!b.selected && !checked;
    const targets = matchTargets(q).map((tg, i) => {
        const needed = Object.values(pairs).includes(tg.label);
        let wrong = false;
        const slots = Array.from({ length: tg.slots }, (_, j) => {
            const key = `${i}:${j}`;
            const term = b.placed[key];
            if (term) {
                const ok = pairs[term] === tg.label;
                if (checked && !ok) wrong = true;
                return `<button type="button" class="slot filled ${checked ? (ok ? "ok" : "no") : ""}" data-slot="${key}" draggable="${!checked}" ${checked ? "disabled" : ""}
                    aria-label="${esc(term)}, placed under ${esc(tg.label)}. Tap to take it back.">
                    ${checked ? `<span class="slot-mark">${icon(ok ? "check" : "close")}</span>` : ""}<span>${esc(term)}</span></button>`;
            }
            if (checked && needed) wrong = true;
            return `<button type="button" class="slot empty ${ready ? "ready" : ""}" data-slot="${key}" ${checked ? "disabled" : ""}
                aria-label="Empty box under ${esc(tg.label)}">${ready ? "Tap to place here" : ""}</button>`;
        }).join("");
        const answer = Object.keys(pairs).filter((t) => pairs[t] === tg.label);
        const fix = checked && wrong ? `<div class="target-fix">Answer: ${answer.length ? answer.map(esc).join(" · ") : "leave empty"}</div>` : "";
        return `<div class="target"><div class="target-head">${esc(tg.label)}</div>${slots}${fix}</div>`;
    }).join("");
    return `
        ${checked ? "" : `<p class="board-hint">${b.selected ? "Now tap the box where it goes." : "Tap an item, then tap the box where it goes."}</p>`}
        <div class="board">
            <div class="pool" data-pool aria-label="Items to place">
                ${pool.map((t) => `<button type="button" class="m-item ${b.selected === t ? "selected" : ""}" data-term="${esc(t)}"
                    draggable="${!checked}" aria-pressed="${b.selected === t}" ${checked ? "disabled" : ""}>${esc(t)}</button>`).join("")}
            </div>
            <div class="targets">${targets}</div>
        </div>`;
}
function bindBoard(root, b, changed) {
    const remove = (term) => { for (const k of Object.keys(b.placed)) if (b.placed[k] === term) delete b.placed[k]; };
    const place = (term, key) => { remove(term); b.placed[key] = term; b.selected = null; };
    $$(".m-item", root).forEach((el) => {
        el.onclick = () => { b.selected = b.selected === el.dataset.term ? null : el.dataset.term; changed(); };
        el.ondragstart = (e) => e.dataTransfer.setData("text/plain", el.dataset.term);
    });
    $$(".slot", root).forEach((el) => {
        const key = el.dataset.slot;
        el.onclick = () => {
            const here = b.placed[key];
            if (b.selected) place(b.selected, key); // anything already here goes back to the left
            else if (here) { delete b.placed[key]; b.selected = here; }
            changed();
        };
        if (b.placed[key]) el.ondragstart = (e) => e.dataTransfer.setData("text/plain", b.placed[key]);
        el.ondragover = (e) => e.preventDefault();
        el.ondrop = (e) => { e.preventDefault(); const t = e.dataTransfer.getData("text/plain"); if (t) { place(t, key); changed(); } };
    });
    const pool = $("[data-pool]", root);
    if (pool) {
        pool.ondragover = (e) => e.preventDefault();
        pool.ondrop = (e) => { e.preventDefault(); remove(e.dataTransfer.getData("text/plain")); changed(); };
    }
}

function isAnswered(q, sel) {
    if (isMatching(q)) return Object.keys(sel || {}).length >= Object.keys(q.correct_pairs || {}).length;
    if (Array.isArray(sel)) return sel.length === correctList(q).length;
    return !!sel;
}
function isCorrect(q, sel) {
    if (isMatching(q)) {
        const pairs = q.correct_pairs || {};
        const keys = Object.keys(pairs);
        return keys.length > 0 && sel && keys.length === Object.keys(sel).length && keys.every((k) => sel[k] === pairs[k]);
    }
    const want = new Set(correctList(q));
    const got = new Set((Array.isArray(sel) ? sel : [sel]).filter(Boolean).map((s) => String(s).trim()));
    return want.size === got.size && [...want].every((x) => got.has(x));
}

// ─── Memory hints ───────────────────────────────────────────────────────────
// Each hint links a clue in the question to a key word in the right answer. A key marked
// "unique" appears in no other answer choice in the whole exam. Hint files live in
// static/beta/hints/<exam>.json; add an exam's file name here when its hints are written.
const HINT_EXAMS = new Set([
    "ccna-2-v7-modules-1-4-switching-concepts-vlans-and-intervlan-routing-exam-answers.json",
]);
async function loadHints(filename) {
    if (!HINT_EXAMS.has(filename)) return null;
    try {
        const res = await fetch(`/beta/hints/${encodeURIComponent(filename)}?v=1`);
        return res.ok ? await res.json() : null;
    } catch (e) { return null; }
}
function hintCardHtml(h, open) {
    const keys = h.keys.map((k) => `<span class="hint-key">${esc(k.k)}${k.unique ? '<span class="hint-star" title="No other answer in this exam has this">★</span>' : ""}</span>`).join('<span class="hint-plus">+</span>');
    const anyUnique = h.keys.some((k) => k.unique);
    return `<div class="hint-card ${open ? "after" : ""}" role="note">
        <div class="hint-title">${icon("star")}Memory hook</div>
        <div class="hint-link"><span class="hint-cue">${esc(h.cue)}</span><span class="hint-arrow" aria-label="goes with">→</span>${keys}</div>
        <p class="hint-tip">${esc(h.tip)}</p>
        ${anyUnique ? `<p class="hint-legend">★ No other answer in this exam has this word</p>` : ""}
    </div>`;
}
/** Wraps the hint's key words inside an answer's text (already escaped) in <mark>. */
function markKeys(escaped, h) {
    if (!h) return escaped;
    let out = escaped;
    for (const k of h.keys) {
        const e = esc(k.k).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        out = out.replace(new RegExp(`(^|[^A-Za-z0-9])(${e})(?![A-Za-z0-9])`, "i"), "$1<mark class=\"hint-mark\">$2</mark>");
    }
    return out;
}

/** Runs a list of questions one at a time with instant feedback.
 *  Resolves with { answers, durationSeconds } or null if the user quits. */
function runQuiz(root, { quiz, heading, alive, filename, hints }) {
    return new Promise((resolve) => {
        document.body.classList.add("focus-mode");
        const s = { index: 0, answers: {}, checked: false, started: Date.now(), boards: {}, hintOpen: {} };
        const board = (q) => s.boards[q.id] || (s.boards[q.id] = { placed: {}, selected: null, order: (q.terms || []).slice() });

        const quit = () => {
            const answered = Object.keys(s.answers).length;
            if (answered > 0 && !confirm("Leave this session? Your answers so far won't be saved.")) return;
            resolve(null);
        };

        function render() {
            if (!alive()) return resolve(null);
            const q = quiz[s.index];
            const multi = !isMatching(q) && correctList(q).length > 1;
            const sel = s.answers[q.id];
            const hint = hints ? hints[String(q.id)] : null;
            const total = quiz.length;
            const done = Math.round((s.index / total) * 100);
            let body = "";
            if (isMatching(q)) {
                body = boardHtml(q, board(q), s.checked);
            } else {
                const chosen = Array.isArray(sel) ? sel : sel ? [sel] : [];
                const right = correctList(q);
                body = `<div class="options" role="group" aria-label="Answer choices">${(q.options || []).map((opt, i) => {
                    const picked = chosen.includes(opt);
                    let cls = multi ? "multi" : "";
                    if (s.checked) {
                        if (right.includes(opt.trim())) cls += " is-correct";
                        else if (picked) cls += " is-wrong";
                    }
                    return `<button type="button" class="option ${cls}" data-i="${i}" aria-pressed="${picked}" ${s.checked ? "disabled" : ""}>
                        <span class="mark">${icon(s.checked && !right.includes(opt.trim()) && picked ? "close" : "check")}</span>
                        ${q.option_images && q.option_images[opt] ? `<img class="option-img" src="${esc(q.option_images[opt])}" alt="" loading="lazy">` : ""}
                        <span class="option-text">${s.checked && right.includes(opt.trim()) ? markKeys(esc(opt), hint) : esc(opt)}</span>
                    </button>`;
                }).join("")}</div>`;
            }
            let feedback = "";
            if (s.checked) {
                const good = isCorrect(q, sel);
                feedback = good
                    ? `<div class="feedback good" role="status"><strong>Correct!</strong></div>`
                    : `<div class="feedback bad" role="status"><strong>Not quite.</strong>${isMatching(q) ? "<span>The correct matches are shown above.</span>" : `<span>Correct answer: ${esc(correctList(q).join(" · "))}</span>`}</div>`;
            }
            const last = s.index === total - 1;
            const action = s.checked
                ? `<button type="button" class="btn btn-primary btn-block" id="next-btn">${last ? "See results" : "Next question"}</button>`
                : `<button type="button" class="btn btn-primary btn-block" id="check-btn" ${isAnswered(q, sel) ? "" : "disabled"}>Check answer</button>`;
            // Redrawing the question used to reload its pictures. For a moment they had no height,
            // the page got shorter and the browser jumped to the top. Keep the loaded pictures
            // and the scroll position across redraws of the same question.
            const sameQuestion = s.shownId === q.id;
            const keepY = window.scrollY;
            const oldImgs = sameQuestion ? $$("img", root) : [];
            s.shownId = q.id;
            root.innerHTML = `
                <div class="runner-head">
                    <button type="button" class="icon-btn" id="quit-btn" aria-label="Leave ${esc(heading)}">${icon("close")}</button>
                    <div class="bar" role="progressbar" aria-valuenow="${done}" aria-valuemin="0" aria-valuemax="100" aria-label="Progress"><span style="width:${done}%"></span></div>
                    <span class="runner-count">${s.index + 1} / ${total}</span>
                </div>
                <span class="eyebrow">${esc(heading)}</span>
                <h1 class="question-text">${esc(q.question)}</h1>
                ${multi ? `<p class="question-hint">Choose ${correctList(q).length}</p>` : ""}
                ${q.image ? `<img class="question-img" src="${esc(q.image)}" alt="Diagram for this question" loading="lazy">` : ""}
                ${body}
                ${feedback}
                ${hint ? (s.checked || s.hintOpen[q.id] ? hintCardHtml(hint, s.checked) : `<button type="button" class="hint-btn" id="hint-btn">${icon("star")}Show memory hint</button>`) : ""}
                ${filename ? `<button type="button" class="ask-link" id="ask-btn">${icon("bubble")}Ask about this question</button>` : ""}
                <div class="runner-actions">${action}</div>`;
            if (sameQuestion) {
                const spare = oldImgs.slice();
                $$("img", root).forEach((img) => {
                    const at = spare.findIndex((o) => o.getAttribute("src") === img.getAttribute("src") && o.className === img.className);
                    if (at >= 0) { img.replaceWith(spare[at]); spare.splice(at, 1); }
                });
                window.scrollTo(0, keepY);
            }

            $("#quit-btn", root).onclick = quit;
            const hb = $("#hint-btn", root);
            if (hb) hb.onclick = () => { s.hintOpen[q.id] = true; render(); };
            const ask = $("#ask-btn", root);
            if (ask) ask.onclick = () => askAboutQuestion(filename, q);
            $$(".option", root).forEach((btn) => {
                btn.onclick = () => {
                    const opt = q.options[Number(btn.dataset.i)];
                    if (multi) {
                        const cur = Array.isArray(s.answers[q.id]) ? s.answers[q.id].slice() : [];
                        const at = cur.indexOf(opt);
                        if (at >= 0) cur.splice(at, 1);
                        else if (cur.length < correctList(q).length) cur.push(opt);
                        else { cur.shift(); cur.push(opt); }
                        s.answers[q.id] = cur;
                    } else {
                        s.answers[q.id] = opt;
                    }
                    render();
                };
            });
            if (isMatching(q) && !s.checked) {
                bindBoard(root, board(q), () => { s.answers[q.id] = boardAnswers(q, board(q)); render(); });
            }
            const check = $("#check-btn", root);
            if (check) check.onclick = () => { s.checked = true; render(); };
            const next = $("#next-btn", root);
            if (next) next.onclick = () => {
                if (last) {
                    resolve({ answers: s.answers, durationSeconds: Math.round((Date.now() - s.started) / 1000) });
                } else {
                    s.index += 1;
                    s.checked = false;
                    render();
                    window.scrollTo(0, 0);
                }
            };
        }
        render();
    });
}

// ─── Answer choice shuffling ────────────────────────────────────────────────
// Every time a question is shown in a practice test or Mastery, its choices come in a new
// order, never the same order as the last time this device saw that question. Answers are
// matched by text, so scoring is unaffected. The last order per question is remembered in
// localStorage as a permutation of the alphabetically sorted choices.
const CHOICE_ORDER_KEY = "answrit:choiceOrder";
function loadChoiceOrders() {
    try { return JSON.parse(localStorage.getItem(CHOICE_ORDER_KEY) || "{}") || {}; } catch (e) { return {}; }
}
function saveChoiceOrders(map) {
    try {
        const keys = Object.keys(map);
        if (keys.length > 4000) keys.slice(0, keys.length - 4000).forEach((k) => delete map[k]);
        localStorage.setItem(CHOICE_ORDER_KEY, JSON.stringify(map));
    } catch (e) { /* storage unavailable: still shuffled, just not remembered */ }
}
function shuffleChoices(quiz, filename) {
    const orders = loadChoiceOrders();
    // Shuffle one list so it never comes out in the same order as last time.
    const fresh = (list, key) => {
        if (list.length < 2) return list.slice();
        const sorted = list.slice().sort();
        const last = orders[key];
        let next, sig;
        for (let tries = 0; tries < 12; tries++) {
            next = shuffle(list);
            sig = next.map((o) => sorted.indexOf(o)).join(",");
            if (sig !== last) break;
        }
        delete orders[key];
        orders[key] = sig;
        return next;
    };
    const out = quiz.map((q) => {
        const key = `${filename}|${q.id}`;
        if (isMatching(q)) {
            // Both sides of the board: the items on the left and the answer boxes on the right.
            const boxes = matchTargets(q).map((tg) => tg.label);
            return { ...q, terms: fresh(q.terms || [], `${key}|L`), definitions: fresh(boxes, `${key}|R`) };
        }
        const opts = q.options || [];
        if (opts.length < 2) return q;
        return { ...q, options: fresh(opts, key) };
    });
    saveChoiceOrders(orders);
    return out;
}

async function viewPractice(root, [filename], query, alive) {
    const meta = examMeta(filename);
    if (!meta) return go("study");
    const n = Math.max(1, Math.min(Number(query.get("n")) || 10, meta.count));
    const ids = (query.get("ids") || "").trim();
    const r = await api(`/api/test?n=${n}&filename=${encodeURIComponent(filename)}${ids ? `&ids=${encodeURIComponent(ids)}` : ""}`);
    if (!r.ok || !(r.data.quiz || []).length) {
        root.innerHTML = `<div class="error-box">${esc(r.data.error || "Couldn't load questions.")}</div>`;
        return;
    }
    // A retake uses the same questions, mixed into a new order
    const quiz = shuffleChoices(ids ? shuffle(r.data.quiz) : r.data.quiz, filename);
    const title = examFullName(filename);
    const hints = await loadHints(filename);
    const outcome = await runQuiz(root, { quiz, heading: `Practice test · ${title}`, alive, filename, hints });
    if (!outcome) return alive() && go(`exam/${encodeURIComponent(filename)}`);
    root.innerHTML = loading();
    const scored = await api("/api/score", { method: "POST", body: { quiz, answers: outcome.answers, filename, title } });
    if (!scored.ok) {
        root.innerHTML = `<div class="error-box">Couldn't score this test. ${esc(scored.data.error || "")}</div>`;
        return;
    }
    const d = scored.data;
    state.lastResult = { filename, title, n, ...d };
    if (state.user) {
        api("/api/history", {
            method: "POST",
            body: {
                filename, title, quiz, answers: outcome.answers, results: d.results,
                total: d.total, correct: d.correct, score: d.score, duration_seconds: outcome.durationSeconds,
            },
        });
    }
    if (alive()) location.replace("#/results");
}

function resultsHtml(result, { backHref, retakeHref }) {
    const wrong = result.results.filter((x) => !x.is_correct);
    const sameIds = result.results.length && result.results.every((x) => x.id != null) ? result.results.map((x) => encodeURIComponent(x.id)).join(",") : "";
    const fmt = (v) => Array.isArray(v) ? v.join(" · ") : (v && typeof v === "object") ? Object.entries(v).map(([k, val]) => `${k} → ${val}`).join("; ") : String(v || "");
    return `
        <div class="card result-hero">
            <span class="eyebrow">${esc(result.title)}</span>
            <div class="result-score">${pct(result.score)}%</div>
            <p class="muted" style="margin:0">${result.correct} of ${result.total} correct</p>
            <div class="btn-row" style="width:100%">
                ${retakeHref && sameIds ? `<a class="btn btn-primary btn-wide" href="${retakeHref.split("?")[0]}?ids=${sameIds}">${icon("refresh")}Retake same test</a>` : ""}
                ${retakeHref ? `<a class="btn ${sameIds ? "btn-secondary" : "btn-primary"}" href="${retakeHref}">New questions</a>` : ""}
                <a class="btn btn-secondary" href="${backHref}">Done</a>
            </div>
        </div>
        ${!state.user ? `<div class="note"><a href="#/login">Log in</a> to save your scores to Progress.</div>` : ""}
        ${result.slimmed ? `<div class="note">Question-by-question review is kept for 30 days after a test. Your score is saved for good.</div>` : `
        <section class="section">
            <h2 class="section-title">${wrong.length ? `Review ${wrong.length} missed question${wrong.length === 1 ? "" : "s"}` : "Perfect score. Nothing to review!"}</h2>
            ${wrong.map((x) => `
                <div class="card review-item">
                    <span class="q">${esc(x.question)}</span>
                    <span class="review-line bad"><span class="tag">You:</span><span>${esc(fmt(x.selected) || "No answer")}</span></span>
                    <span class="review-line good"><span class="tag">Answer:</span><span>${esc(fmt(x.type === "matching" ? x.correct_pairs : x.correct_answer))}</span></span>
                </div>`).join("")}
        </section>`}`;
}

async function viewResults(root) {
    const r = state.lastResult;
    if (!r) return go("study");
    const enc = encodeURIComponent(r.filename);
    root.innerHTML = resultsHtml(r, { backHref: `#/exam/${enc}`, retakeHref: `#/practice/${enc}?n=${r.n}` });
}

async function viewMastery(root, [filename], _q, alive) {
    const meta = examMeta(filename);
    if (!meta) return go("study");
    if (!state.user) return needLogin(root, "use Mastery mode");
    const enc = encodeURIComponent(filename);
    const r = await api(`/api/mastery/batch?n=${MASTERY_BATCH}&filename=${enc}`);
    if (!r.ok) {
        root.innerHTML = `<div class="error-box">${esc(r.data.error || "Couldn't load questions.")}</div>`;
        return;
    }
    const quiz = shuffleChoices(r.data.quiz || [], filename);
    if (!quiz.length) {
        root.innerHTML = `
            <a class="back-link" href="#/exam/${enc}">${icon("back")}Back</a>
            <div class="card result-hero">
                <span class="eyebrow">${esc(examFullName(filename))}</span>
                <div class="result-score">100%</div>
                <p style="margin:0">You've mastered every question in this exam.</p>
                <button type="button" class="btn btn-danger" id="reset-btn">Start mastery over</button>
            </div>`;
        $("#reset-btn", root).onclick = async () => {
            if (!confirm("Reset your mastery progress for this exam?")) return;
            await api("/api/mastery/reset", { method: "POST", body: { filename } });
            router();
        };
        return;
    }
    const hints = await loadHints(filename);
    const outcome = await runQuiz(root, { quiz, heading: `Mastery · ${examFullName(filename)}`, alive, filename, hints });
    if (!outcome) return alive() && go(`exam/${enc}`);
    root.innerHTML = loading();
    const sub = await api("/api/mastery/submit", { method: "POST", body: { filename, quiz, answers: outcome.answers } });
    if (!alive()) return;
    document.body.classList.remove("focus-mode");
    if (!sub.ok) {
        root.innerHTML = `<div class="error-box">Couldn't save your progress. ${esc(sub.data.error || "")}</div>`;
        return;
    }
    const s = sub.data.summary;
    const right = quiz.filter((q) => isCorrect(q, outcome.answers[q.id])).length;
    root.innerHTML = `
        <div class="card result-hero">
            <span class="eyebrow">Mastery · ${esc(examFullName(filename))}</span>
            <div class="result-score">${right}/${quiz.length}</div>
            <p style="margin:0">${sub.data.newly_mastered ? `You mastered <strong>${sub.data.newly_mastered}</strong> new question${sub.data.newly_mastered === 1 ? "" : "s"}.` : "Keep at it: questions you miss come back until you get them."}</p>
            <div class="bar-row" style="width:100%"><div class="bar"><span style="width:${pct(s.progress)}%"></span></div><strong>${pct(s.progress)}%</strong></div>
            <p class="muted small" style="margin:0">${s.mastered} of ${s.total} mastered</p>
            <div class="btn-row" style="width:100%">
                <button type="button" class="btn btn-primary" id="again-btn">Keep going</button>
                <a class="btn btn-secondary" href="#/exam/${enc}">Done</a>
            </div>
        </div>`;
    $("#again-btn", root).onclick = () => router();
}

// ─── Flashcards ─────────────────────────────────────────────────────────────
async function viewFlashcards(root, [filename], _q, alive) {
    const meta = examMeta(filename);
    if (!meta) return go("study");
    const enc = encodeURIComponent(filename);
    const [r, rev] = await Promise.all([
        api("/api/exam-questions", { method: "POST", body: { filename } }),
        state.user ? api(`/api/flashcard/reviews?filename=${enc}`) : Promise.resolve({ ok: false }),
    ]);
    if (!r.ok) {
        root.innerHTML = `<div class="error-box">${esc(r.data.error || "Couldn't load cards.")}</div>`;
        return;
    }
    if (!alive()) return;
    const all = r.data.questions || [];
    const marked = new Set(rev.ok ? (rev.data.reviews || []).map(String) : []);
    const s = { order: all.slice(), index: 0, flipped: false, onlyMarked: false, shuffled: false };

    const cards = () => s.onlyMarked ? s.order.filter((q) => marked.has(String(q.id))) : s.order;
    const backHtml = (q) => {
        if (q.type === "matching") {
            return `<ul>${Object.entries(q.correct_pairs || {}).map(([k, v]) => `<li>${esc(k)} → <strong>${esc(v)}</strong></li>`).join("")}</ul>`;
        }
        const list = correctList(q);
        return list.length > 1
            ? `<ul>${list.map((a) => `<li class="face-text">${esc(a)}</li>`).join("")}</ul>`
            : `<p class="face-text">${esc(list[0] || "")}</p>`;
    };

    function render() {
        const list = cards();
        if (s.index >= list.length) s.index = Math.max(0, list.length - 1);
        const q = list[s.index];
        const isMarked = q && marked.has(String(q.id));
        root.innerHTML = `
            <a class="back-link" href="#/exam/${enc}">${icon("back")}${esc(examTitle(filename))}</a>
            <div class="page-head">
                <h1 class="page-title">Flashcards</h1>
                <p>${list.length ? `Card ${s.index + 1} of ${list.length}` : "No cards"}${s.onlyMarked ? " · marked only" : ""}</p>
            </div>
            ${q ? `
                <button type="button" class="flashcard ${s.flipped ? "back" : ""}" id="card" aria-label="${s.flipped ? "Answer. Tap to see the question" : "Question. Tap to see the answer"}">
                    <span class="side">${s.flipped ? "Answer" : "Question"}</span>
                    ${s.flipped ? backHtml(q) : `<p class="face-text">${esc(q.question)}</p>`}
                    ${!s.flipped && q.image ? `<img class="question-img" src="${esc(q.image)}" alt="Diagram for this question" loading="lazy">` : ""}
                    <span class="tap-hint">Tap the card to flip it</span>
                </button>
                <div class="fc-controls">
                    <button type="button" class="btn btn-secondary" id="prev-btn" aria-label="Previous card" ${s.index === 0 ? "disabled" : ""}>${icon("prev")}</button>
                    <button type="button" class="btn btn-primary" id="flip-btn">${s.flipped ? "Show question" : "Show answer"}</button>
                    <button type="button" class="btn btn-secondary" id="next-btn" aria-label="Next card" ${s.index >= list.length - 1 ? "disabled" : ""}>${icon("next")}</button>
                </div>` : `<div class="card empty"><p style="margin:0">You haven't marked any cards yet.</p></div>`}
            <div class="chip-row">
                ${state.user && q ? `<button type="button" class="chip star-btn" id="mark-btn" aria-pressed="${isMarked}">${isMarked ? "Marked for review" : "Mark for review"}</button>` : ""}
                ${state.user ? `<button type="button" class="chip" id="only-btn" aria-pressed="${s.onlyMarked}">Marked only (${marked.size})</button>` : ""}
                <button type="button" class="chip" id="shuffle-btn" aria-pressed="${s.shuffled}">Shuffle</button>
            </div>
            ${!state.user ? `<div class="note"><a href="#/login?next=${encodeURIComponent("flashcards/" + filename)}">Log in</a> to mark cards you want to review later.</div>` : ""}`;

        const flip = () => { s.flipped = !s.flipped; render(); };
        const card = $("#card", root);
        if (card) card.onclick = flip;
        const flipBtn = $("#flip-btn", root);
        if (flipBtn) flipBtn.onclick = flip;
        const prev = $("#prev-btn", root);
        if (prev) prev.onclick = () => { s.index -= 1; s.flipped = false; render(); };
        const next = $("#next-btn", root);
        if (next) next.onclick = () => { s.index += 1; s.flipped = false; render(); };
        const mark = $("#mark-btn", root);
        if (mark) mark.onclick = async () => {
            const id = String(q.id);
            if (marked.has(id)) marked.delete(id); else marked.add(id);
            render();
            const res = await api("/api/flashcard/review", { method: "POST", body: { filename, question_id: q.id } });
            if (res.ok) {
                if (res.data.marked) marked.add(id); else marked.delete(id);
                render();
            }
        };
        const only = $("#only-btn", root);
        if (only) only.onclick = () => { s.onlyMarked = !s.onlyMarked; s.index = 0; s.flipped = false; render(); };
        $("#shuffle-btn", root).onclick = () => {
            s.shuffled = !s.shuffled;
            s.order = s.shuffled ? shuffle(all) : all.slice();
            s.index = 0; s.flipped = false;
            render();
        };
    }
    document.onkeydown = (e) => {
        if (!location.hash.startsWith("#/flashcards/")) { document.onkeydown = null; return; }
        if (e.target.closest("input, select, textarea")) return;
        if (e.key === "ArrowRight") $("#next-btn", root)?.click();
        else if (e.key === "ArrowLeft") $("#prev-btn", root)?.click();
        else if (e.key === " " && e.target === document.body) { e.preventDefault(); $("#flip-btn", root)?.click(); }
    };
    render();
}

// ─── Drills ─────────────────────────────────────────────────────────────────
async function viewDrills(root) {
    const list = DRILLS();
    const groups = [];
    list.forEach((d) => {
        let g = groups.find((x) => x.name === (d.group || "More"));
        if (!g) groups.push(g = { name: d.group || "More", items: [] });
        g.items.push(d);
    });
    root.innerHTML = `
        <a class="back-link" href="#/study">${icon("back")}Study</a>
        <div class="page-head">
            <h1 class="page-title">Drills &amp; games</h1>
            <p>Short games for the things you need to memorize.</p>
        </div>
        ${list.length ? groups.map((g) => `
            <section class="section">
                <div class="section-head"><h2 class="section-title">${esc(g.name)}</h2></div>
                <div class="row-list">${g.items.map((d) => `
                    <a class="row" href="#/drills/${esc(d.id)}">
                        <span class="icon-tile tint-blue">${icon("game")}</span>
                        <span class="row-body"><span class="row-title">${esc(d.name)}</span><span class="row-sub">${esc(d.desc || "")}</span></span>
                        ${icon("chevron", "row-chevron")}
                    </a>`).join("")}
                </div>
            </section>`).join("") : `<div class="error-box">The drills didn't load. Refresh the page to try again.</div>`}`;
}

async function viewDrill(root, [id], _q, alive) {
    const d = DRILLS().find((x) => x.id === id);
    if (!d) return go("drills");
    root.innerHTML = `
        <a class="back-link" href="#/drills">${icon("back")}Drills</a>
        <div class="page-head"><h1 class="page-title">${esc(d.name)}</h1></div>
        <div id="drill-body"></div>`;
    const cleanup = window.AnswritDrills.mount($("#drill-body", root), id, { esc, shuffle, alive });
    if (typeof cleanup === "function") state.cleanup = cleanup;
}

// ─── Packet Tracer practice ─────────────────────────────────────────────────
const PT_SUBNET_PROBLEMS = [
    { network: "192.168.1.0/24", requiredSubnets: 4, description: "You need to divide 192.168.1.0/24 into 4 equal subnets." },
    { network: "172.16.0.0/16", requiredSubnets: 256, description: "Divide 172.16.0.0/16 into 256 subnets for a large campus network." },
    { network: "10.0.0.0/8", requiredSubnets: 512, description: "Divide 10.0.0.0/8 into at least 512 subnets." },
    { network: "192.168.10.0/24", requiredSubnets: 2, description: "Split 192.168.10.0/24 into 2 subnets for two departments." },
    { network: "172.20.0.0/16", requiredSubnets: 64, description: "Divide 172.20.0.0/16 into 64 subnets for branch offices." },
    { network: "10.10.0.0/16", requiredSubnets: 16, description: "Divide 10.10.0.0/16 into 16 subnets for VLANs." },
    { network: "192.168.50.0/24", requiredSubnets: 8, description: "Divide 192.168.50.0/24 into 8 subnets for a small business." },
    { network: "172.30.0.0/16", requiredSubnets: 128, description: "Divide 172.30.0.0/16 into 128 subnets for a multi-floor building." },
];

const CLI_ENABLE = { prompt: "Router>", expect: "enable", response: "", nextPrompt: "Router#" };
const CLI_CONFT = { prompt: "Router#", expect: "configure terminal", response: "Enter configuration commands, one per line.  End with CNTL/Z.", nextPrompt: "Router(config)#" };
const PT_CLI_TASKS = [
    { title: "Enter privileged EXEC mode", hint: "Use the 'enable' command", steps: [CLI_ENABLE] },
    { title: "Enter global configuration mode", hint: "From privileged EXEC, use 'configure terminal'", steps: [CLI_ENABLE, CLI_CONFT] },
    { title: "Set the hostname to 'CoreRouter'", hint: "In global config mode, use 'hostname CoreRouter'", steps: [CLI_ENABLE, CLI_CONFT,
        { prompt: "Router(config)#", expect: "hostname CoreRouter", response: "", nextPrompt: "CoreRouter(config)#" }] },
    { title: "Configure interface GigabitEthernet0/0 with IP 192.168.1.1/24 and bring it up", hint: "Enter interface config, assign IP, then 'no shutdown'", steps: [CLI_ENABLE, CLI_CONFT,
        { prompt: "Router(config)#", expect: "interface gigabitethernet0/0", response: "", nextPrompt: "Router(config-if)#" },
        { prompt: "Router(config-if)#", expect: "ip address 192.168.1.1 255.255.255.0", response: "", nextPrompt: "Router(config-if)#" },
        { prompt: "Router(config-if)#", expect: "no shutdown", response: "%LINK-5-CHANGED: Interface GigabitEthernet0/0, changed state to up", nextPrompt: "Router(config-if)#" }] },
    { title: "Set the enable secret password to 'class'", hint: "In global config, use 'enable secret class'", steps: [CLI_ENABLE, CLI_CONFT,
        { prompt: "Router(config)#", expect: "enable secret class", response: "", nextPrompt: "Router(config)#" }] },
    { title: "Configure console line with password 'cisco' and enable login", hint: "Use 'line console 0', then 'password cisco', then 'login'", steps: [CLI_ENABLE, CLI_CONFT,
        { prompt: "Router(config)#", expect: "line console 0", response: "", nextPrompt: "Router(config-line)#" },
        { prompt: "Router(config-line)#", expect: "password cisco", response: "", nextPrompt: "Router(config-line)#" },
        { prompt: "Router(config-line)#", expect: "login", response: "", nextPrompt: "Router(config-line)#" }] },
];

// ─── Packet Tracer labs ─────────────────────────────────────────────────────
// Live for everyone since 2026-11-10 (they were behind ?ptpreview=1 before; that switch is now unused).
// Their files (ptlab.js/css) load on demand when a lab or the Packet Tracer page opens.
const PT_PREVIEW_KEY = "answrit:ptPreview";
(function ptPreviewSwitch() {
    const v = new URLSearchParams(location.search).get("ptpreview");
    try {
        if (v === "1") localStorage.setItem(PT_PREVIEW_KEY, "1");
        if (v === "0") localStorage.removeItem(PT_PREVIEW_KEY);
    } catch (e) { /* storage blocked */ }
    if (v !== null) history.replaceState(null, "", location.pathname + location.hash);
})();
function ptPreviewOn() { try { return localStorage.getItem(PT_PREVIEW_KEY) === "1"; } catch (e) { return false; } }
let ptLabLoading = null;
function loadPtLab() {
    if (window.AnswritPtLab) return Promise.resolve(true);
    if (!ptLabLoading) {
        ptLabLoading = new Promise((resolve) => {
            const css = document.createElement("link");
            css.rel = "stylesheet"; css.href = "/beta/ptlab.css?v=15";
            document.head.appendChild(css);
            const js = document.createElement("script");
            js.src = "/beta/ptlab.js?v=15";
            js.onload = () => resolve(true);
            js.onerror = () => { ptLabLoading = null; resolve(false); };
            document.head.appendChild(js);
        });
    }
    return ptLabLoading;
}

async function viewPacketTracer(root, _p, _q, alive) {
    const preview = true; // the labs are live for everyone
    root.innerHTML = loading();
    await loadPtLab();
    if (alive && !alive()) return;
    root.innerHTML = `
        <a class="back-link" href="#/study">${icon("back")}Study</a>
        <div class="page-head">
            <span class="eyebrow">CCNA 1 &amp; CCNA 2</span>
            <h1 class="page-title">Packet Tracer practice</h1>
            <p>${preview ? "Skills labs that look and grade like the real Packet Tracer, plus subnetting and a CLI simulator." : "Practice the subnetting and CLI commands you need for the PT final."}</p>
        </div>
        <div class="row-list">
            ${((preview && window.AnswritPtLab && window.AnswritPtLab.list) || []).map((l) => `
            <a class="row" href="#/packet-tracer/lab/${esc(l.id)}">
                <span class="icon-tile tint-orange">${icon("network")}</span>
                <span class="row-body"><span class="row-title">${esc(l.title)} <span class="badge-new">${esc(l.course || "Lab")}</span></span><span class="row-sub">${esc(l.sub)}. A full practice lab with a CLI on every device.</span></span>
                ${icon("chevron", "row-chevron")}
            </a>`).join("")}
            <a class="row" href="#/packet-tracer/commands">
                <span class="icon-tile tint-blue">${icon("cards")}</span>
                <span class="row-body"><span class="row-title">Packet Tracer 1: Command drill</span><span class="row-sub">Practice every command on your phone. Type it or pick it.</span></span>
                ${icon("chevron", "row-chevron")}
            </a>
            <a class="row" href="#/packet-tracer/subnet">
                <span class="icon-tile tint-blue">${icon("network")}</span>
                <span class="row-body"><span class="row-title">Subnetting practice</span><span class="row-sub">Work out the mask, hosts and subnets for a network</span></span>
                ${icon("chevron", "row-chevron")}
            </a>
            <a class="row" href="#/packet-tracer/cli">
                <span class="icon-tile tint-green">${icon("terminal")}</span>
                <span class="row-body"><span class="row-title">CLI simulator</span><span class="row-sub">Type router and switch commands in a practice terminal</span></span>
                ${icon("chevron", "row-chevron")}
            </a>
        </div>`;
}

async function viewPtLab(root, [id], _q, alive) {
    root.innerHTML = loading();
    if (!(await loadPtLab())) { root.innerHTML = `<div class="error-box">Couldn't load the lab. Check your connection.</div>`; return; }
    if (alive && !alive()) return;
    const lab = window.AnswritPtLab && (window.AnswritPtLab.get ? window.AnswritPtLab.get(id) : window.AnswritPtLab.list.find((l) => l.id === id));
    if (!lab) return go("packet-tracer");
    document.body.classList.add("focus-mode", "lab-mode");
    root.innerHTML = "";
    const cleanup = window.AnswritPtLab.mount(root, id, { alive });
    state.cleanup = () => {
        document.body.classList.remove("lab-mode");
        if (typeof cleanup === "function") cleanup();
    };
}

// ─── Packet Tracer 1: command drill ─────────────────────────────────────────
// Phone-friendly practice for every command in Packet Tracer 1, in the same order as the lab's
// Tasks box. Each round makes up new names and numbers. Type the command (the short forms that
// work in Packet Tracer count) or pick it from 4.
const PTC_MODE_KEY = "answrit:ptcMode";
// Short forms shown after each answer. vlan, username, password, secret and range stay full on purpose.
const PTC_SHORT = {
    enable: "en", configure: "conf", terminal: "t", hostname: "host", console: "con", service: "serv",
    "password-encryption": "pass", banner: "ban", shutdown: "shut", interface: "int", encapsulation: "enc",
    dot1q: "dot", native: "nat", address: "add", switchport: "sw", mode: "mo", trunk: "tr", access: "acc",
    "domain-name": "domain-n", crypto: "cry", generate: "gen", local: "loc", transport: "trans", input: "in",
    "default-gateway": "default-g", version: "ver", "running-config": "run", "startup-config": "start", write: "wr",
};
// Fewest letters Packet Tracer accepts for each word (shorter ones are ambiguous there).
const PTC_MIN = {
    enable: 2, configure: 4, terminal: 1, hostname: 4, secret: 3, line: 4, console: 3, password: 4, login: 5,
    vty: 3, service: 4, "password-encryption": 4, banner: 3, motd: 4, no: 2, shutdown: 4, interface: 3,
    encapsulation: 3, dot1q: 3, native: 3, ip: 2, address: 3, vlan: 2, name: 2, switchport: 2, mode: 2,
    trunk: 2, access: 2, range: 3, ipv6: 4, "link-local": 4, "domain-name": 8, username: 5, crypto: 3, key: 3,
    generate: 3, rsa: 3, "general-keys": 3, modulus: 3, ssh: 3, version: 3, local: 3, transport: 4, input: 2,
    "default-gateway": 9, copy: 4, "running-config": 3, "startup-config": 3, write: 2, memory: 3,
};
const PTC_SHOW = { dot1q: "dot1Q" };

function ptcValues() {
    const rnd = (n) => Math.floor(Math.random() * n);
    const pick = (a) => a[rnd(a.length)];
    const two = (a) => { const b = shuffle(a.slice()); return [b[0], b[1]]; };
    const [sc, sw1] = two(["HAWK", "EAGLE", "OSPREY", "COMET", "PULSAR", "VEGA", "CEDAR", "MAPLE"]);
    const [nameA, nameB] = pick([["ENGINEERING", "ACCOUNTING"], ["SALES", "HR"], ["FACULTY", "STUDENTS"], ["PLANNING", "SUPPORT"], ["RED", "BLUE"], ["LAB", "OFFICE"]]);
    const pre = Math.random() < 0.5 ? `172.${16 + rnd(16)}.${rnd(256)}` : `192.168.${pick([1, 2, 5, 20, 33, 50, 77, 100, 150, 200])}`;
    const k = rnd(5), a0 = k * 32;
    const ip = (n) => `${pre}.${n}`;
    const lk = `10.${1 + rnd(254)}.${rnd(256)}`, l0 = 4 * rnd(63);
    const hex = () => rnd(4096).toString(16).toUpperCase();
    const v6 = `2001:DB8:${hex()}:${pick("123456789ABCDEF".split(""))}::`;
    const [t1, t2] = pick([[9, 10], [11, 12], [21, 22], [23, 24]]);
    const rsw = pick(["g0/0/1", "g0/0/0"]);
    return {
        R: pick(["FALCON", "NOVA", "ORION", "TITAN", "ZEUS", "DENALI", "ATLAS"]), SC: sc, SW: sw1,
        A: pick([10, 20, 30, 40, 60, 70]), B: pick([80, 90, 110, 120, 200, 300]), N: pick([99, 100, 250, 333, 777, 999]),
        nameA, nameB,
        netA: ip(a0), netB: ip(a0 + 32), netN: ip(a0 + 64),
        rA: ip(a0 + 30), rB: ip(a0 + 62), rN: ip(a0 + 70), sw2: ip(a0 + 66), bcB: ip(a0 + 63), nB: ip(a0 + 32),
        link: `${lk}.${l0}`, rL: `${lk}.${l0 + 2}`, srv: `${lk}.${l0 + 1}`,
        v6, end: pick(["5", "7", "9", "A", "B", "C", "E"]), ll: pick(["FE80::1", "FE80::A", "FE80::B", "FE80::2"]),
        rsw, t1, t2, acc: pick([1, 3, 5, 19]),
        banner: pick(["Authorized Users Only!", "Authorized Access Only!", "Staff Only!", "No Trespassing!"]),
        domain: pick(["skills.lab", "netlab.com", "ccna.net", "branch.net"]),
        user: pick(["operator", "netadmin", "itadmin", "sshuser"]), secret: pick(["Shell22", "Secure1", "Remote1", "Key2Go"]),
    };
}

function ptcQuestions(v) {
    const L = [];
    const add = (task, where, prompt, q, answers, why, extra = {}) => L.push({ task, where, prompt, q, answers, why, ...extra });
    const R = v.R, S = v.SC;
    const M27 = "255.255.255.224", M29 = "255.255.255.248", M30 = "255.255.255.252";
    // Task 1
    add(1, "Router", "Router>", "Go from user mode to privileged (admin) mode.", [["enable"]], "The prompt changes from > to #.");
    add(1, "Router", "Router#", "Go into global configuration mode.", [["configure", "terminal"]], "Now you can change settings: the prompt shows (config).");
    add(1, "Router", "Router(config)#", `Name the router ${R}.`, [["hostname", { v: R }]], "Use the name under the router on the map, not the model (ISR4331).");
    // Task 2
    add(2, "Router", `${R}(config)#`, "Set the enable secret to class.", [["enable", "secret", { v: "class" }]], "Type enable (or ena) here: en is refused because it could also mean end.", { min: { enable: 3 }, short: "enable secret class" });
    add(2, "Router", `${R}(config)#`, "Go to the console line (logging in with a cable).", [["line", "console", { v: "0" }]], "The console line is always 0.");
    add(2, "Router", `${R}(config-line)#`, "Set this line's password to cisco.", [["password", { v: "cisco" }]], "Lines get cisco, enable gets class (\"cisco class\").");
    add(2, "Router", `${R}(config-line)#`, "Make this line ask for its password.", [["login"]], "Without login, the password does nothing.");
    add(2, "Router", `${R}(config)#`, "Go to the router's first 5 remote-login (VTY) lines.", [["line", "vty", { v: "0" }, { v: "4" }]], "On the router, vty 0 4 is what the lab grades.");
    add(2, "Router", `${R}(config)#`, "Scramble every plain password in the settings.", [["service", "password-encryption"]], "So nobody can read the line passwords in the config.");
    // Task 3
    add(3, "Router", `${R}(config)#`, `Set the login banner to: ${v.banner}`, [[{ banner: v.banner }]], "The # marks where the message starts and ends. Copy the text exactly.", { full: `banner motd #${v.banner}#`, short: `ban motd #${v.banner}#` });
    // Task 4: router
    add(4, "Router", `${R}(config)#`, `Go to the router's port ${v.rsw}, the cable to the switch.`, [["interface", { iface: v.rsw }]], "Read it off the router's end of the cable on the map.");
    add(4, "Router", `${R}(config-if)#`, "Turn this port on.", [["no", "shutdown"]], "Router ports start off. This also turns on its virtual ports.");
    add(4, "Router", `${R}(config)#`, `Create the router's virtual port for VLAN ${v.A} on ${v.rsw}.`, [["interface", { iface: `${v.rsw}.${v.A}` }]], "Add a dot and the VLAN number. It's not on the map: typing it creates it.");
    add(4, "Router", `${R}(config-subif)#`, `Tell this virtual port it handles VLAN ${v.A}.`, [["encapsulation", "dot1q", { v: String(v.A) }]], "Do this before ip address, or the router refuses the address.");
    add(4, "Router", `${R}(config-subif)#`, `VLAN ${v.A} is ${v.netA}/27. Give this virtual port the router's address and mask.`, [["ip", "address", { v: v.rA }, { v: M27 }]], "The router takes the last usable address. It's the gateway for that VLAN's PCs.");
    add(4, "Router", `${R}(config-subif)#`, `Tell this virtual port it handles the native VLAN ${v.N}.`, [["encapsulation", "dot1q", { v: String(v.N) }, "native"]], "Only the native VLAN gets the word native.");
    // Task 4: switches
    add(4, "Switch", `${S}(config)#`, `Create VLAN ${v.A}.`, [["vlan", { v: String(v.A) }]], "Create all 3 VLANs on every switch.");
    add(4, "Switch", `${S}(config-vlan)#`, `Name this VLAN ${v.nameA}.`, [["name", { v: v.nameA }]], "Spell it exactly like the map, capitals too.");
    add(4, "Switch", `${S}(config)#`, `Select ports Fa0/${v.t1} and Fa0/${v.t2} at the same time.`, [["interface", "range", { range: [`f0/${v.t1}`, `f0/${v.t2}`] }]], "range lets you set several ports at once. f0/9-10 and f0/9, f0/10 both work.", { show: `f0/${v.t1} , f0/${v.t2}` });
    add(4, "Switch", `${S}(config-if-range)#`, "Make these ports trunks.", [["switchport", "mode", "trunk"]], "A trunk carries every VLAN over one cable. The dashed lines on the map are trunks.");
    add(4, "Switch", `${S}(config-if-range)#`, `Set the native VLAN on these trunks to ${v.N}.`, [["switchport", "trunk", "native", "vlan", { v: String(v.N) }]], "Same native VLAN on every trunk and on the router.");
    add(4, "Switch", `${v.SW}(config)#`, `Go to port Fa0/${v.acc}, the cable to a PC.`, [["interface", { iface: `f0/${v.acc}` }]], "Read it off the switch's end of the cable.");
    add(4, "Switch", `${v.SW}(config-if)#`, "Make this port an access port (for one PC).", [["switchport", "mode", "access"]], "An access port belongs to one VLAN.");
    add(4, "Switch", `${v.SW}(config-if)#`, `Put this port in VLAN ${v.B}.`, [["switchport", "access", "vlan", { v: String(v.B) }]], "Use the VLAN written next to the PC on the map.");
    // Task 5
    add(5, "Switch", `${S}(config)#`, `Go to the switch's management interface (VLAN ${v.N}).`, [["interface", "vlan", { v: String(v.N) }]], "This gives the switch its own address (SVI). It's in the native/management VLAN.");
    add(5, "Switch", `${S}(config-if)#`, `VLAN ${v.N} is ${v.netN}/29 and this switch is labeled 2ND. Give it its address and mask.`, [["ip", "address", { v: v.sw2 }, { v: M29 }]], "1ST = network + 1, 2ND = + 2, 3RD = + 3.");
    add(5, "Router", `${R}(config-if)#`, `The server link is ${v.link}/30. Give the router its IPv4 address and mask.`, [["ip", "address", { v: v.rL }, { v: M30 }]], "Router = last usable. The server gets the first one.");
    add(5, "Router", `${R}(config-if)#`, `The IPv6 network is ${v.v6}/64 and the ending next to the router is ::${v.end}. Give the router its IPv6 address.`, [["ipv6", "address", { v6: `${v.v6}${v.end}`, len: "64" }]], "Swap the network's final :: for the ending, then add /64.", { show: `${v.v6}${v.end}/64` });
    add(5, "Router", `${R}(config-if)#`, `Set this port's link-local address to ${v.ll}.`, [["ipv6", "address", { v6: v.ll }, "link-local"]], "The FE80 address is in the small box next to the router.", { show: v.ll });
    // Task 6
    add(6, "SSH switch", `${S}(config)#`, `Set the domain name to ${v.domain}.`, [["ip", "domain-name", { v: v.domain }]], "Do this first: the keys are refused without a domain name.");
    add(6, "SSH switch", `${S}(config)#`, `Create user ${v.user} with secret ${v.secret}.`, [["username", { v: v.user }, "secret", { v: v.secret }]], "Passwords are case-sensitive.");
    add(6, "SSH switch", `${S}(config)#`, "Make 1024-bit RSA keys for SSH.", [["crypto", "key", "generate", "rsa", "general-keys", "modulus", { v: "1024" }], ["crypto", "key", "generate", "rsa"]], "The short way asks \"How many bits in the modulus\": type 1024. Pressing Enter gives 512 and loses the point.");
    add(6, "SSH switch", `${S}(config)#`, "Turn on SSH version 2.", [["ip", "ssh", "version", { v: "2" }]], "Version 2 is the secure one.");
    add(6, "SSH switch", `${S}(config)#`, "Go to all 16 remote-login (VTY) lines.", [["line", "vty", { v: "0" }, { v: "15" }]], "\"Every VTY line\" means 0 15, not 0 4.");
    add(6, "SSH switch", `${S}(config-line)#`, "Make these lines log in with the username you created.", [["login", "local"]], "local = use the switch's own username list.");
    add(6, "SSH switch", `${S}(config-line)#`, "Allow SSH only on these lines (no Telnet).", [["transport", "input", "ssh"]], "Telnet sends passwords in plain text.");
    // Task 7
    add(7, "Switch", `${v.SW}(config)#`, `Set the switch's default gateway to ${v.rN}.`, [["ip", "default-gateway", { v: v.rN }]], "It's the router's address in the native VLAN.");
    add(7, "Any device", `${v.SW}#`, "Save your work.", [["copy", "running-config", "startup-config"], ["write"], ["write", "memory"]], "Press Enter if it asks for a file name.", { full: "copy running-config startup-config", short: "wr" });
    // Notebook math (no command, just the answer)
    add(0, "Notebook", "", `VLAN ${v.B} is ${v.nB}/27. What's the router's address?`, [[{ v: v.rB }]], "Last usable = next block's start − 2. Magic number for /27 is 32.", { distract: [v.bcB, ip1(v.nB), ip1(v.rB)] });
    add(0, "Notebook", "", "What's the mask for /27?", [[{ v: M27 }]], "Magic number 32. Mask = 256 − 32 = 224.", { distract: [M29, M30, "255.255.255.192"] });
    add(0, "Notebook", "", "What's the mask for /29?", [[{ v: M29 }]], "Magic number 8. Mask = 256 − 8 = 248.", { distract: [M27, M30, "255.255.255.240"] });
    add(8, "Notebook", "", `The server link is ${v.link}/30. What goes in each PC's DNS Server box?`, [[{ v: v.srv }]], "The server takes the first usable address on the link; the router takes the last.", { distract: [v.rL, v.link, v.rN] });
    return L;
}
function ip1(addr) { const p = addr.split("."); p[3] = String(Math.max(0, +p[3] - 1)); return p.join("."); }

function ptcIface(s) {
    const m = /^([a-z]+)([0-9][0-9/.]*)$/.exec(String(s).toLowerCase());
    if (!m) return null;
    if ("fastethernet".startsWith(m[1])) return "f" + m[2];
    if ("gigabitethernet".startsWith(m[1])) return "g" + m[2];
    return null;
}
function ptcV6(s) {
    s = String(s).toLowerCase();
    if (!/^[0-9a-f:]+$/.test(s) || (s.match(/::/g) || []).length > 1) return null;
    const [h, t] = s.split("::");
    const head = h ? h.split(":") : [], tail = t === undefined ? null : t ? t.split(":") : [];
    const groups = tail === null ? head : [...head, ...Array(Math.max(0, 8 - head.length - tail.length)).fill("0"), ...tail];
    if (groups.length !== 8 || groups.some((g) => !g || g.length > 4)) return null;
    return groups.map((g) => parseInt(g, 16).toString(16)).join(":");
}
function ptcRange(rest) {
    const out = [];
    let type = "";
    for (const part of rest.toLowerCase().replace(/\s+/g, "").split(",")) {
        const m = /^([a-z]*)((?:\d+\/)+)(\d+)(?:-(?:[a-z]*(?:\d+\/)+)?(\d+))?$/.exec(part);
        if (!m) return null;
        if (m[1]) type = m[1];
        const t = ptcIface(type + m[2] + m[3]);
        if (!t) return null;
        const base = t.slice(0, t.lastIndexOf("/") + 1);
        const a = +m[3], b = m[4] ? +m[4] : a;
        if (b < a || b - a > 24) return null;
        for (let n = a; n <= b; n++) out.push(base + n);
    }
    return [...new Set(out)].sort();
}
function ptcMatch(typed, toks, min = {}) {
    const t = String(typed).trim().replace(/\s+/g, " ");
    if (!t) return false;
    const kw = (w, k) => { w = w.toLowerCase(); return k.startsWith(w) && w.length >= Math.min(min[k] || PTC_MIN[k] || k.length, k.length); };
    if (toks[0] && toks[0].banner !== undefined) {
        const m = /^(\S+) (\S+) (\S)(.*)\3$/.exec(t);
        return !!m && kw(m[1], "banner") && kw(m[2], "motd") && m[4] === toks[0].banner;
    }
    const words = [];
    t.split(" ").forEach((w) => {
        const prev = words[words.length - 1];
        if (prev && /^\d/.test(w) && /^[a-z]+$/i.test(prev) && ptcIface(prev + w)) words[words.length - 1] = prev + w;
        else words.push(w);
    });
    let i = 0;
    for (const x of toks) {
        if (x && x.range) { const got = ptcRange(words.slice(i).join(" ")); return !!got && got.join() === x.range.slice().sort().join(); }
        const w = words[i++];
        if (w === undefined) return false;
        if (typeof x === "string") { if (!kw(w, x)) return false; }
        else if (x.iface) { if (ptcIface(w) !== x.iface) return false; }
        else if (x.v6) { const [a, len] = w.split("/"); if (len !== x.len || !ptcV6(a) || ptcV6(a) !== ptcV6(x.v6)) return false; }
        else if (w !== x.v) return false;
    }
    return i === words.length;
}
function ptcText(q, short) {
    if (short && q.short) return q.short;
    if (!short && q.full) return q.full;
    return q.answers[0].map((x) => {
        if (typeof x === "string") return short ? PTC_SHORT[x] || x : PTC_SHOW[x] || x;
        if (x.range) return q.show;
        if (x.iface) return x.iface;
        if (x.v6) return q.show;
        return x.v;
    }).join(" ");
}

async function viewPtCmd(root, _p, _q, alive) {
    let mode = "type";
    try { mode = localStorage.getItem(PTC_MODE_KEY) || "type"; } catch (e) { /* storage blocked */ }
    const TASKS = { 0: "Notebook", 1: "Task 1", 2: "Task 2", 3: "Task 3", 4: "Task 4", 5: "Task 5", 6: "Task 6", 7: "Task 7", 8: "Task 8" };

    function start() {
        document.body.classList.remove("focus-mode");
        const total = ptcQuestions(ptcValues()).length;
        root.innerHTML = `
            <a class="back-link" href="#/course/ccna2">${icon("back")}CCNA 2</a>
            <div class="page-head">
                <span class="eyebrow">Packet Tracer 1</span>
                <h1 class="page-title">Command drill</h1>
                <p>Every command from Packet Tracer 1, in the order of the Tasks box. New names and numbers each round.</p>
            </div>
            <div class="segmented" role="group" aria-label="How to answer">
                <button type="button" data-mode="type" aria-pressed="${mode === "type"}">Type it</button>
                <button type="button" data-mode="pick" aria-pressed="${mode === "pick"}">Pick it</button>
            </div>
            <div class="btn-row">
                <button type="button" class="btn btn-primary btn-block" id="ptc-quick">Quick round (15)</button>
                <button type="button" class="btn btn-secondary btn-block" id="ptc-all">Full walkthrough (${total}, in task order)</button>
            </div>
            <div class="note"><strong>Type it</strong> works best for memorizing. Short forms that work in Packet Tracer count (like <code>int</code> or <code>sw mo tr</code>), and you see the short form after each answer.</div>`;
        $$("[data-mode]", root).forEach((b) => {
            b.onclick = () => {
                mode = b.dataset.mode;
                try { localStorage.setItem(PTC_MODE_KEY, mode); } catch (e) { /* storage blocked */ }
                start();
            };
        });
        $("#ptc-quick", root).onclick = () => run(shuffle(ptcQuestions(ptcValues())).slice(0, 15));
        $("#ptc-all", root).onclick = () => run(ptcQuestions(ptcValues()));
    }

    function run(list) {
        document.body.classList.add("focus-mode");
        const s = { i: 0, checked: false, ok: false, typed: "", picked: null, right: 0, missed: [] };
        const others = list.map((q) => ptcText(q, false));

        function optionsFor(q) {
            if (q.opts) return q.opts;
            const right = ptcText(q, false);
            let pool = q.distract ? q.distract.slice() : shuffle(list.filter((o) => o !== q && o.where === q.where && !o.distract).map((o) => ptcText(o, false)));
            if (pool.length < 3) pool = pool.concat(shuffle(others));
            const opts = [right];
            for (const o of pool) { if (opts.length >= 4) break; if (!opts.includes(o)) opts.push(o); }
            q.opts = shuffle(opts);
            return q.opts;
        }
        function check() {
            const q = list[s.i];
            if (mode === "pick") s.ok = s.picked === ptcText(q, false);
            else s.ok = q.answers.some((a) => ptcMatch(s.typed, a, q.min));
            s.checked = true;
            if (s.ok) s.right++; else s.missed.push(q);
            render();
        }
        function render() {
            if (alive && !alive()) return;
            const q = list[s.i];
            const done = Math.round((s.i / list.length) * 100);
            const full = ptcText(q, false), short = ptcText(q, true);
            let body;
            if (mode === "pick") {
                body = `<div class="options" role="group" aria-label="Answer choices">${optionsFor(q).map((o, n) => {
                    let cls = "";
                    if (s.checked) { if (o === full) cls = "is-correct"; else if (o === s.picked) cls = "is-wrong"; }
                    return `<button type="button" class="option ${cls}" data-o="${n}" aria-pressed="${o === s.picked}" ${s.checked ? "disabled" : ""}>
                        <span class="mark">${icon(s.checked && o === s.picked && o !== full ? "close" : "check")}</span>
                        <span class="option-text ptc-code">${esc(o)}</span></button>`;
                }).join("")}</div>`;
            } else {
                body = `<form class="ptc-term" id="ptc-form" autocomplete="off">
                    ${q.prompt ? `<span class="ptc-prompt">${esc(q.prompt)}</span>` : ""}
                    <input class="ptc-input" id="ptc-in" type="text" value="${esc(s.typed)}" ${s.checked ? "readonly" : ""}
                        autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="go"
                        aria-label="${q.prompt ? "Type the command" : "Type the answer"}" placeholder="${q.prompt ? "type the command" : "type the answer"}">
                </form>`;
            }
            let feedback = "";
            if (s.checked) {
                feedback = `<div class="feedback ${s.ok ? "good" : "bad"}" role="status">
                    <strong>${s.ok ? "Correct!" : "Not quite."}</strong>
                    <span>${q.prompt ? "Command" : "Answer"}: <code class="ptc-ans">${esc(full)}</code></span>
                    ${short !== full ? `<span>Short form: <code class="ptc-ans">${esc(short)}</code></span>` : ""}
                    <span>${esc(q.why)}</span>
                    ${!s.ok && mode === "type" && s.typed.trim() ? `<button type="button" class="ptc-mine" id="ptc-mine">I typed it right, count it</button>` : ""}
                </div>`;
            }
            const last = s.i === list.length - 1;
            const action = s.checked
                ? `<button type="button" class="btn btn-primary btn-block" id="ptc-next">${last ? "See results" : "Next"}</button>`
                : `<div class="btn-row"><button type="button" class="btn btn-primary btn-block" id="ptc-check" ${mode === "pick" && s.picked === null ? "disabled" : ""}>Check</button>
                   <button type="button" class="btn btn-ghost btn-block" id="ptc-show">I don't know, show me</button></div>`;
            root.innerHTML = `
                <div class="runner-head">
                    <button type="button" class="icon-btn" id="ptc-quit" aria-label="Leave the command drill">${icon("close")}</button>
                    <div class="bar" role="progressbar" aria-valuenow="${done}" aria-valuemin="0" aria-valuemax="100" aria-label="Progress"><span style="width:${done}%"></span></div>
                    <span class="runner-count">${s.i + 1} / ${list.length}</span>
                </div>
                <span class="eyebrow">${esc(TASKS[q.task])} · ${esc(q.where)}</span>
                <h1 class="question-text">${esc(q.q)}</h1>
                ${body}
                ${feedback}
                <div class="runner-actions">${action}</div>`;
            $("#ptc-quit", root).onclick = () => { if (s.i === 0 || confirm("Leave this round?")) start(); };
            const inp = $("#ptc-in", root);
            if (inp) {
                inp.oninput = () => { s.typed = inp.value; };
                if (!s.checked) inp.focus({ preventScroll: true });
                $("#ptc-form", root).onsubmit = (e) => { e.preventDefault(); if (!s.checked) { s.typed = inp.value; check(); } else next(); };
            }
            $$("[data-o]", root).forEach((b) => { b.onclick = () => { s.picked = optionsFor(q)[+b.dataset.o]; render(); }; });
            const ck = $("#ptc-check", root);
            if (ck) ck.onclick = () => { if (inp) s.typed = inp.value; check(); };
            const sh = $("#ptc-show", root);
            if (sh) sh.onclick = () => { if (inp) s.typed = inp.value; s.picked = s.picked ?? "\u0000"; s.checked = true; s.ok = false; s.missed.push(q); render(); };
            const mine = $("#ptc-mine", root);
            if (mine) mine.onclick = () => { s.ok = true; s.right++; s.missed = s.missed.filter((m) => m !== q); render(); };
            const nx = $("#ptc-next", root);
            if (nx) { nx.onclick = next; nx.focus({ preventScroll: true }); }
        }
        function next() {
            if (s.i === list.length - 1) return results();
            s.i++; s.checked = false; s.ok = false; s.typed = ""; s.picked = null;
            render();
            window.scrollTo(0, 0);
        }
        function results() {
            const score = Math.round((s.right / list.length) * 100);
            root.innerHTML = `
                <div class="card result-hero">
                    <span class="eyebrow">Packet Tracer 1 · Command drill</span>
                    <div class="result-score">${score}%</div>
                    <p>${s.right} of ${list.length} right</p>
                </div>
                ${s.missed.length ? `
                <div class="section-head"><h2 class="section-title">Review ${s.missed.length} missed</h2></div>
                <div class="row-list">${s.missed.map((m) => `
                    <div class="card review-item"><span class="q">${esc(m.q)}</span><code class="ptc-ans">${esc(ptcText(m, false))}</code>${ptcText(m, true) !== ptcText(m, false) ? `<span class="row-sub">Short: <code class="ptc-ans">${esc(ptcText(m, true))}</code></span>` : ""}</div>`).join("")}
                </div>` : `<div class="note">Perfect round. Try the full walkthrough, or switch to Type it if you picked.</div>`}
                <div class="btn-row">
                    ${s.missed.length ? `<button type="button" class="btn btn-primary btn-block" id="ptc-again-missed">Practice the ${s.missed.length} I missed</button>` : ""}
                    <button type="button" class="btn ${s.missed.length ? "btn-secondary" : "btn-primary"} btn-block" id="ptc-new">New round</button>
                    <a class="btn btn-ghost btn-block" href="#/course/ccna2">Done</a>
                </div>`;
            document.body.classList.remove("focus-mode");
            window.scrollTo(0, 0);
            const again = $("#ptc-again-missed", root);
            if (again) again.onclick = () => run(s.missed.map((m) => ({ ...m, opts: null })));
            $("#ptc-new", root).onclick = start;
        }
        render();
    }
    start();
}

function ptSubnetProblem() {
    const prob = PT_SUBNET_PROBLEMS[Math.floor(Math.random() * PT_SUBNET_PROBLEMS.length)];
    const prefix = parseInt(prob.network.split("/")[1], 10);
    const bits = Math.ceil(Math.log2(prob.requiredSubnets));
    const newPrefix = prefix + bits;
    const mask = [0, 1, 2, 3].map((i) => 256 - Math.pow(2, 8 - Math.min(8, Math.max(0, newPrefix - i * 8)))).join(".");
    return { ...prob, answer: { mask, usableHosts: Math.pow(2, 32 - newPrefix) - 2, subnets: Math.pow(2, bits), prefix: newPrefix } };
}

async function viewPtSubnet(root) {
    let prob = ptSubnetProblem();
    function render() {
        root.innerHTML = `
            <a class="back-link" href="#/packet-tracer">${icon("back")}Packet Tracer</a>
            <div class="page-head"><h1 class="page-title">Subnetting practice</h1><p>Work out the addressing for this network.</p></div>
            <div class="card">
                <p class="question-text" style="margin:0">${esc(prob.description)}</p>
                <form id="pt-form" class="pt-form" novalidate>
                    <div class="field"><label for="pt-mask">Subnet mask</label><input class="input" id="pt-mask" inputmode="decimal" autocomplete="off" placeholder="e.g. 255.255.255.192"></div>
                    <div class="field"><label for="pt-hosts">Usable hosts per subnet</label><input class="input" id="pt-hosts" inputmode="numeric" autocomplete="off" placeholder="e.g. 62"></div>
                    <div class="field"><label for="pt-subnets">Number of subnets</label><input class="input" id="pt-subnets" inputmode="numeric" autocomplete="off" placeholder="e.g. 4"></div>
                    <div class="btn-row">
                        <button class="btn btn-primary" type="submit">Check answer</button>
                        <button class="btn btn-secondary" type="button" id="pt-next">New problem</button>
                    </div>
                </form>
                <div id="pt-result" aria-live="polite"></div>
            </div>`;
        $("#pt-next", root).onclick = () => { prob = ptSubnetProblem(); render(); };
        $("#pt-form", root).onsubmit = (e) => {
            e.preventDefault();
            const a = prob.answer;
            const mine = { mask: $("#pt-mask", root).value.trim(), hosts: $("#pt-hosts", root).value.trim(), subnets: $("#pt-subnets", root).value.trim() };
            const rows = [
                ["Subnet mask", mine.mask, a.mask, mine.mask === a.mask],
                ["Usable hosts", mine.hosts, a.usableHosts, parseInt(mine.hosts, 10) === a.usableHosts],
                ["Subnets", mine.subnets, a.subnets, parseInt(mine.subnets, 10) === a.subnets],
            ];
            const allOk = rows.every((r) => r[3]);
            $("#pt-result", root).innerHTML = `
                <div class="feedback ${allOk ? "good" : "bad"}">${allOk ? "Correct! All values match." : "Not quite. Check the answers below."}</div>
                <table class="pt-table">
                    <thead><tr><th></th><th>You</th><th>Answer</th></tr></thead>
                    <tbody>${rows.map(([label, you, ans, ok]) => `
                        <tr class="${ok ? "ok" : "no"}"><th scope="row">${label}</th><td>${esc(you) || "—"}</td><td>${esc(ans)} ${ok ? "✓" : "✗"}</td></tr>`).join("")}
                    </tbody>
                </table>
                <p class="small muted" style="margin:0">New prefix /${a.prefix} · ${32 - a.prefix} host bits · 2^${32 - a.prefix} − 2 = ${a.usableHosts} hosts</p>`;
        };
    }
    render();
}

async function viewPtCli(root) {
    const s = { task: 0, step: 0, lines: [], done: false, msg: "" };
    function prompt() {
        const t = PT_CLI_TASKS[s.task];
        return s.step < t.steps.length ? t.steps[s.step].prompt : t.steps[t.steps.length - 1].nextPrompt;
    }
    function render() {
        const t = PT_CLI_TASKS[s.task];
        root.innerHTML = `
            <a class="back-link" href="#/packet-tracer">${icon("back")}Packet Tracer</a>
            <div class="page-head"><h1 class="page-title">CLI simulator</h1><p>Type Cisco IOS commands to finish the task.</p></div>
            <div class="card">
                <span class="eyebrow">Task ${s.task + 1} of ${PT_CLI_TASKS.length}</span>
                <p class="question-text" style="margin:0">${esc(t.title)}</p>
                <div class="terminal" id="term">
                    <div class="term-out">${s.lines.map(([cls, text]) => `<div class="${cls}">${esc(text)}</div>`).join("")}</div>
                    <form class="term-row" id="term-form">
                        <label for="term-in" class="term-prompt">${esc(prompt())}</label>
                        <input id="term-in" class="term-in" autocomplete="off" autocapitalize="off" autocorrect="off" spellcheck="false" enterkeyhint="send" ${s.done ? "disabled" : ""} aria-label="Command">
                    </form>
                </div>
                ${s.msg ? `<div class="feedback ${s.done ? "good" : ""}">${esc(s.msg)}</div>` : ""}
                <div class="btn-row">
                    <button type="button" class="btn btn-secondary" id="hint-btn">Hint</button>
                    <button type="button" class="btn btn-secondary" id="reset-btn">Start over</button>
                    ${s.done && s.task < PT_CLI_TASKS.length - 1 ? `<button type="button" class="btn btn-primary" id="next-btn">Next task</button>` : ""}
                </div>
            </div>`;
        const out = $(".term-out", root);
        out.scrollTop = out.scrollHeight;
        const input = $("#term-in", root);
        $("#term-form", root).onsubmit = (e) => {
            e.preventDefault();
            const cmd = input.value.trim();
            if (!cmd || s.done) return;
            const step = t.steps[s.step];
            s.lines.push(["term-line", `${step.prompt} ${cmd}`]);
            if (cmd.toLowerCase() === step.expect.toLowerCase()) {
                if (step.response) s.lines.push(["term-resp", step.response]);
                s.step += 1;
                if (s.step >= t.steps.length) { s.done = true; s.msg = "Task complete!"; }
            } else {
                s.lines.push(["term-err", "% Invalid input detected at '^' marker."]);
            }
            render();
            if (!s.done) $("#term-in", root).focus();
        };
        $("#hint-btn", root).onclick = () => { s.msg = "Hint: " + t.hint; render(); };
        $("#reset-btn", root).onclick = () => { Object.assign(s, { step: 0, lines: [], done: false, msg: "" }); render(); };
        const next = $("#next-btn", root);
        if (next) next.onclick = () => { Object.assign(s, { task: s.task + 1, step: 0, lines: [], done: false, msg: "" }); render(); $("#term-in", root).focus(); };
        $("#term", root).onclick = (e) => { if (!e.target.closest("button")) input.focus(); };
    }
    render();
}

// ─── My Flashcards ──────────────────────────────────────────────────────────
const MY_FC_LOCAL_KEY = "answrit_my_flashcards";

async function loadMyDecks() {
    if (state.myDecks) return state.myDecks;
    let decks = null;
    if (state.user) {
        const r = await api("/api/my-flashcards");
        if (r.ok) decks = r.data.decks || [];
    }
    let local = [];
    try { local = JSON.parse(localStorage.getItem(MY_FC_LOCAL_KEY) || "[]"); } catch (e) { local = []; }
    if (!Array.isArray(local)) local = [];
    // First time logged in with decks made on this device: copy them into the account.
    const upload = state.user && decks && !decks.length && local.length;
    if (!decks || upload) decks = local;
    state.myDecks = Array.isArray(decks) ? decks : [];
    if (upload) await saveMyDecks();
    return state.myDecks;
}

async function saveMyDecks() {
    try { localStorage.setItem(MY_FC_LOCAL_KEY, JSON.stringify(state.myDecks)); } catch (e) { /* storage unavailable */ }
    if (state.user) return api("/api/my-flashcards", { method: "POST", body: { decks: state.myDecks } });
    return { ok: true };
}

async function viewMyDecks(root, _p, _q, alive) {
    const decks = await loadMyDecks();
    if (!alive()) return;
    function render(error = "") {
        root.innerHTML = `
            <a class="back-link" href="#/study">${icon("back")}Study</a>
            <div class="page-head"><h1 class="page-title">My Flashcards</h1><p>Make your own decks for anything you want to remember.</p></div>
            ${!state.user ? `<div class="note">These decks are saved on this device only. <a href="#/login?next=my-flashcards">Log in</a> to keep them in your account.</div>` : ""}
            <form class="card" id="deck-form" novalidate>
                <div class="field"><label for="deck-name">New deck</label><input class="input" id="deck-name" maxlength="80" placeholder="e.g. Port numbers" autocomplete="off"></div>
                ${error ? `<div class="error-box" role="alert">${esc(error)}</div>` : ""}
                <button class="btn btn-primary btn-block" type="submit">${icon("plus")}Create deck</button>
            </form>
            <section class="section">
                <div class="section-head"><h2 class="section-title">Your decks (${decks.length})</h2></div>
                ${decks.length ? `<div class="row-list">${decks.map((d, i) => `
                    <a class="row" href="#/my-flashcards/${i}">
                        <span class="icon-tile tint-orange">${icon("cards")}</span>
                        <span class="row-body"><span class="row-title">${esc(d.name)}</span><span class="row-sub">${d.cards.length} card${d.cards.length === 1 ? "" : "s"}</span></span>
                        ${icon("chevron", "row-chevron")}
                    </a>`).join("")}</div>` : `<div class="card empty"><p class="muted" style="margin:0">No decks yet. Create one above.</p></div>`}
            </section>`;
        $("#deck-form", root).onsubmit = async (e) => {
            e.preventDefault();
            const name = $("#deck-name", root).value.trim();
            if (!name) return render("Enter a deck name.");
            if (decks.some((d) => d.name.toLowerCase() === name.toLowerCase())) return render("You already have a deck with that name.");
            decks.push({ name, cards: [] });
            await saveMyDecks();
            go(`my-flashcards/${decks.length - 1}`);
        };
    }
    render();
}

async function viewMyDeck(root, [idx], _q, alive) {
    const decks = await loadMyDecks();
    if (!alive()) return;
    const deck = decks[Number(idx)];
    if (!deck) return go("my-flashcards");
    function render(error = "") {
        root.innerHTML = `
            <a class="back-link" href="#/my-flashcards">${icon("back")}My Flashcards</a>
            <div class="page-head"><h1 class="page-title">${esc(deck.name)}</h1><p>${deck.cards.length} card${deck.cards.length === 1 ? "" : "s"}</p></div>
            ${deck.cards.length ? `<a class="btn btn-primary btn-block" href="#/my-flashcards/${idx}/study">Study this deck</a>` : ""}
            <form class="card" id="card-form" novalidate>
                <h2 class="section-title">Add a card</h2>
                <div class="field"><label for="fc-front">Front</label><textarea class="input" id="fc-front" rows="2" maxlength="500" placeholder="Question or term"></textarea></div>
                <div class="field"><label for="fc-back">Back</label><textarea class="input" id="fc-back" rows="2" maxlength="1000" placeholder="Answer or definition"></textarea></div>
                ${error ? `<div class="error-box" role="alert">${esc(error)}</div>` : ""}
                <button class="btn btn-secondary btn-block" type="submit">${icon("plus")}Add card</button>
            </form>
            ${deck.cards.length ? `<div class="row-list">${deck.cards.map((c) => `
                <div class="row">
                    <span class="row-body"><span class="row-title">${esc(c.front)}</span><span class="row-sub">${esc(c.back)}</span></span>
                    <button type="button" class="icon-btn" data-del="${esc(c.id)}" aria-label="Delete card">${icon("trash")}</button>
                </div>`).join("")}</div>` : ""}
            <button type="button" class="btn btn-ghost btn-block" id="del-deck" style="color:var(--red)">Delete this deck</button>`;
        $("#card-form", root).onsubmit = async (e) => {
            e.preventDefault();
            const front = $("#fc-front", root).value.trim();
            const back = $("#fc-back", root).value.trim();
            if (!front || !back) return render("Fill in both the front and the back.");
            deck.cards.push({ id: String(Date.now()), front, back });
            render();
            await saveMyDecks();
            $("#fc-front", root)?.focus();
        };
        $$("[data-del]", root).forEach((b) => {
            b.onclick = async () => {
                deck.cards = deck.cards.filter((c) => c.id !== b.dataset.del);
                render();
                await saveMyDecks();
            };
        });
        $("#del-deck", root).onclick = async () => {
            if (!confirm(`Delete "${deck.name}" and all its cards?`)) return;
            decks.splice(Number(idx), 1);
            await saveMyDecks();
            go("my-flashcards");
        };
    }
    render();
}

async function viewMyDeckStudy(root, [idx], _q, alive) {
    const decks = await loadMyDecks();
    if (!alive()) return;
    const deck = decks[Number(idx)];
    if (!deck || !deck.cards.length) return go(`my-flashcards/${idx}`);
    const s = { order: deck.cards.slice(), index: 0, flipped: false, shuffled: false };
    function render() {
        const c = s.order[s.index];
        root.innerHTML = `
            <a class="back-link" href="#/my-flashcards/${idx}">${icon("back")}${esc(deck.name)}</a>
            <div class="page-head"><h1 class="page-title">Study</h1><p>Card ${s.index + 1} of ${s.order.length}</p></div>
            <button type="button" class="flashcard ${s.flipped ? "back" : ""}" id="card">
                <span class="side">${s.flipped ? "Back" : "Front"}</span>
                <p class="face-text">${esc(s.flipped ? c.back : c.front)}</p>
                <span class="tap-hint">Tap the card to flip it</span>
            </button>
            <div class="fc-controls">
                <button type="button" class="btn btn-secondary" id="prev-btn" aria-label="Previous card" ${s.index === 0 ? "disabled" : ""}>${icon("prev")}</button>
                <button type="button" class="btn btn-primary" id="flip-btn">${s.flipped ? "Show front" : "Show back"}</button>
                <button type="button" class="btn btn-secondary" id="next-btn" aria-label="Next card" ${s.index >= s.order.length - 1 ? "disabled" : ""}>${icon("next")}</button>
            </div>
            <div class="chip-row"><button type="button" class="chip" id="shuffle-btn" aria-pressed="${s.shuffled}">Shuffle</button></div>`;
        const flip = () => { s.flipped = !s.flipped; render(); };
        $("#card", root).onclick = flip;
        $("#flip-btn", root).onclick = flip;
        $("#prev-btn", root).onclick = () => { s.index -= 1; s.flipped = false; render(); };
        $("#next-btn", root).onclick = () => { s.index += 1; s.flipped = false; render(); };
        $("#shuffle-btn", root).onclick = () => {
            s.shuffled = !s.shuffled;
            s.order = s.shuffled ? shuffle(deck.cards) : deck.cards.slice();
            s.index = 0; s.flipped = false; render();
        };
    }
    render();
}

// ─── Progress ───────────────────────────────────────────────────────────────
async function viewProgress(root, _p, _q, alive) {
    if (!state.user) return needLogin(root, "see your progress");
    const [h, ping, ...mast] = await Promise.all([
        api("/api/history"),
        api("/api/ping", { method: "POST" }),
        ...state.exams.map((e) => api(`/api/mastery?filename=${encodeURIComponent(e.filename)}`)),
    ]);
    if (!alive()) return;
    const attempts = h.ok ? (h.data.attempts || []) : [];
    const testsTaken = h.ok ? (h.data.tests_taken || attempts.length) : 0;
    const me = ping.ok ? (ping.data.online || []).find((u) => u.username === state.user) : null;
    const streak = me ? me.streak || 0 : 0;
    const avg = attempts.length ? pct(attempts.reduce((s, a) => s + Number(a.score || 0), 0) / attempts.length) : null;
    const byCourse = {};
    let masteredTotal = 0;
    mast.forEach((r, i) => {
        if (!r.ok) return;
        const course = courseOf(state.exams[i].filename);
        if (!course) return;
        const c = byCourse[course.id] || (byCourse[course.id] = { mastered: 0, total: 0 });
        c.mastered += r.data.summary.mastered;
        c.total += r.data.summary.total;
        masteredTotal += r.data.summary.mastered;
    });
    root.innerHTML = `
        <div class="page-head"><h1 class="page-title">Your progress</h1></div>
        <div class="streak">
            <span class="icon-tile tint-orange">${icon("flame")}</span>
            <span><strong>${streak}-day study streak</strong><span class="small">${streak ? "Come back tomorrow to keep it going" : "Study today to start a streak"}</span></span>
        </div>
        <div class="stat-grid">
            <div class="stat"><strong>${testsTaken}</strong><span>Tests taken</span></div>
            <div class="stat"><strong>${avg === null ? "–" : avg + "%"}</strong><span>Avg recent score</span></div>
            <div class="stat"><strong>${masteredTotal}</strong><span>Mastered</span></div>
        </div>
        <div class="card">
            <h2 class="section-title" style="font-size:16px">Mastery by course</h2>
            ${Object.entries(byCourse).map(([id, c]) => {
                const p = c.total ? pct((c.mastered / c.total) * 100) : 0;
                return `<div style="display:flex;flex-direction:column;gap:6px">
                    <div class="section-head" style="font-size:14px"><span style="font-weight:500">${esc(COURSES[id].name)}</span><strong>${p}%</strong></div>
                    <div class="bar"><span style="width:${p}%"></span></div>
                </div>`;
            }).join("")}
        </div>
        <section class="section">
            <h2 class="section-title" style="font-size:16px">Recent results</h2>
            ${attempts.length ? `<div class="row-list">${attempts.map((a) => `
                <a class="row" href="#/progress/attempt/${encodeURIComponent(a.id)}">
                    <span class="row-body"><span class="row-title">${esc(examMeta(a.filename) ? examFullName(a.filename) : a.title)}</span><span class="row-sub">Practice test · ${esc(relDate(a.completed_at))}</span></span>
                    <span class="score-pill ${scoreClass(Number(a.score))}">${pct(a.score)}%</span>
                </a>`).join("")}</div>`
                : `<div class="card empty"><p style="margin:0">No practice tests yet.</p><a class="btn btn-primary" href="#/study">Start studying</a></div>`}
        </section>`;
}

async function viewAttempt(root, [id], _q, alive) {
    if (!state.user) return needLogin(root, "see your progress");
    const h = await api("/api/history");
    if (!alive()) return;
    const a = h.ok ? (h.data.attempts || []).find((x) => x.id === id) : null;
    if (!a) return go("progress");
    const title = examMeta(a.filename) ? examFullName(a.filename) : a.title;
    root.innerHTML = `<a class="back-link" href="#/progress">${icon("back")}Progress</a>` +
        resultsHtml({ ...a, title, results: a.results || [] }, {
            backHref: "#/progress",
            retakeHref: examMeta(a.filename) ? `#/practice/${encodeURIComponent(a.filename)}?n=${a.total}` : "",
        });
}

// ─── Chat ───────────────────────────────────────────────────────────────────
function stopChatPolling() {
    if (state.chatTimer) { clearInterval(state.chatTimer); state.chatTimer = null; }
}

const ROOM_ICON = { announcements: ["megaphone", "orange"], lounge: ["bubble", "blue"], ite: ["monitor", "blue"], ccna1: ["network", "green"], ccna2: ["network", "blue"], comms: ["signal", "orange"] };
const COURSE_ROOM = { ite: "ite", ccna: "ccna1", ccna2: "ccna2", comms: "comms" };
const CHAT_SEEN_KEY = () => `answrit:chatSeen:${state.user || ""}`;

function chatSeen() {
    try { return JSON.parse(localStorage.getItem(CHAT_SEEN_KEY()) || "null"); } catch (e) { return null; }
}
function markRoomSeen(room, ts) {
    try {
        const seen = chatSeen() || {};
        if (!seen[room] || ts > seen[room]) seen[room] = ts;
        localStorage.setItem(CHAT_SEEN_KEY(), JSON.stringify(seen));
    } catch (e) { /* storage unavailable */ }
}
function unreadFor(room, seen) {
    const since = (seen || {})[room.id] || "";
    return (room.recent || []).filter((t) => t > since).length;
}
// First visit on this device: start everything as read, so old messages don't all show as new.
function ensureSeenStart(rooms) {
    if (chatSeen()) return;
    try {
        const seen = {};
        rooms.forEach((r) => { seen[r.id] = (r.recent || []).slice(-1)[0] || new Date().toISOString(); });
        localStorage.setItem(CHAT_SEEN_KEY(), JSON.stringify(seen));
    } catch (e) { /* storage unavailable */ }
}

async function refreshChatBadge() {
    const tab = $('.tabbar a[data-tab="chat"]');
    if (!tab) return;
    let total = 0;
    if (state.user) {
        const r = await api("/api/chat/rooms");
        if (r.ok) {
            ensureSeenStart(r.data.rooms);
            const seen = chatSeen();
            total = r.data.rooms.reduce((n, room) => n + unreadFor(room, seen), 0);
            state.chatRooms = r.data.rooms;
        }
        const d = await api("/api/dm/list");
        if (d.ok) {
            state.dmUnread = d.data.convos.reduce((n, c) => n + unreadFor({ id: "dm:" + c.id, recent: c.recent }, chatSeen()), 0);
            total += state.dmUnread;
        }
    }
    let badge = $(".tab-badge", tab);
    if (!total) { if (badge) badge.remove(); return; }
    if (!badge) { badge = document.createElement("span"); badge.className = "tab-badge"; tab.appendChild(badge); }
    badge.textContent = total > 99 ? "99+" : String(total);
    tab.setAttribute("aria-label", `Chat, ${total} unread`);
}
if (!window.__chatBadgeTimer) window.__chatBadgeTimer = setInterval(() => { if (document.visibilityState === "visible") refreshChatBadge(); }, 60000);

function chatTabs(active) {
    const dm = state.dmUnread || 0;
    return state.user ? `<div class="segmented chat-tabs" role="tablist">
        <a role="tab" href="#/chat" aria-selected="${active === "rooms"}">Rooms</a>
        <a role="tab" href="#/messages" aria-selected="${active === "messages"}">Messages${dm ? ` <span class="unread sm">${dm > 99 ? "99+" : dm}</span>` : ""}</a>
    </div>` : "";
}

async function viewChatRooms(root, _p, _q, alive) {
    const r = await api("/api/chat/rooms");
    if (state.user) await refreshChatBadge();
    if (!alive()) return;
    if (!r.ok) { root.innerHTML = `<div class="error-box">Couldn't load the chat. Please try again.</div>`; return; }
    if (state.user) ensureSeenStart(r.data.rooms);
    const seen = chatSeen();
    const row = (room) => {
        const [ic, tint] = ROOM_ICON[room.id] || ["bubble", "blue"];
        const n = state.user ? unreadFor(room, seen) : 0;
        const last = room.last;
        return `<a class="row room-row" href="#/chat/${room.id}">
            <span class="icon-tile tint-${tint}">${icon(ic)}</span>
            <span class="row-body">
                <span class="row-title">${esc(room.name)}${room.admin_only ? ' <span class="admin-badge">Official</span>' : ""}</span>
                <span class="row-sub room-last">${last ? `<b>${esc(last.display)}:</b> ${esc(last.message)}` : esc(room.desc)}</span>
            </span>
            <span class="room-end">${last ? `<span class="room-time">${esc(relDate(last.timestamp) === "Today" ? timeOf(last.timestamp) : relDate(last.timestamp))}</span>` : ""}${n ? `<span class="unread">${n > 99 ? "99+" : n}</span>` : ""}</span>
        </a>`;
    };
    const rooms = r.data.rooms;
    root.innerHTML = `
        <div class="page-head">
            <h1 class="page-title">Chat</h1>
            <p>Ask questions, help classmates, and hang out.</p>
        </div>
        ${chatTabs("rooms")}
        ${!state.user ? `<div class="note"><a href="#/login?next=chat">Log in</a> to join the conversation and message people. You can read the rooms without an account.</div>` : ""}
        <div class="row-list">${rooms.filter((x) => x.id === "announcements" || x.id === "lounge").map(row).join("")}</div>
        <section class="section">
            <div class="section-head"><h2 class="section-title">Course rooms</h2></div>
            <div class="row-list">${rooms.filter((x) => x.id !== "announcements" && x.id !== "lounge").map(row).join("")}</div>
        </section>
        <p class="small muted" style="margin:0">Stuck on a question? Tap <b>Ask about this question</b> during a practice test or Mastery to post it in its course room.</p>
        ${state.isAdmin ? `<a class="btn btn-secondary btn-block" href="#/chat-reports">${icon("flag")}Reported messages</a>` : ""}`;
    refreshChatBadge();
}

function messageHtml(m, avatars, room) {
    const time = relDate(m.timestamp) === "Today" ? timeOf(m.timestamp) : `${relDate(m.timestamp)} ${timeOf(m.timestamp)}`;
    const quote = m.quote ? `
        <a class="q-card" href="#/answers/${encodeURIComponent(m.quote.filename)}?id=${encodeURIComponent(m.quote.qid)}">
            <span class="q-card-h">${icon("test")}Question · ${esc(m.quote.exam || "")}</span>
            <span class="q-card-t">${esc(m.quote.question)}</span>
            <span class="q-card-l">See the answer ${icon("chevron")}</span>
        </a>` : "";
    const reply = m.reply_to ? `<span class="reply-ref">${icon("reply")}<b>${esc(m.reply_to.username)}</b> ${esc(m.reply_to.message)}</span>` : "";
    return `<div class="msg ${m.mine ? "mine" : ""}" data-id="${esc(m.id)}">
        <button type="button" class="avatar-link" data-profile="${esc(m.username)}" aria-label="View ${esc(m.display)}'s profile">${avatarHtml(m.username, (avatars || {})[m.username])}</button>
        <div class="msg-body">
            <span class="msg-meta">${m.mine ? "You" : `<button type="button" class="name-link" data-profile="${esc(m.username)}">${esc(m.display)}</button>`}${m.admin ? ' <span class="admin-badge">Admin</span>' : ""} · ${esc(time)}<button type="button" class="msg-more" data-act="${esc(m.id)}" aria-label="Reply, react or more">⋯</button></span>
            <button type="button" class="bubble ${m.quote && !m.message ? "bubble-empty" : ""}" data-act="${esc(m.id)}" aria-label="Message options">${reply}${quote}${m.message ? `<span class="bubble-text">${esc(m.message)}</span>` : ""}</button>
            ${m.reactions && m.reactions.length ? `<span class="reacts">${m.reactions.map((x) => `<button type="button" class="react ${x.mine ? "on" : ""}" data-react="${esc(m.id)}" data-emoji="${x.emoji}" aria-pressed="${x.mine}">${x.emoji} ${x.count}</button>`).join("")}</span>` : ""}
        </div>
    </div>`;
}

function openSheet(html, bind) {
    const old = $("#sheet");
    if (old) old.remove();
    const el = document.createElement("div");
    el.id = "sheet";
    el.className = "sheet-wrap";
    el.innerHTML = `<div class="sheet" role="dialog" aria-modal="true">${html}</div>`;
    document.body.appendChild(el);
    const close = () => { el.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = (e) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    el.addEventListener("click", (e) => { if (e.target === el) close(); });
    bind(el, close);
    return close;
}

async function viewChatRoom(root, [roomId], _q, alive) {
    const rooms = (await api("/api/chat/rooms")).data.rooms || [];
    const room = rooms.find((r) => r.id === roomId);
    if (!room || !alive()) return go("chat");
    const canPost = state.user && (!room.admin_only || state.isAdmin);
    const s = { reply: null, sig: "", data: null };
    root.innerHTML = `
        <a class="back-link" href="#/chat">${icon("back")}Chat</a>
        <div class="page-head room-head"><h1 class="page-title">${esc(room.name)}</h1><p>${esc(room.desc)}</p></div>
        <div id="pinned"></div>
        <div class="chat-list" id="chat-list" aria-live="polite">${loading()}</div>
        ${canPost ? `
            <form class="chat-compose" id="chat-form">
                <div class="reply-chip" id="reply-chip" hidden></div>
                <div class="compose-row">
                    <label class="sr-only" for="chat-input">Message</label>
                    <input class="input" id="chat-input" maxlength="500" autocomplete="off" placeholder="${room.admin_only ? "Post an announcement…" : `Message ${esc(room.name)}…`}">
                    <button class="send-btn" type="submit" aria-label="Send message">${icon("send")}</button>
                </div>
            </form>` : state.user
                ? `<div class="note">Only AnswrIT posts here. React with 👍 to show you've seen it.</div>`
                : `<div class="note"><a href="#/login?next=${encodeURIComponent("chat/" + roomId)}">Log in</a> to join the conversation.</div>`}`;

    function nearBottom() { return window.innerHeight + window.scrollY >= document.body.scrollHeight - 160; }
    async function refresh(scroll) {
        const r = await api(`/api/chat/messages?room=${roomId}`);
        if (!alive()) return stopChatPolling();
        if (!r.ok) return;
        const d = r.data;
        const sig = JSON.stringify([d.messages.map((m) => [m.id, m.reactions]), d.pinned && d.pinned.id]);
        const wasBottom = nearBottom();
        s.data = d;
        if (d.messages.length) markRoomSeen(roomId, d.messages[d.messages.length - 1].timestamp);
        if (sig === s.sig && !scroll) return;
        s.sig = sig;
        $("#pinned", root).innerHTML = d.pinned ? `
            <button type="button" class="pinned" data-goto="${esc(d.pinned.id)}">${icon("pin")}<span><b>Pinned · ${esc(d.pinned.display)}</b><span>${esc(d.pinned.message || (d.pinned.quote || {}).question || "")}</span></span></button>` : "";
        $("#chat-list", root).innerHTML = d.messages.length
            ? d.messages.map((m) => messageHtml(m, d.avatars, roomId)).join("")
            : `<div class="card empty"><p class="muted" style="margin:0">${room.admin_only ? "No announcements yet." : "No messages yet. Start the conversation!"}</p></div>`;
        bind();
        if (scroll || wasBottom) window.scrollTo(0, document.body.scrollHeight);
        refreshChatBadge();
    }
    function bind() {
        $$("[data-act]", root).forEach((b) => { b.onclick = (e) => { if (e.target.closest(".q-card")) return; actions(b.dataset.act); }; });
        $$("[data-react]", root).forEach((b) => { b.onclick = () => react(b.dataset.react, b.dataset.emoji); });
        const pin = $("[data-goto]", root);
        if (pin) pin.onclick = () => { const el = $(`.msg[data-id="${CSS.escape(pin.dataset.goto)}"]`, root); if (el) { el.scrollIntoView({ block: "center" }); el.classList.add("flash"); setTimeout(() => el.classList.remove("flash"), 1200); } };
    }
    async function react(id, emoji) {
        if (!state.user) return go(`login?next=${encodeURIComponent("chat/" + roomId)}`);
        await api("/api/chat/react", { method: "POST", body: { id, emoji } });
        refresh(false);
    }
    function actions(id) {
        const m = (s.data.messages || []).find((x) => x.id === id) || (s.data.pinned && s.data.pinned.id === id ? s.data.pinned : null);
        if (!m) return;
        const isPinned = s.data.pinned && s.data.pinned.id === id;
        const emojis = ["👍", "❤️", "😂", "🙏"];
        openSheet(`
            <p class="sheet-title">${esc(m.display)}: ${esc((m.message || (m.quote || {}).question || "").slice(0, 80))}</p>
            ${state.user ? `<div class="emoji-row">${emojis.map((e) => `<button type="button" class="emoji-btn" data-e="${e}" aria-label="React ${e}">${e}</button>`).join("")}</div>` : ""}
            <div class="sheet-actions">
                ${canPost ? `<button type="button" class="sheet-btn" data-a="reply">${icon("reply")}Reply</button>` : ""}
                ${state.isAdmin ? `<button type="button" class="sheet-btn" data-a="pin">${icon("pin")}${isPinned ? "Unpin" : "Pin to top"}</button>` : ""}
                ${state.user && !m.mine ? `<button type="button" class="sheet-btn" data-a="report">${icon("flag")}Report</button>` : ""}
                ${m.mine || state.isAdmin ? `<button type="button" class="sheet-btn danger" data-a="delete">${icon("trash")}Delete</button>` : ""}
                ${!state.user ? `<a class="sheet-btn" href="#/login?next=${encodeURIComponent("chat/" + roomId)}">Log in to reply or react</a>` : ""}
                <button type="button" class="sheet-btn muted-btn" data-a="cancel">Cancel</button>
            </div>`, (el, close) => {
            $$("[data-e]", el).forEach((b) => { b.onclick = () => { close(); react(id, b.dataset.e); }; });
            $$("[data-a]", el).forEach((b) => {
                b.onclick = async () => {
                    const a = b.dataset.a;
                    close();
                    if (a === "reply") {
                        s.reply = m;
                        const chip = $("#reply-chip", root);
                        chip.hidden = false;
                        chip.innerHTML = `${icon("reply")}<span>Replying to <b>${esc(m.display)}</b></span><button type="button" aria-label="Cancel reply">${icon("close")}</button>`;
                        $("button", chip).onclick = () => { s.reply = null; chip.hidden = true; };
                        $("#chat-input", root).focus();
                    } else if (a === "pin") {
                        await api("/api/chat/pin", { method: "POST", body: { room: roomId, id: isPinned ? null : id } });
                        refresh(true);
                    } else if (a === "report") {
                        const reason = prompt("Why are you reporting this message? (optional)") ;
                        if (reason === null) return;
                        const r = await api("/api/chat/report", { method: "POST", body: { id, reason } });
                        alert(r.ok ? "Thanks. The AnswrIT team will take a look." : (r.data.error || "Couldn't send the report."));
                    } else if (a === "delete") {
                        if (!confirm("Delete this message?")) return;
                        await api("/api/chat/delete", { method: "POST", body: { id } });
                        refresh(true);
                    }
                };
            });
        });
    }
    await refresh(true);
    state.chatTimer = setInterval(() => refresh(false), 6000);

    const form = $("#chat-form", root);
    if (form) form.onsubmit = async (e) => {
        e.preventDefault();
        const input = $("#chat-input", root);
        const message = input.value.trim();
        if (!message) return;
        input.value = "";
        const body = { room: roomId, message };
        if (s.reply) body.reply_to = s.reply.id;
        const r = await api("/api/chat/message", { method: "POST", body });
        if (!r.ok) { input.value = message; alert(r.data.error || "Couldn't send your message."); return; }
        s.reply = null;
        const chip = $("#reply-chip", root);
        if (chip) chip.hidden = true;
        await refresh(true);
        input.focus();
    };
}

// ─── Profiles ──────────────────────────────────────────────────────────────
async function showProfile(username) {
    if (!state.user) {
        openSheet(`<p class="sheet-title">${esc(username)}</p><p class="muted" style="margin:0">Log in to view profiles and send messages.</p>
            <div class="sheet-actions"><a class="btn btn-primary btn-block" href="#/login?next=${encodeURIComponent(parseHash().path)}">Log in</a><button type="button" class="sheet-btn muted-btn" data-a="cancel">Close</button></div>`,
            (el, close) => { $("[data-a]", el).onclick = close; $("a", el).onclick = close; });
        return;
    }
    const r = await api(`/api/people/${encodeURIComponent(username)}`);
    if (!r.ok) { alert(r.data.error || "Couldn't load that profile."); return; }
    const p = r.data.person;
    const active = p.last_active_days === null ? "Not active yet" : p.last_active_days === 0 ? "Active today" : p.last_active_days === 1 ? "Active yesterday" : `Active ${p.last_active_days} days ago`;
    openSheet(`
        <div class="profile">
            ${avatarHtml(p.username, p.avatar, "avatar avatar-xl")}
            <p class="profile-name">${esc(p.display)}${p.admin ? ' <span class="admin-badge">Admin</span>' : ""}</p>
            <p class="profile-sub">${p.admin ? "The AnswrIT team" : `@${esc(p.username)}`} · ${esc(active)}</p>
            ${p.admin ? "" : `<div class="profile-stats">
                <div><strong>${p.streak ? `🔥 ${p.streak}` : "0"}</strong><span>day streak</span></div>
                <div><strong>${p.tests_taken}</strong><span>practice test${p.tests_taken === 1 ? "" : "s"}</span></div>
            </div>`}
        </div>
        <div class="sheet-actions">
            ${p.me ? `<a class="btn btn-secondary btn-block" href="#/account">This is you · Edit your profile</a>` : `<button type="button" class="btn btn-primary btn-block" id="profile-dm">${icon("send")}Message ${esc(p.display)}</button>`}
            <button type="button" class="sheet-btn muted-btn" data-a="cancel">Close</button>
        </div>`, (el, close) => {
        $("[data-a]", el).onclick = close;
        const link = $("a", el);
        if (link) link.onclick = close;
        const dm = $("#profile-dm", el);
        if (dm) dm.onclick = async () => {
            dm.disabled = true;
            const s = await api("/api/dm/start", { method: "POST", body: { username: p.username } });
            close();
            if (s.ok) go(`messages/${s.data.id}`); else alert(s.data.error || "Couldn't start the conversation.");
        };
    });
}
document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-profile]");
    if (!b) return;
    e.preventDefault();
    e.stopPropagation();
    const open = $("#sheet");
    if (open) open.remove();
    showProfile(b.dataset.profile);
});

// "Ask about this question" from a practice test or Mastery: posts the question to its course room.
function askAboutQuestion(filename, q) {
    const course = courseOf(filename);
    const roomId = COURSE_ROOM[course ? course.id : ""] || "lounge";
    const roomName = course ? course.name : "Lounge";
    if (!state.user) {
        openSheet(`<p class="sheet-title">Ask about this question</p><p class="muted" style="margin:0">Log in to ask classmates in the ${esc(roomName)} room. Your answers so far stay right here.</p>
            <div class="sheet-actions"><button type="button" class="sheet-btn muted-btn" data-a="cancel">OK</button></div>`, (el, close) => { $("[data-a]", el).onclick = close; });
        return;
    }
    openSheet(`
        <p class="sheet-title">Ask the ${esc(roomName)} room</p>
        <div class="q-card static"><span class="q-card-t">${esc(q.question)}</span></div>
        <label class="field"><span class="small muted">What's confusing you? (optional)</span>
            <textarea class="input" id="ask-text" rows="3" maxlength="500" placeholder="e.g. Why isn't it the other one?"></textarea></label>
        <p class="small muted" id="ask-msg" style="margin:0"></p>
        <div class="sheet-actions">
            <button type="button" class="btn btn-primary btn-block" id="ask-send">Post question</button>
            <button type="button" class="sheet-btn muted-btn" data-a="cancel">Cancel</button>
        </div>`, (el, close) => {
        $("[data-a]", el).onclick = close;
        $("#ask-send", el).onclick = async () => {
            const btn = $("#ask-send", el);
            btn.disabled = true;
            const r = await api("/api/chat/message", { method: "POST", body: { room: roomId, message: $("#ask-text", el).value.trim(), quote: { filename, qid: q.id } } });
            if (!r.ok) { btn.disabled = false; $("#ask-msg", el).textContent = r.data.error || "Couldn't post it."; return; }
            $(".sheet", el).innerHTML = `<p class="sheet-title">Posted in ${esc(roomName)} ✓</p><p class="muted" style="margin:0">You'll see replies in Chat. Keep going with your questions here.</p>
                <div class="sheet-actions"><button type="button" class="btn btn-primary btn-block" id="ask-ok">Back to the question</button></div>`;
            $("#ask-ok", el).onclick = close;
        };
        setTimeout(() => $("#ask-text", el)?.focus(), 50);
    });
}

// ─── Direct messages and group chats ────────────────────────────────────────
function convoAvatar(c) {
    if (c.type === "group") return `<span class="icon-tile tint-green">${icon("people")}</span>`;
    return avatarHtml(c.with || c.name, (state.dmAvatars || {})[c.with], "avatar avatar-md");
}

async function viewMessages(root, _p, _q, alive) {
    if (!state.user) return needLogin(root, "send messages");
    const r = await api("/api/dm/list");
    if (!alive()) return;
    if (!r.ok) { root.innerHTML = `<div class="error-box">${esc(r.data.error || "Couldn't load your messages.")}</div>`; return; }
    await refreshChatBadge();
    const seen = chatSeen() || {};
    const convos = r.data.convos;
    const admin = r.data.admin;
    const hasAdminDm = admin && convos.some((c) => c.type === "dm" && c.with === admin.username);
    root.innerHTML = `
        <div class="page-head"><h1 class="page-title">Chat</h1><p>Private messages and group chats.</p></div>
        ${chatTabs("messages")}
        <div class="dm-actions">
            <button type="button" class="btn btn-primary" id="new-dm">${icon("pencil")}New message</button>
            <button type="button" class="btn btn-secondary" id="new-group">${icon("people")}New group</button>
        </div>
        ${admin && !hasAdminDm ? `<button type="button" class="row admin-dm" id="dm-admin">
            <span class="icon-tile tint-orange">${icon("megaphone")}</span>
            <span class="row-body"><span class="row-title">Message ${esc(admin.display)} <span class="admin-badge">Admin</span></span><span class="row-sub">Questions, problems or ideas for the site</span></span>
            ${icon("chevron", "row-chevron")}</button>` : ""}
        ${convos.length ? `<div class="row-list">${convos.map((c) => {
            const n = unreadFor({ id: "dm:" + c.id, recent: c.recent }, seen);
            return `<a class="row room-row" href="#/messages/${esc(c.id)}">
                ${c.type === "group" ? `<span class="icon-tile tint-green">${icon("people")}</span>` : avatarHtml(c.with || c.name, "", "avatar avatar-md")}
                <span class="row-body">
                    <span class="row-title">${esc(c.name)}${c.members.some((m) => m.admin && m.username !== state.user) && c.type === "dm" ? ' <span class="admin-badge">Admin</span>' : ""}</span>
                    <span class="row-sub room-last">${c.last ? `<b>${esc(c.last.display)}:</b> ${esc(c.last.message)}` : c.type === "group" ? `${c.members.length} people` : "No messages yet"}</span>
                </span>
                <span class="room-end">${c.last ? `<span class="room-time">${esc(relDate(c.last.timestamp) === "Today" ? timeOf(c.last.timestamp) : relDate(c.last.timestamp))}</span>` : ""}${n ? `<span class="unread">${n > 99 ? "99+" : n}</span>` : ""}</span>
            </a>`;
        }).join("")}</div>` : `<div class="card empty"><p class="muted" style="margin:0">No conversations yet. Start one with <b>New message</b>, or make a group for your class.</p></div>`}`;
    $("#new-dm", root).onclick = () => pickPeople({ title: "New message", multi: false, onDone: async ([u]) => {
        const s = await api("/api/dm/start", { method: "POST", body: { username: u } });
        if (s.ok) go(`messages/${s.data.id}`); else alert(s.data.error || "Couldn't start the conversation.");
    } });
    $("#new-group", root).onclick = () => pickPeople({ title: "New group", multi: true, max: 24, askName: true, onDone: async (users, name) => {
        const g = await api("/api/dm/group", { method: "POST", body: { name, members: users } });
        if (g.ok) go(`messages/${g.data.id}`); else alert(g.data.error || "Couldn't create the group.");
    } });
    const ad = $("#dm-admin", root);
    if (ad) ad.onclick = async () => {
        const s = await api("/api/dm/start", { method: "POST", body: { username: admin.username } });
        if (s.ok) go(`messages/${s.data.id}`);
    };
}

// Search for people by username. multi: pick several (for groups).
function pickPeople({ title, multi, max = 24, askName, exclude = [], onDone }) {
    const picked = [];
    openSheet(`
        <p class="sheet-title">${esc(title)}</p>
        ${askName ? `<label class="field"><span class="small muted">Group name</span><input class="input" id="pp-name" maxlength="60" placeholder="e.g. Class 531 study group" autocomplete="off"></label>` : ""}
        <label class="field"><span class="small muted">${multi ? `Add people (up to ${max})` : "To"}</span>
            <input class="input" id="pp-q" placeholder="Search by username" autocomplete="off" autocapitalize="none" spellcheck="false"></label>
        ${multi ? `<div class="pp-chips" id="pp-chips"></div>` : ""}
        <div class="pp-results" id="pp-results"><p class="small muted" style="margin:0">Type a username to search.</p></div>
        <p class="small" id="pp-msg" style="margin:0;color:var(--red)"></p>
        <div class="sheet-actions">
            ${multi ? `<button type="button" class="btn btn-primary btn-block" id="pp-done">${askName ? "Create group" : "Add"}</button>` : ""}
            <button type="button" class="sheet-btn muted-btn" data-a="cancel">Cancel</button>
        </div>`, (el, close) => {
        $("[data-a]", el).onclick = close;
        const drawChips = () => {
            const c = $("#pp-chips", el);
            if (!c) return;
            c.innerHTML = picked.map((u) => `<button type="button" class="chip" data-rm="${esc(u.username)}">${esc(u.display)} ✕</button>`).join("");
            $$("[data-rm]", c).forEach((b) => { b.onclick = () => { picked.splice(picked.findIndex((x) => x.username === b.dataset.rm), 1); drawChips(); }; });
        };
        let t = null;
        $("#pp-q", el).oninput = (e) => {
            clearTimeout(t);
            t = setTimeout(async () => {
                const q = e.target.value.trim();
                const box = $("#pp-results", el);
                if (!q) { box.innerHTML = '<p class="small muted" style="margin:0">Type a username to search.</p>'; return; }
                const r = await api(`/api/users/search?q=${encodeURIComponent(q)}`);
                const users = (r.ok ? r.data.users : []).filter((u) => !exclude.includes(u.username));
                box.innerHTML = users.length ? users.map((u) => `<button type="button" class="pp-user" data-u="${esc(u.username)}" data-d="${esc(u.display)}">${avatarHtml(u.username, "")}<span>${esc(u.display)}${u.admin ? ' <span class="admin-badge">Admin</span>' : ""}</span></button>`).join("")
                    : '<p class="small muted" style="margin:0">No one found with that name.</p>';
                $$(".pp-user", box).forEach((b) => {
                    b.onclick = () => {
                        if (!multi) { close(); onDone([b.dataset.u]); return; }
                        if (picked.some((x) => x.username === b.dataset.u)) return;
                        if (picked.length >= max) { $("#pp-msg", el).textContent = `You can add up to ${max} people.`; return; }
                        picked.push({ username: b.dataset.u, display: b.dataset.d });
                        drawChips();
                        $("#pp-q", el).value = ""; $("#pp-q", el).focus();
                    };
                });
            }, 200);
        };
        const done = $("#pp-done", el);
        if (done) done.onclick = () => {
            const name = askName ? $("#pp-name", el).value.trim() : "";
            if (askName && !name) { $("#pp-msg", el).textContent = "Give the group a name."; return; }
            if (!picked.length) { $("#pp-msg", el).textContent = "Add at least one person."; return; }
            close();
            onDone(picked.map((x) => x.username), name);
        };
        setTimeout(() => ($("#pp-name", el) || $("#pp-q", el)).focus(), 50);
    });
}

async function viewConvo(root, [cid], _q, alive) {
    if (!state.user) return needLogin(root, "send messages");
    const s = { reply: null, sig: "", data: null };
    root.innerHTML = loading();
    const first = await api(`/api/dm/messages?id=${encodeURIComponent(cid)}`);
    if (!alive()) return;
    if (!first.ok) { root.innerHTML = `<a class="back-link" href="#/messages">${icon("back")}Messages</a><div class="error-box">${esc(first.data.error || "Conversation not found.")}</div>`; return; }
    const c0 = first.data.convo;
    root.innerHTML = `
        <a class="back-link" href="#/messages">${icon("back")}Messages</a>
        <div class="page-head room-head convo-head">
            <div><h1 class="page-title" id="convo-title"></h1><p id="convo-sub"></p></div>
            ${c0.type === "group" ? `<button type="button" class="btn btn-secondary" id="members-btn">${icon("people")}Members</button>` : ""}
        </div>
        <div class="chat-list" id="chat-list" aria-live="polite"></div>
        <form class="chat-compose" id="chat-form">
            <div class="reply-chip" id="reply-chip" hidden></div>
            <div class="compose-row">
                <label class="sr-only" for="chat-input">Message</label>
                <input class="input" id="chat-input" maxlength="1000" autocomplete="off" placeholder="Message…">
                <button class="send-btn" type="submit" aria-label="Send message">${icon("send")}</button>
            </div>
        </form>`;
    const nearBottom = () => window.innerHeight + window.scrollY >= document.body.scrollHeight - 160;
    function draw(d, scroll) {
        const sig = JSON.stringify([d.messages.map((m) => [m.id, m.reactions]), d.convo.members.length, d.convo.name]);
        const wasBottom = nearBottom();
        s.data = d;
        if (d.messages.length) markRoomSeen("dm:" + cid, d.messages[d.messages.length - 1].timestamp);
        if (sig === s.sig && !scroll) return;
        s.sig = sig;
        const c = d.convo;
        $("#convo-title", root).textContent = c.name;
        $("#convo-sub", root).innerHTML = c.type === "group" ? `${c.members.length} people · ${esc(c.members.map((m) => m.display).slice(0, 4).join(", "))}${c.members.length > 4 ? "…" : ""}`
            : (c.members.find((m) => m.username !== state.user) || {}).admin ? 'Private message · <span class="admin-badge">Admin</span>' : "Private message";
        $("#chat-list", root).innerHTML = d.messages.length ? d.messages.map((m) => messageHtml(m, d.avatars)).join("")
            : `<div class="card empty"><p class="muted" style="margin:0">Say hi! Only the people in this conversation can see it.</p></div>`;
        $$("[data-act]", root).forEach((b) => { b.onclick = (e) => { if (e.target.closest(".q-card")) return; actions(b.dataset.act); }; });
        $$("[data-react]", root).forEach((b) => { b.onclick = () => react(b.dataset.react, b.dataset.emoji); });
        if (scroll || wasBottom) window.scrollTo(0, document.body.scrollHeight);
        refreshChatBadge();
    }
    async function refresh(scroll) {
        const r = await api(`/api/dm/messages?id=${encodeURIComponent(cid)}`);
        if (!alive()) return stopChatPolling();
        if (r.ok) draw(r.data, scroll);
        else if (r.status === 404) go("messages");
    }
    async function react(mid, emoji) {
        await api("/api/dm/react", { method: "POST", body: { id: cid, mid, emoji } });
        refresh(false);
    }
    function actions(mid) {
        const m = s.data.messages.find((x) => x.id === mid);
        if (!m) return;
        openSheet(`
            <p class="sheet-title">${esc(m.display)}: ${esc((m.message || "").slice(0, 80))}</p>
            <div class="emoji-row">${["👍", "❤️", "😂", "🙏"].map((e) => `<button type="button" class="emoji-btn" data-e="${e}" aria-label="React ${e}">${e}</button>`).join("")}</div>
            <div class="sheet-actions">
                <button type="button" class="sheet-btn" data-a="reply">${icon("reply")}Reply</button>
                ${!m.mine ? `<button type="button" class="sheet-btn" data-a="report">${icon("flag")}Report to AnswrIT</button>` : ""}
                ${m.mine ? `<button type="button" class="sheet-btn danger" data-a="delete">${icon("trash")}Delete</button>` : ""}
                <button type="button" class="sheet-btn muted-btn" data-a="cancel">Cancel</button>
            </div>`, (el, close) => {
            $$("[data-e]", el).forEach((b) => { b.onclick = () => { close(); react(mid, b.dataset.e); }; });
            $$("[data-a]", el).forEach((b) => {
                b.onclick = async () => {
                    const a = b.dataset.a;
                    close();
                    if (a === "reply") {
                        s.reply = m;
                        const chip = $("#reply-chip", root);
                        chip.hidden = false;
                        chip.innerHTML = `${icon("reply")}<span>Replying to <b>${esc(m.display)}</b></span><button type="button" aria-label="Cancel reply">${icon("close")}</button>`;
                        $("button", chip).onclick = () => { s.reply = null; chip.hidden = true; };
                        $("#chat-input", root).focus();
                    } else if (a === "report") {
                        const reason = prompt("Why are you reporting this? The AnswrIT admin will see this message and a few around it.");
                        if (reason === null) return;
                        const r = await api("/api/dm/report", { method: "POST", body: { id: cid, mid, reason } });
                        alert(r.ok ? "Thanks. The AnswrIT team will take a look." : (r.data.error || "Couldn't send the report."));
                    } else if (a === "delete") {
                        if (!confirm("Delete this message?")) return;
                        await api("/api/dm/delete", { method: "POST", body: { id: cid, mid } });
                        refresh(true);
                    }
                };
            });
        });
    }
    function members() {
        const c = s.data.convo;
        const owner = c.owner === state.user;
        openSheet(`
            <p class="sheet-title">${esc(c.name)} · ${c.members.length} of 25</p>
            <div class="pp-results">${c.members.map((m) => `<div class="pp-user static"><button type="button" class="avatar-link" data-profile="${esc(m.username)}" aria-label="View ${esc(m.display)}'s profile">${avatarHtml(m.username, (s.data.avatars || {})[m.username])}</button><span>${esc(m.display)}${m.username === c.owner ? ' <span class="admin-badge">Creator</span>' : ""}${m.username === state.user ? " (you)" : ""}</span>
                ${owner && m.username !== state.user ? `<button type="button" class="pp-remove" data-rm="${esc(m.username)}" aria-label="Remove ${esc(m.display)}">${icon("close")}</button>` : ""}</div>`).join("")}</div>
            <div class="sheet-actions">
                ${owner ? `<button type="button" class="sheet-btn" data-a="add">${icon("people")}Add people</button><button type="button" class="sheet-btn" data-a="rename">${icon("pencil")}Rename group</button>` : ""}
                <button type="button" class="sheet-btn danger" data-a="leave">Leave group</button>
                <button type="button" class="sheet-btn muted-btn" data-a="cancel">Close</button>
            </div>`, (el, close) => {
            $$("[data-rm]", el).forEach((b) => { b.onclick = async () => {
                if (!confirm("Remove this person from the group?")) return;
                await api("/api/dm/members", { method: "POST", body: { id: cid, remove: [b.dataset.rm] } });
                close(); await refresh(true); members();
            }; });
            $$("[data-a]", el).forEach((b) => { b.onclick = async () => {
                const a = b.dataset.a;
                close();
                if (a === "add") {
                    pickPeople({ title: "Add people", multi: true, max: 25 - c.members.length, exclude: c.members.map((m) => m.username), onDone: async (users) => {
                        const r = await api("/api/dm/members", { method: "POST", body: { id: cid, add: users } });
                        if (!r.ok) alert(r.data.error || "Couldn't add them.");
                        refresh(true);
                    } });
                } else if (a === "rename") {
                    const name = prompt("New group name:", c.name);
                    if (name && name.trim()) { await api("/api/dm/members", { method: "POST", body: { id: cid, name: name.trim() } }); refresh(true); }
                } else if (a === "leave") {
                    if (!confirm("Leave this group? You won't see its messages anymore.")) return;
                    await api("/api/dm/leave", { method: "POST", body: { id: cid } });
                    go("messages");
                }
            }; });
        });
    }
    draw(first.data, true);
    const mb = $("#members-btn", root);
    if (mb) mb.onclick = members;
    state.chatTimer = setInterval(() => refresh(false), 5000);
    $("#chat-form", root).onsubmit = async (e) => {
        e.preventDefault();
        const input = $("#chat-input", root);
        const message = input.value.trim();
        if (!message) return;
        input.value = "";
        const body = { id: cid, message };
        if (s.reply) body.reply_to = s.reply.id;
        const r = await api("/api/dm/message", { method: "POST", body });
        if (!r.ok) { input.value = message; alert(r.data.error || "Couldn't send your message."); return; }
        s.reply = null;
        $("#reply-chip", root).hidden = true;
        await refresh(true);
        input.focus();
    };
}

async function viewChatReports(root, _p, _q, alive) {
    if (!state.isAdmin) return go("chat");
    const [r, dr] = await Promise.all([api("/api/chat/reports"), api("/api/dm/reports")]);
    if (!alive()) return;
    const list = r.ok ? r.data.reports : [];
    const dms = dr.ok ? dr.data.reports : [];
    const roomName = (id) => ((state.chatRooms || []).find((x) => x.id === id) || {}).name || id;
    root.innerHTML = `
        <a class="back-link" href="#/chat">${icon("back")}Chat</a>
        <div class="page-head"><h1 class="page-title">Reported messages</h1><p>${list.length + dms.length ? `${list.length + dms.length} report${list.length + dms.length === 1 ? "" : "s"}` : "Nothing reported. All clear!"}</p></div>
        ${dms.length ? `<section class="section"><div class="section-head"><h2 class="section-title">Private messages</h2></div>
            <p class="small muted" style="margin:0">You only see the reported message and a few around it, saved when it was reported.</p>
            <div class="row-list">${dms.map((g) => `
            <div class="card report-card">
                <span class="small muted">${esc(g.where)} · reported by ${esc(g.by)} · ${esc(relDate(g.at))}${g.reason ? ` · “${esc(g.reason)}”` : ""}</span>
                <div class="report-context">${g.context.map((x) => `<p class="${x.reported ? "reported" : ""}"><b>${esc(x.display)}:</b> ${esc(x.message)}</p>`).join("")}</div>
                <div class="btn-row">
                    <button type="button" class="btn btn-danger" data-dmdel="${esc(g.rid)}">Delete message</button>
                    <button type="button" class="btn btn-secondary" data-dmok="${esc(g.rid)}">Keep it</button>
                </div>
            </div>`).join("")}</div></section>
            ${list.length ? '<div class="section-head"><h2 class="section-title">Chat rooms</h2></div>' : ""}` : ""}
        <div class="row-list">${list.map((g) => `
            <div class="card report-card">
                <span class="small muted">${esc(roomName(g.room))} · reported ${g.count} time${g.count === 1 ? "" : "s"}${g.reasons.length ? ` · “${esc(g.reasons.join("”, “"))}”` : ""}</span>
                <p style="margin:0"><b>${esc(g.message.display)}:</b> ${esc(g.message.message || (g.message.quote || {}).question || "")}</p>
                <div class="btn-row">
                    <button type="button" class="btn btn-danger" data-del="${esc(g.id)}">Delete message</button>
                    <button type="button" class="btn btn-secondary" data-ok="${esc(g.id)}">Keep it</button>
                </div>
            </div>`).join("")}</div>`;
    $$("[data-del]", root).forEach((b) => { b.onclick = async () => { await api("/api/chat/delete", { method: "POST", body: { id: b.dataset.del } }); router(); }; });
    $$("[data-ok]", root).forEach((b) => { b.onclick = async () => { await api("/api/chat/reports", { method: "POST", body: { id: b.dataset.ok } }); router(); }; });
    $$("[data-dmdel]", root).forEach((b) => { b.onclick = async () => { await api("/api/dm/reports", { method: "POST", body: { rid: b.dataset.dmdel, action: "delete" } }); router(); }; });
    $$("[data-dmok]", root).forEach((b) => { b.onclick = async () => { await api("/api/dm/reports", { method: "POST", body: { rid: b.dataset.dmok, action: "keep" } }); router(); }; });
}

// ─── Login & account ────────────────────────────────────────────────────────
async function viewLogin(root, _p, query) {
    if (state.user) return go(query.get("next") || "");
    let mode = query.get("mode") === "signup" ? "signup" : "login";
    function render(error = "") {
        root.innerHTML = `
            <div class="page-head">
                <h1 class="page-title">${mode === "login" ? "Welcome back" : "Create your account"}</h1>
                <p>${mode === "login" ? "Log in with your AnswrIT username." : "Free. Saves your scores, mastery and chat name."}</p>
            </div>
            <div class="segmented" role="group" aria-label="Log in or sign up">
                <button type="button" data-mode="login" aria-pressed="${mode === "login"}">Log in</button>
                <button type="button" data-mode="signup" aria-pressed="${mode === "signup"}">Sign up</button>
            </div>
            <form class="card" id="auth-form" novalidate>
                ${error ? `<div class="error-box" role="alert">${esc(error)}</div>` : ""}
                <div class="field">
                    <label for="u">Username</label>
                    <input class="input" id="u" name="username" autocomplete="username" autocapitalize="none" spellcheck="false" required>
                </div>
                <div class="field">
                    <label for="p">Password</label>
                    <input class="input" id="p" name="password" type="password" autocomplete="${mode === "login" ? "current-password" : "new-password"}" required>
                </div>
                <button class="btn btn-primary btn-block" type="submit">${mode === "login" ? "Log in" : "Create account"}</button>
            </form>`;
        $$(".segmented button", root).forEach((b) => { b.onclick = () => { mode = b.dataset.mode; render(); }; });
        $("#auth-form", root).onsubmit = async (e) => {
            e.preventDefault();
            const username = $("#u", root).value.trim();
            const password = $("#p", root).value;
            if (!username || !password) return render("Enter your username and password.");
            const r = await api(mode === "login" ? "/api/login" : "/api/register", { method: "POST", body: { username, password } });
            if (!r.ok) return render(r.data.error || "Something went wrong. Try again.");
            state.user = r.data.user;
            state.profile = r.data.profile || {};
            state.isAdmin = false;
            state.myDecks = null;
            loadMe();
            applyTheme(state.profile.theme);
            renderAccountButton();
            go(query.get("next") || "");
        };
        $("#u", root).focus();
    }
    render();
}

// ─── Account: profile picture and theme ─────────────────────────────────────
// Theme keys match the classic site so saved choices carry over.
const THEMES = [
    { key: "ocean", label: "Ocean", color: "#2563EB" },
    { key: "midnight", label: "Midnight", color: "#0F172A" },
    { key: "forest", label: "Forest", color: "#15803D" },
    { key: "sunset", label: "Sunset", color: "#BE123C" },
    { key: "jenelle", label: "Jenelle", color: "#DB2777" },
];

function applyTheme(key) {
    const theme = THEMES.some((t) => t.key === key) ? key : "ocean";
    document.documentElement.dataset.theme = theme;
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "midnight" ? "#0B1120" : "#F5F7FB");
}

async function saveProfile(changes) {
    const r = await api("/api/profile", { method: "POST", body: changes });
    if (r.ok) {
        state.profile = { ...state.profile, ...(r.data.profile || changes) };
        renderAccountButton();
    }
    return r;
}

const CROP_VIEW = 240;
const CROP_OUT = 256;

async function viewAccount(root) {
    if (!state.user) return go("login?next=account");
    let msg = "";
    let crop = null; // { img, base, scale, x, y }
    function render() {
        const current = state.profile.theme || "ocean";
        const hasPic = !!safeAvatar(state.profile.avatar_image);
        root.innerHTML = `
            <div class="page-head"><h1 class="page-title">Account</h1></div>
            <div class="card">
                <div style="display:flex;gap:14px;align-items:center">
                    ${avatarHtml(state.user, state.profile.avatar_image, "avatar avatar-lg")}
                    <div class="row-body"><span class="row-title">${esc(state.user)}</span><span class="row-sub">Signed in</span></div>
                </div>
                ${crop ? `
                    <div class="crop">
                        <p class="small muted" style="margin:0">Drag to move the picture. Use the slider to zoom.</p>
                        <div class="crop-view" id="crop-view" style="width:${CROP_VIEW}px;height:${CROP_VIEW}px"><img id="crop-img" src="${crop.img.src}" alt="" draggable="false"></div>
                        <label class="small" for="crop-zoom">Zoom</label>
                        <input type="range" id="crop-zoom" min="${crop.base}" max="${crop.base * 5}" step="${crop.base / 50}" value="${crop.scale}">
                        <div class="btn-row">
                            <button type="button" class="btn btn-primary" id="crop-save">Save picture</button>
                            <button type="button" class="btn btn-secondary" id="crop-cancel">Cancel</button>
                        </div>
                    </div>` : `
                    <div class="btn-row">
                        <label class="btn btn-secondary" for="avatar-file">${icon("camera")}${hasPic ? "Change picture" : "Add a picture"}</label>
                        ${hasPic ? `<button type="button" class="btn btn-ghost" id="avatar-remove">Remove</button>` : ""}
                    </div>
                    <input type="file" id="avatar-file" accept="image/*" class="sr-only">`}
                ${msg ? `<div class="feedback ${msg.ok ? "good" : "bad"}" role="status">${esc(msg.text)}</div>` : ""}
            </div>
            <section class="section">
                <div class="section-head"><h2 class="section-title">Theme</h2></div>
                <div class="theme-grid" role="group" aria-label="Theme">
                    ${THEMES.map((t) => `
                        <button type="button" class="theme-swatch" data-theme-key="${t.key}" aria-pressed="${t.key === current}">
                            <span class="swatch" style="background:${t.color}"></span>${esc(t.label)}
                        </button>`).join("")}
                </div>
            </section>
            <button type="button" class="btn btn-secondary btn-block" id="logout-btn">Log out</button>`;

        $$("[data-theme-key]", root).forEach((b) => {
            b.onclick = async () => {
                applyTheme(b.dataset.themeKey);
                state.profile.theme = b.dataset.themeKey;
                render();
                const r = await saveProfile({ theme: b.dataset.themeKey });
                if (!r.ok) { msg = { ok: false, text: r.data.error || "Couldn't save your theme." }; render(); }
            };
        });
        $("#logout-btn", root).onclick = async () => {
            await api("/api/logout", { method: "POST" });
            state.user = null;
            state.profile = {};
            state.myDecks = null;
            applyTheme("ocean");
            renderAccountButton();
            go("");
        };
        const file = $("#avatar-file", root);
        if (file) file.onchange = () => {
            const f = file.files && file.files[0];
            if (!f || !f.type.startsWith("image/")) { msg = { ok: false, text: "Please choose a picture file." }; return render(); }
            const reader = new FileReader();
            reader.onload = () => {
                const img = new Image();
                img.onload = () => {
                    const base = Math.max(CROP_VIEW / img.naturalWidth, CROP_VIEW / img.naturalHeight);
                    crop = { img, base, scale: base, x: 0, y: 0 };
                    msg = "";
                    render();
                };
                img.onerror = () => { msg = { ok: false, text: "That picture couldn't be opened. Try another one." }; render(); };
                img.src = reader.result;
            };
            reader.readAsDataURL(f);
        };
        const remove = $("#avatar-remove", root);
        if (remove) remove.onclick = async () => {
            const r = await saveProfile({ avatar_image: "" });
            msg = r.ok ? { ok: true, text: "Picture removed." } : { ok: false, text: r.data.error || "Couldn't remove it." };
            render();
        };
        if (crop) bindCrop();
    }

    function bindCrop() {
        const view = $("#crop-view", root);
        const img = $("#crop-img", root);
        const zoom = $("#crop-zoom", root);
        const place = () => {
            const halfW = Math.max(0, crop.img.naturalWidth * crop.scale / 2 - CROP_VIEW / 2);
            const halfH = Math.max(0, crop.img.naturalHeight * crop.scale / 2 - CROP_VIEW / 2);
            crop.x = Math.max(-halfW, Math.min(halfW, crop.x));
            crop.y = Math.max(-halfH, Math.min(halfH, crop.y));
            img.style.width = `${crop.img.naturalWidth * crop.scale}px`;
            img.style.transform = `translate(calc(-50% + ${crop.x}px), calc(-50% + ${crop.y}px))`;
        };
        let drag = null;
        view.onpointerdown = (e) => { drag = { x: e.clientX - crop.x, y: e.clientY - crop.y }; view.setPointerCapture(e.pointerId); };
        view.onpointermove = (e) => { if (!drag) return; crop.x = e.clientX - drag.x; crop.y = e.clientY - drag.y; place(); };
        view.onpointerup = view.onpointercancel = () => { drag = null; };
        zoom.oninput = () => { crop.scale = Number(zoom.value); place(); };
        place();
        $("#crop-cancel", root).onclick = () => { crop = null; render(); };
        $("#crop-save", root).onclick = async () => {
            const canvas = document.createElement("canvas");
            canvas.width = canvas.height = CROP_OUT;
            const ctx = canvas.getContext("2d");
            const left = CROP_VIEW / 2 + crop.x - crop.img.naturalWidth * crop.scale / 2;
            const top = CROP_VIEW / 2 + crop.y - crop.img.naturalHeight * crop.scale / 2;
            const size = CROP_VIEW / crop.scale;
            ctx.drawImage(crop.img, -left / crop.scale, -top / crop.scale, size, size, 0, 0, CROP_OUT, CROP_OUT);
            const data = canvas.toDataURL("image/jpeg", 0.9);
            if (data.length > 190000) { msg = { ok: false, text: "That picture is too large. Try a smaller one." }; return render(); }
            const r = await saveProfile({ avatar_image: data });
            crop = null;
            msg = r.ok ? { ok: true, text: "Picture saved." } : { ok: false, text: r.data.error || "Couldn't save your picture." };
            render();
        };
    }
    render();
}

// ─── Start ──────────────────────────────────────────────────────────────────
// Old-style page addresses (from Google, bookmarks and shared links) open the matching screen.
function routeFromPath() {
    if (location.hash && location.hash !== "#" && location.hash !== "#/") return;
    const path = location.pathname.replace(/\/+$/, "");
    const exam = path.match(/^\/exams\/([^/]+)$/);
    const map = { "/study": "study", "/flashcards": "study", "/history": "progress", "/chat": "chat", "/apps": "drills", "/packet-tracer": "packet-tracer" };
    const target = exam ? `exam/${exam[1]}.json` : map[path];
    if (target) history.replaceState(null, "", `/#/${target}`);
}

function trackPageView() {
    if (typeof window.gtag !== "function") return;
    window.gtag("event", "page_view", {
        page_location: location.href,
        page_path: "/" + (parseHash().path || ""),
        page_title: document.title,
    });
}

window.addEventListener("hashchange", () => { router(); trackPageView(); });
(async function start() {
    routeFromPath();
    await loadMe();
    router();
    trackPageView();
})();
