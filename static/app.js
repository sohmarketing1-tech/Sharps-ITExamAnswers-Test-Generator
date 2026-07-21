const API = {
    exams: "/api/exams",
    load: "/api/load",
    state: "/api/state",
    test: "/api/test",
    score: "/api/score",
    register: "/api/register",
    login: "/api/login",
    logout: "/api/logout",
    me: "/api/me",
    mastery: "/api/mastery",
    masteryBatch: "/api/mastery/batch",
    masterySubmit: "/api/mastery/submit",
    masteryReset: "/api/mastery/reset",
    chatMessages: "/api/chat/messages",
    chatMessage: "/api/chat/message",
    chatAvatars: "/api/chat/avatars",
    examQuestions: "/api/exam-questions",
    flashcardReviews: "/api/flashcard/reviews",
    flashcardReviewToggle: "/api/flashcard/review",
    history: "/api/history",
    profile: "/api/profile",
};

const state = {
    exams: [],
    currentFilename: null,
    title: "IT Exam Practice Test",
    url: "",
    allQuestions: [],
    testQuestions: [],
    lastTestQuestions: [],
    answers: {}, // { questionId: [selectedOption, ...] }
    currentIndex: 0,
    timerInterval: null,
    secondsElapsed: 0,
    timerLimitSeconds: 0,
    fiveMinWarned: false,
    multiSelect: false,
    mode: "practice", // "practice" or "mastery"
    user: null,
    masterySummary: null,
    lastSavedAnswers: {}, // qid -> saved answer array
    currentTab: "home",
    flashcardFilename: null,
    historyAttempts: [],
    flashcardMode: "question", // "question" or "choices"
    flashcardFilter: "all", // "all" or "review"
    flashcardQuestions: [],
    flashcardIndex: 0,
    flashcardFlipped: false,
    flashcardReviews: new Set(),
    authModalMode: null,
    chatMessages: [],
    chatMessagesKey: null,
    userProfile: {},
};

// DOM refs
const screens = {
    home: document.getElementById("home-screen"),
    setup: document.getElementById("setup-screen"),
    quiz: document.getElementById("quiz-screen"),
    results: document.getElementById("results-screen"),
    history: document.getElementById("history-screen"),
    community: document.getElementById("community-screen"),
    flashcards: document.getElementById("flashcards-screen"),
};

const els = {
    examButtons: document.getElementById("exam-buttons"),
    totalQuestions: document.getElementById("total-questions"),
    questionCount: document.getElementById("question-count"),
    startBtn: document.getElementById("start-btn"),
    setupMessage: document.getElementById("setup-message"),
    accountPrompt: document.getElementById("account-prompt"),
    tabHome: document.getElementById("tab-home"),
    tabNav: document.querySelector(".tab-nav"),
    tabPractice: document.getElementById("tab-practice"),
    tabFlashcards: document.getElementById("tab-flashcards"),
    tabHistory: document.getElementById("tab-history"),
    tabCommunity: document.getElementById("tab-community"),
    homePracticeBtn: document.querySelector('.home-card[data-tab="practice"]'),
    homeFlashcardsBtn: document.querySelector('.home-card[data-tab="flashcards"]'),
    homeHistoryBtn: document.querySelector('.home-card[data-tab="history"]'),
    homeCommunityBtn: document.querySelector('.home-card[data-tab="community"]'),
    historyLoginPrompt: document.getElementById("history-login-prompt"),
    historyLoginBtn: document.getElementById("history-login-btn"),
    historyContent: document.getElementById("history-content"),
    historyTestsTaken: document.getElementById("history-tests-taken"),
    historyAverageScore: document.getElementById("history-average-score"),
    historyRecentScore: document.getElementById("history-recent-score"),
    historyList: document.getElementById("history-list"),
    chatMessages: document.getElementById("chat-messages"),
    chatInput: document.getElementById("chat-input"),
    chatSendBtn: document.getElementById("chat-send-btn"),
    chatLoginPrompt: document.getElementById("chat-login-prompt"),
    chatInputRow: document.getElementById("chat-input-row"),
    progressBar: document.getElementById("progress-bar"),
    progress: document.getElementById("progress"),
    timer: document.getElementById("timer"),
    timerDuration: document.getElementById("timer-duration"),
    homeBtn: document.getElementById("home-btn"),
    homeLogo: document.getElementById("home-logo"),
    homeStartBtn: document.getElementById("home-start-btn"),
    questionBadge: document.getElementById("question-badge"),
    questionText: document.getElementById("question-text"),
    optionsContainer: document.getElementById("options-container"),
    prevBtn: document.getElementById("prev-btn"),
    nextBtn: document.getElementById("next-btn"),
    submitBtn: document.getElementById("submit-btn"),
    resultsTitle: document.getElementById("results-title"),
    scoreValue: document.getElementById("score-value"),
    scoreDetail: document.getElementById("score-detail"),
    restartBtn: document.getElementById("restart-btn"),
    retakeBtn: document.getElementById("retake-btn"),
    continueMasteryBtn: document.getElementById("continue-mastery-btn"),
    reviewPanel: document.getElementById("review-panel"),
    reviewList: document.getElementById("review-list"),
    modalUsername: document.getElementById("modal-username"),
    modalPassword: document.getElementById("modal-password"),
    modalConfirmPassword: document.getElementById("modal-confirm-password"),
    confirmPasswordField: document.getElementById("confirm-password-field"),
    togglePassword: document.getElementById("toggle-password"),
    toggleConfirmPassword: document.getElementById("toggle-confirm-password"),
    modalSubmit: document.getElementById("modal-submit"),
    modalCancel: document.getElementById("modal-cancel"),
    modalTitle: document.getElementById("auth-modal-title"),
    modalMessage: document.getElementById("modal-message"),
    authModal: document.getElementById("auth-modal"),
    loginTrigger: document.getElementById("login-trigger"),
    registerTrigger: document.getElementById("register-trigger"),
    installHelpBtn: document.getElementById("install-help-btn"),
    installModal: document.getElementById("install-modal"),
    installCloseBtn: document.getElementById("install-close-btn"),
    installTabIos: document.getElementById("install-tab-ios"),
    installTabAndroid: document.getElementById("install-tab-android"),
    installIos: document.getElementById("install-ios"),
    installAndroid: document.getElementById("install-android"),
    authLoggedOut: document.getElementById("auth-logged-out"),
    authLoggedIn: document.getElementById("auth-logged-in"),
    authUser: document.getElementById("auth-user"),
    navAvatar: document.getElementById("nav-avatar"),
    profileBtn: document.getElementById("profile-btn"),
    profileModal: document.getElementById("profile-modal"),
    profileAvatarPreview: document.getElementById("profile-avatar-preview"),
    profileUsername: document.getElementById("profile-username"),
    micahBuilder: document.getElementById("avatar-modal-builder"),
    avatarEditBtn: document.getElementById("avatar-edit-btn"),
    avatarModal: document.getElementById("avatar-modal"),
    avatarModalPreview: document.getElementById("avatar-modal-preview-img"),
    avatarModalUsername: document.getElementById("avatar-modal-username"),
    avatarModalClose: document.getElementById("avatar-modal-close"),
    avatarModalRandom: document.getElementById("avatar-modal-random"),
    avatarModalSave: document.getElementById("avatar-modal-save"),
    avatarModalCancel: document.getElementById("avatar-modal-cancel"),
    themePicker: document.getElementById("theme-picker"),
    profileSave: document.getElementById("profile-save"),
    profileCancel: document.getElementById("profile-cancel"),
    profileLogout: document.getElementById("profile-logout"),
    profileMessage: document.getElementById("profile-message"),
    modePractice: document.getElementById("mode-practice"),
    modeMastery: document.getElementById("mode-mastery"),
    modeDescription: document.getElementById("mode-description"),
    countGroup: document.getElementById("count-group"),
    startRow: document.getElementById("start-row"),
    masteryPanel: document.getElementById("mastery-panel"),
    masteryBar: document.getElementById("mastery-bar"),
    masteryText: document.getElementById("mastery-text"),
    masteryStartBtn: document.getElementById("mastery-start-btn"),
    masteryResetBtn: document.getElementById("mastery-reset-btn"),
    masteryMessage: document.getElementById("mastery-message"),
    resultsMasteryProgress: document.getElementById("results-mastery-progress"),
    resultsMasteryBar: document.getElementById("results-mastery-bar"),
    resultsMasteryText: document.getElementById("results-mastery-text"),
    flashcardExamButtons: document.getElementById("flashcard-exam-buttons"),
    flashcardModeQuestion: document.getElementById("flashcard-mode-question"),
    flashcardModeChoices: document.getElementById("flashcard-mode-choices"),
    flashcardModeDescription: document.getElementById("flashcard-mode-description"),
    flashcardPreviewFront: document.getElementById("flashcard-preview-front"),
    flashcardPreviewBack: document.getElementById("flashcard-preview-back"),
    flashcardFilterAll: document.getElementById("flashcard-filter-all"),
    flashcardFilterReview: document.getElementById("flashcard-filter-review"),
    flashcardReviewCount: document.getElementById("flashcard-review-count"),
    flashcardStartBtn: document.getElementById("flashcard-start-btn"),
    flashcardSetupMessage: document.getElementById("flashcard-setup-message"),
    flashcardResumeContainer: document.getElementById("flashcard-resume-container"),
    flashcardResumeText: document.getElementById("flashcard-resume-text"),
    flashcardResumeBtn: document.getElementById("flashcard-resume-btn"),
    flashcardDiscardBtn: document.getElementById("flashcard-discard-btn"),
    flashcardSessionStatus: document.getElementById("flashcard-session-status"),
    flashcardStudyArea: document.getElementById("flashcard-study-area"),
    flashcard: document.getElementById("flashcard"),
    flashcardFrontText: document.getElementById("flashcard-front-text"),
    flashcardFrontImage: document.getElementById("flashcard-front-image"),
    flashcardFrontOptions: document.getElementById("flashcard-front-options"),
    flashcardBackText: document.getElementById("flashcard-back-text"),
    flashcardCounter: document.getElementById("flashcard-counter"),
    flashcardShuffleBtn: document.getElementById("flashcard-shuffle-btn"),
    flashcardFlipBtn: document.getElementById("flashcard-flip-btn"),
    flashcardPrevBtn: document.getElementById("flashcard-prev-btn"),
    flashcardNextBtn: document.getElementById("flashcard-next-btn"),
    flashcardMarkBtn: document.getElementById("flashcard-mark-btn"),
    flashcardReviewBadge: document.getElementById("flashcard-review-badge"),
    flashcardExitBtn: document.getElementById("flashcard-exit-btn"),
};

const DEFAULT_PROFILE = { theme: "ocean", avatar_seed: "me", avatar_style: "micah", avatar_options: {} };
const THEMES = [
    { key: "ocean", label: "Ocean" },
    { key: "midnight", label: "Midnight" },
    { key: "sunset", label: "Sunset" },
    { key: "forest", label: "Forest" },
    { key: "berry", label: "Berry" },
    { key: "bubblegum", label: "Jenelle" },
    { key: "slate", label: "Slate" },
    { key: "coffee", label: "Coffee" },
];

const MICAH_OPTIONS = {
    hair: ["dannyPhantom", "dougFunny", "fonze", "full", "mrClean", "mrT", "pixie", "turban"],
    clothes: ["collared", "crew", "open"],
    mouth: ["frown", "laughing", "nervous", "pucker", "sad", "smile", "smirk", "surprised"],
    eyes: ["eyes", "eyesShadow", "round", "smiling", "smilingShadow"],
    ears: ["attached", "detached"],
    eyebrows: ["down", "eyelashesDown", "eyelashesUp", "up"],
    nose: ["curve", "pointed", "tound"],
    baseColor: "#f9c9b6",
    hairColor: "#000000",
    shirtColor: "#d2eff3",
    glassesColor: "#000000",
    eyesColor: "#000000",
    glasses: false,
    facialHair: false,
    earrings: false,
};

const MICAH_COLORS = [
    "#000000", "#ffffff", "#f9c9b6", "#ac6651", "#77311d", "#92400e",
    "#f4d150", "#57534e", "#d2eff3", "#ef4444", "#3b82f6", "#22c55e",
    "#a855f7", "#ec4899",
];

const MICAH_DEFAULTS = {};
Object.keys(MICAH_OPTIONS).forEach((k) => {
    const v = MICAH_OPTIONS[k];
    MICAH_DEFAULTS[k] = Array.isArray(v) ? v[0] : v;
});

let profileDraft = { ...DEFAULT_PROFILE };
let profileSavedTheme = DEFAULT_PROFILE.theme;
let avatarSnapshot = null;

function getProfile() {
    return { ...DEFAULT_PROFILE, ...state.userProfile };
}

function avatarUrl(seed, style, options = {}, size = null) {
    const s = seed || (state.user ? state.user : "guest");
    const st = style || "bottts";
    const base = `https://api.dicebear.com/10.x/${encodeURIComponent(st)}/svg?seed=${encodeURIComponent(s)}`;
    let url = base;
    if (st === "micah" && options && Object.keys(options).length > 0) {
        const params = [];
        const bools = ["glasses", "facialHair", "earrings"];
        Object.entries(options).forEach(([key, value]) => {
            if (value === undefined || value === null || value === "") return;
            if (bools.includes(key)) {
                const prob = value === true || value === "true" ? 100 : 0;
                params.push(`${encodeURIComponent(key)}Probability=${prob}`);
                return;
            }
            if (key.toLowerCase().endsWith("color")) {
                const color = String(value).replace("#", "");
                params.push(`${encodeURIComponent(key)}=${encodeURIComponent(color)}`);
                return;
            }
            params.push(`${encodeURIComponent(key)}Variant=${encodeURIComponent(value)}`);
        });
        if (params.length) url = `${url}&${params.join("&")}`;
    }
    if (size) url = `${url}&size=${size}`;
    return url;
}

function applyProfileTheme(profile) {
    const theme = profile.theme || "ocean";
    document.documentElement.dataset.theme = theme;
}

function updateNavAvatar() {
    const profile = getProfile();
    els.navAvatar.src = avatarUrl(profile.avatar_seed, profile.avatar_style, profile.avatar_options);
    els.authUser.textContent = state.user || "";
}

function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[name].classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateHeader() {
    document.title = "AnswrIT";
}

function setAuthMessage(text, type = "") {
    els.modalMessage.textContent = text;
    els.modalMessage.className = "auth-message" + (type ? ` ${type}` : "");
}

function setMasteryMessage(text, type = "") {
    els.masteryMessage.textContent = text;
    els.masteryMessage.className = "message" + (type ? ` ${type}` : "");
}

function renderAuthState() {
    if (state.user) {
        els.authLoggedOut.classList.add("hidden");
        els.authLoggedIn.classList.remove("hidden");
        updateNavAvatar();
        els.modalUsername.value = "";
        els.modalPassword.value = "";
    } else {
        els.authLoggedIn.classList.add("hidden");
        els.authLoggedOut.classList.remove("hidden");
        els.authUser.textContent = "";
        state.userProfile = {};
        applyProfileTheme(getProfile());
    }
    renderChatInputState();
    if (state.currentTab === "flashcards" && state.flashcardFilename) {
        updateFlashcardReviewCount();
    }
}

async function checkAuth() {
    try {
        const res = await fetch(API.me, { credentials: "same-origin" });
        const data = await res.json();
        if (data.ok && data.user) {
            state.user = data.user;
            state.userProfile = data.profile || {};
        } else {
            state.user = null;
            state.userProfile = {};
        }
    } catch (err) {
        state.user = null;
        state.userProfile = {};
    }
    applyProfileTheme(getProfile());
    renderAuthState();
    renderAccountPrompt();
    if (state.currentTab === "history") loadHistory();
}

async function login() {
    const username = els.modalUsername.value.trim();
    const password = els.modalPassword.value;
    if (!username || !password) {
        setAuthMessage("Enter a username and password.", "error");
        return;
    }
    els.modalSubmit.disabled = true;
    try {
        const res = await fetch(API.login, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
            credentials: "same-origin",
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "Login failed");
        state.user = data.user;
        state.userProfile = data.profile || {};
        applyProfileTheme(getProfile());
        renderAuthState();
        renderAccountPrompt();
        setAuthMessage("Logged in.", "success");
        closeAuthModal();
        await refreshMastery();
        if (state.currentTab === "history") loadHistory();
    } catch (err) {
        setAuthMessage(err.message, "error");
    } finally {
        els.modalSubmit.disabled = false;
    }
}

async function register() {
    const username = els.modalUsername.value.trim();
    const password = els.modalPassword.value;
    const confirmPassword = els.modalConfirmPassword.value;
    if (!username || !password) {
        setAuthMessage("Enter a username and password.", "error");
        return;
    }
    if (password.length < 4) {
        setAuthMessage("Password must be at least 4 characters.", "error");
        return;
    }
    if (password !== confirmPassword) {
        setAuthMessage("Passwords do not match.", "error");
        return;
    }
    els.modalSubmit.disabled = true;
    try {
        const res = await fetch(API.register, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ username, password }),
            credentials: "same-origin",
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "Sign up failed");
        state.user = data.user;
        state.userProfile = data.profile || {};
        applyProfileTheme(getProfile());
        renderAuthState();
        renderAccountPrompt();
        setAuthMessage("Account created and logged in.", "success");
        closeAuthModal();
        await refreshMastery();
        if (state.currentTab === "history") loadHistory();
    } catch (err) {
        setAuthMessage(err.message, "error");
    } finally {
        els.modalSubmit.disabled = false;
    }
}

function submitAuth() {
    if (state.authModalMode === "login") {
        login();
    } else if (state.authModalMode === "register") {
        register();
    }
}

function openAuthModal(mode) {
    state.authModalMode = mode;
    els.modalUsername.value = "";
    els.modalPassword.value = "";
    els.modalConfirmPassword.value = "";
    els.modalPassword.type = "password";
    els.modalConfirmPassword.type = "password";
    els.togglePassword.textContent = "Show";
    els.toggleConfirmPassword.textContent = "Show";
    setAuthMessage("");
    const isLogin = mode === "login";
    els.modalTitle.textContent = isLogin ? "Log In" : "Sign Up";
    els.modalSubmit.textContent = isLogin ? "Log In" : "Sign Up";
    els.confirmPasswordField.classList.toggle("hidden", isLogin);
    els.authModal.classList.remove("hidden");
    els.modalUsername.focus();
}

function closeAuthModal() {
    els.authModal.classList.add("hidden");
    state.authModalMode = null;
}

function openInstallModal() {
    switchInstallTab("ios");
    els.installModal.classList.remove("hidden");
}

function closeInstallModal() {
    els.installModal.classList.add("hidden");
}

function switchInstallTab(tab) {
    const isIos = tab === "ios";
    els.installTabIos.classList.toggle("active", isIos);
    els.installTabAndroid.classList.toggle("active", !isIos);
    els.installIos.classList.toggle("active", isIos);
    els.installIos.classList.toggle("hidden", !isIos);
    els.installAndroid.classList.toggle("active", !isIos);
    els.installAndroid.classList.toggle("hidden", isIos);
}

function togglePasswordVisibility(input, btn) {
    const showing = input.type === "text";
    input.type = showing ? "password" : "text";
    btn.textContent = showing ? "Show" : "Hide";
}

async function logout() {
    try {
        await fetch(API.logout, {
            method: "POST",
            credentials: "same-origin",
        });
        state.user = null;
        state.userProfile = {};
        state.masterySummary = null;
        applyProfileTheme(getProfile());
        renderAuthState();
        renderAccountPrompt();
        renderMasteryPanel();
        if (state.currentTab === "history") renderHistory();
    } catch (err) {
        // Logout error is silent since the UI already reflects the action.
        console.error("Logout failed", err);
    }
}

function setProfileMessage(text, type = "") {
    els.profileMessage.textContent = text;
    els.profileMessage.className = "auth-message" + (type ? ` ${type}` : "");
}

function getMicahOption(key) {
    const opts = profileDraft.avatar_options || {};
    const raw = opts[key] !== undefined ? opts[key] : MICAH_OPTIONS[key];
    if (["glasses", "facialHair", "earrings"].includes(key)) {
        return raw === true || raw === "true" || raw === "True";
    }
    return Array.isArray(raw) ? raw[0] : raw;
}

function setMicahOption(key, value) {
    profileDraft.avatar_options = { ...(profileDraft.avatar_options || {}), [key]: value };
    updateAvatarPreview();
    updateMicahBuilderActiveStates();
}

function updateAvatarPreview() {
    const url = avatarUrl(profileDraft.avatar_seed, profileDraft.avatar_style, profileDraft.avatar_options);
    if (els.profileAvatarPreview) els.profileAvatarPreview.src = url;
    if (els.avatarModalPreview) els.avatarModalPreview.src = url;
}

function openAvatarModal() {
    if (!els.avatarModal) return;
    avatarSnapshot = {
        seed: profileDraft.avatar_seed,
        style: profileDraft.avatar_style,
        options: { ...(profileDraft.avatar_options || {}) },
    };
    if (els.avatarModalUsername) els.avatarModalUsername.textContent = state.user || "";
    renderMicahBuilder();
    updateAvatarPreview();
    els.avatarModal.classList.remove("hidden");
}

function closeAvatarModal() {
    if (els.avatarModal) els.avatarModal.classList.add("hidden");
}

function saveAvatarModal() {
    closeAvatarModal();
}

function cancelAvatarModal() {
    if (avatarSnapshot) {
        profileDraft.avatar_seed = avatarSnapshot.seed;
        profileDraft.avatar_style = avatarSnapshot.style;
        profileDraft.avatar_options = { ...avatarSnapshot.options };
        updateAvatarPreview();
    }
    closeAvatarModal();
}

function micahOptionUrl(key, value, size = 64) {
    const opts = { ...MICAH_DEFAULTS, [key]: value };
    return avatarUrl("preview", "micah", opts, size);
}

function updateMicahBuilderActiveStates() {
    if (!els.micahBuilder) return;
    Array.from(els.micahBuilder.querySelectorAll("[data-micah-key]")).forEach((btn) => {
        const key = btn.dataset.micahKey;
        const isToggle = btn.dataset.micahToggle === "true";
        const active = isToggle ? getMicahOption(key) : String(getMicahOption(key)) === btn.dataset.micahValue;
        btn.classList.toggle("active", active);
    });
    Array.from(els.micahBuilder.querySelectorAll(".micah-swatch")).forEach((btn) => {
        const key = btn.dataset.micahColor;
        const val = btn.dataset.micahColorValue;
        btn.classList.toggle("active", String(getMicahOption(key)) === val);
    });
}

function renderMicahBuilder() {
    if (!els.micahBuilder) return;
    els.micahBuilder.innerHTML = "";

    const variantSections = [
        { key: "hair", label: "Hair" },
        { key: "clothes", label: "Shirt" },
        { key: "mouth", label: "Mouth" },
        { key: "eyes", label: "Eyes" },
        { key: "ears", label: "Ears" },
        { key: "eyebrows", label: "Eyebrows" },
        { key: "nose", label: "Nose" },
    ];

    variantSections.forEach(({ key, label }) => {
        const row = document.createElement("div");
        row.className = "micah-row";
        const title = document.createElement("div");
        title.className = "micah-row-label";
        title.textContent = label;
        const options = document.createElement("div");
        options.className = "micah-options-row";
        (MICAH_OPTIONS[key] || []).forEach((val) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "micah-option";
            btn.dataset.micahKey = key;
            btn.dataset.micahValue = val;
            btn.title = val.replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase());
            const img = document.createElement("img");
            img.src = micahOptionUrl(key, val);
            img.alt = "";
            img.loading = "lazy";
            btn.appendChild(img);
            btn.addEventListener("click", () => setMicahOption(key, val));
            options.appendChild(btn);
        });
        row.appendChild(title);
        row.appendChild(options);
        els.micahBuilder.appendChild(row);
    });

    const toggleSection = document.createElement("div");
    toggleSection.className = "micah-row";
    const toggleTitle = document.createElement("div");
    toggleTitle.className = "micah-row-label";
    toggleTitle.textContent = "Accessories";
    const toggleOptions = document.createElement("div");
    toggleOptions.className = "micah-options-row";
    const toggleLabels = { glasses: "Glasses", facialHair: "Facial hair", earrings: "Earrings" };
    ["glasses", "facialHair", "earrings"].forEach((key) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "micah-option";
        btn.dataset.micahKey = key;
        btn.dataset.micahValue = "true";
        btn.dataset.micahToggle = "true";
        btn.title = toggleLabels[key];
        const img = document.createElement("img");
        img.src = micahOptionUrl(key, true);
        img.alt = "";
        img.loading = "lazy";
        btn.appendChild(img);
        btn.addEventListener("click", () => setMicahOption(key, !getMicahOption(key)));
        toggleOptions.appendChild(btn);
    });
    toggleSection.appendChild(toggleTitle);
    toggleSection.appendChild(toggleOptions);
    els.micahBuilder.appendChild(toggleSection);

    const colorSection = document.createElement("div");
    colorSection.className = "micah-row";
    const colorTitle = document.createElement("div");
    colorTitle.className = "micah-row-label";
    colorTitle.textContent = "Colors";
    const colorGrid = document.createElement("div");
    colorGrid.className = "micah-colors-grid";
    const colorLabels = {
        baseColor: "Skin",
        hairColor: "Hair",
        shirtColor: "Shirt",
        eyesColor: "Eyes",
        glassesColor: "Glasses",
    };
    Object.keys(colorLabels).forEach((key) => {
        const field = document.createElement("div");
        field.className = "micah-color";
        const lbl = document.createElement("label");
        lbl.textContent = colorLabels[key];
        const swatches = document.createElement("div");
        swatches.className = "micah-swatches";
        swatches.dataset.micahColorKey = key;
        MICAH_COLORS.forEach((color) => {
            const btn = document.createElement("button");
            btn.type = "button";
            btn.className = "micah-swatch";
            btn.style.backgroundColor = color;
            btn.dataset.micahColor = key;
            btn.dataset.micahColorValue = color;
            btn.title = color;
            btn.addEventListener("click", () => setMicahOption(key, color));
            swatches.appendChild(btn);
        });
        field.appendChild(lbl);
        field.appendChild(swatches);
        colorGrid.appendChild(field);
    });
    colorSection.appendChild(colorTitle);
    colorSection.appendChild(colorGrid);
    els.micahBuilder.appendChild(colorSection);

    updateMicahBuilderActiveStates();
}

function renderThemePicker(selectedKey) {
    els.themePicker.innerHTML = "";
    THEMES.forEach((theme) => {
        const btn = document.createElement("button");
        btn.className = "theme-option" + (theme.key === selectedKey ? " active" : "");
        btn.type = "button";
        btn.textContent = theme.label;
        btn.dataset.theme = theme.key;
        btn.title = theme.label;
        btn.addEventListener("click", () => {
            profileDraft.theme = theme.key;
            renderThemePicker(theme.key);
            applyProfileTheme(profileDraft);
        });
        els.themePicker.appendChild(btn);
    });
}

function randomMicahOptions() {
    const opts = {};
    ["hair", "clothes", "mouth", "eyes", "ears", "eyebrows", "nose"].forEach((key) => {
        const arr = MICAH_OPTIONS[key];
        opts[key] = arr[Math.floor(Math.random() * arr.length)];
    });
    ["glasses", "facialHair", "earrings"].forEach((key) => {
        opts[key] = Math.random() > 0.5;
    });
    ["baseColor", "hairColor", "shirtColor", "eyesColor", "glassesColor"].forEach((key) => {
        opts[key] = MICAH_COLORS[Math.floor(Math.random() * MICAH_COLORS.length)];
    });
    return opts;
}

function randomAvatar() {
    profileDraft.avatar_seed = Math.random().toString(36).slice(2, 10);
    profileDraft.avatar_style = "micah";
    profileDraft.avatar_options = randomMicahOptions();
    renderMicahBuilder();
    updateAvatarPreview();
}

function openProfileModal() {
    profileDraft = { ...getProfile(), avatar_style: "micah" };
    const opts = { ...(profileDraft.avatar_options || {}) };
    if (opts.skinColor !== undefined && opts.baseColor === undefined) {
        opts.baseColor = opts.skinColor;
    }
    ["skinColor", "mouthColor", "eyeShadowColor", "eyebrowsColor", "facialHairColor", "earringColor"].forEach((key) => {
        delete opts[key];
    });
    profileDraft.avatar_options = opts;
    profileSavedTheme = profileDraft.theme;
    els.profileUsername.textContent = state.user || "";
    updateAvatarPreview();
    renderThemePicker(profileDraft.theme);
    setProfileMessage("");
    els.profileModal.classList.remove("hidden");
}

function closeProfileModal() {
    els.profileModal.classList.add("hidden");
}

function cancelProfile() {
    applyProfileTheme({ theme: profileSavedTheme });
    closeProfileModal();
}

async function saveProfile() {
    try {
        const res = await fetch(API.profile, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(profileDraft),
            credentials: "same-origin",
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "Could not save profile");
        state.userProfile = { ...profileDraft };
        applyProfileTheme(state.userProfile);
        updateNavAvatar();
        updateChatAvatars({});
        closeProfileModal();
        if (state.currentTab === "community") {
            loadChat();
            loadChatAvatars();
        }
    } catch (err) {
        setProfileMessage(err.message, "error");
    }
}

function renderAccountPrompt() {
    if (els.accountPrompt) {
        els.accountPrompt.classList.toggle("hidden", !!state.user);
    }
}

function setMessage(text, type = "") {
    els.setupMessage.textContent = text;
    els.setupMessage.className = "message" + (type ? ` ${type}` : "");
}

function setAvailableCount(count) {
    els.totalQuestions.textContent = `${count} available`;
    els.totalQuestions.dataset.count = String(count);
    els.questionCount.max = Math.max(count, 1);
    els.startBtn.disabled = count === 0;
}

function renderSkeletonExams(container) {
    container.innerHTML = "";
    for (let i = 0; i < 6; i++) {
        const div = document.createElement("div");
        div.className = "btn-exam skeleton";
        div.innerHTML = '<span class="exam-name skeleton-text">&nbsp;</span><span class="exam-count skeleton-text">&nbsp;</span>';
        container.appendChild(div);
    }
}

function renderSkeletonChat(container) {
    container.innerHTML = "";
    for (let i = 0; i < 3; i++) {
        const div = document.createElement("div");
        div.className = "chat-message skeleton";
        div.innerHTML = '<div class="chat-message-header"><span class="chat-username skeleton-text">&nbsp;</span><span class="chat-time skeleton-text">&nbsp;</span></div><div class="chat-text skeleton-text">&nbsp;</div>';
        container.appendChild(div);
    }
}

async function loadExams() {
    renderSkeletonExams(els.examButtons);
    renderSkeletonExams(els.flashcardExamButtons);
    try {
        const res = await fetch(API.exams);
        if (!res.ok) throw new Error("Failed to load exam list");
        const data = await res.json();
        state.exams = data.exams || [];
        renderExamButtons();
        const prefs = loadPrefs();
        if (prefs.flashcardFilename && state.exams.find((e) => e.filename === prefs.flashcardFilename)) {
            state.flashcardFilename = prefs.flashcardFilename;
        }
        state._restoringPrefs = true;
        if (prefs.flashcardMode) setFlashcardMode(prefs.flashcardMode);
        if (prefs.flashcardFilter) setFlashcardFilter(prefs.flashcardFilter);
        state._restoringPrefs = false;
        renderFlashcardExamButtons();
        updateFlashcardSteps();
        await renderFlashcardResume();
        if (state.exams.length > 0) {
            const current = (prefs.examFilename && state.exams.find((e) => e.filename === prefs.examFilename))
                ? prefs.examFilename
                : (data.current_filename || state.exams[0].filename);
            await loadExam(current, true);
        } else {
            setMessage("No pre-scraped exams found.", "error");
            setAvailableCount(0);
        }
    } catch (err) {
        setMessage(err.message, "error");
        els.examButtons.innerHTML = '<p class="empty-state">Error loading exams.</p>';
        setAvailableCount(0);
    }
}

function renderExamButtons() {
    els.examButtons.innerHTML = "";
    if (!state.exams.length) {
        els.examButtons.innerHTML = '<p class="empty-state">No exams found.</p>';
        return;
    }
    state.exams.forEach((exam) => {
        const btn = document.createElement("button");
        btn.className = "btn btn-exam";
        btn.dataset.filename = exam.filename;
        btn.innerHTML = `<span class="exam-name">${exam.display_name || exam.title}</span><span class="exam-count">${exam.count} questions</span>`;
        btn.addEventListener("click", () => loadExam(exam.filename, true));
        els.examButtons.appendChild(btn);
    });
}

function updateExamButtonSelection(filename) {
    Array.from(els.examButtons.children).forEach((btn) => {
        btn.classList.toggle("active", btn.dataset.filename === filename);
    });
}

async function loadExam(filename, updateSelection = true) {
    const examMeta = state.exams.find((e) => e.filename === filename);
    if (!examMeta) return;
    setMessage(`Loading ${examMeta.display_name || examMeta.title}…`);
    try {
        const res = await fetch(API.load, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename }),
            credentials: "same-origin",
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "Failed to load exam");
        state.title = data.title;
        state.url = data.url;
        state.currentFilename = data.filename;
        state.allQuestions = data.questions || [];
        updateHeader();
        if (updateSelection) updateExamButtonSelection(filename);
        setAvailableCount(data.count);
        const requested = parseInt(els.questionCount.value, 10) || 20;
        els.questionCount.value = Math.min(requested, data.count);
        setMessage("Ready to start.");
        savePrefs();
        updatePracticeSteps();
        await refreshMastery();
    } catch (err) {
        setMessage(err.message, "error");
        setAvailableCount(0);
    }
}

function setMode(mode) {
    state.mode = mode;
    if (mode === "practice") {
        els.modePractice.classList.add("active", "btn-primary");
        els.modePractice.classList.remove("btn-secondary");
        els.modeMastery.classList.remove("active", "btn-primary");
        els.modeMastery.classList.add("btn-secondary");
        els.modeDescription.textContent = "Random questions each test. Great for quick review.";
        els.countGroup.classList.remove("hidden");
        document.getElementById("timer-group").classList.remove("hidden");
        els.startRow.classList.remove("hidden");
        els.masteryPanel.classList.add("hidden");
        els.startBtn.textContent = "Start Test";
    } else {
        els.modeMastery.classList.add("active", "btn-primary");
        els.modeMastery.classList.remove("btn-secondary");
        els.modePractice.classList.remove("active", "btn-primary");
        els.modePractice.classList.add("btn-secondary");
        els.modeDescription.textContent = "Keep seeing questions until you've mastered every single one.";
        els.countGroup.classList.add("hidden");
        document.getElementById("timer-group").classList.add("hidden");
        els.startRow.classList.add("hidden");
        els.masteryPanel.classList.remove("hidden");
        renderMasteryPanel();
    }
}

function renderMasteryPanel() {
    const summary = state.masterySummary;
    if (!state.user) {
        els.masteryText.textContent = "Log in to track mastery progress.";
        els.masteryBar.style.width = "0%";
        els.masteryStartBtn.disabled = true;
        els.masteryResetBtn.disabled = true;
        return;
    }
    if (!summary) {
        els.masteryText.textContent = "Select an exam to load mastery progress.";
        els.masteryBar.style.width = "0%";
        els.masteryStartBtn.disabled = true;
        els.masteryResetBtn.disabled = true;
        return;
    }
    const { mastered, total, remaining } = summary;
    els.masteryText.textContent = `Mastered ${mastered} of ${total} questions (${remaining} remaining).`;
    els.masteryBar.style.width = `${summary.progress}%`;
    els.masteryStartBtn.disabled = total === 0;
    els.masteryResetBtn.disabled = total === 0;
    if (mastered === total && total > 0) {
        els.masteryStartBtn.textContent = "Exam Mastered!";
        els.masteryStartBtn.disabled = true;
    } else {
        els.masteryStartBtn.textContent = "Start Mastery Session";
        els.masteryStartBtn.disabled = false;
    }
}

function renderResultsMasteryPanel() {
    const summary = state.masterySummary;
    if (state.mode !== "mastery" || !summary) {
        els.resultsMasteryProgress.classList.add("hidden");
        els.continueMasteryBtn.classList.add("hidden");
        return;
    }
    els.resultsMasteryProgress.classList.remove("hidden");
    const { mastered, total, remaining } = summary;
    els.resultsMasteryText.textContent = `Overall mastery: ${mastered}/${total} (${remaining} remaining).`;
    els.resultsMasteryBar.style.width = `${summary.progress}%`;
    if (mastered === total && total > 0) {
        els.scoreValue.textContent = "100%";
        els.resultsTitle.textContent = "Exam Mastered!";
        els.scoreDetail.textContent = `You have mastered all ${total} questions. Congrats!`;
        els.continueMasteryBtn.classList.add("hidden");
    } else {
        els.continueMasteryBtn.classList.remove("hidden");
    }
}

async function refreshMastery() {
    if (!state.user || !state.currentFilename) {
        state.masterySummary = null;
        renderMasteryPanel();
        return;
    }
    try {
        const res = await fetch(
            `${API.mastery}?filename=${encodeURIComponent(state.currentFilename)}`,
            { credentials: "same-origin", cache: "no-store" }
        );
        const data = await res.json();
        if (data.ok) {
            state.masterySummary = data.summary;
            renderMasteryPanel();
        }
    } catch (err) {
        // ignore
    }
}

async function startMasterySession() {
    if (!state.user || !state.currentFilename) return;
    els.masteryStartBtn.disabled = true;
    setMasteryMessage("Loading mastery batch…");
    try {
        const res = await fetch(
            `${API.masteryBatch}?n=20&filename=${encodeURIComponent(state.currentFilename)}`,
            { credentials: "same-origin", cache: "no-store" }
        );
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "Could not load mastery batch");
        if (data.summary.mastered === data.summary.total && data.summary.total > 0) {
            state.masterySummary = data.summary;
            renderMasteryPanel();
            setMasteryMessage("All questions mastered! Great job.", "success");
            return;
        }
        state.testQuestions = data.quiz;
        state.lastTestQuestions = [...data.quiz];
        state.answers = {};
        state.lastSavedAnswers = {};
        state.testQuestions.forEach((q) => {
            state.answers[q.id] = q.type === "matching" ? {} : [];
        });
        state.currentIndex = 0;
        state.secondsElapsed = 0;
        state.multiSelect = false;
        showScreen("quiz");
        els.timer.style.display = "none";
        stopTimer();
        renderQuestion();
    } catch (err) {
        setMasteryMessage(err.message, "error");
    } finally {
        els.masteryStartBtn.disabled = false;
    }
}

async function submitMastery() {
    stopTimer();
    if (!state.user || !state.currentFilename) return;

    // Flush any pending answer save so the last question isn't lost.
    clearTimeout(masterySaveTimeout);
    const currentQ = state.testQuestions[state.currentIndex];
    if (currentQ) {
        const current = state.answers[currentQ.id];
        const saved = state.lastSavedAnswers[currentQ.id];
        const same = JSON.stringify(current) === JSON.stringify(saved);
        const hasAnswer = Array.isArray(current)
            ? current.length > 0
            : current && typeof current === "object" && Object.keys(current).length > 0;
        if (hasAnswer && !same) {
            await saveMasteryAnswer(currentQ.id);
        }
    }

    try {
        await refreshMastery();
        const results = computeResults(state.testQuestions, state.answers);
        const correct = results.filter((r) => r.is_correct).length;
        showResults({
            title: state.title,
            total: results.length,
            correct,
            score: results.length ? Math.round((correct / results.length) * 100) : 0,
            results,
        });
        renderResultsMasteryPanel();
    } catch (err) {
        alert(err.message);
    }
}

function isMatchingCorrect(q, answer) {
    const correctPairs = q.correct_pairs || {};
    if (!answer || typeof answer !== "object" || Array.isArray(answer)) {
        return false;
    }
    for (const [term, definition] of Object.entries(correctPairs)) {
        if (answer[term] !== definition) {
            return false;
        }
    }
    return Object.keys(correctPairs).length > 0;
}

function computeResults(quiz, answers) {
    return quiz.map((q) => {
        const selected = answers[q.id];
        let isCorrect;
        let selectedDisplay;
        let correctDisplay;

        if (q.type === "matching") {
            isCorrect = isMatchingCorrect(q, selected);
            selectedDisplay = selected && typeof selected === "object" && !Array.isArray(selected) ? { ...selected } : {};
            correctDisplay = q.correct_pairs || {};
        } else {
            const correctKey = q.correct_answer || q._correct_answer || "";
            const correctSet = new Set(correctKey.split("|").map((a) => a.trim()));
            const selectedArray = Array.isArray(selected) ? selected : [];
            const selectedSet = new Set(selectedArray.map((s) => s.trim()));
            isCorrect = correctSet.size === selectedSet.size && [...correctSet].every((c) => selectedSet.has(c));
            selectedDisplay = Array.from(selectedSet);
            correctDisplay = Array.from(correctSet);
        }

        const result = {
            id: q.id,
            question: q.question,
            options: q.options || [],
            selected: selectedDisplay,
            correct_answer: correctDisplay,
            is_correct: isCorrect,
        };
        if (q.type === "matching") {
            result.type = q.type;
            result.terms = q.terms;
            result.correct_pairs = q.correct_pairs;
        }
        return result;
    });
}

async function resetMastery() {
    if (!state.user || !state.currentFilename) return;
    if (!confirm("Reset all mastery progress for this exam? This cannot be undone.")) return;
    try {
        const res = await fetch(API.masteryReset, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: state.currentFilename }),
            credentials: "same-origin",
        });
        const data = await res.json();
        if (data.ok) {
            state.masterySummary = data.summary;
            renderMasteryPanel();
            setMasteryMessage("Mastery progress reset.", "success");
        }
    } catch (err) {
        setMasteryMessage("Reset failed.", "error");
    }
}

function generateLocalQuiz(n) {
    const questions = state.allQuestions;
    const count = Math.max(1, Math.min(n, questions.length || 1));
    const shuffled = [...questions].sort(() => 0.5 - Math.random());
    const selected = shuffled.slice(0, count);
    return selected.map((q) => ({
        id: q.id,
        question: q.question,
        options: q.options,
        _correct_answer: q.correct_answer,
        type: q.type,
        terms: q.terms,
        definitions: q.definitions,
        correct_pairs: q.correct_pairs,
        image: q.image,
    }));
}

async function startTest() {
    const total = parseInt(els.totalQuestions.dataset.count || "0") || state.allQuestions.length || 0;
    const requested = parseInt(els.questionCount.value, 10) || 10;
    const n = Math.max(1, Math.min(requested, total || 1));
    const filename = state.currentFilename || "";

    try {
        const res = await fetch(`${API.test}?n=${n}&filename=${encodeURIComponent(filename)}`, { cache: "no-store" });
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Could not generate test");
        }
        const data = await res.json();
        state.testQuestions = data.quiz;
        state.lastTestQuestions = [...data.quiz];
        if (data.title) state.title = data.title;
        updateHeader();
    } catch (err) {
        if (state.allQuestions.length) {
            state.testQuestions = generateLocalQuiz(n);
            state.lastTestQuestions = [...state.testQuestions];
            updateHeader();
        } else {
            setMessage(err.message, "error");
            return;
        }
    }

    state.answers = {};
    state.testQuestions.forEach((q) => {
        state.answers[q.id] = q.type === "matching" ? {} : [];
    });
    state.currentIndex = 0;
    state.secondsElapsed = 0;
    state.multiSelect = false;
    showScreen("quiz");
    els.timer.style.display = "";
    startTimer();
    renderQuestion();
}

let _toastTimeout = null;
function showToast(msg, type = "", duration = 4000) {
    const toast = document.getElementById("toast");
    if (!toast) return;
    toast.textContent = msg;
    toast.className = "toast" + (type ? ` ${type}` : "");
    clearTimeout(_toastTimeout);
    _toastTimeout = setTimeout(() => { toast.classList.add("hidden"); }, duration);
}

function startTimer() {
    clearInterval(state.timerInterval);
    const limitMins = els.timerDuration ? parseInt(els.timerDuration.value, 10) : 0;
    state.timerLimitSeconds = limitMins > 0 ? limitMins * 60 : 0;
    state.secondsElapsed = 0;
    state.fiveMinWarned = false;
    els.timer.classList.remove("timer-warning");

    if (state.timerLimitSeconds > 0) {
        const update = () => {
            const remaining = state.timerLimitSeconds - state.secondsElapsed;
            const m = String(Math.floor(remaining / 60)).padStart(2, "0");
            const s = String(remaining % 60).padStart(2, "0");
            els.timer.textContent = `${m}:${s}`;

            if (remaining <= 300) {
                els.timer.classList.add("timer-warning");
                if (!state.fiveMinWarned && state.timerLimitSeconds > 300) {
                    state.fiveMinWarned = true;
                    showToast("⏰ 5 minutes remaining!", "warning", 6000);
                }
            }

            if (remaining <= 0) {
                stopTimer();
                showToast("⏱ Time's up! Submitting your test…", "warning", 5000);
                setTimeout(() => els.submitBtn.click(), 1200);
            }
        };
        update();
        state.timerInterval = setInterval(() => {
            state.secondsElapsed += 1;
            update();
        }, 1000);
    } else {
        els.timer.textContent = "00:00";
        state.timerInterval = setInterval(() => {
            state.secondsElapsed += 1;
            const m = String(Math.floor(state.secondsElapsed / 60)).padStart(2, "0");
            const s = String(state.secondsElapsed % 60).padStart(2, "0");
            els.timer.textContent = `${m}:${s}`;
        }, 1000);
    }
}

function stopTimer() {
    clearInterval(state.timerInterval);
    els.timer.classList.remove("timer-warning");
}

function goHome() {
    const onQuiz = screens.quiz.classList.contains("active");
    if (onQuiz && !confirm("Leave this test? Unsubmitted answers won't be saved.")) {
        return;
    }
    stopTimer();
    state.testQuestions = [];
    state.answers = {};
    state.currentIndex = 0;
    state.secondsElapsed = 0;
    state.mode = "practice";
    setMode("practice");
    state.currentTab = "home";
    try { localStorage.setItem(TAB_KEY, "home"); } catch (e) {}
    els.tabHome.classList.add("active");
    els.tabPractice.classList.remove("active");
    els.tabFlashcards.classList.remove("active");
    els.tabHistory.classList.remove("active");
    els.tabCommunity.classList.remove("active");
    if (els.tabNav) els.tabNav.classList.add("hidden");
    showScreen("home");
}

const TAB_KEY = "answrit_active_tab";
const PREFS_KEY = "answrit_prefs";

function savePrefs() {
    if (state._restoringPrefs) return;
    try {
        localStorage.setItem(PREFS_KEY, JSON.stringify({
            examFilename: state.currentFilename,
            flashcardFilename: state.flashcardFilename,
            flashcardMode: state.flashcardMode,
            flashcardFilter: state.flashcardFilter,
        }));
    } catch (e) {}
}

function loadPrefs() {
    try {
        const raw = localStorage.getItem(PREFS_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
}

function switchTab(tabName) {
    if (state.currentTab === tabName) return;
    try { localStorage.setItem(TAB_KEY, tabName); } catch (e) {}
    if (screens.quiz.classList.contains("active")) {
        if (!confirm("Leave this test? Unsubmitted answers won't be saved.")) return;
    }
    if (screens.results.classList.contains("active")) {
        state.answers = {};
        state.currentIndex = 0;
        state.secondsElapsed = 0;
        stopTimer();
    }
    state.currentTab = tabName;
    els.tabHome.classList.toggle("active", tabName === "home");
    els.tabPractice.classList.toggle("active", tabName === "practice");
    els.tabFlashcards.classList.toggle("active", tabName === "flashcards");
    els.tabHistory.classList.toggle("active", tabName === "history");
    els.tabCommunity.classList.toggle("active", tabName === "community");
    if (els.tabNav) els.tabNav.classList.toggle("hidden", tabName === "home");
    stopChatPolling();
    if (tabName === "home") {
        showScreen("home");
    } else if (tabName === "practice") {
        showScreen("setup");
    } else if (tabName === "history") {
        showScreen("history");
        loadHistory();
    } else if (tabName === "community") {
        showScreen("community");
        loadChat();
        loadChatAvatars();
        startChatPolling();
    } else if (tabName === "flashcards") {
        showScreen("flashcards");
        renderFlashcardExamButtons();
        renderFlashcardResume();
    }
}

async function loadHistory() {
    if (!state.user) {
        state.historyAttempts = [];
        renderHistory();
        return;
    }
    try {
        const res = await fetch(API.history, { credentials: "same-origin", cache: "no-store" });
        const data = await res.json();
        state.historyAttempts = res.ok && data.ok ? data.attempts || [] : [];
    } catch (err) {
        state.historyAttempts = [];
    }
    renderHistory();
}

function renderHistory() {
    const loggedIn = !!state.user;
    els.historyLoginPrompt.classList.toggle("hidden", loggedIn);
    els.historyContent.classList.toggle("hidden", !loggedIn);
    if (!loggedIn) return;

    const attempts = state.historyAttempts;
    els.historyTestsTaken.textContent = attempts.length;
    if (!attempts.length) {
        els.historyAverageScore.textContent = "—";
        els.historyRecentScore.textContent = "—";
        els.historyList.innerHTML = '<div class="card history-empty"><h3>No completed practice tests yet</h3><p>Finish a practice test and it will appear here for review or an exact retake.</p></div>';
        return;
    }

    const scores = attempts.map((attempt) => Number(attempt.score) || 0);
    els.historyAverageScore.textContent = `${Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length)}%`;
    els.historyRecentScore.textContent = `${scores[0]}%`;
    els.historyList.innerHTML = "";
    attempts.forEach((attempt) => {
        const item = document.createElement("article");
        item.className = "card history-item";
        const completed = new Date(attempt.completed_at);
        const dateText = Number.isNaN(completed.getTime()) ? "Completed test" : completed.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
        const timerText = attempt.timer_minutes ? `${attempt.timer_minutes} min limit` : "No time limit";
        item.innerHTML = `
            <div class="history-item-main">
                <h3>${escapeHtml(attempt.title)}</h3>
                <p>${dateText} · ${attempt.total} questions · ${timerText}</p>
            </div>
            <div class="history-item-score"><strong>${attempt.score}%</strong><span>${attempt.correct} / ${attempt.total} correct · ${formatTime(attempt.duration_seconds || 0)}</span></div>
            <div class="history-item-actions">
                <button class="btn btn-secondary btn-small">Review Results</button>
                <button class="btn btn-primary btn-small">Retake This Test</button>
            </div>`;
        const [reviewBtn, retakeBtn] = item.querySelectorAll("button");
        reviewBtn.addEventListener("click", () => reviewHistoryAttempt(attempt));
        retakeBtn.addEventListener("click", () => retakeHistoryAttempt(attempt));
        els.historyList.appendChild(item);
    });
}

function reviewHistoryAttempt(attempt) {
    state.mode = "practice";
    state.currentFilename = attempt.filename;
    state.title = attempt.title;
    state.lastTestQuestions = attempt.quiz || [];
    state.testQuestions = attempt.quiz || [];
    state.answers = attempt.answers || {};
    state.secondsElapsed = attempt.duration_seconds || 0;
    showResults({ ...attempt, duration_seconds: attempt.duration_seconds || 0 });
}

function retakeHistoryAttempt(attempt) {
    if (!attempt.quiz || !attempt.quiz.length) return;
    state.mode = "practice";
    state.currentFilename = attempt.filename;
    state.title = attempt.title;
    state.lastTestQuestions = [...attempt.quiz];
    if (els.timerDuration) els.timerDuration.value = String(attempt.timer_minutes || 0);
    retakeSameTest();
}

async function saveHistoryAttempt(data, answers) {
    if (!state.user || state.mode !== "practice") return;
    try {
        const timerMinutes = els.timerDuration ? parseInt(els.timerDuration.value, 10) || 0 : 0;
        const res = await fetch(API.history, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
                filename: state.currentFilename,
                title: data.title || state.title || "Practice Test",
                quiz: state.testQuestions,
                answers,
                results: data.results,
                total: data.total,
                correct: data.correct,
                score: data.score,
                duration_seconds: state.secondsElapsed,
                timer_minutes: timerMinutes,
            }),
        });
        if (res.ok && state.currentTab === "history") loadHistory();
    } catch (err) {}
}

let chatPollInterval = null;
let chatAvatarPollInterval = null;

function chatMessagesKey(messages) {
    return messages.map((m) => `${m.timestamp}|${m.username}|${m.message}`).join("\n");
}

async function loadChat() {
    if (!els.chatMessages.querySelector(".chat-message:not(.skeleton)")) {
        renderSkeletonChat(els.chatMessages);
    }
    try {
        const res = await fetch(API.chatMessages, { credentials: "same-origin" });
        if (!res.ok) throw new Error("Could not load chat");
        const data = await res.json();
        const messages = data.messages || [];
        if (chatMessagesKey(messages) !== state.chatMessagesKey) {
            renderChat(messages);
        }
    } catch (err) {
        renderChat([]);
    }
}

function renderChat(messages) {
    els.chatMessages.innerHTML = "";
    state.chatMessages = messages;
    state.chatMessagesKey = chatMessagesKey(messages);
    if (!messages.length) {
        els.chatMessages.innerHTML = `<p class="empty-state">No messages yet. Be the first to say hello!</p>`;
    } else {
        messages.forEach((msg) => {
            const el = document.createElement("div");
            el.className = "chat-message" + (msg.username === state.user ? " chat-message-own" : "");
            el.dataset.username = msg.username;
            el.dataset.timestamp = msg.timestamp;
            const time = new Date(msg.timestamp).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
            });
            const isOwn = msg.username === state.user;
            const profile = isOwn ? getProfile() : msg;
            const avatarUrlSrc = avatarUrl(
                profile.avatar_seed || msg.username,
                profile.avatar_style || "micah",
                profile.avatar_options || {}
            );
            el.innerHTML = `
                <img src="${escapeHtml(avatarUrlSrc)}" alt="" class="chat-avatar" loading="lazy" />
                <div class="chat-message-content">
                    <div class="chat-message-header">
                        <span class="chat-username">${escapeHtml(msg.username)}</span>
                        <span class="chat-time">${escapeHtml(time)}</span>
                    </div>
                    <div class="chat-text">${escapeHtml(msg.message)}</div>
                </div>
            `;
            els.chatMessages.appendChild(el);
        });
    }
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
    renderChatInputState();
}

function updateChatAvatars(avatars) {
    if (!els.chatMessages) return;
    const ownProfile = state.user ? getProfile() : null;
    Array.from(els.chatMessages.querySelectorAll(".chat-message")).forEach((el) => {
        const username = el.dataset.username;
        const img = el.querySelector(".chat-avatar");
        if (!username || !img) return;
        let profile;
        if (username === state.user && ownProfile) {
            profile = ownProfile;
        } else if (avatars && avatars[username]) {
            profile = avatars[username];
        } else {
            return;
        }
        const src = avatarUrl(
            profile.avatar_seed || username,
            profile.avatar_style || "micah",
            profile.avatar_options || {}
        );
        if (img.src !== src) img.src = src;
    });
}

async function loadChatAvatars() {
    if (state.currentTab !== "community") return;
    try {
        const res = await fetch(API.chatAvatars, { credentials: "same-origin" });
        if (!res.ok) throw new Error("Could not load chat avatars");
        const data = await res.json();
        updateChatAvatars(data.avatars || {});
    } catch (err) {}
}

function escapeHtml(text) {
    if (text == null) return "";
    return String(text)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function renderChatInputState() {
    if (state.user) {
        els.chatLoginPrompt.classList.add("hidden");
        els.chatInputRow.classList.remove("hidden");
    } else {
        els.chatLoginPrompt.classList.remove("hidden");
        els.chatInputRow.classList.add("hidden");
    }
}

async function sendChatMessage() {
    if (!state.user) return;
    const message = els.chatInput.value.trim();
    if (!message) return;
    try {
        const res = await fetch(API.chatMessage, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ message }),
            credentials: "same-origin",
        });
        if (!res.ok) throw new Error("Could not send message");
        els.chatInput.value = "";
        await loadChat();
    } catch (err) {
        alert(err.message);
    }
}

function startChatPolling() {
    stopChatPolling();
    chatPollInterval = setInterval(loadChat, 3000);
    chatAvatarPollInterval = setInterval(loadChatAvatars, 1500);
}

function stopChatPolling() {
    if (chatPollInterval) {
        clearInterval(chatPollInterval);
        chatPollInterval = null;
    }
    if (chatAvatarPollInterval) {
        clearInterval(chatAvatarPollInterval);
        chatAvatarPollInterval = null;
    }
}

function renderFlashcardExamButtons() {
    if (!state.exams.length) {
        els.flashcardExamButtons.innerHTML = `<p class="empty-state">No exams loaded yet.</p>`;
        return;
    }
    els.flashcardExamButtons.innerHTML = "";
    state.exams.forEach((exam) => {
        const btn = document.createElement("button");
        btn.className = "btn btn-exam" + (state.flashcardFilename === exam.filename ? " active" : "");
        btn.innerHTML = `
            <span class="exam-name">${escapeHtml(exam.display_name || exam.title || exam.filename)}</span>
            <span class="exam-count">${exam.count || 0} questions</span>
        `;
        btn.addEventListener("click", () => selectFlashcardExam(exam.filename));
        els.flashcardExamButtons.appendChild(btn);
    });
    els.flashcardStartBtn.disabled = !state.flashcardFilename;
}

function selectFlashcardExam(filename) {
    state.flashcardFilename = filename;
    renderFlashcardExamButtons();
    updateFlashcardReviewCount();
    els.flashcardSetupMessage.textContent = "";
    savePrefs();
    updateFlashcardSteps();
}

function setFlashcardMode(mode) {
    state.flashcardMode = mode;
    els.flashcardModeQuestion.classList.toggle("active", mode === "question");
    els.flashcardModeQuestion.classList.toggle("btn-primary", mode === "question");
    els.flashcardModeQuestion.classList.toggle("btn-secondary", mode !== "question");
    els.flashcardModeChoices.classList.toggle("active", mode === "choices");
    els.flashcardModeChoices.classList.toggle("btn-primary", mode === "choices");
    els.flashcardModeChoices.classList.toggle("btn-secondary", mode !== "choices");

    if (mode === "question") {
        els.flashcardModeDescription.textContent = "Front shows just the question. Flip to see the answer.";
        els.flashcardPreviewFront.textContent = "What is the loopback IP address?";
        els.flashcardPreviewBack.textContent = "127.0.0.1";
    } else {
        els.flashcardModeDescription.textContent = "Front shows the question and answer choices. Flip to reveal the correct answer.";
        els.flashcardPreviewFront.innerHTML = "What is the loopback IP address?<br><br>A. 192.168.1.1<br>B. 10.0.0.1<br>C. 127.0.0.1";
        els.flashcardPreviewBack.textContent = "C. 127.0.0.1";
    }
    saveFlashcardSession();
    savePrefs();
}

async function startFlashcards() {
    if (!state.flashcardFilename) {
        els.flashcardSetupMessage.textContent = "Select an exam first.";
        return;
    }
    clearFlashcardSession();
    try {
        const [questionsRes, reviewsRes] = await Promise.all([
            fetch(API.examQuestions, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ filename: state.flashcardFilename }),
                credentials: "same-origin",
            }),
            state.user
                ? fetch(`${API.flashcardReviews}?filename=${encodeURIComponent(state.flashcardFilename)}`, {
                      credentials: "same-origin",
                  }).catch(() => null)
                : Promise.resolve(null),
        ]);
        const data = await questionsRes.json();
        if (!data.ok || !data.questions || !data.questions.length) {
            els.flashcardSetupMessage.textContent = data.error || "Could not load questions.";
            return;
        }

        let allQuestions = [...data.questions];
        state.flashcardReviews = new Set();
        if (reviewsRes && reviewsRes.ok) {
            const reviewData = await reviewsRes.json();
            if (reviewData.ok) {
                state.flashcardReviews = new Set(reviewData.reviews.map(String));
            }
        }

        if (state.flashcardFilter === "review") {
            allQuestions = allQuestions.filter((q) => state.flashcardReviews.has(String(q.id)));
            if (!allQuestions.length) {
                els.flashcardSetupMessage.textContent = "No cards marked for review yet.";
                return;
            }
        }

        state.flashcardQuestions = allQuestions;
        state.flashcardIndex = 0;
        state.flashcardFlipped = false;
        showFlashcardStudyArea();
        renderFlashcard();
        saveFlashcardSession();
    } catch (err) {
        els.flashcardSetupMessage.textContent = "Failed to load flashcards.";
    }
}

function showFlashcardStudyArea() {
    document.querySelector("#flashcards-screen .setup-grid").classList.add("hidden");
    els.flashcardStudyArea.classList.remove("hidden");
}

function showFlashcardSetup() {
    document.querySelector("#flashcards-screen .setup-grid").classList.remove("hidden");
    els.flashcardStudyArea.classList.add("hidden");
    state.flashcardQuestions = [];
    state.flashcardIndex = 0;
    state.flashcardFlipped = false;
    els.flashcardSetupMessage.textContent = "";
    renderFlashcardResume();
}

const FLASHCARD_SESSION_KEY = "answrit_flashcard_session";

function saveFlashcardSession() {
    if (state._restoringPrefs) return;
    if (!state.flashcardQuestions.length) return;
    const session = {
        filename: state.flashcardFilename,
        mode: state.flashcardMode,
        filter: state.flashcardFilter,
        questions: state.flashcardQuestions,
        index: state.flashcardIndex,
        flipped: state.flashcardFlipped,
        reviews: Array.from(state.flashcardReviews),
        savedAt: Date.now(),
    };
    try {
        localStorage.setItem(FLASHCARD_SESSION_KEY, JSON.stringify(session));
    } catch (e) {
        console.error("Failed to save flashcard session", e);
    }
    if (state.user) {
        fetch("/api/flashcard/session", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ session }),
        }).catch(() => {});
    }
}

function clearFlashcardSession() {
    localStorage.removeItem(FLASHCARD_SESSION_KEY);
    if (state.user) {
        fetch("/api/flashcard/session", {
            method: "DELETE",
            credentials: "same-origin",
        }).catch(() => {});
    }
    renderFlashcardResume();
}

async function loadServerFlashcardSession() {
    if (!state.user) return null;
    try {
        const res = await fetch("/api/flashcard/session", { credentials: "same-origin" });
        if (!res.ok) return null;
        const data = await res.json();
        return data.session || null;
    } catch (e) {
        return null;
    }
}

function loadFlashcardSession() {
    const raw = localStorage.getItem(FLASHCARD_SESSION_KEY);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

async function renderFlashcardResume() {
    let session = loadFlashcardSession();

    if (!session && state.user) {
        const serverSession = await loadServerFlashcardSession();
        if (serverSession && serverSession.questions && serverSession.questions.length) {
            try { localStorage.setItem(FLASHCARD_SESSION_KEY, JSON.stringify(serverSession)); } catch (e) {}
            session = serverSession;
        }
    }

    const hasSession = !!(session && session.questions && session.questions.length);

    els.flashcardResumeContainer.classList.toggle("hidden", !hasSession);
    document.getElementById("flashcard-start-row").classList.toggle("hidden", hasSession);

    if (els.flashcardSessionStatus) {
        if (!state.user) {
            els.flashcardSessionStatus.textContent = "⚠️ Not signed in — progress is only saved on this device.";
        } else {
            els.flashcardSessionStatus.textContent = "";
        }
    }

    if (!hasSession) return;

    const exam = state.exams.find((e) => e.filename === session.filename);
    const examName = exam?.display_name || exam?.title || session.filename;
    const current = Math.min(session.index + 1, session.questions.length);
    els.flashcardResumeText.textContent = `Resume "${examName}" — card ${current} of ${session.questions.length}.`;
}

async function resumeFlashcardSession() {
    let session = null;
    if (state.user) {
        session = await loadServerFlashcardSession();
        if (session) {
            try { localStorage.setItem(FLASHCARD_SESSION_KEY, JSON.stringify(session)); } catch (e) {}
        }
    }
    if (!session) session = loadFlashcardSession();
    if (!session || !session.questions || !session.questions.length) {
        clearFlashcardSession();
        return;
    }
    state.flashcardFilename = session.filename;
    state.flashcardMode = session.mode || "question";
    state.flashcardFilter = session.filter || "all";
    state.flashcardQuestions = session.questions;
    state.flashcardIndex = Math.min(session.index || 0, session.questions.length - 1);
    state.flashcardFlipped = !!session.flipped;
    state.flashcardReviews = new Set((session.reviews || []).map(String));

    renderFlashcardExamButtons();
    setFlashcardMode(state.flashcardMode);
    setFlashcardFilter(state.flashcardFilter);
    updateFlashcardReviewCount();
    showFlashcardStudyArea();
    renderFlashcard();
    saveFlashcardSession();
}

function renderFlashcard() {
    const q = state.flashcardQuestions[state.flashcardIndex];
    if (!q) return;

    els.flashcard.classList.toggle("flipped", state.flashcardFlipped);

    els.flashcardFrontText.textContent = q.question;

    els.flashcardFrontImage.innerHTML = "";
    if (q.image) {
        const img = document.createElement("img");
        img.src = q.image;
        img.alt = "Question image";
        img.onerror = () => { img.style.display = "none"; };
        els.flashcardFrontImage.appendChild(img);
    }

    els.flashcardFrontOptions.innerHTML = "";
    if (state.flashcardMode === "choices" && q.options && q.options.length) {
        const ul = document.createElement("ul");
        q.options.forEach((opt) => {
            const li = document.createElement("li");
            li.textContent = opt;
            ul.appendChild(li);
        });
        els.flashcardFrontOptions.appendChild(ul);
    }

    const correct = q.correct_answer || q._correct_answer || "";
    els.flashcardBackText.textContent = correct;
    els.flashcardCounter.textContent = `Card ${state.flashcardIndex + 1} of ${state.flashcardQuestions.length}`;

    const isMarked = state.flashcardReviews.has(String(q.id));
    els.flashcardReviewBadge.classList.toggle("hidden", !isMarked);
    els.flashcardMarkBtn.textContent = isMarked ? "Unmark review" : "Mark for review";
    els.flashcardMarkBtn.classList.toggle("btn-secondary", !isMarked);
    els.flashcardMarkBtn.classList.toggle("btn-warning", isMarked);

    els.flashcardPrevBtn.disabled = state.flashcardIndex === 0;
    els.flashcardNextBtn.disabled = state.flashcardIndex === state.flashcardQuestions.length - 1;
}

function flipFlashcard() {
    state.flashcardFlipped = !state.flashcardFlipped;
    els.flashcard.classList.toggle("flipped", state.flashcardFlipped);
    saveFlashcardSession();
}

function nextFlashcard() {
    if (state.flashcardIndex < state.flashcardQuestions.length - 1) {
        state.flashcardIndex += 1;
        state.flashcardFlipped = false;
        renderFlashcard();
        saveFlashcardSession();
    }
}

function prevFlashcard() {
    if (state.flashcardIndex > 0) {
        state.flashcardIndex -= 1;
        state.flashcardFlipped = false;
        renderFlashcard();
        saveFlashcardSession();
    }
}

function shuffleFlashcards() {
    for (let i = state.flashcardQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [state.flashcardQuestions[i], state.flashcardQuestions[j]] = [state.flashcardQuestions[j], state.flashcardQuestions[i]];
    }
    state.flashcardIndex = 0;
    state.flashcardFlipped = false;
    renderFlashcard();
    saveFlashcardSession();
}

async function toggleFlashcardReview() {
    const q = state.flashcardQuestions[state.flashcardIndex];
    if (!q) return;
    if (!state.user) {
        alert("Log in to mark cards for review.");
        return;
    }
    try {
        const res = await fetch(API.flashcardReviewToggle, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename: state.flashcardFilename, question_id: q.id }),
            credentials: "same-origin",
        });
        const data = await res.json();
        if (data.ok) {
            if (data.marked) {
                state.flashcardReviews.add(String(q.id));
            } else {
                state.flashcardReviews.delete(String(q.id));
            }
            renderFlashcard();
            updateFlashcardReviewCount();
            saveFlashcardSession();
        }
    } catch (err) {
        console.error(err);
    }
}

function setFlashcardFilter(filter) {
    state.flashcardFilter = filter;
    els.flashcardFilterAll.classList.toggle("active", filter === "all");
    els.flashcardFilterAll.classList.toggle("btn-primary", filter === "all");
    els.flashcardFilterAll.classList.toggle("btn-secondary", filter !== "all");
    els.flashcardFilterReview.classList.toggle("active", filter === "review");
    els.flashcardFilterReview.classList.toggle("btn-primary", filter === "review");
    els.flashcardFilterReview.classList.toggle("btn-secondary", filter !== "review");
    updateFlashcardReviewCount();
    saveFlashcardSession();
    savePrefs();
}

async function updateFlashcardReviewCount() {
    if (!state.flashcardFilename) return;
    if (!state.user) {
        els.flashcardReviewCount.textContent = "Log in to keep a saved review list.";
        return;
    }
    try {
        const res = await fetch(
            `${API.flashcardReviews}?filename=${encodeURIComponent(state.flashcardFilename)}`,
            { credentials: "same-origin" }
        );
        const data = await res.json();
        const count = data.ok ? data.reviews.length : 0;
        els.flashcardReviewCount.textContent = `${count} card${count === 1 ? "" : "s"} marked for review.`;
    } catch (err) {
        els.flashcardReviewCount.textContent = "Could not load review count.";
    }
}

function retakeSameTest() {
    if (!state.lastTestQuestions || !state.lastTestQuestions.length) return;
    stopTimer();
    els.timer.style.display = "";
    state.testQuestions = [...state.lastTestQuestions];
    state.answers = {};
    state.testQuestions.forEach((q) => {
        state.answers[q.id] = q.type === "matching" ? {} : [];
    });
    state.currentIndex = 0;
    state.secondsElapsed = 0;
    state.multiSelect = false;
    els.reviewPanel.classList.add("hidden");
    showScreen("quiz");
    startTimer();
    renderQuestion();
}

function formatTime(totalSeconds) {
    const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const s = String(totalSeconds % 60).padStart(2, "0");
    return `${m}:${s}`;
}

function isMultiCorrect(question) {
    return question._correct_answer.includes("|");
}

function shuffleArray(array) {
    const arr = [...array];
    for (let i = arr.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
}

function createMatchingTerm(term, options = {}) {
    const { onClick, assigned, selected } = options;
    const termEl = document.createElement("div");
    termEl.className = "matching-term";
    termEl.textContent = term;
    termEl.dataset.term = term;
    if (onClick) {
        termEl.addEventListener("click", (e) => {
            e.stopPropagation();
            onClick(term, termEl);
        });
    }
    if (assigned) termEl.classList.add("assigned");
    if (selected) termEl.classList.add("selected");
    return termEl;
}

function renderMatchingQuestion(q) {
    state.multiSelect = false;
    updateProgress();
    els.questionText.innerHTML = "";

    const questionText = document.createElement("span");
    questionText.textContent = q.question;
    els.questionText.appendChild(questionText);

    if (q.image) {
        const img = document.createElement("img");
        img.src = q.image;
        img.alt = "Question image";
        img.className = "question-image";
        img.onerror = () => { img.style.display = "none"; };
        els.questionText.appendChild(img);
    }

    els.optionsContainer.innerHTML = "";
    const selected = state.answers[q.id] || {};

    const wrapper = document.createElement("div");
    wrapper.className = "matching-container";

    const termsBox = document.createElement("div");
    termsBox.className = "matching-terms";
    const termsHeading = document.createElement("h4");
    termsHeading.textContent = "Terms";
    termsBox.appendChild(termsHeading);

    const shuffledTerms = shuffleArray(q.terms);
    let selectedTerm = null;

    const clearSelection = () => {
        selectedTerm = null;
        wrapper.querySelectorAll(".matching-term.selected").forEach((el) => {
            el.classList.remove("selected");
        });
    };

    const selectTerm = (term, el) => {
        clearSelection();
        selectedTerm = term;
        el.classList.add("selected");
    };

    const toggleTermSelection = (term, el) => {
        if (selectedTerm === term) {
            clearSelection();
        } else {
            selectTerm(term, el);
        }
    };

    const updateTermAssignments = () => {
        Array.from(termsBox.children).forEach((child) => {
            const term = child.dataset.term;
            const isAssigned = !!(state.answers[q.id] || {})[term];
            child.classList.toggle("assigned", isAssigned);
        });
    };

    shuffledTerms.forEach((term) => {
        const termEl = createMatchingTerm(term, {
            onClick: toggleTermSelection,
            assigned: !!selected[term],
        });
        termsBox.appendChild(termEl);
    });

    const defsBox = document.createElement("div");
    defsBox.className = "matching-definitions";
    const defsHeading = document.createElement("h4");
    defsHeading.textContent = "Definitions";
    defsBox.appendChild(defsHeading);

    const shuffledDefs = shuffleArray(q.definitions);
    const zoneUpdaters = [];

    shuffledDefs.forEach((def) => {
        const row = document.createElement("div");
        row.className = "matching-row";
        row.dataset.definition = def;

        const defText = document.createElement("div");
        defText.className = "matching-definition-text";
        defText.textContent = def;

        const termsInDef = document.createElement("div");
        termsInDef.className = "matching-terms-in-definition";

        const updateTermsInDef = () => {
            termsInDef.innerHTML = "";
            const current = state.answers[q.id] || {};
            q.terms.forEach((term) => {
                if (current[term] === def) {
                    const termEl = createMatchingTerm(term, {
                        onClick: toggleTermSelection,
                        assigned: true,
                    });
                    const clearBtn = document.createElement("button");
                    clearBtn.type = "button";
                    clearBtn.className = "matching-clear-btn";
                    clearBtn.textContent = "×";
                    clearBtn.addEventListener("click", (e) => {
                        e.stopPropagation();
                        updateMatchingAnswer(q.id, term, "");
                        zoneUpdaters.forEach((fn) => fn());
                        updateTermAssignments();
                    });
                    termEl.appendChild(clearBtn);
                    termsInDef.appendChild(termEl);
                }
            });
        };

        const dropZone = document.createElement("div");
        dropZone.className = "matching-drop-zone";
        dropZone.textContent = "Tap to place selected term";

        const placeSelectedTerm = () => {
            if (!selectedTerm) return;
            updateMatchingAnswer(q.id, selectedTerm, def);
            clearSelection();
            zoneUpdaters.forEach((fn) => fn());
            updateTermAssignments();
        };

        dropZone.addEventListener("click", (e) => {
            e.stopPropagation();
            placeSelectedTerm();
        });

        row.addEventListener("click", () => {
            placeSelectedTerm();
        });

        updateTermsInDef();

        row.appendChild(defText);
        row.appendChild(termsInDef);
        row.appendChild(dropZone);
        defsBox.appendChild(row);

        zoneUpdaters.push(updateTermsInDef);
    });

    wrapper.appendChild(termsBox);
    wrapper.appendChild(defsBox);
    els.optionsContainer.appendChild(wrapper);
}

function updateMatchingAnswer(qid, term, definition) {
    const current = state.answers[qid] || {};
    const updated = { ...current };
    if (definition) {
        updated[term] = definition;
    } else {
        delete updated[term];
    }
    state.answers[qid] = updated;

    if (state.mode === "mastery" && state.user && state.currentFilename) {
        clearTimeout(masterySaveTimeout);
        masterySaveTimeout = setTimeout(() => saveMasteryAnswer(qid), 600);
    }
}

function updateProgress() {
    const total = state.testQuestions.length;
    const pct = total ? ((state.currentIndex + 1) / total) * 100 : 0;
    els.progressBar.style.width = `${pct}%`;
    els.progress.textContent = `Question ${state.currentIndex + 1} of ${total}`;
    els.questionBadge.textContent = `Question ${state.currentIndex + 1}`;
}

function renderQuestion() {
    const q = state.testQuestions[state.currentIndex];

    if (q.type === "matching") {
        renderMatchingQuestion(q);
        return;
    }

    const selected = state.answers[q.id] || [];
    const isMulti = isMultiCorrect(q);
    state.multiSelect = isMulti;

    updateProgress();
    els.questionText.innerHTML = "";

    const questionText = document.createElement("span");
    questionText.textContent = q.question;
    els.questionText.appendChild(questionText);

    // Display any associated question image
    if (q.image) {
        const img = document.createElement("img");
        img.src = q.image;
        img.alt = "Question image";
        img.className = "question-image";
        img.onerror = () => { img.style.display = "none"; };
        els.questionText.appendChild(img);
    }

    els.optionsContainer.innerHTML = "";
    q.options.forEach((opt) => {
        const optionEl = document.createElement("label");
        optionEl.className = "option" + (selected.includes(opt) ? " selected" : "");

        const input = document.createElement("input");
        input.type = isMulti ? "checkbox" : "radio";
        input.name = "answer";
        input.value = opt;
        if (selected.includes(opt)) input.checked = true;

        const span = document.createElement("span");
        span.className = "option-text";
        span.textContent = opt;

        optionEl.appendChild(input);
        optionEl.appendChild(span);
        els.optionsContainer.appendChild(optionEl);

        input.addEventListener("change", () => {
            updateAnswer(q.id, input.checked, opt);
        });
    });

    const total = state.testQuestions.length;
    els.prevBtn.disabled = state.currentIndex === 0;
    els.nextBtn.textContent = state.currentIndex === total - 1 ? "Finish" : "Next";
}

let masterySaveTimeout = null;

function updateAnswer(qid, checked, value) {
    const current = state.answers[qid] || [];
    let updated;
    if (state.multiSelect) {
        updated = checked
            ? [...new Set([...current, value])]
            : current.filter((v) => v !== value);
    } else {
        updated = checked ? [value] : [];
    }
    state.answers[qid] = updated;

    Array.from(els.optionsContainer.children).forEach((label) => {
        const input = label.querySelector("input");
        label.classList.toggle("selected", input.checked);
    });

    if (state.mode === "mastery" && state.user && state.currentFilename) {
        clearTimeout(masterySaveTimeout);
        masterySaveTimeout = setTimeout(() => saveMasteryAnswer(qid), 600);
    }
}

async function saveMasteryAnswer(qid) {
    const current = state.answers[qid];
    const hasAnswer = Array.isArray(current)
        ? current.length > 0
        : current && typeof current === "object" && Object.keys(current).length > 0;
    if (!hasAnswer) return;

    const saved = state.lastSavedAnswers[qid];
    const same = JSON.stringify(current) === JSON.stringify(saved);
    if (same) return;

    const question = state.testQuestions.find((q) => q.id == qid);
    if (!question) return;

    try {
        const res = await fetch(API.masterySubmit, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                filename: state.currentFilename,
                answers: { [qid]: current },
                quiz: [question],
            }),
            credentials: "same-origin",
        });
        if (!res.ok) throw new Error("Mastery save failed");
        state.lastSavedAnswers[qid] = Array.isArray(current) ? [...current] : { ...current };
    } catch (err) {
        console.error(err);
    }
}

function navigate(direction) {
    const total = state.testQuestions.length;
    state.currentIndex += direction;
    if (state.currentIndex < 0) state.currentIndex = 0;
    if (state.currentIndex >= total) state.currentIndex = total - 1;
    renderQuestion();
}

async function submitTest() {
    stopTimer();
    // Only score questions that were actually shown in this test.
    const testQuestionIds = new Set(state.testQuestions.map((q) => q.id));
    const relevantAnswers = {};
    for (const [qid, selected] of Object.entries(state.answers)) {
        if (testQuestionIds.has(parseInt(qid, 10))) {
            relevantAnswers[qid] = selected;
        }
    }
    const payload = { answers: relevantAnswers, quiz: state.testQuestions };
    try {
        const res = await fetch(API.score, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Scoring failed");
        const data = await res.json();
        await saveHistoryAttempt(data, relevantAnswers);
        showResults(data);
    } catch (err) {
        // Offline fallback: score locally using the cached questions.
        const results = computeResults(state.testQuestions, relevantAnswers);
        const correct = results.filter((r) => r.is_correct).length;
        const localData = {
            title: state.title,
            total: results.length,
            correct,
            score: results.length ? Math.round((correct / results.length) * 100) : 0,
            results,
        };
        await saveHistoryAttempt(localData, relevantAnswers);
        showResults(localData);
    }
}

function formatAnswerForReview(answer) {
    if (!answer) return "(no answer)";
    if (Array.isArray(answer)) {
        return answer.length ? answer.join(", ") : "(no answer)";
    }
    if (typeof answer === "object") {
        return Object.entries(answer)
            .map(([def, term]) => `${term} → ${def}`)
            .join("; ") || "(no answer)";
    }
    return String(answer);
}

function formatMatchingAnswerForReview(answer, terms, correctPairs, isSelected) {
    if (!terms || !terms.length) return "(no answer)";
    return terms
        .map((term) => {
            const def = isSelected
                ? (answer && typeof answer === "object" ? answer[term] : undefined)
                : correctPairs[term];
            return `${term}: ${def || "(not matched)"}`;
        })
        .join("; ");
}

function showResults(data) {
    showScreen("results");
    const scoreCircle = document.querySelector(".score-circle");
    if (state.mode === "mastery") {
        els.retakeBtn.classList.add("hidden");
        scoreCircle.classList.remove("hidden");
        els.resultsTitle.textContent = state.masterySummary && state.masterySummary.mastered === state.masterySummary.total
            ? "Exam Mastered!"
            : "Mastery Session Complete";
        els.scoreValue.textContent = `${data.score}%`;
        els.scoreDetail.textContent = `You got ${data.correct} out of ${data.total} correct in ${formatTime(data.duration_seconds ?? state.secondsElapsed)}.`;
        const deg = data.total ? Math.round((data.correct / data.total) * 360) : 0;
        scoreCircle.style.setProperty("--score-deg", `${deg}deg`);
    } else {
        scoreCircle.classList.remove("hidden");
        els.retakeBtn.classList.remove("hidden");
        els.resultsTitle.textContent = `Results: ${data.title || state.title || "Practice Test"}`;
        els.scoreValue.textContent = `${data.score}%`;
        els.scoreDetail.textContent = `You got ${data.correct} out of ${data.total} correct in ${formatTime(data.duration_seconds ?? state.secondsElapsed)}.`;
        const deg = data.total ? Math.round((data.correct / data.total) * 360) : 0;
        scoreCircle.style.setProperty("--score-deg", `${deg}deg`);
    }
    els.reviewPanel.classList.remove("hidden");

    els.reviewList.innerHTML = "";
    data.results.forEach((r, i) => {
        const item = document.createElement("div");
        item.className = `review-item ${r.is_correct ? "correct" : "wrong"}`;

        const heading = document.createElement("h4");
        heading.textContent = `${i + 1}. ${r.question}`;
        item.appendChild(heading);

        const selectedRow = document.createElement("div");
        selectedRow.className = "answer-row";
        const selectedLabel = document.createElement("div");
        selectedLabel.className = "answer-label";
        selectedLabel.textContent = "Your answer";
        const selectedText = document.createElement("div");
        selectedText.className = `answer-text ${r.is_correct ? "correct-answer" : "wrong-answer"}`;
        selectedText.textContent = r.type === "matching"
            ? formatMatchingAnswerForReview(r.selected, r.terms, r.correct_pairs, true)
            : formatAnswerForReview(r.selected);
        selectedRow.appendChild(selectedLabel);
        selectedRow.appendChild(selectedText);
        item.appendChild(selectedRow);

        const correctRow = document.createElement("div");
        correctRow.className = "answer-row";
        const correctLabel = document.createElement("div");
        correctLabel.className = "answer-label";
        correctLabel.textContent = "Correct answer";
        const correctText = document.createElement("div");
        correctText.className = "answer-text correct-answer";
        correctText.textContent = r.type === "matching"
            ? formatMatchingAnswerForReview(r.correct_answer, r.terms, r.correct_pairs, false)
            : formatAnswerForReview(r.correct_answer);
        correctRow.appendChild(correctLabel);
        correctRow.appendChild(correctText);
        item.appendChild(correctRow);

        els.reviewList.appendChild(item);
    });
}

els.startBtn.addEventListener("click", startTest);
els.homeBtn.addEventListener("click", goHome);
els.homeLogo.addEventListener("click", goHome);
els.homeStartBtn.addEventListener("click", () => switchTab("practice"));
els.prevBtn.addEventListener("click", () => navigate(-1));
els.nextBtn.addEventListener("click", () => {
    if (state.currentIndex === state.testQuestions.length - 1) {
        if (state.mode === "mastery") {
            submitMastery();
        } else {
            submitTest();
        }
    } else {
        navigate(1);
    }
});
els.submitBtn.addEventListener("click", () => {
    if (state.mode === "mastery") {
        submitMastery();
    } else {
        submitTest();
    }
});
els.restartBtn.addEventListener("click", goHome);
els.retakeBtn.addEventListener("click", retakeSameTest);
els.continueMasteryBtn.addEventListener("click", startMasterySession);

els.loginTrigger.addEventListener("click", () => openAuthModal("login"));
els.registerTrigger.addEventListener("click", () => openAuthModal("register"));
els.profileBtn.addEventListener("click", openProfileModal);
els.profileLogout.addEventListener("click", logout);
els.profileSave.addEventListener("click", saveProfile);
els.profileCancel.addEventListener("click", cancelProfile);
els.avatarEditBtn.addEventListener("click", openAvatarModal);
els.avatarModalClose.addEventListener("click", cancelAvatarModal);
els.avatarModalRandom.addEventListener("click", randomAvatar);
els.avatarModalSave.addEventListener("click", saveAvatarModal);
els.avatarModalCancel.addEventListener("click", cancelAvatarModal);
els.avatarModal.addEventListener("click", (e) => {
    if (e.target === els.avatarModal) cancelAvatarModal();
});
els.profileModal.addEventListener("click", (e) => {
    if (e.target === els.profileModal) cancelProfile();
});

els.modalSubmit.addEventListener("click", submitAuth);
els.modalCancel.addEventListener("click", closeAuthModal);
els.authModal.addEventListener("click", (e) => {
    if (e.target === els.authModal) closeAuthModal();
});
els.togglePassword.addEventListener("click", () => {
    togglePasswordVisibility(els.modalPassword, els.togglePassword);
});
els.toggleConfirmPassword.addEventListener("click", () => {
    togglePasswordVisibility(els.modalConfirmPassword, els.toggleConfirmPassword);
});
document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
        if (!els.authModal.classList.contains("hidden")) closeAuthModal();
        if (!els.installModal.classList.contains("hidden")) closeInstallModal();
        if (!els.avatarModal.classList.contains("hidden")) {
            cancelAvatarModal();
            return;
        }
        if (!els.profileModal.classList.contains("hidden")) cancelProfile();
    }
});

els.installHelpBtn.addEventListener("click", openInstallModal);
els.installCloseBtn.addEventListener("click", closeInstallModal);
els.installModal.addEventListener("click", (e) => {
    if (e.target === els.installModal) closeInstallModal();
});
els.installTabIos.addEventListener("click", () => switchInstallTab("ios"));
els.installTabAndroid.addEventListener("click", () => switchInstallTab("android"));

document.querySelectorAll(".home-card").forEach((card) => {
    card.addEventListener("mousemove", (e) => {
        const rect = card.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        card.style.setProperty("--mouse-x", `${x}%`);
        card.style.setProperty("--mouse-y", `${y}%`);
    });
});

const homeHero = document.querySelector(".home-hero");
if (homeHero) {
    homeHero.addEventListener("mousemove", (e) => {
        const rect = homeHero.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        homeHero.style.setProperty("--mouse-x", `${x}%`);
        homeHero.style.setProperty("--mouse-y", `${y}%`);
    });
}

[els.modalUsername, els.modalPassword, els.modalConfirmPassword].forEach((input) => {
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submitAuth();
    });
});
els.modePractice.addEventListener("click", () => setMode("practice"));
els.modeMastery.addEventListener("click", () => setMode("mastery"));
els.masteryStartBtn.addEventListener("click", startMasterySession);
els.masteryResetBtn.addEventListener("click", resetMastery);

els.tabHome.addEventListener("click", () => switchTab("home"));
els.tabPractice.addEventListener("click", () => switchTab("practice"));
els.tabFlashcards.addEventListener("click", () => switchTab("flashcards"));
els.tabHistory.addEventListener("click", () => switchTab("history"));
els.tabCommunity.addEventListener("click", () => switchTab("community"));

document.querySelectorAll(".home-card[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});
els.historyLoginBtn.addEventListener("click", () => openAuthModal("login"));
els.chatSendBtn.addEventListener("click", sendChatMessage);
els.chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendChatMessage();
});

els.flashcardModeQuestion.addEventListener("click", () => setFlashcardMode("question"));
els.flashcardModeChoices.addEventListener("click", () => setFlashcardMode("choices"));
els.flashcardFilterAll.addEventListener("click", () => setFlashcardFilter("all"));
els.flashcardFilterReview.addEventListener("click", () => setFlashcardFilter("review"));
els.flashcardStartBtn.addEventListener("click", startFlashcards);
els.flashcard.addEventListener("click", flipFlashcard);
els.flashcardFlipBtn.addEventListener("click", flipFlashcard);
els.flashcardNextBtn.addEventListener("click", nextFlashcard);
els.flashcardPrevBtn.addEventListener("click", prevFlashcard);
els.flashcardShuffleBtn.addEventListener("click", shuffleFlashcards);
els.flashcardMarkBtn.addEventListener("click", toggleFlashcardReview);
els.flashcardExitBtn.addEventListener("click", showFlashcardSetup);
els.flashcardResumeBtn.addEventListener("click", resumeFlashcardSession);
els.flashcardDiscardBtn.addEventListener("click", clearFlashcardSession);
window.addEventListener("pagehide", saveFlashcardSession);
window.addEventListener("beforeunload", saveFlashcardSession);

document.addEventListener("keydown", (e) => {
    if (!screens.flashcards.classList.contains("active")) return;
    if (!els.flashcardStudyArea.classList.contains("hidden")) {
        if (e.key === " " || e.code === "Space") {
            e.preventDefault();
            flipFlashcard();
        } else if (e.key === "ArrowRight") {
            nextFlashcard();
        } else if (e.key === "ArrowLeft") {
            prevFlashcard();
        } else if (e.key.toLowerCase() === "s") {
            shuffleFlashcards();
        } else if (e.key.toLowerCase() === "r") {
            toggleFlashcardReview();
        }
    }
});

// ── Welcome banner ─────────────────────────────────────────────────────────
const WELCOME_KEY = "answrit_welcomed";
(function initWelcomeBanner() {
    const banner = document.getElementById("welcome-banner");
    const dismiss = document.getElementById("welcome-dismiss");
    if (!banner) return;
    if (!localStorage.getItem(WELCOME_KEY)) {
        banner.classList.remove("hidden");
    }
    dismiss.addEventListener("click", () => {
        banner.classList.add("hidden");
        try { localStorage.setItem(WELCOME_KEY, "1"); } catch (e) {}
    });
})();

// ── Step indicator helpers ──────────────────────────────────────────────────
function updatePracticeSteps() {
    const examPicked = !!state.currentFilename;
    const s1 = document.getElementById("step-practice-1");
    const s2 = document.getElementById("step-practice-2");
    const s3 = document.getElementById("step-practice-3");
    if (!s1) return;
    s1.className = "setup-step" + (examPicked ? " done" : " active");
    s2.className = "setup-step" + (examPicked ? " active" : "");
    s3.className = "setup-step" + (examPicked ? " active" : "");
}

function updateFlashcardSteps() {
    const examPicked = !!state.flashcardFilename;
    const s1 = document.getElementById("step-fc-1");
    const s2 = document.getElementById("step-fc-2");
    const s3 = document.getElementById("step-fc-3");
    if (!s1) return;
    s1.className = "setup-step" + (examPicked ? " done" : " active");
    s2.className = "setup-step" + (examPicked ? " active" : "");
    s3.className = "setup-step" + (examPicked ? " active" : "");
}

// Initialize — wrap defaults in _restoringPrefs so savePrefs is not called
state._restoringPrefs = true;
setFlashcardMode("question");
setFlashcardFilter("all");
state._restoringPrefs = false;
loadExams();
checkAuth();

(function restoreTab() {
    const saved = localStorage.getItem(TAB_KEY);
    if (saved) {
        switchTab(saved);
    } else {
        switchTab("home");
    }
})();
