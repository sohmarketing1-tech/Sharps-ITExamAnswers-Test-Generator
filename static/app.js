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
    examQuestions: "/api/exam-questions",
    flashcardReviews: "/api/flashcard/reviews",
    flashcardReviewToggle: "/api/flashcard/review",
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
    multiSelect: false,
    mode: "practice", // "practice" or "mastery"
    user: null,
    masterySummary: null,
    lastSavedAnswers: {}, // qid -> saved answer array
    currentTab: "practice",
    flashcardFilename: null,
    flashcardMode: "question", // "question" or "choices"
    flashcardFilter: "all", // "all" or "review"
    flashcardQuestions: [],
    flashcardIndex: 0,
    flashcardFlipped: false,
    flashcardReviews: new Set(),
    authModalMode: null,
};

// DOM refs
const screens = {
    setup: document.getElementById("setup-screen"),
    quiz: document.getElementById("quiz-screen"),
    results: document.getElementById("results-screen"),
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
    tabPractice: document.getElementById("tab-practice"),
    tabFlashcards: document.getElementById("tab-flashcards"),
    tabCommunity: document.getElementById("tab-community"),
    chatMessages: document.getElementById("chat-messages"),
    chatInput: document.getElementById("chat-input"),
    chatSendBtn: document.getElementById("chat-send-btn"),
    chatLoginPrompt: document.getElementById("chat-login-prompt"),
    chatInputRow: document.getElementById("chat-input-row"),
    progressBar: document.getElementById("progress-bar"),
    progress: document.getElementById("progress"),
    timer: document.getElementById("timer"),
    homeBtn: document.getElementById("home-btn"),
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
    logoutBtn: document.getElementById("logout-btn"),
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
        els.authUser.textContent = state.user;
        els.modalUsername.value = "";
        els.modalPassword.value = "";
    } else {
        els.authLoggedIn.classList.add("hidden");
        els.authLoggedOut.classList.remove("hidden");
        els.authUser.textContent = "";
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
        } else {
            state.user = null;
        }
    } catch (err) {
        state.user = null;
    }
    renderAuthState();
    renderAccountPrompt();
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
        renderAuthState();
        renderAccountPrompt();
        setAuthMessage("Logged in.", "success");
        closeAuthModal();
        await refreshMastery();
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
        renderAuthState();
        renderAccountPrompt();
        setAuthMessage("Account created and logged in.", "success");
        closeAuthModal();
        await refreshMastery();
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
        state.masterySummary = null;
        renderAuthState();
        renderAccountPrompt();
        renderMasteryPanel();
    } catch (err) {
        // Logout error is silent since the UI already reflects the action.
        console.error("Logout failed", err);
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

async function loadExams() {
    try {
        const res = await fetch(API.exams);
        if (!res.ok) throw new Error("Failed to load exam list");
        const data = await res.json();
        state.exams = data.exams || [];
        renderExamButtons();
        renderFlashcardExamButtons();
        renderFlashcardResume();
        if (state.exams.length > 0) {
            const current = data.current_filename || state.exams[0].filename;
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
        startTimer();
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
    startTimer();
    renderQuestion();
}

function startTimer() {
    clearInterval(state.timerInterval);
    els.timer.textContent = "00:00";
    state.timerInterval = setInterval(() => {
        state.secondsElapsed += 1;
        const m = String(Math.floor(state.secondsElapsed / 60)).padStart(2, "0");
        const s = String(state.secondsElapsed % 60).padStart(2, "0");
        els.timer.textContent = `${m}:${s}`;
    }, 1000);
}

function stopTimer() {
    clearInterval(state.timerInterval);
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
    showScreen("setup");
}

function switchTab(tabName) {
    if (state.currentTab === tabName) return;
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
    els.tabPractice.classList.toggle("active", tabName === "practice");
    els.tabFlashcards.classList.toggle("active", tabName === "flashcards");
    els.tabCommunity.classList.toggle("active", tabName === "community");
    stopChatPolling();
    if (tabName === "practice") {
        showScreen("setup");
    } else if (tabName === "community") {
        showScreen("community");
        loadChat();
        startChatPolling();
    } else if (tabName === "flashcards") {
        showScreen("flashcards");
        renderFlashcardExamButtons();
        renderFlashcardResume();
    }
}

let chatPollInterval = null;

async function loadChat() {
    try {
        const res = await fetch(API.chatMessages, { credentials: "same-origin" });
        if (!res.ok) throw new Error("Could not load chat");
        const data = await res.json();
        renderChat(data.messages || []);
    } catch (err) {
        renderChat([]);
    }
}

function renderChat(messages) {
    els.chatMessages.innerHTML = "";
    if (!messages.length) {
        els.chatMessages.innerHTML = `<p class="empty-state">No messages yet. Be the first to say hello!</p>`;
    } else {
        messages.forEach((msg) => {
            const el = document.createElement("div");
            el.className = "chat-message" + (msg.username === state.user ? " chat-message-own" : "");
            const time = new Date(msg.timestamp).toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "numeric",
                minute: "2-digit",
            });
            el.innerHTML = `
                <div class="chat-message-header">
                    <span class="chat-username">${escapeHtml(msg.username)}</span>
                    <span class="chat-time">${escapeHtml(time)}</span>
                </div>
                <div class="chat-text">${escapeHtml(msg.message)}</div>
            `;
            els.chatMessages.appendChild(el);
        });
    }
    els.chatMessages.scrollTop = els.chatMessages.scrollHeight;
    renderChatInputState();
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
}

function stopChatPolling() {
    if (chatPollInterval) {
        clearInterval(chatPollInterval);
        chatPollInterval = null;
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
}

function clearFlashcardSession() {
    localStorage.removeItem(FLASHCARD_SESSION_KEY);
    renderFlashcardResume();
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

function renderFlashcardResume() {
    const session = loadFlashcardSession();
    const hasSession = !!(session && session.questions && session.questions.length);

    els.flashcardResumeContainer.classList.toggle("hidden", !hasSession);
    document.getElementById("flashcard-start-row").classList.toggle("hidden", hasSession);

    if (!hasSession) {
        if (els.flashcardSessionStatus) {
            els.flashcardSessionStatus.textContent = "No saved flashcard session on this device.";
        }
        return;
    }

    const exam = state.exams.find((e) => e.filename === session.filename);
    const examName = exam?.display_name || exam?.title || session.filename;
    const current = Math.min(session.index + 1, session.questions.length);
    els.flashcardResumeText.textContent = `Resume "${examName}" — card ${current} of ${session.questions.length}.`;
    if (els.flashcardSessionStatus) {
        els.flashcardSessionStatus.textContent = "";
    }
}

function resumeFlashcardSession() {
    const session = loadFlashcardSession();
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
        showResults(data);
    } catch (err) {
        // Offline fallback: score locally using the cached questions.
        const results = computeResults(state.testQuestions, relevantAnswers);
        const correct = results.filter((r) => r.is_correct).length;
        showResults({
            title: state.title,
            total: results.length,
            correct,
            score: results.length ? Math.round((correct / results.length) * 100) : 0,
            results,
        });
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
        els.scoreDetail.textContent = `You got ${data.correct} out of ${data.total} correct in ${formatTime(state.secondsElapsed)}.`;
        const deg = data.total ? Math.round((data.correct / data.total) * 360) : 0;
        scoreCircle.style.setProperty("--score-deg", `${deg}deg`);
    } else {
        scoreCircle.classList.remove("hidden");
        els.retakeBtn.classList.remove("hidden");
        els.resultsTitle.textContent = `Results: ${data.title || state.title || "Practice Test"}`;
        els.scoreValue.textContent = `${data.score}%`;
        els.scoreDetail.textContent = `You got ${data.correct} out of ${data.total} correct in ${formatTime(state.secondsElapsed)}.`;
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
els.logoutBtn.addEventListener("click", logout);

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
    }
});

els.installHelpBtn.addEventListener("click", openInstallModal);
els.installCloseBtn.addEventListener("click", closeInstallModal);
els.installModal.addEventListener("click", (e) => {
    if (e.target === els.installModal) closeInstallModal();
});
els.installTabIos.addEventListener("click", () => switchInstallTab("ios"));
els.installTabAndroid.addEventListener("click", () => switchInstallTab("android"));

[els.modalUsername, els.modalPassword, els.modalConfirmPassword].forEach((input) => {
    input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") submitAuth();
    });
});
els.modePractice.addEventListener("click", () => setMode("practice"));
els.modeMastery.addEventListener("click", () => setMode("mastery"));
els.masteryStartBtn.addEventListener("click", startMasterySession);
els.masteryResetBtn.addEventListener("click", resetMastery);

els.tabPractice.addEventListener("click", () => switchTab("practice"));
els.tabFlashcards.addEventListener("click", () => switchTab("flashcards"));
els.tabCommunity.addEventListener("click", () => switchTab("community"));
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

// Initialize
setFlashcardMode("question");
setFlashcardFilter("all");
loadExams();
checkAuth();
