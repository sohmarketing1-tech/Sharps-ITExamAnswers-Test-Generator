const DEFAULT_MASTERY_SIZE = 20;

// Feature-detect touch capability instead of relying on screen width so
// tablets (iPads etc.) reporting desktop-sized viewports still get swipe
// navigation + onboarding, while touchscreen-less laptops keep the classic
// keyboard/mouse Next/Previous buttons.
const isTouchDevice = ("ontouchstart" in window) || (navigator.maxTouchPoints > 0);
if (isTouchDevice) {
    document.body.classList.add("touch-nav");
}

const SWIPE_ONBOARD_KEY = "answrit_swipe_onboard_count";
const SWIPE_ONBOARD_MAX_RUNS = 5;
const FLASHCARD_SWIPE_ONBOARD_KEY = "answrit_flashcard_swipe_onboard_count";
const FLASHCARD_SWIPE_ONBOARD_MAX_RUNS = 5;

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
    recentActivity: "/api/recent-activity",
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
    keyboardFocusIndex: -1,
    swipeOnboardingPending: false,
    flashcardSwipeOnboardingPending: false,
    mode: "practice", // "practice" or "mastery"
    user: null,
    masterySummary: null,
    masteryImmediateFeedback: false,
    masteryLockedQids: new Set(),
    currentTab: "home",
    authChecked: false,
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
    subnetDrill: {
        difficulty: "easy",
        current: null,
        solved: 0,
        correct: 0,
    },
    binaryGame: {
        bits: 8,
        difficulty: "easy",
        target: 0,
        bitValues: [],
        solved: 0,
        streak: 0,
        bestStreak: 0,
    },
    portMatch: {
        direction: "forward",
        current: null,
        solved: 0,
        correct: 0,
        answered: false,
    },
    cliMatch: {
        current: null,
        solved: 0,
        correct: 0,
        answered: false,
    },
    osiSorter: {
        order: [],
        nextIndex: 0,
        mistakes: 0,
        rounds: 0,
        bestMistakes: null,
        roundId: 0,
    },
    acronymDrill: {
        deck: [],
        index: 0,
        flipped: false,
    },
    processSorter: {
        mode: "tcp",
        order: [],
        nextIndex: 0,
        mistakes: 0,
        rounds: 0,
        bestMistakes: null,
        roundId: 0,
    },
    raidMatch: { current: null, solved: 0, correct: 0, answered: false },
    ipv4Classify: { current: null, solved: 0, correct: 0, answered: false },
    osCmdMatch: { current: null, solved: 0, correct: 0, answered: false },
    cableId: { current: null, solved: 0, correct: 0, answered: false },
    topologyId: { current: null, solved: 0, correct: 0, answered: false },
    secplusFlash: { deck: [], index: 0, flipped: false },
    natoPhonetic: { current: null, solved: 0, correct: 0, answered: false },
    precedenceMatch: { current: null, solved: 0, correct: 0, answered: false },
    rfSpectrum: { current: null, solved: 0, correct: 0, answered: false },
    serverRoles: { current: null, solved: 0, correct: 0, answered: false },
    wirelessMatch: { current: null, solved: 0, correct: 0, answered: false },
    logicGates: { current: null, solved: 0, correct: 0, answered: false },
    cloudModels: { current: null, solved: 0, correct: 0, answered: false },
    myFc: { decks: [], currentDeck: null, index: 0, flipped: false, studying: false },
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
    gallery: document.getElementById("gallery-screen"),
    binary: document.getElementById("binary-screen"),
    subnetDrills: document.getElementById("subnet-drills-screen"),
    portMatch: document.getElementById("port-match-screen"),
    cliMatch: document.getElementById("cli-match-screen"),
    osiSorter: document.getElementById("osi-sorter-screen"),
    acronymDrill: document.getElementById("acronym-drill-screen"),
    processSorter: document.getElementById("process-sorter-screen"),
    raidMatch: document.getElementById("raid-match-screen"),
    ipv4Classify: document.getElementById("ipv4-classify-screen"),
    osCmdMatch: document.getElementById("os-cmd-match-screen"),
    cableId: document.getElementById("cable-id-screen"),
    topologyId: document.getElementById("topology-id-screen"),
    secplusFlash: document.getElementById("secplus-flash-screen"),
    natoPhonetic: document.getElementById("nato-phonetic-screen"),
    precedenceMatch: document.getElementById("precedence-match-screen"),
    rfSpectrum: document.getElementById("rf-spectrum-screen"),
    serverRoles: document.getElementById("server-roles-screen"),
    ohmsLaw: document.getElementById("ohms-law-screen"),
    wirelessMatch: document.getElementById("wireless-match-screen"),
    logicGates: document.getElementById("logic-gates-screen"),
    cloudModels: document.getElementById("cloud-models-screen"),
    myFlashcards: document.getElementById("my-flashcards-screen"),
    packetTracer: document.getElementById("packet-tracer-screen"),
};

const els = {
    examButtons: document.getElementById("exam-buttons"),
    totalQuestions: document.getElementById("total-questions"),
    questionCount: document.getElementById("question-count"),
    questionCountHint: document.getElementById("question-count-hint"),
    startBtn: document.getElementById("start-btn"),
    setupMessage: document.getElementById("setup-message"),
    accountPrompt: document.getElementById("account-prompt"),
    tabNav: document.querySelector(".tab-nav"),
    tabHome: document.getElementById("tab-home"),
    tabPractice: document.getElementById("tab-practice"),
    tabFlashcards: document.getElementById("tab-flashcards"),
    tabHistory: document.getElementById("tab-history"),
    tabCommunity: document.getElementById("tab-community"),
    tabAllApps: document.getElementById("tab-all-apps"),
    tabAllAppsHeader: document.getElementById("tab-all-apps-header"),
    ptBackHome: document.getElementById("pt-back-home"),
    ptSubnetArea: document.getElementById("pt-subnet-area"),
    ptCliArea: document.getElementById("pt-cli-area"),
    ptSubnetBack: document.getElementById("pt-subnet-back"),
    ptCliBack: document.getElementById("pt-cli-back"),
    ptSubnetPrompt: document.getElementById("pt-subnet-prompt"),
    ptSubnetMask: document.getElementById("pt-subnet-mask"),
    ptSubnetHosts: document.getElementById("pt-subnet-hosts"),
    ptSubnetSubnets: document.getElementById("pt-subnet-subnets"),
    ptSubnetCheck: document.getElementById("pt-subnet-check"),
    ptSubnetNext: document.getElementById("pt-subnet-next"),
    ptSubnetMessage: document.getElementById("pt-subnet-message"),
    ptSubnetBreakdown: document.getElementById("pt-subnet-breakdown"),
    ptCliTaskText: document.getElementById("pt-cli-task-text"),
    ptCliOutput: document.getElementById("pt-cli-output"),
    ptCliPromptText: document.getElementById("pt-cli-prompt-text"),
    ptCliInput: document.getElementById("pt-cli-input"),
    ptCliHintBtn: document.getElementById("pt-cli-hint-btn"),
    ptCliResetBtn: document.getElementById("pt-cli-reset-btn"),
    ptCliNextBtn: document.getElementById("pt-cli-next-btn"),
    ptCliMessage: document.getElementById("pt-cli-message"),
    historyLoading: document.getElementById("history-loading"),
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
    homeBtn: document.getElementById("home-btn"),
    homeLogo: document.getElementById("home-logo"),
    homeStartBtn: document.getElementById("home-start-btn"),
    quizFeedback: document.getElementById("quiz-feedback"),
    quizKeyboardHint: document.getElementById("quiz-keyboard-hint"),
    questionBadge: document.getElementById("question-badge"),
    questionText: document.getElementById("question-text"),
    optionsContainer: document.getElementById("options-container"),
    prevBtn: document.getElementById("prev-btn"),
    nextBtn: document.getElementById("next-btn"),
    questionCard: document.getElementById("question-card"),
    questionCardStackNext: document.getElementById("question-card-stack-next"),
    cardPrevArrow: document.getElementById("card-prev-arrow"),
    cardNextArrow: document.getElementById("card-next-arrow"),
    swipeOnboarding: document.getElementById("swipe-onboarding"),
    swipeOnboardingLabel: document.getElementById("swipe-onboarding-label"),
    swipeDirectionFlash: document.getElementById("swipe-direction-flash"),
    swipeDirectionFlashLabel: document.getElementById("swipe-direction-flash-label"),
    resultsTitle: document.getElementById("results-title"),
    scoreValue: document.getElementById("score-value"),
    scoreDetail: document.getElementById("score-detail"),
    restartBtn: document.getElementById("restart-btn"),
    retakeBtn: document.getElementById("retake-btn"),
    continueMasteryBtn: document.getElementById("continue-mastery-btn"),
    addQuestionsBtn: document.getElementById("add-questions-btn"),
    addQuestionsCount: document.getElementById("add-questions-count"),
    addQuestionsRow: document.getElementById("add-questions-row"),
    addQuestionsAvailable: document.getElementById("add-questions-available"),
    addQuestionsHint: document.getElementById("add-questions-hint"),
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
    authLoading: document.getElementById("auth-loading"),
    authLoadingText: document.getElementById("auth-loading-text"),
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
    avatarUpload: document.getElementById("avatar-upload"),
    avatarUploadError: document.getElementById("avatar-upload-error"),
    avatarCropModal: document.getElementById("avatar-crop-modal"),
    cropImage: document.getElementById("crop-image"),
    cropZoom: document.getElementById("crop-zoom"),
    cropCancel: document.getElementById("crop-cancel"),
    cropSave: document.getElementById("crop-save"),
    themePicker: document.getElementById("theme-picker"),
    profileClose: document.getElementById("profile-close"),
    profileLogout: document.getElementById("profile-logout"),
    profileMessage: document.getElementById("profile-message"),
    modePractice: document.getElementById("mode-practice"),
    modeMastery: document.getElementById("mode-mastery"),
    modeFlashcards: document.getElementById("mode-flashcards"),
    modeDescription: document.getElementById("mode-description"),
    countGroup: document.getElementById("count-group"),
    startRow: document.getElementById("start-row"),
    masteryPanel: document.getElementById("mastery-panel"),
    flashcardPanel: document.getElementById("flashcard-panel"),
    fcPanelModeQuestion: document.getElementById("fc-panel-mode-question"),
    fcPanelModeChoices: document.getElementById("fc-panel-mode-choices"),
    fcPanelModeDesc: document.getElementById("fc-panel-mode-desc"),
    fcPanelFilterAll: document.getElementById("fc-panel-filter-all"),
    fcPanelFilterReview: document.getElementById("fc-panel-filter-review"),
    fcPanelReviewCount: document.getElementById("fc-panel-review-count"),
    fcPanelStartBtn: document.getElementById("fc-panel-start-btn"),
    masteryBar: document.getElementById("mastery-bar"),
    masteryText: document.getElementById("mastery-text"),
    masteryStartBtn: document.getElementById("mastery-start-btn"),
    masteryResetBtn: document.getElementById("mastery-reset-btn"),
    masteryMessage: document.getElementById("mastery-message"),
    masteryImmediateFeedbackToggle: document.getElementById("mastery-immediate-feedback"),
    quizFeedback: document.getElementById("quiz-feedback"),
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
    flashcardStackNext: document.getElementById("flashcard-stack-next"),
    flashcard: document.getElementById("flashcard"),
    flashcardInner: document.querySelector("#flashcard .flashcard-inner"),
    flashcardFrontFace: document.querySelector("#flashcard .flashcard-front"),
    flashcardBackFace: document.querySelector("#flashcard .flashcard-back"),
    flashcardFrontText: document.getElementById("flashcard-front-text"),
    flashcardFrontImage: document.getElementById("flashcard-front-image"),
    flashcardFrontOptions: document.getElementById("flashcard-front-options"),
    flashcardBackText: document.getElementById("flashcard-back-text"),
    flashcardBackQuestion: document.getElementById("flashcard-back-question"),
    flashcardCounter: document.getElementById("flashcard-counter"),
    flashcardShuffleBtn: document.getElementById("flashcard-shuffle-btn"),
    flashcardFlipBtn: document.getElementById("flashcard-flip-btn"),
    flashcardPrevBtn: document.getElementById("flashcard-prev-btn"),
    flashcardNextBtn: document.getElementById("flashcard-next-btn"),
    flashcardPrevArrows: document.querySelectorAll("#flashcard .flashcard-prev-arrow"),
    flashcardNextArrows: document.querySelectorAll("#flashcard .flashcard-next-arrow"),
    flashcardSwipeOnboarding: document.getElementById("flashcard-swipe-onboarding"),
    flashcardSwipeOnboardingLabel: document.getElementById("flashcard-swipe-onboarding-label"),
    flashcardSwipeDirectionFlash: document.getElementById("flashcard-swipe-direction-flash"),
    flashcardSwipeDirectionFlashLabel: document.getElementById("flashcard-swipe-direction-flash-label"),
    flashcardMarkBtn: document.getElementById("flashcard-mark-btn"),
    flashcardReviewBadge: document.getElementById("flashcard-review-badge"),
    flashcardExitBtn: document.getElementById("flashcard-exit-btn"),
    subnetDrillsPanel: document.getElementById("subnet-drills-panel"),
    subnetDiffEasy: document.getElementById("subnet-diff-easy"),
    subnetDiffMedium: document.getElementById("subnet-diff-medium"),
    subnetDiffHard: document.getElementById("subnet-diff-hard"),
    subnetProblemText: document.getElementById("subnet-problem-text"),
    subnetAnswerNetwork: document.getElementById("subnet-answer-network"),
    subnetAnswerBroadcast: document.getElementById("subnet-answer-broadcast"),
    subnetAnswerFirst: document.getElementById("subnet-answer-first"),
    subnetAnswerLast: document.getElementById("subnet-answer-last"),
    subnetAnswerHosts: document.getElementById("subnet-answer-hosts"),
    subnetDrillMessage: document.getElementById("subnet-drill-message"),
    subnetCheckBtn: document.getElementById("subnet-check-btn"),
    subnetNextBtn: document.getElementById("subnet-next-btn"),
    subnetBreakdown: document.getElementById("subnet-breakdown"),
    subnetStatSolved: document.getElementById("subnet-stat-solved"),
    subnetStatCorrect: document.getElementById("subnet-stat-correct"),
    subnetStatAccuracy: document.getElementById("subnet-stat-accuracy"),
    binaryDiffEasy: document.getElementById("binary-diff-easy"),
    binaryDiffMedium: document.getElementById("binary-diff-medium"),
    binaryDiffHard: document.getElementById("binary-diff-hard"),
    binaryTargetValue: document.getElementById("binary-target-value"),
    binaryBitsRow: document.getElementById("binary-bits-row"),
    binaryCurrentRow: document.getElementById("binary-current-row"),
    binaryCurrentValue: document.getElementById("binary-current-value"),
    binaryGameMessage: document.getElementById("binary-game-message"),
    binaryNextBtn: document.getElementById("binary-next-btn"),
    binaryStatSolved: document.getElementById("binary-stat-solved"),
    binaryStatStreak: document.getElementById("binary-stat-streak"),
    binaryStatBest: document.getElementById("binary-stat-best"),
    portDirForward: document.getElementById("port-dir-forward"),
    portDirReverse: document.getElementById("port-dir-reverse"),
    portMatchLabel: document.getElementById("port-match-label"),
    portMatchQuestion: document.getElementById("port-match-question"),
    portMatchChoices: document.getElementById("port-match-choices"),
    portMatchMessage: document.getElementById("port-match-message"),
    portMatchNextBtn: document.getElementById("port-match-next-btn"),
    portMatchStatSolved: document.getElementById("port-match-stat-solved"),
    portMatchStatCorrect: document.getElementById("port-match-stat-correct"),
    portMatchStatAccuracy: document.getElementById("port-match-stat-accuracy"),
    cliMatchQuestion: document.getElementById("cli-match-question"),
    cliMatchChoices: document.getElementById("cli-match-choices"),
    cliMatchMessage: document.getElementById("cli-match-message"),
    cliMatchNextBtn: document.getElementById("cli-match-next-btn"),
    cliMatchStatSolved: document.getElementById("cli-match-stat-solved"),
    cliMatchStatCorrect: document.getElementById("cli-match-stat-correct"),
    cliMatchStatAccuracy: document.getElementById("cli-match-stat-accuracy"),
    osiSorterChips: document.getElementById("osi-sorter-chips"),
    osiSorterMessage: document.getElementById("osi-sorter-message"),
    osiMnemonicBtn: document.getElementById("osi-mnemonic-btn"),
    osiMnemonicText: document.getElementById("osi-mnemonic-text"),
    osiResetBtn: document.getElementById("osi-reset-btn"),
    osiStatRounds: document.getElementById("osi-stat-rounds"),
    osiStatMistakes: document.getElementById("osi-stat-mistakes"),
    osiStatBest: document.getElementById("osi-stat-best"),
    acronymCounterText: document.getElementById("acronym-counter-text"),
    acronymCard: document.getElementById("acronym-card"),
    acronymFrontText: document.getElementById("acronym-front-text"),
    acronymBackFull: document.getElementById("acronym-back-full"),
    acronymBackDesc: document.getElementById("acronym-back-desc"),
    acronymShuffleBtn: document.getElementById("acronym-shuffle-btn"),
    acronymPrevBtn: document.getElementById("acronym-prev-btn"),
    acronymFlipBtn: document.getElementById("acronym-flip-btn"),
    acronymNextBtn: document.getElementById("acronym-next-btn"),
    processModeTcp: document.getElementById("process-mode-tcp"),
    processModeDora: document.getElementById("process-mode-dora"),
    processSorterChips: document.getElementById("process-sorter-chips"),
    processSorterMessage: document.getElementById("process-sorter-message"),
    processSorterResetBtn: document.getElementById("process-sorter-reset-btn"),
    processSorterStatRounds: document.getElementById("process-sorter-stat-rounds"),
    processSorterStatMistakes: document.getElementById("process-sorter-stat-mistakes"),
    processSorterStatBest: document.getElementById("process-sorter-stat-best"),
    raidMatchQuestion: document.getElementById("raid-match-question"),
    raidMatchChoices: document.getElementById("raid-match-choices"),
    raidMatchMessage: document.getElementById("raid-match-message"),
    raidMatchNextBtn: document.getElementById("raid-match-next-btn"),
    raidMatchStatSolved: document.getElementById("raid-match-stat-solved"),
    raidMatchStatCorrect: document.getElementById("raid-match-stat-correct"),
    raidMatchStatAccuracy: document.getElementById("raid-match-stat-accuracy"),
    ipv4ClassifyQuestion: document.getElementById("ipv4-classify-question"),
    ipv4ClassifyChoices: document.getElementById("ipv4-classify-choices"),
    ipv4ClassifyMessage: document.getElementById("ipv4-classify-message"),
    ipv4ClassifyNextBtn: document.getElementById("ipv4-classify-next-btn"),
    ipv4ClassifyStatSolved: document.getElementById("ipv4-classify-stat-solved"),
    ipv4ClassifyStatCorrect: document.getElementById("ipv4-classify-stat-correct"),
    ipv4ClassifyStatAccuracy: document.getElementById("ipv4-classify-stat-accuracy"),
    osCmdMatchQuestion: document.getElementById("os-cmd-match-question"),
    osCmdMatchChoices: document.getElementById("os-cmd-match-choices"),
    osCmdMatchMessage: document.getElementById("os-cmd-match-message"),
    osCmdMatchNextBtn: document.getElementById("os-cmd-match-next-btn"),
    osCmdMatchStatSolved: document.getElementById("os-cmd-match-stat-solved"),
    osCmdMatchStatCorrect: document.getElementById("os-cmd-match-stat-correct"),
    osCmdMatchStatAccuracy: document.getElementById("os-cmd-match-stat-accuracy"),
    cableIdImage: document.getElementById("cable-id-image"),
    cableIdChoices: document.getElementById("cable-id-choices"),
    cableIdMessage: document.getElementById("cable-id-message"),
    cableIdNextBtn: document.getElementById("cable-id-next-btn"),
    cableIdStatSolved: document.getElementById("cable-id-stat-solved"),
    cableIdStatCorrect: document.getElementById("cable-id-stat-correct"),
    cableIdStatAccuracy: document.getElementById("cable-id-stat-accuracy"),
    topologyIdDiagram: document.getElementById("topology-id-diagram"),
    topologyIdChoices: document.getElementById("topology-id-choices"),
    topologyIdMessage: document.getElementById("topology-id-message"),
    topologyIdNextBtn: document.getElementById("topology-id-next-btn"),
    topologyIdStatSolved: document.getElementById("topology-id-stat-solved"),
    topologyIdStatCorrect: document.getElementById("topology-id-stat-correct"),
    topologyIdStatAccuracy: document.getElementById("topology-id-stat-accuracy"),
    secplusCounterText: document.getElementById("secplus-counter-text"),
    secplusCard: document.getElementById("secplus-card"),
    secplusFrontText: document.getElementById("secplus-front-text"),
    secplusBackFull: document.getElementById("secplus-back-full"),
    secplusBackDesc: document.getElementById("secplus-back-desc"),
    secplusShuffleBtn: document.getElementById("secplus-shuffle-btn"),
    secplusPrevBtn: document.getElementById("secplus-prev-btn"),
    secplusFlipBtn: document.getElementById("secplus-flip-btn"),
    secplusNextBtn: document.getElementById("secplus-next-btn"),
    natoPhoneticQuestion: document.getElementById("nato-phonetic-question"),
    natoPhoneticChoices: document.getElementById("nato-phonetic-choices"),
    natoPhoneticMessage: document.getElementById("nato-phonetic-message"),
    natoPhoneticNextBtn: document.getElementById("nato-phonetic-next-btn"),
    natoPhoneticStatSolved: document.getElementById("nato-phonetic-stat-solved"),
    natoPhoneticStatCorrect: document.getElementById("nato-phonetic-stat-correct"),
    natoPhoneticStatAccuracy: document.getElementById("nato-phonetic-stat-accuracy"),
    precedenceMatchQuestion: document.getElementById("precedence-match-question"),
    precedenceMatchChoices: document.getElementById("precedence-match-choices"),
    precedenceMatchMessage: document.getElementById("precedence-match-message"),
    precedenceMatchNextBtn: document.getElementById("precedence-match-next-btn"),
    precedenceMatchStatSolved: document.getElementById("precedence-match-stat-solved"),
    precedenceMatchStatCorrect: document.getElementById("precedence-match-stat-correct"),
    precedenceMatchStatAccuracy: document.getElementById("precedence-match-stat-accuracy"),
    rfSpectrumQuestion: document.getElementById("rf-spectrum-question"),
    rfSpectrumChoices: document.getElementById("rf-spectrum-choices"),
    rfSpectrumMessage: document.getElementById("rf-spectrum-message"),
    rfSpectrumNextBtn: document.getElementById("rf-spectrum-next-btn"),
    rfSpectrumStatSolved: document.getElementById("rf-spectrum-stat-solved"),
    rfSpectrumStatCorrect: document.getElementById("rf-spectrum-stat-correct"),
    rfSpectrumStatAccuracy: document.getElementById("rf-spectrum-stat-accuracy"),
    serverRolesQuestion: document.getElementById("server-roles-question"),
    serverRolesChoices: document.getElementById("server-roles-choices"),
    serverRolesMessage: document.getElementById("server-roles-message"),
    serverRolesNextBtn: document.getElementById("server-roles-next-btn"),
    serverRolesStatSolved: document.getElementById("server-roles-stat-solved"),
    serverRolesStatCorrect: document.getElementById("server-roles-stat-correct"),
    serverRolesStatAccuracy: document.getElementById("server-roles-stat-accuracy"),
    ohmsVoltage: document.getElementById("ohms-voltage"),
    ohmsCurrent: document.getElementById("ohms-current"),
    ohmsResistance: document.getElementById("ohms-resistance"),
    ohmsPower: document.getElementById("ohms-power"),
    ohmsLawMessage: document.getElementById("ohms-law-message"),
    ohmsLawCalcBtn: document.getElementById("ohms-law-calc-btn"),
    ohmsLawResetBtn: document.getElementById("ohms-law-reset-btn"),
    wirelessMatchQuestion: document.getElementById("wireless-match-question"),
    wirelessMatchChoices: document.getElementById("wireless-match-choices"),
    wirelessMatchMessage: document.getElementById("wireless-match-message"),
    wirelessMatchNextBtn: document.getElementById("wireless-match-next-btn"),
    wirelessMatchStatSolved: document.getElementById("wireless-match-stat-solved"),
    wirelessMatchStatCorrect: document.getElementById("wireless-match-stat-correct"),
    wirelessMatchStatAccuracy: document.getElementById("wireless-match-stat-accuracy"),
    logicGatesQuestion: document.getElementById("logic-gates-question"),
    logicGatesChoices: document.getElementById("logic-gates-choices"),
    logicGatesMessage: document.getElementById("logic-gates-message"),
    logicGatesNextBtn: document.getElementById("logic-gates-next-btn"),
    logicGatesStatSolved: document.getElementById("logic-gates-stat-solved"),
    logicGatesStatCorrect: document.getElementById("logic-gates-stat-correct"),
    logicGatesStatAccuracy: document.getElementById("logic-gates-stat-accuracy"),
    cloudModelsQuestion: document.getElementById("cloud-models-question"),
    cloudModelsChoices: document.getElementById("cloud-models-choices"),
    cloudModelsMessage: document.getElementById("cloud-models-message"),
    cloudModelsNextBtn: document.getElementById("cloud-models-next-btn"),
    cloudModelsStatSolved: document.getElementById("cloud-models-stat-solved"),
    cloudModelsStatCorrect: document.getElementById("cloud-models-stat-correct"),
    cloudModelsStatAccuracy: document.getElementById("cloud-models-stat-accuracy"),
    myFcDecksView: document.getElementById("my-fc-decks-view"),
    myFcDeckName: document.getElementById("my-fc-deck-name"),
    myFcCreateDeckBtn: document.getElementById("my-fc-create-deck-btn"),
    myFcDeckMessage: document.getElementById("my-fc-deck-message"),
    myFcDeckCount: document.getElementById("my-fc-deck-count"),
    myFcDeckList: document.getElementById("my-fc-deck-list"),
    myFcDeckDetail: document.getElementById("my-fc-deck-detail"),
    myFcBackToDecks: document.getElementById("my-fc-back-to-decks"),
    myFcDeckTitle: document.getElementById("my-fc-deck-title"),
    myFcDeleteDeckBtn: document.getElementById("my-fc-delete-deck-btn"),
    myFcFront: document.getElementById("my-fc-front"),
    myFcBack: document.getElementById("my-fc-back"),
    myFcAddBtn: document.getElementById("my-fc-add-btn"),
    myFcMessage: document.getElementById("my-fc-message"),
    myFcCount: document.getElementById("my-fc-count"),
    myFcStudyBtn: document.getElementById("my-fc-study-btn"),
    myFcList: document.getElementById("my-fc-list"),
    myFcStudyArea: document.getElementById("my-fc-study-area"),
    myFcCounter: document.getElementById("my-fc-counter"),
    myFcShuffleBtn: document.getElementById("my-fc-shuffle-btn"),
    myFcCard: document.getElementById("my-fc-card"),
    myFcFrontText: document.getElementById("my-fc-front-text"),
    myFcBackText: document.getElementById("my-fc-back-text"),
    myFcPrevBtn: document.getElementById("my-fc-prev-btn"),
    myFcFlipBtn: document.getElementById("my-fc-flip-btn"),
    myFcNextBtn: document.getElementById("my-fc-next-btn"),
    myFcExitBtn: document.getElementById("my-fc-exit-btn"),
};

const DEFAULT_PROFILE = { theme: "ocean", avatar_image: "" };
const THEMES = [
    { key: "ocean", label: "Ocean" },
    { key: "midnight", label: "Midnight" },
    { key: "forest", label: "Forest" },
    { key: "sunset", label: "Sunset" },
    { key: "jenelle", label: "Jenelle" },
];

let profileDraft = { ...DEFAULT_PROFILE };
let avatarSnapshot = null;

let cropState = { scale: 1, offsetX: 0, offsetY: 0, dragging: false, startX: 0, startY: 0, imgWidth: 0, imgHeight: 0 };
let cropImageLoaded = false;

function getProfile() {
    return { ...DEFAULT_PROFILE, ...state.userProfile };
}

function getAvatarImage(avatarImage, username) {
    if (avatarImage && typeof avatarImage === "string") return avatarImage;
    const name = username || "guest";
    const initials = name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="128" height="128" viewBox="0 0 128 128"><rect width="128" height="128" fill="%23${getComputedStyle(document.documentElement).getPropertyValue("--accent").trim().replace("#", "") || "3b82f6"}"/><text x="64" y="72" font-size="48" fill="%23fff" text-anchor="middle" font-family="sans-serif">${initials}</text></svg>`;
    return "data:image/svg+xml," + encodeURIComponent(svg);
}

function applyProfileTheme(profile) {
    const theme = profile.theme || "ocean";
    document.documentElement.dataset.theme = theme;
}

function updateNavAvatar() {
    const profile = getProfile();
    els.navAvatar.src = getAvatarImage(profile.avatar_image, state.user);
    els.authUser.textContent = state.user || "";
}

async function loadProfile() {
    if (!state.user) return;
    try {
        const res = await fetch(API.profile, { credentials: "same-origin", cache: "no-store" });
        const data = await res.json();
        if (data.ok && data.profile) {
            state.userProfile = data.profile;
            applyProfileTheme(getProfile());
            updateNavAvatar();
            updateChatAvatars({});
        }
    } catch (err) {
        // ignore
    }
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

function setAuthLoading(loading, text = "") {
    const isLogin = state.authModalMode === "login";
    els.modalSubmit.classList.toggle("hidden", loading);
    els.modalCancel.classList.toggle("hidden", loading);
    els.authLoading.classList.toggle("hidden", !loading);
    if (loading) {
        els.authLoadingText.textContent = text || (isLogin ? "Logging in..." : "Signing up...");
    }
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
    state.authChecked = true;
    applyProfileTheme(getProfile());
    renderAuthState();
    renderAccountPrompt();
    renderHomeRecentActivity();
    if (state.currentTab === "history") loadHistory();
}

async function login() {
    const username = els.modalUsername.value.trim();
    const password = els.modalPassword.value;
    if (!username || !password) {
        setAuthMessage("Enter a username and password.", "error");
        return;
    }
    setAuthLoading(true, "Logging in...");
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
        renderHomeRecentActivity();
        if (state.currentTab === "history") loadHistory();
    } catch (err) {
        setAuthMessage(err.message, "error");
    } finally {
        setAuthLoading(false);
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
    setAuthLoading(true, "Signing up...");
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
        setAuthLoading(false);
    }
}

function submitAuth() {
    if (!els.authLoading.classList.contains("hidden")) return;
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
    setAuthLoading(false);
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
    } finally {
        closeProfileModal();
    }
}

function setProfileMessage(text, type = "") {
    els.profileMessage.textContent = text;
    els.profileMessage.className = "auth-message" + (type ? ` ${type}` : "");
}

function updateAvatarPreview() {
    const src = getAvatarImage(profileDraft.avatar_image, state.user);
    if (els.profileAvatarPreview) els.profileAvatarPreview.src = src;
}

function openAvatarCrop(file) {
    const errorEl = els.avatarUploadError;
    if (!file || !file.type.startsWith("image/")) {
        if (errorEl) errorEl.textContent = "Please choose an image file.";
        return;
    }
    if (errorEl) errorEl.textContent = "";
    const reader = new FileReader();
    reader.onload = (e) => {
        if (els.cropImage) {
            cropImageLoaded = false;
            els.cropImage.src = e.target.result;
            els.cropImage.onload = () => {
                cropImageLoaded = true;
                cropState.imgWidth = els.cropImage.naturalWidth;
                cropState.imgHeight = els.cropImage.naturalHeight;
                const baseScale = Math.max(256 / cropState.imgWidth, 256 / cropState.imgHeight);
                cropState.scale = baseScale;
                cropState.offsetX = 0;
                cropState.offsetY = 0;
                if (els.cropZoom) {
                    els.cropZoom.min = baseScale.toFixed(3);
                    els.cropZoom.max = Math.max(baseScale * 5, 5).toFixed(3);
                    els.cropZoom.step = (Math.max(baseScale, 1) / 50).toFixed(3);
                    els.cropZoom.value = baseScale.toFixed(3);
                }
                updateCropTransform();
                if (els.avatarCropModal) els.avatarCropModal.classList.remove("hidden");
            };
            els.cropImage.onerror = () => {
                if (errorEl) errorEl.textContent = "Could not read image.";
            };
        }
    };
    reader.readAsDataURL(file);
}

function closeAvatarCrop() {
    if (els.avatarCropModal) els.avatarCropModal.classList.add("hidden");
    cropImageLoaded = false;
}

function clampCropOffset() {
    const halfW = cropState.imgWidth * cropState.scale / 2;
    const halfH = cropState.imgHeight * cropState.scale / 2;
    const maxX = halfW - 128;
    const maxY = halfH - 128;
    if (maxX > 0) {
        cropState.offsetX = Math.max(-maxX, Math.min(maxX, cropState.offsetX));
    } else {
        cropState.offsetX = 0;
    }
    if (maxY > 0) {
        cropState.offsetY = Math.max(-maxY, Math.min(maxY, cropState.offsetY));
    } else {
        cropState.offsetY = 0;
    }
}

function updateCropTransform() {
    if (!els.cropImage) return;
    clampCropOffset();
    els.cropImage.style.setProperty("--crop-scale", cropState.scale);
    els.cropImage.style.setProperty("--crop-x", `${cropState.offsetX}px`);
    els.cropImage.style.setProperty("--crop-y", `${cropState.offsetY}px`);
}

function onCropPointerDown(e) {
    if (!cropImageLoaded) return;
    e.preventDefault();
    cropState.dragging = true;
    const point = e.touches ? e.touches[0] : e;
    cropState.startX = point.clientX - cropState.offsetX;
    cropState.startY = point.clientY - cropState.offsetY;
    if (els.cropImage) els.cropImage.style.cursor = "grabbing";
}

function onCropPointerMove(e) {
    if (!cropState.dragging) return;
    e.preventDefault();
    const point = e.touches ? e.touches[0] : e;
    cropState.offsetX = point.clientX - cropState.startX;
    cropState.offsetY = point.clientY - cropState.startY;
    updateCropTransform();
}

function onCropPointerUp() {
    cropState.dragging = false;
    if (els.cropImage) els.cropImage.style.cursor = "grab";
}

function saveAvatarCrop() {
    if (!cropImageLoaded || !els.cropImage) return;
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");
    const topLeftX = 128 + cropState.offsetX - (cropState.imgWidth * cropState.scale) / 2;
    const topLeftY = 128 + cropState.offsetY - (cropState.imgHeight * cropState.scale) / 2;
    const sx = (0 - topLeftX) / cropState.scale;
    const sy = (0 - topLeftY) / cropState.scale;
    const sw = 256 / cropState.scale;
    const sh = 256 / cropState.scale;
    ctx.drawImage(els.cropImage, sx, sy, sw, sh, 0, 0, 256, 256);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
    if (dataUrl.length > 500_000) {
        if (els.avatarUploadError) els.avatarUploadError.textContent = "Processed image is too large. Try a smaller photo.";
        return;
    }
    profileDraft.avatar_image = dataUrl;
    updateAvatarPreview();
    autoSaveProfile();
    closeAvatarCrop();
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
            autoSaveProfile();
        });
        els.themePicker.appendChild(btn);
    });
}

async function openProfileModal() {
    await loadProfile();
    profileDraft = { ...getProfile() };
    if (els.avatarUpload) els.avatarUpload.value = "";
    if (els.avatarUploadError) els.avatarUploadError.textContent = "";
    els.profileUsername.textContent = state.user || "";
    updateAvatarPreview();
    renderThemePicker(profileDraft.theme);
    setProfileMessage("");
    els.profileModal.classList.remove("hidden");
}

function closeProfileModal() {
    els.profileModal.classList.add("hidden");
}

async function persistProfile() {
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
    if (state.currentTab === "community") {
        loadChat();
        loadChatAvatars();
    }
    return data;
}

let profileMessageTimeout = null;

async function autoSaveProfile() {
    try {
        await persistProfile();
        setProfileMessage("Saved", "success");
        clearTimeout(profileMessageTimeout);
        profileMessageTimeout = setTimeout(() => setProfileMessage(""), 1500);
    } catch (err) {
        setProfileMessage(err.message, "error");
    }
}

function renderAccountPrompt() {
    if (els.accountPrompt) {
        els.accountPrompt.classList.toggle("hidden", !!state.user);
    }
    const homeLoginPrompt = document.getElementById("home-login-prompt");
    if (homeLoginPrompt) {
        homeLoginPrompt.classList.toggle("hidden", !!state.user);
    }
}

const ACTIVITY_ICONS = {
    mastery: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>',
    practice: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>',
    flashcards: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>',
    game: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    cli: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>',
};

async function renderHomeRecentActivity() {
    const strip = document.getElementById("home-recent-activity");
    const iconEl = document.getElementById("home-recent-icon");
    const labelEl = document.getElementById("home-recent-label");
    const detailEl = document.getElementById("home-recent-detail");
    const ctaEl = document.getElementById("home-recent-cta");
    if (!strip || !iconEl || !labelEl || !detailEl || !ctaEl) return;

    if (!state.user) {
        labelEl.textContent = "Recent Activity";
        detailEl.textContent = "Log in to see your recent activity";
        ctaEl.textContent = "";
        strip.removeAttribute("data-tab");
        strip.removeAttribute("data-hub-section");
        return;
    }

    try {
        const res = await fetch(API.recentActivity, { credentials: "same-origin", cache: "no-store" });
        const data = await res.json();
        if (data.ok && data.activity) {
            const a = data.activity;
            labelEl.textContent = "Continue where you left off";
            detailEl.textContent = a.label + (a.detail ? ` · ${a.detail}` : "");
            ctaEl.textContent = "Resume \u2192";
            iconEl.innerHTML = ACTIVITY_ICONS[a.type] || ACTIVITY_ICONS.practice;
            strip.dataset.tab = a.tab;
        } else {
            labelEl.textContent = "Recent Activity";
            detailEl.textContent = "Start studying \u2014 your last activity will show here";
            ctaEl.textContent = "Get started \u2192";
            strip.dataset.tab = "practice";
        }
    } catch (e) {
        // ignore
    }
}

async function saveRecentActivity(type, label, tab, detail = "") {
    if (!state.user) return;
    try {
        await fetch(API.recentActivity, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ type, label, tab, detail }),
        });
    } catch (e) {
        // ignore
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
    validateQuestionCount();
}

function validateQuestionCount() {
    if (!els.questionCount || !els.questionCountHint) return true;
    const max = parseInt(els.totalQuestions.dataset.count || "0", 10) || 0;
    const requested = parseInt(els.questionCount.value, 10);
    if (max > 0 && requested > max) {
        els.questionCount.classList.add("input-error");
        els.questionCountHint.classList.add("error");
        els.questionCountHint.textContent = `That number is too big — this exam only has ${max} question${max === 1 ? "" : "s"}.`;
        return false;
    }
    els.questionCount.classList.remove("input-error");
    els.questionCountHint.classList.remove("error");
    els.questionCountHint.textContent = "✎ Type any number you'd like";
    return true;
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
            if (typeof window.EXAM_FILENAME === "string" && window.EXAM_FILENAME && state.exams.find((e) => e.filename === window.EXAM_FILENAME)) {
                await loadExam(window.EXAM_FILENAME, true);
                switchTab("practice");
            }
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

function getExamCategory(exam) {
    const name = (exam.display_name || exam.title || exam.filename).toUpperCase();
    if (name.includes("IT ESSENTIALS") || name.includes("ITE")) return "IT Essentials";
    if (name.includes("CCNA")) return "CCNA";
    return "Comms/MRTS";
}

function groupExamsByCategory(exams) {
    const groups = {};
    exams.forEach((exam) => {
        const cat = getExamCategory(exam);
        if (!groups[cat]) groups[cat] = [];
        groups[cat].push(exam);
    });
    const order = ["IT Essentials", "CCNA", "Comms/MRTS"];
    return order.filter((cat) => groups[cat]).map((cat) => ({ category: cat, exams: groups[cat] }));
}

function getCategoryForFilename(filename) {
    const exam = state.exams.find((e) => e.filename === filename);
    return exam ? getExamCategory(exam) : "";
}

function renderExamGroups(container, activeFilename, onSelect, defaultCategory = "") {
    container.innerHTML = "";
    if (!state.exams.length) {
        container.innerHTML = '<p class="empty-state">No exams found.</p>';
        return;
    }
    const groups = groupExamsByCategory(state.exams);
    const selectedCategory = activeFilename ? getCategoryForFilename(activeFilename) : "";
    const activeCategory = container.dataset.viewCategory || selectedCategory || defaultCategory || groups[0].category;

    const label = document.createElement("div");
    label.className = "exam-category-label";
    label.textContent = "Choose a category:";
    container.appendChild(label);

    const tabs = document.createElement("div");
    tabs.className = "exam-category-tabs";
    tabs.setAttribute("role", "tablist");
    tabs.setAttribute("aria-label", "Exam categories");
    const displayNames = { "IT Essentials": "ITE", CCNA: "CCNA", "Comms/MRTS": "Comms/MRTS" };
    groups.forEach(({ category }) => {
        const tab = document.createElement("button");
        tab.type = "button";
        tab.className = "exam-category-tab" + (category === activeCategory ? " active" : "");
        tab.textContent = displayNames[category] || category;
        tab.setAttribute("role", "tab");
        tab.setAttribute("aria-selected", category === activeCategory ? "true" : "false");
        tab.addEventListener("click", () => {
            container.dataset.viewCategory = category;
            renderExamGroups(container, activeFilename, onSelect, category);
        });
        tabs.appendChild(tab);
    });
    container.appendChild(tabs);

    const categoryDescriptions = {
        "IT Essentials": "Questions are sourced directly from the test. At random, around 50 of these same questions will be on your test. Pro Tip: focus on the keywords in the correct answers to speed up memorization. Most shipmates score 90% or 100% with this method. Unlike ITExamAnswers and Quizlet, this site is built specifically to make studying and memorizing answers easy.",
        "CCNA": "Questions are sourced directly from the test. At random, around 50 of these same questions will be on your test. Pro Tip: focus on the keywords in the correct answers to speed up memorization. Most shipmates score 90% or 100% with this method. Unlike ITExamAnswers and Quizlet, this site is built specifically to make studying and memorizing answers easy."
    };
    const categoryDescription = categoryDescriptions[activeCategory];
    if (categoryDescription && container !== els.flashcardExamButtons) {
        const details = document.createElement("details");
        details.className = "exam-category-disclaimer";
        details.open = true;

        const summary = document.createElement("summary");
        summary.className = "exam-category-disclaimer-summary";

        const summaryLabel = document.createElement("span");
        summaryLabel.textContent = "See less";
        summary.appendChild(summaryLabel);

        details.addEventListener("toggle", () => {
            summaryLabel.textContent = details.open ? "See less" : "See more";
        });

        const text = document.createElement("p");
        text.className = "exam-category-disclaimer-text";
        text.textContent = categoryDescription;

        details.appendChild(summary);
        details.appendChild(text);
        container.appendChild(details);
    }

    const activeGroup = groups.find((g) => g.category === activeCategory) || groups[0];
    const grid = document.createElement("div");
    grid.className = "exam-grid";
    activeGroup.exams.forEach((exam) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn btn-exam" + (activeFilename === exam.filename ? " active" : "");
        btn.dataset.filename = exam.filename;
        btn.innerHTML = `<span class="exam-name">${escapeHtml(exam.display_name || exam.title)}</span><span class="exam-count">${exam.count || 0} questions</span>`;
        btn.addEventListener("click", () => {
            onSelect(exam.filename);
            container.dataset.viewCategory = getCategoryForFilename(exam.filename);
            renderExamGroups(container, exam.filename, onSelect, container.dataset.viewCategory);
        });
        grid.appendChild(btn);
    });
    container.appendChild(grid);
}

function renderExamButtons() {
    renderExamGroups(els.examButtons, state.currentFilename, loadExam, "IT Essentials");
}

function updateExamButtonSelection(filename) {
    Array.from(els.examButtons.querySelectorAll(".btn-exam")).forEach((btn) => {
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
        state.flashcardFilename = filename;
        state.allQuestions = data.questions || [];
        updateHeader();
        if (updateSelection) updateExamButtonSelection(filename);
        setAvailableCount(data.count);
        const requested = parseInt(els.questionCount.value, 10) || 20;
        els.questionCount.value = Math.min(requested, data.count);
        setMessage("Ready to start.");
        if (typeof updateFcPanelStartBtn === "function") updateFcPanelStartBtn();
        if (typeof renderFlashcardExamButtons === "function") renderFlashcardExamButtons();
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
    // Reset all mode buttons
    [els.modePractice, els.modeMastery, els.modeFlashcards].forEach((btn) => {
        if (btn) {
            btn.classList.remove("active", "btn-primary");
            btn.classList.add("btn-secondary");
        }
    });
    if (mode === "practice") {
        els.modePractice.classList.add("active", "btn-primary");
        els.modePractice.classList.remove("btn-secondary");
        els.modeDescription.textContent = "Random questions each test. Great for quick review.";
        els.countGroup.classList.remove("hidden");
        els.startRow.classList.remove("hidden");
        els.masteryPanel.classList.add("hidden");
        if (els.flashcardPanel) els.flashcardPanel.classList.add("hidden");
        els.startBtn.textContent = "Start Test";
    } else if (mode === "mastery") {
        els.modeMastery.classList.add("active", "btn-primary");
        els.modeMastery.classList.remove("btn-secondary");
        els.modeDescription.textContent = "Keep seeing questions until you've mastered every single one.";
        els.countGroup.classList.add("hidden");
        els.startRow.classList.add("hidden");
        els.masteryPanel.classList.remove("hidden");
        if (els.flashcardPanel) els.flashcardPanel.classList.add("hidden");
        renderMasteryPanel();
    } else if (mode === "flashcards") {
        els.modeFlashcards.classList.add("active", "btn-primary");
        els.modeFlashcards.classList.remove("btn-secondary");
        els.modeDescription.textContent = "Flip through cards at your own pace to memorize answers.";
        els.countGroup.classList.add("hidden");
        els.startRow.classList.add("hidden");
        els.masteryPanel.classList.add("hidden");
        if (els.flashcardPanel) els.flashcardPanel.classList.remove("hidden");
        if (!state.flashcardFilename && state.currentFilename) {
            state.flashcardFilename = state.currentFilename;
        }
        if (typeof updateFcPanelStartBtn === "function") updateFcPanelStartBtn();
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
            `${API.masteryBatch}?n=${DEFAULT_MASTERY_SIZE}&filename=${encodeURIComponent(state.currentFilename)}`,
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
        state.testQuestions = withShuffledOptions(data.quiz);
        state.lastTestQuestions = [...data.quiz];
        state.answers = {};
        state.masteryLockedQids = new Set();
        state.testQuestions.forEach((q) => {
            state.answers[q.id] = q.type === "matching" ? {} : [];
        });
        state.currentIndex = 0;
        state.secondsElapsed = 0;
        state.multiSelect = false;
        state.masteryBatchType = null;
        markQuizRunStart();
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

    const quiz = state.testQuestions;
    const answers = {};
    quiz.forEach((q) => { answers[q.id] = state.answers[q.id]; });

    try {
        const res = await fetch(API.masterySubmit, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({
                filename: state.currentFilename,
                answers,
                quiz,
            }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "Could not save mastery results");
        state.masterySummary = data.summary;
        const pct = data.summary && data.summary.total > 0 ? Math.round((data.summary.mastered / data.summary.total) * 100) : 0;
        saveRecentActivity("mastery", "Mastery Mode", "practice", `${state.title} · ${pct}% mastered`);

        const results = computeResults(quiz, state.answers);
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
    if (!validateQuestionCount()) return;
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
        state.testQuestions = withShuffledOptions(data.quiz);
        state.lastTestQuestions = [...data.quiz];
        if (data.title) state.title = data.title;
        updateHeader();
    } catch (err) {
        if (state.allQuestions.length) {
            const localQuiz = generateLocalQuiz(n);
            state.testQuestions = withShuffledOptions(localQuiz);
            state.lastTestQuestions = [...localQuiz];
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
    markQuizRunStart();
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
                setTimeout(() => {
                    if (state.mode === "mastery") {
                        submitMastery();
                    } else {
                        submitTest();
                    }
                }, 1200);
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

function goBackToApp() {
    const onQuiz = screens.quiz.classList.contains("active");
    if (onQuiz && !confirm("Leave this test? Unsubmitted answers won't be saved.")) {
        return;
    }
    if (screens.results.classList.contains("active")) {
        state.answers = {};
        state.currentIndex = 0;
        state.secondsElapsed = 0;
        stopTimer();
    }
    stopTimer();
    state.testQuestions = [];
    state.answers = {};
    state.currentIndex = 0;
    state.secondsElapsed = 0;
    state.mode = "practice";
    setMode("practice");
    const tabName = state.currentTab && state.currentTab !== "home" ? state.currentTab : "practice";
    if (state.currentTab === tabName) {
        showScreen(tabName === "practice" ? "setup" : tabName);
    } else {
        switchTab(tabName);
    }
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
    const galleryApps = ["gallery", "myFlashcards", "binary", "subnetDrills", "portMatch", "cliMatch", "osiSorter", "acronymDrill", "processSorter", "raidMatch", "ipv4Classify", "osCmdMatch", "cableId", "topologyId", "secplusFlash", "natoPhonetic", "precedenceMatch", "rfSpectrum", "serverRoles", "ohmsLaw", "wirelessMatch", "logicGates", "cloudModels"];
    const GAME_NAMES = { binary: "Binary Converter", subnetDrills: "Subnet Drills", portMatch: "Port Match", cliMatch: "CLI Match", osiSorter: "OSI Sorter", acronymDrill: "Acronym Drill", processSorter: "Process Sorter", raidMatch: "RAID Match", ipv4Classify: "IPv4 Classify", osCmdMatch: "OS Cmd Match", cableId: "Cable ID", topologyId: "Topology ID", secplusFlash: "Sec+ Flash", natoPhonetic: "NATO Phonetic", precedenceMatch: "Precedence Match", rfSpectrum: "RF Spectrum", serverRoles: "Server Roles", ohmsLaw: "Ohm's Law", wirelessMatch: "Wireless Match", logicGates: "Logic Gates", cloudModels: "Cloud Models" };
    if (GAME_NAMES[tabName]) {
        saveRecentActivity("game", GAME_NAMES[tabName], tabName);
    } else if (tabName === "packetTracer") {
        saveRecentActivity("cli", "CLI Practice", "packetTracer");
    }
    const homeScreens = ["home", "packetTracer"];
    const studyTabs = ["practice", "flashcards"];
    if (els.tabHome) els.tabHome.classList.toggle("active", homeScreens.includes(tabName));
    if (els.tabPractice) els.tabPractice.classList.toggle("active", studyTabs.includes(tabName));
    if (els.tabFlashcards) els.tabFlashcards.classList.toggle("active", tabName === "flashcards");
    if (els.tabHistory) els.tabHistory.classList.toggle("active", tabName === "history");
    if (els.tabCommunity) els.tabCommunity.classList.toggle("active", tabName === "community");
    if (els.tabAllApps) els.tabAllApps.classList.toggle("active", galleryApps.includes(tabName));
    if (els.tabAllAppsHeader) els.tabAllAppsHeader.classList.toggle("active", galleryApps.includes(tabName));
    if (els.tabNav) {
        els.tabNav.classList.remove("hidden");
        els.tabNav.classList.add("bottom-nav");
    }
    [els.tabHome, els.tabPractice, els.tabFlashcards, els.tabHistory, els.tabCommunity, els.tabAllApps, els.tabAllAppsHeader].forEach((btn) => {
        if (btn) btn.setAttribute("aria-selected", btn.classList.contains("active") ? "true" : "false");
    });
    stopChatPolling();
    // Update URL
    const TAB_ROUTES = { home: "/", practice: "/study", flashcards: "/study", packetTracer: "/packet-tracer", gallery: "/apps", history: "/history" };
    const route = TAB_ROUTES[tabName];
    if (route && window.location.pathname !== route) {
        history.pushState({ tab: tabName }, "", route);
    }
    if (tabName === "home") {
        showScreen("home");
    } else if (tabName === "packetTracer") {
        showScreen("packetTracer");
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
    } else if (tabName === "gallery") {
        showScreen("gallery");
    } else if (tabName === "binary") {
        showScreen("binary");
        if (!state.binaryGame.bitValues.length) generateBinaryProblem();
    } else if (tabName === "subnetDrills") {
        showScreen("subnetDrills");
        if (!state.subnetDrill.current) generateSubnetProblem();
    } else if (tabName === "portMatch") {
        showScreen("portMatch");
        if (!state.portMatch.current) generatePortMatchQuestion();
    } else if (tabName === "cliMatch") {
        showScreen("cliMatch");
        if (!state.cliMatch.current) generateCliMatchQuestion();
    } else if (tabName === "osiSorter") {
        showScreen("osiSorter");
        if (!state.osiSorter.order.length) startOsiRound();
    } else if (tabName === "acronymDrill") {
        showScreen("acronymDrill");
        if (!state.acronymDrill.deck.length) initAcronymDrill();
    } else if (tabName === "processSorter") {
        showScreen("processSorter");
        if (!state.processSorter.order.length) startProcessRound();
    } else if (tabName === "raidMatch") {
        showScreen("raidMatch");
        if (!state.raidMatch.current) generateRaidMatchQuestion();
    } else if (tabName === "ipv4Classify") {
        showScreen("ipv4Classify");
        if (!state.ipv4Classify.current) generateIpv4ClassifyQuestion();
    } else if (tabName === "osCmdMatch") {
        showScreen("osCmdMatch");
        if (!state.osCmdMatch.current) generateOsCmdMatchQuestion();
    } else if (tabName === "cableId") {
        showScreen("cableId");
        if (!state.cableId.current) generateCableIdQuestion();
    } else if (tabName === "topologyId") {
        showScreen("topologyId");
        if (!state.topologyId.current) generateTopologyIdQuestion();
    } else if (tabName === "secplusFlash") {
        showScreen("secplusFlash");
        if (!state.secplusFlash.deck.length) initSecplusFlash();
    } else if (tabName === "natoPhonetic") {
        showScreen("natoPhonetic");
        if (!state.natoPhonetic.current) generateNatoPhoneticQuestion();
    } else if (tabName === "precedenceMatch") {
        showScreen("precedenceMatch");
        if (!state.precedenceMatch.current) generatePrecedenceMatchQuestion();
    } else if (tabName === "rfSpectrum") {
        showScreen("rfSpectrum");
        if (!state.rfSpectrum.current) generateRfSpectrumQuestion();
    } else if (tabName === "serverRoles") {
        showScreen("serverRoles");
        if (!state.serverRoles.current) generateServerRolesQuestion();
    } else if (tabName === "ohmsLaw") {
        showScreen("ohmsLaw");
    } else if (tabName === "wirelessMatch") {
        showScreen("wirelessMatch");
        if (!state.wirelessMatch.current) generateWirelessMatchQuestion();
    } else if (tabName === "logicGates") {
        showScreen("logicGates");
        if (!state.logicGates.current) generateLogicGatesQuestion();
    } else if (tabName === "cloudModels") {
        showScreen("cloudModels");
        if (!state.cloudModels.current) generateCloudModelsQuestion();
    } else if (tabName === "myFlashcards") {
        showScreen("myFlashcards");
        loadMyFlashcards();
    }
}

async function loadHistory() {
    if (!state.authChecked) {
        renderHistory();
        return;
    }
    if (!state.user) {
        state.historyAttempts = [];
        renderHistory();
        return;
    }
    try {
        const res = await fetch(API.history, { credentials: "same-origin", cache: "no-store" });
        const data = await res.json();
        state.historyAttempts = res.ok && data.ok ? data.attempts || [] : [];
        state.historyTestsTaken = res.ok && data.ok ? data.tests_taken ?? state.historyAttempts.length : 0;
    } catch (err) {
        state.historyAttempts = [];
        state.historyTestsTaken = 0;
    }
    renderHistory();
}

function renderHistory() {
    if (!state.authChecked) {
        if (els.historyLoading) els.historyLoading.classList.remove("hidden");
        els.historyLoginPrompt.classList.add("hidden");
        els.historyContent.classList.add("hidden");
        return;
    }
    if (els.historyLoading) els.historyLoading.classList.add("hidden");
    const loggedIn = !!state.user;
    els.historyLoginPrompt.classList.toggle("hidden", loggedIn);
    els.historyContent.classList.toggle("hidden", !loggedIn);
    if (!loggedIn) return;

    const attempts = state.historyAttempts;
    els.historyTestsTaken.textContent = state.historyTestsTaken ?? attempts.length;
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
        item.innerHTML = `
            <div class="history-item-main">
                <h3>${escapeHtml(attempt.title)}</h3>
                <p>${dateText} · ${attempt.total} questions</p>
            </div>
            <div class="history-item-score"><strong>${attempt.score}%</strong><span>${attempt.correct} / ${attempt.total} correct · ${formatTime(attempt.duration_seconds || 0)}</span></div>
            <div class="history-item-actions">
                <button class="btn btn-primary btn-small">Review Results</button>
            </div>`;
        const reviewBtn = item.querySelector("button");
        reviewBtn.addEventListener("click", () => reviewHistoryAttempt(attempt));
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

async function saveHistoryAttempt(data, answers) {
    if (!state.user || state.mode !== "practice") return;
    try {
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
            }),
        });
        if (res.ok && state.currentTab === "history") loadHistory();
        saveRecentActivity("practice", "Practice Test", "practice", `${data.title || state.title} · ${data.score}%`);
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
            const avatarUrlSrc = getAvatarImage(profile.avatar_image, msg.username);
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
        const src = getAvatarImage(profile.avatar_image, username);
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
    renderExamGroups(els.flashcardExamButtons, state.flashcardFilename, selectFlashcardExam, "IT Essentials");
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
        markFlashcardRunStart();
        showFlashcardStudyArea();
        renderFlashcard();
        saveFlashcardSession();
        const fcExam = state.exams.find((e) => e.filename === state.flashcardFilename);
        saveRecentActivity("flashcards", "Flashcards", "flashcards", fcExam ? (fcExam.display_name || fcExam.title) : "");
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

const FLASHCARD_MIN_HEIGHT = 360;

function adjustFlashcardHeight() {
    if (!els.flashcardInner || !els.flashcardFrontFace || !els.flashcardBackFace) return;
    const contentHeight = Math.max(els.flashcardFrontFace.scrollHeight, els.flashcardBackFace.scrollHeight);
    els.flashcardInner.style.minHeight = `${Math.max(FLASHCARD_MIN_HEIGHT, contentHeight)}px`;
}

function renderFlashcard() {
    const q = state.flashcardQuestions[state.flashcardIndex];
    if (!q) return;

    els.flashcard.classList.toggle("flipped", state.flashcardFlipped);

    // Reset to the baseline height before measuring, so a shorter card after
    // a taller one shrinks back down instead of staying stretched.
    if (els.flashcardInner) els.flashcardInner.style.minHeight = `${FLASHCARD_MIN_HEIGHT}px`;

    els.flashcardFrontText.textContent = q.question;

    els.flashcardFrontImage.innerHTML = "";
    if (q.image) {
        const img = document.createElement("img");
        img.src = q.image;
        img.alt = "Question image";
        img.onerror = () => { img.style.display = "none"; adjustFlashcardHeight(); };
        img.onload = adjustFlashcardHeight;
        els.flashcardFrontImage.appendChild(img);
    }

    els.flashcardFrontOptions.innerHTML = "";
    if (state.flashcardMode === "choices" && q.options && q.options.length) {
        const ul = document.createElement("ul");
        shuffleArray(q.options).forEach((opt) => {
            const li = document.createElement("li");
            li.textContent = opt;
            ul.appendChild(li);
        });
        els.flashcardFrontOptions.appendChild(ul);
    }

    const correct = q.correct_answer || q._correct_answer || "";
    els.flashcardBackText.textContent = correct;
    if (els.flashcardBackQuestion) els.flashcardBackQuestion.textContent = q.question;
    els.flashcardCounter.textContent = `Card ${state.flashcardIndex + 1} of ${state.flashcardQuestions.length}`;

    const isMarked = state.flashcardReviews.has(String(q.id));
    els.flashcardReviewBadge.classList.toggle("hidden", !isMarked);
    els.flashcardMarkBtn.textContent = isMarked ? "Unmark review" : "Mark for review";
    els.flashcardMarkBtn.classList.toggle("btn-secondary", !isMarked);
    els.flashcardMarkBtn.classList.toggle("btn-warning", isMarked);

    els.flashcardPrevBtn.disabled = state.flashcardIndex === 0;
    els.flashcardNextBtn.disabled = state.flashcardIndex === state.flashcardQuestions.length - 1;
    els.flashcardPrevArrows.forEach((btn) => { btn.disabled = state.flashcardIndex === 0; });
    els.flashcardNextArrows.forEach((btn) => { btn.disabled = state.flashcardIndex === state.flashcardQuestions.length - 1; });

    adjustFlashcardHeight();
    maybeShowFlashcardSwipeOnboarding();
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

function handleFlashcardNextAction() {
    if (state.flashcardIndex >= state.flashcardQuestions.length - 1) return;
    animateFlashcardNavigate("next", () => nextFlashcard());
}

function handleFlashcardPrevAction() {
    if (state.flashcardIndex <= 0) return;
    animateFlashcardNavigate("prev", () => prevFlashcard());
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
    state.testQuestions = withShuffledOptions(shuffleArray([...state.lastTestQuestions]));
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

function getRemainingQuestions() {
    const all = state.allQuestions || [];
    const usedIds = new Set((state.lastTestQuestions || []).map((q) => q.id));
    return all.filter((q) => !usedIds.has(q.id));
}

function setupAddQuestionsUI() {
    if (!els.addQuestionsRow) return;
    const isPractice = state.mode === "practice";
    const remaining = getRemainingQuestions();
    els.addQuestionsRow.classList.toggle("hidden", !isPractice);
    if (!isPractice) return;

    const currentCount = state.lastTestQuestions ? state.lastTestQuestions.length : 0;
    const maxAdd = Math.max(0, remaining.length);
    if (els.addQuestionsCount) {
        els.addQuestionsCount.dataset.max = String(maxAdd);
        els.addQuestionsCount.value = String(Math.min(parseInt(els.addQuestionsCount.value, 10) || 5, maxAdd || 1));
    }
    if (els.addQuestionsAvailable) {
        els.addQuestionsAvailable.textContent = `${maxAdd} new question${maxAdd === 1 ? "" : "s"} available · current test: ${currentCount}`;
    }
    if (els.addQuestionsBtn) {
        els.addQuestionsBtn.disabled = maxAdd === 0;
    }
    updateAddQuestionsButtonText();
    validateAddQuestionsCount();
}

function updateAddQuestionsButtonText() {
    if (!els.addQuestionsBtn || !els.addQuestionsCount) return;
    const n = parseInt(els.addQuestionsCount.value, 10) || 5;
    els.addQuestionsBtn.textContent = `Add ${n} question${n === 1 ? "" : "s"}`;
}

function validateAddQuestionsCount() {
    if (!els.addQuestionsCount || !els.addQuestionsHint) return true;
    const max = parseInt(els.addQuestionsCount.dataset.max || "0", 10) || 0;
    const requested = parseInt(els.addQuestionsCount.value, 10);
    if (max > 0 && requested > max) {
        els.addQuestionsCount.classList.add("input-error");
        els.addQuestionsHint.classList.add("error");
        els.addQuestionsHint.textContent = `That number is too big — only ${max} more question${max === 1 ? "" : "s"} left on this exam.`;
        els.addQuestionsHint.classList.remove("hidden");
        if (els.addQuestionsBtn) els.addQuestionsBtn.disabled = true;
        return false;
    }
    els.addQuestionsCount.classList.remove("input-error");
    els.addQuestionsHint.classList.remove("error");
    els.addQuestionsHint.classList.add("hidden");
    els.addQuestionsHint.textContent = "";
    if (els.addQuestionsBtn) els.addQuestionsBtn.disabled = max === 0;
    return true;
}

let addQuestionsInFlight = false;

async function addQuestionsToTest() {
    if (addQuestionsInFlight) return;
    if (!state.currentFilename) {
        showToast("No exam selected.", "error");
        return;
    }
    if (!validateAddQuestionsCount()) return;

    addQuestionsInFlight = true;
    if (els.addQuestionsBtn) els.addQuestionsBtn.disabled = true;

    try {
        let remaining = getRemainingQuestions();

        // If we don't have the full question pool loaded, fetch it for the current exam.
        if (!remaining.length && !state.allQuestions.length) {
            try {
                const res = await fetch(API.examQuestions, {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ filename: state.currentFilename }),
                    credentials: "same-origin",
                    cache: "no-store",
                });
                const data = await res.json();
                if (!res.ok || !data.ok) throw new Error(data.error || "Could not load exam questions");
                state.allQuestions = data.questions || [];
                remaining = getRemainingQuestions();
            } catch (err) {
                showToast(err.message, "error");
                return;
            }
        }

        const requested = parseInt(els.addQuestionsCount.value, 10) || 5;
        const n = Math.max(1, Math.min(requested, remaining.length));
        if (!n) {
            showToast("No new questions left to add from this exam.", "error");
            return;
        }

        const shuffled = [...remaining].sort(() => 0.5 - Math.random());
        const added = shuffled.slice(0, n).map((q) => ({
            id: q.id,
            question: q.question,
            options: q.options,
            _correct_answer: q.correct_answer || q._correct_answer,
            type: q.type,
            terms: q.terms,
            definitions: q.definitions,
            correct_pairs: q.correct_pairs,
            image: q.image,
        }));

        state.lastTestQuestions = shuffleArray([...state.lastTestQuestions, ...added]);
        state.testQuestions = withShuffledOptions(state.lastTestQuestions);
        state.answers = {};
        state.testQuestions.forEach((q) => {
            state.answers[q.id] = q.type === "matching" ? {} : [];
        });
        state.currentIndex = 0;
        state.secondsElapsed = 0;
        state.multiSelect = false;
        els.reviewPanel.classList.add("hidden");
        showScreen("quiz");
        els.timer.style.display = "";
        startTimer();
        renderQuestion();
        showToast(`Added ${added.length} question${added.length === 1 ? "" : "s"}. Now ${state.testQuestions.length} total.`, "success");
    } finally {
        addQuestionsInFlight = false;
        if (els.addQuestionsBtn) els.addQuestionsBtn.disabled = false;
    }
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

// Returns a copy of the questions with each question's answer-choice order
// randomized, so the same question doesn't always show its correct answer
// in the same position across attempts. Matching questions (terms/definitions)
// are already shuffled at render time and are left untouched here.
function withShuffledOptions(questions) {
    return (questions || []).map((q) =>
        Array.isArray(q.options) ? { ...q, options: shuffleArray(q.options) } : q
    );
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

    const termsHint = document.createElement("p");
    termsHint.className = "matching-hint";
    termsHint.textContent = "Click a term first, then click a definition to match.";
    termsBox.appendChild(termsHint);

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
    const total = state.testQuestions.length;
    els.prevBtn.disabled = state.currentIndex === 0;
    els.nextBtn.disabled = false;
    els.nextBtn.textContent = state.currentIndex === total - 1 ? "Finish" : "Next";
    els.cardPrevArrow.disabled = state.currentIndex === 0;
    els.cardNextArrow.disabled = false;
    els.cardNextArrow.classList.toggle("is-finish", state.currentIndex === total - 1);

    if (isTouchDevice) {
        maybeShowSwipeOnboarding();
    }

    if (q.type === "matching") {
        renderMatchingQuestion(q);
        return;
    }

    const selected = state.answers[q.id] || [];
    const isMulti = isMultiCorrect(q);
    state.multiSelect = isMulti;
    els.quizFeedback.classList.add("hidden");
    els.quizFeedback.classList.remove("correct", "incorrect");
    els.quizFeedback.textContent = "";

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
    q.options.forEach((opt, idx) => {
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
        input.addEventListener("focus", () => {
            state.keyboardFocusIndex = idx;
            updateKeyboardFocus();
        });
    });

    // Initialize keyboard focus on the first selected option, or the first option.
    const firstChecked = q.options.findIndex((opt) => selected.includes(opt));
    state.keyboardFocusIndex = firstChecked >= 0 ? firstChecked : 0;
    updateKeyboardFocus();

    if (els.quizKeyboardHint) {
        if (isTouchDevice) {
            els.quizKeyboardHint.classList.add("hidden");
        } else {
            els.quizKeyboardHint.classList.remove("hidden");
            if (isMulti) {
                els.quizKeyboardHint.textContent = "← / → navigate • 1-5 toggle • ↑ / ↓ move focus • Enter/Space toggle";
            } else {
                els.quizKeyboardHint.textContent = "← / → navigate • 1-5 choose • ↑ / ↓ move";
            }
        }
    }

    if (
        state.mode === "mastery" &&
        state.masteryImmediateFeedback &&
        state.masteryLockedQids.has(q.id)
    ) {
        const lockedSelected = (state.answers[q.id] || [])[0];
        state.masteryLockedQids.delete(q.id);
        if (lockedSelected !== undefined) {
            showMasteryFeedback(q.id, lockedSelected);
        }
    }
}

function updateKeyboardFocus() {
    const labels = els.optionsContainer.querySelectorAll(".option");
    labels.forEach((label, idx) => {
        label.classList.toggle("keyboard-focus", idx === state.keyboardFocusIndex);
    });
}

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

    // Optional immediate feedback in mastery mode (single-select only):
    // when enabled, reveal the right/wrong answer the instant the user picks
    // one and lock the question so the first instinct is what gets scored.
    if (state.mode === "mastery" && state.masteryImmediateFeedback && !state.multiSelect && checked) {
        showMasteryFeedback(qid, value);
    }
}

function showMasteryFeedback(qid, selectedValue) {
    if (state.masteryLockedQids.has(qid)) return;
    const question = state.testQuestions.find((q) => q.id == qid);
    if (!question || !question._correct_answer) return;

    const correctSet = new Set(
        String(question._correct_answer).split("|").map((a) => a.trim()).filter(Boolean)
    );
    const isCorrect = correctSet.has(selectedValue);
    state.masteryLockedQids.add(qid);

    Array.from(els.optionsContainer.children).forEach((label) => {
        const input = label.querySelector("input");
        input.disabled = true;
        label.classList.add("feedback-locked");
        if (correctSet.has(input.value)) {
            label.classList.add("feedback-correct");
        } else if (input.value === selectedValue) {
            label.classList.add("feedback-incorrect");
        }
    });

    els.quizFeedback.classList.remove("hidden", "correct", "incorrect");
    els.quizFeedback.classList.add(isCorrect ? "correct" : "incorrect");
    els.quizFeedback.textContent = isCorrect
        ? "✓ Correct!"
        : `✗ Incorrect — correct answer is highlighted above.`;
}

function navigate(direction) {
    const total = state.testQuestions.length;
    state.currentIndex += direction;
    if (state.currentIndex < 0) state.currentIndex = 0;
    if (state.currentIndex >= total) state.currentIndex = total - 1;
    renderQuestion();
}

// Call once when a brand-new exam/mastery run begins (not on retakes or
// "add more questions" continuations). Flags the swipe onboarding to play
// on the very first question, capped at the user's first 5 runs total.
function markQuizRunStart() {
    markSwipeOnboardingRun(SWIPE_ONBOARD_KEY, SWIPE_ONBOARD_MAX_RUNS, (v) => { state.swipeOnboardingPending = v; });
}

function maybeShowSwipeOnboarding() {
    if (state.currentIndex !== 0 || !state.swipeOnboardingPending) return;
    state.swipeOnboardingPending = false;
    quizSwipeOnboarding.show();
}

function showSwipeDirectionFlash(direction) {
    flashSwipeDirection(els.swipeDirectionFlash, els.swipeDirectionFlashLabel, direction);
}

// Call once when a brand-new flashcard session begins (not on resume).
// Flags the swipe onboarding to play on the very first card, capped at the
// user's first 5 runs total.
function markFlashcardRunStart() {
    markSwipeOnboardingRun(FLASHCARD_SWIPE_ONBOARD_KEY, FLASHCARD_SWIPE_ONBOARD_MAX_RUNS, (v) => { state.flashcardSwipeOnboardingPending = v; });
}

function maybeShowFlashcardSwipeOnboarding() {
    if (state.flashcardIndex !== 0 || !state.flashcardSwipeOnboardingPending) return;
    state.flashcardSwipeOnboardingPending = false;
    flashcardSwipeOnboarding.show();
}

function showFlashcardSwipeDirectionFlash(direction) {
    flashSwipeDirection(els.flashcardSwipeDirectionFlash, els.flashcardSwipeDirectionFlashLabel, direction);
}

// ---- Generic swipeable-card helpers (shared by the quiz card and flashcards) ----

// Call once when a brand-new run begins. Flags a swipe onboarding demo to
// play on the very first item, capped at the user's first N runs total.
function markSwipeOnboardingRun(storageKey, maxRuns, setPending) {
    if (!isTouchDevice) return;
    let count = 0;
    try {
        count = parseInt(localStorage.getItem(storageKey) || "0", 10) || 0;
    } catch (e) { /* ignore */ }
    if (count < maxRuns) {
        setPending(true);
        try { localStorage.setItem(storageKey, String(count + 1)); } catch (e) { /* ignore */ }
    } else {
        setPending(false);
    }
}

// Demo timings (ms) — a slower, more deliberate ~2.5s sequence so the user
// has time to actually notice and read the gesture before it moves.
const ONBOARD_SLIDE_MS = 450;
const ONBOARD_HOLD_MS = 350;
const ONBOARD_READ_PAUSE_MS = 200;

// Builds a self-contained swipe-onboarding demo controller for a given card:
// plays a gentle half-swipe left ("Next"), a hold so the user can see the
// peek, a return to center, then the same demo mirrored right ("Previous").
// The "next card in the deck" silhouette grows in behind it each time,
// exactly like real navigation.
function createSwipeOnboarding({ overlay, card, stackNext, label, nextText, prevText }) {
    let timeouts = [];

    function hide() {
        timeouts.forEach(clearTimeout);
        timeouts = [];
        card.classList.remove("onboarding-half-left", "onboarding-half-right");
        card.style.transition = "";
        if (stackNext) stackNext.classList.remove("show-peek", "show");
        overlay.classList.add("hidden");
    }

    function show() {
        overlay.classList.remove("hidden");
        card.classList.remove("onboarding-half-left", "onboarding-half-right");
        card.style.transition = `transform ${ONBOARD_SLIDE_MS}ms ease, box-shadow 0.18s ease`;

        label.textContent = nextText;

        timeouts.forEach(clearTimeout);
        timeouts = [];

        let t = ONBOARD_READ_PAUSE_MS;

        // Phase 1: half-swipe left to peek "Next".
        timeouts.push(setTimeout(() => {
            card.classList.add("onboarding-half-left");
            if (stackNext) stackNext.classList.add("show-peek");
        }, t));
        t += ONBOARD_SLIDE_MS + ONBOARD_HOLD_MS;

        // Phase 2: return to center.
        timeouts.push(setTimeout(() => {
            card.classList.remove("onboarding-half-left");
            if (stackNext) stackNext.classList.remove("show-peek");
        }, t));
        t += ONBOARD_SLIDE_MS + ONBOARD_READ_PAUSE_MS;

        // Phase 3: half-swipe right to peek "Previous".
        timeouts.push(setTimeout(() => {
            label.textContent = prevText;
            card.classList.add("onboarding-half-right");
            if (stackNext) stackNext.classList.add("show-peek");
        }, t));
        t += ONBOARD_SLIDE_MS + ONBOARD_HOLD_MS;

        // Phase 4: return to center and end the demo.
        timeouts.push(setTimeout(() => {
            card.classList.remove("onboarding-half-right");
            if (stackNext) stackNext.classList.remove("show-peek");
        }, t));
        t += ONBOARD_SLIDE_MS;

        timeouts.push(setTimeout(hide, t + 150));

        overlay.addEventListener("click", hide, { once: true });
    }

    return { show, hide };
}

const quizSwipeOnboarding = createSwipeOnboarding({
    overlay: els.swipeOnboarding,
    card: els.questionCard,
    stackNext: els.questionCardStackNext,
    label: els.swipeOnboardingLabel,
    nextText: "Swipe left for Next",
    prevText: "Swipe right for Previous",
});

const flashcardSwipeOnboarding = createSwipeOnboarding({
    overlay: els.flashcardSwipeOnboarding,
    card: els.flashcard,
    stackNext: els.flashcardStackNext,
    label: els.flashcardSwipeOnboardingLabel,
    nextText: "Swipe left for Next",
    prevText: "Swipe right for Previous",
});

// Briefly flashes the word "Next"/"Previous" over a card so the user gets
// unambiguous confirmation of which way they just navigated.
function flashSwipeDirection(el, label, direction) {
    if (!el || !label) return;
    label.textContent = direction === "next" ? "Next" : "Previous";
    el.classList.remove("show");
    void el.offsetWidth;
    el.classList.add("show");
    clearTimeout(el._flashTimeout);
    el._flashTimeout = setTimeout(() => el.classList.remove("show"), 260);
}

// Renders a lightweight, non-interactive preview of a question into the
// stack-next silhouette so it already shows real content as it grows in
// behind the departing card — whichever direction (Next or Previous) is
// actually being navigated to. Includes the same nav-arrows row as the real
// card so both are the exact same height (otherwise the swap visibly "pops"
// taller/shorter once the real card's arrow row appears).
function renderCardPreviewInto(container, q, questionNumber, isLastQuestion) {
    container.innerHTML = "";
    if (!q) return;

    const badge = document.createElement("span");
    badge.className = "question-badge";
    badge.textContent = `Question ${questionNumber}`;
    container.appendChild(badge);

    const h3 = document.createElement("h3");
    const span = document.createElement("span");
    span.textContent = q.question;
    h3.appendChild(span);
    container.appendChild(h3);

    if (q.type === "matching") {
        const hint = document.createElement("p");
        hint.className = "option-text";
        hint.textContent = "Match the terms to their definitions…";
        container.appendChild(hint);
    } else {
        const optsDiv = document.createElement("div");
        optsDiv.className = "options";
        (q.options || []).forEach((opt) => {
            const optionEl = document.createElement("label");
            optionEl.className = "option";
            const input = document.createElement("input");
            input.type = "radio";
            input.disabled = true;
            const textSpan = document.createElement("span");
            textSpan.className = "option-text";
            textSpan.textContent = opt;
            optionEl.appendChild(input);
            optionEl.appendChild(textSpan);
            optsDiv.appendChild(optionEl);
        });
        container.appendChild(optsDiv);
    }

    const navArrows = document.createElement("div");
    navArrows.className = "card-nav-arrows";
    navArrows.innerHTML = `
        <button class="card-arrow-btn card-arrow-prev" disabled aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        <button class="card-arrow-btn card-arrow-next${isLastQuestion ? " is-finish" : ""}" disabled aria-hidden="true">
            <svg class="card-arrow-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
            <span class="card-arrow-finish-label">Finish</span>
        </button>
    `;
    container.appendChild(navArrows);
}

// Renders a lightweight, non-interactive preview of a flashcard's front face
// into the stack-next silhouette so it already shows real content as it
// grows in behind the departing card. Destination cards always land
// unflipped, so only the front face needs previewing. Includes the same
// nav-arrows row as the real card so both are the exact same height.
function renderFlashcardPreviewInto(container, q) {
    container.innerHTML = "";
    if (!q) return;

    const label = document.createElement("span");
    label.className = "flashcard-label";
    label.textContent = "Question";
    container.appendChild(label);

    const h3 = document.createElement("h3");
    h3.textContent = q.question;
    container.appendChild(h3);

    const imageDiv = document.createElement("div");
    imageDiv.className = "flashcard-image";
    if (q.image) {
        const img = document.createElement("img");
        img.src = q.image;
        img.alt = "Question image";
        imageDiv.appendChild(img);
    }
    container.appendChild(imageDiv);

    const optionsDiv = document.createElement("div");
    optionsDiv.className = "flashcard-options";
    if (state.flashcardMode === "choices" && q.options && q.options.length) {
        const ul = document.createElement("ul");
        q.options.forEach((opt) => {
            const li = document.createElement("li");
            li.textContent = opt;
            ul.appendChild(li);
        });
        optionsDiv.appendChild(ul);
    }
    container.appendChild(optionsDiv);

    const navArrows = document.createElement("div");
    navArrows.className = "card-nav-arrows";
    navArrows.innerHTML = `
        <button class="card-arrow-btn card-arrow-prev" disabled aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
        </button>
        <button class="card-arrow-btn card-arrow-next" disabled aria-hidden="true">
            <svg class="card-arrow-icon" viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"></polyline></svg>
        </button>
    `;
    container.appendChild(navArrows);
}

// Tinder-style card slide: the real card slides fully off-screen in the
// direction of travel, while the next/previous item's real content (drawn
// by `renderPreview`) grows into place behind it — that single grow
// animation IS the entrance; once it finishes, the real front card silently
// takes over the exact same fully-grown spot (no second re-animated
// grow-in, which previously caused a visible stutter/restart). Falls back
// to an instant render on non-touch devices. `getInFlight`/`setInFlight`
// let each card type (quiz vs flashcard) track its own in-progress flag.
const CARD_SWIPE_ANIM_MS = 220;
function animateCardSwipe(card, stackNext, direction, doNavigate, renderPreview, getInFlight, setInFlight) {
    if (!isTouchDevice || getInFlight()) {
        doNavigate();
        return;
    }
    setInFlight(true);
    const outClass = direction === "next" ? "swipe-slide-out-left" : "swipe-slide-out-right";

    if (stackNext && renderPreview) {
        renderPreview(stackNext);
        stackNext.classList.add("show");
    }

    card.classList.add(outClass);

    setTimeout(() => {
        doNavigate();
        // Snap the real card directly into the identical fully-grown resting
        // state the stack-next card just finished animating to — an instant,
        // invisible handoff rather than a second grow-in transition.
        card.classList.add("swipe-slide-no-transition");
        card.classList.remove(outClass);
        if (stackNext) {
            stackNext.classList.add("swipe-slide-no-transition");
            stackNext.classList.remove("show");
        }
        void card.offsetWidth;
        card.classList.remove("swipe-slide-no-transition");
        if (stackNext) stackNext.classList.remove("swipe-slide-no-transition");
        setInFlight(false);
    }, CARD_SWIPE_ANIM_MS);
}

let quizCardAnimInFlight = false;
function animateCardNavigate(direction, doNavigate) {
    const targetIndex = direction === "next" ? state.currentIndex + 1 : state.currentIndex - 1;
    const clampedIndex = Math.max(0, Math.min(targetIndex, state.testQuestions.length - 1));
    const isLastQuestion = clampedIndex === state.testQuestions.length - 1;
    showSwipeDirectionFlash(direction);
    animateCardSwipe(
        els.questionCard,
        els.questionCardStackNext,
        direction,
        doNavigate,
        (container) => renderCardPreviewInto(container, state.testQuestions[clampedIndex], clampedIndex + 1, isLastQuestion),
        () => quizCardAnimInFlight,
        (v) => { quizCardAnimInFlight = v; }
    );
}

let flashcardCardAnimInFlight = false;
function animateFlashcardNavigate(direction, doNavigate) {
    const targetIndex = direction === "next" ? state.flashcardIndex + 1 : state.flashcardIndex - 1;
    const clampedIndex = Math.max(0, Math.min(targetIndex, state.flashcardQuestions.length - 1));
    showFlashcardSwipeDirectionFlash(direction);
    animateCardSwipe(
        els.flashcard,
        els.flashcardStackNext,
        direction,
        doNavigate,
        (container) => renderFlashcardPreviewInto(container, state.flashcardQuestions[clampedIndex]),
        () => flashcardCardAnimInFlight,
        (v) => { flashcardCardAnimInFlight = v; }
    );
}

// Wires up horizontal swipe-to-navigate on a card (touch devices only):
// swipe left = next, swipe right = previous. Gated by distance/time/angle
// thresholds so it doesn't fire on taps (flipping/selecting) or vertical
// scrolling. `isBlocked()` lets callers suppress swipes while e.g. an
// onboarding overlay is showing.
function wireSwipeNavigation(card, onNext, onPrev, isBlocked) {
    if (!isTouchDevice) return;
    const SWIPE_MIN_DISTANCE = 60;
    const SWIPE_MAX_VERTICAL = 60;
    const SWIPE_MAX_DURATION = 700;
    let touchStartX = 0;
    let touchStartY = 0;
    let touchStartTime = 0;

    card.addEventListener("touchstart", (e) => {
        if (!e.touches.length) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        touchStartTime = Date.now();
    }, { passive: true });

    card.addEventListener("touchend", (e) => {
        if (isBlocked && isBlocked()) return;
        if (!e.changedTouches.length) return;
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        const dt = Date.now() - touchStartTime;
        if (dt > SWIPE_MAX_DURATION) return;
        if (Math.abs(dx) < SWIPE_MIN_DISTANCE) return;
        if (Math.abs(dy) > SWIPE_MAX_VERTICAL) return;
        if (dx < 0) {
            onNext();
        } else {
            onPrev();
        }
    }, { passive: true });
}

wireSwipeNavigation(
    els.questionCard,
    handleNextAction,
    handlePrevAction,
    () => !els.swipeOnboarding.classList.contains("hidden")
);

wireSwipeNavigation(
    els.flashcard,
    handleFlashcardNextAction,
    handleFlashcardPrevAction,
    () => !els.flashcardSwipeOnboarding.classList.contains("hidden")
);

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
    const payload = {
        answers: relevantAnswers,
        quiz: state.testQuestions,
        filename: state.currentFilename,
        title: state.title,
    };
    try {
        const res = await fetch(API.score, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Scoring failed");
        const data = await res.json();
        showResults(data);
        saveHistoryAttempt(data, relevantAnswers);
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
        showResults(localData);
        saveHistoryAttempt(localData, relevantAnswers);
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

    // Sort by the correct definition so matching results are grouped logically
    // (e.g. all "Layer 2" rows together, then "Layer 3", etc.).
    const sortedTerms = [...terms].sort((a, b) => {
        const defA = correctPairs[a] || "";
        const defB = correctPairs[b] || "";
        return defA.localeCompare(defB);
    });

    const rows = sortedTerms.map((term) => {
        const matchedDef = isSelected
            ? (answer && typeof answer === "object" ? answer[term] : undefined)
            : correctPairs[term];
        const correctDef = correctPairs[term];
        const isCorrect = matchedDef && matchedDef === correctDef;
        const rowClass = isSelected
            ? (isCorrect ? "match-correct" : "match-wrong")
            : "match-correct";
        const statusIcon = isSelected
            ? (isCorrect ? "✓" : "✗")
            : "✓";
        return `<tr class="${rowClass}"><td class="match-term">${term}</td><td class="match-def">${matchedDef || "(not matched)"}</td><td class="match-status">${statusIcon}</td></tr>`;
    });

    return `<table class="matching-review-table"><thead><tr><th>Term</th><th>${isSelected ? "Your match" : "Correct match"}</th><th></th></tr></thead><tbody>${rows.join("")}</tbody></table>`;
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
    setupAddQuestionsUI();
    els.reviewPanel.classList.remove("hidden");

    els.reviewList.innerHTML = "";
    const orderedResults = data.results
        .map((r, i) => ({ ...r, _originalNumber: i + 1 }))
        .sort((a, b) => Number(a.is_correct) - Number(b.is_correct));
    orderedResults.forEach((r) => {
        const item = document.createElement("div");
        item.className = `review-item ${r.is_correct ? "correct" : "wrong"}`;

        const heading = document.createElement("h4");
        heading.textContent = `${r._originalNumber}. ${r.question}`;
        item.appendChild(heading);

        const selectedRow = document.createElement("div");
        selectedRow.className = "answer-row";
        const selectedLabel = document.createElement("div");
        selectedLabel.className = "answer-label";
        selectedLabel.textContent = "Your answer";
        const selectedText = document.createElement("div");
        selectedText.className = `answer-text ${r.is_correct ? "correct-answer" : "wrong-answer"}`;
        if (r.type === "matching") {
            selectedText.innerHTML = formatMatchingAnswerForReview(r.selected, r.terms, r.correct_pairs, true);
        } else {
            selectedText.textContent = formatAnswerForReview(r.selected);
        }
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
        if (r.type === "matching") {
            correctText.innerHTML = formatMatchingAnswerForReview(r.correct_answer, r.terms, r.correct_pairs, false);
        } else {
            correctText.textContent = formatAnswerForReview(r.correct_answer);
        }
        correctRow.appendChild(correctLabel);
        correctRow.appendChild(correctText);
        item.appendChild(correctRow);

        els.reviewList.appendChild(item);
    });
}

els.startBtn.addEventListener("click", startTest);
els.homeBtn.addEventListener("click", goBackToApp);
els.homeLogo.addEventListener("click", () => switchTab("home"));

function handlePrevAction() {
    if (els.prevBtn.disabled) return;
    animateCardNavigate("prev", () => navigate(-1));
}

let navInFlight = false;
async function handleNextAction() {
    if (navInFlight || els.nextBtn.disabled) return;
    if (state.currentIndex === state.testQuestions.length - 1) {
        navInFlight = true;
        const originalText = els.nextBtn.textContent;
        els.nextBtn.disabled = true;
        els.cardNextArrow.disabled = true;
        els.nextBtn.innerHTML = `<span class="btn-spinner"></span>Submitting…`;
        try {
            if (state.mode === "mastery") {
                await submitMastery();
            } else {
                await submitTest();
            }
        } finally {
            // Only restore the button if we're still on the quiz screen (i.e. submission failed before navigating away).
            if (screens.quiz.classList.contains("active")) {
                els.nextBtn.disabled = false;
                els.cardNextArrow.disabled = false;
                els.nextBtn.textContent = originalText;
            }
            navInFlight = false;
        }
    } else {
        animateCardNavigate("next", () => navigate(1));
    }
}

els.prevBtn.addEventListener("click", handlePrevAction);
els.nextBtn.addEventListener("click", handleNextAction);
els.cardPrevArrow.addEventListener("click", handlePrevAction);
els.cardNextArrow.addEventListener("click", handleNextAction);
els.restartBtn.addEventListener("click", goBackToApp);
els.retakeBtn.addEventListener("click", retakeSameTest);
els.continueMasteryBtn.addEventListener("click", startMasterySession);
if (els.addQuestionsBtn) els.addQuestionsBtn.addEventListener("click", addQuestionsToTest);
if (els.addQuestionsCount) els.addQuestionsCount.addEventListener("input", () => {
    updateAddQuestionsButtonText();
    validateAddQuestionsCount();
});
if (els.questionCount) els.questionCount.addEventListener("input", validateQuestionCount);

els.loginTrigger.addEventListener("click", () => openAuthModal("login"));
els.registerTrigger.addEventListener("click", () => openAuthModal("register"));
els.profileBtn.addEventListener("click", openProfileModal);
els.profileLogout.addEventListener("click", logout);
els.profileClose.addEventListener("click", closeProfileModal);
if (els.avatarUpload) {
    els.avatarUpload.addEventListener("change", (e) => {
        const file = e.target.files && e.target.files[0];
        if (file) openAvatarCrop(file);
    });
}
if (els.cropImage) {
    els.cropImage.addEventListener("mousedown", onCropPointerDown);
    els.cropImage.addEventListener("touchstart", onCropPointerDown, { passive: false });
    window.addEventListener("mousemove", onCropPointerMove);
    window.addEventListener("touchmove", onCropPointerMove, { passive: false });
    window.addEventListener("mouseup", onCropPointerUp);
    window.addEventListener("touchend", onCropPointerUp);
}
if (els.cropZoom) {
    els.cropZoom.addEventListener("input", (e) => {
        cropState.scale = parseFloat(e.target.value) || 1;
        updateCropTransform();
    });
}
if (els.cropCancel) els.cropCancel.addEventListener("click", closeAvatarCrop);
if (els.cropSave) els.cropSave.addEventListener("click", saveAvatarCrop);
if (els.avatarCropModal) {
    els.avatarCropModal.addEventListener("click", (e) => {
        if (e.target === els.avatarCropModal) closeAvatarCrop();
    });
}
els.profileModal.addEventListener("click", (e) => {
    if (e.target === els.profileModal) closeProfileModal();
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
        if (els.avatarCropModal && !els.avatarCropModal.classList.contains("hidden")) {
            closeAvatarCrop();
            return;
        }
        if (!els.profileModal.classList.contains("hidden")) closeProfileModal();
    }
});

els.installHelpBtn.addEventListener("click", openInstallModal);
els.installCloseBtn.addEventListener("click", closeInstallModal);
els.installModal.addEventListener("click", (e) => {
    if (e.target === els.installModal) closeInstallModal();
});
els.installTabIos.addEventListener("click", () => switchInstallTab("ios"));
els.installTabAndroid.addEventListener("click", () => switchInstallTab("android"));

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
if (els.modeFlashcards) els.modeFlashcards.addEventListener("click", () => setMode("flashcards"));

// Flashcard panel (inline on setup screen)
function updateFcPanelStartBtn() {
    if (els.fcPanelStartBtn) {
        els.fcPanelStartBtn.disabled = !state.flashcardFilename;
    }
}
function fcPanelSetMode(mode) {
    setFlashcardMode(mode);
    if (els.fcPanelModeQuestion && els.fcPanelModeChoices) {
        els.fcPanelModeQuestion.classList.toggle("active", mode === "question");
        els.fcPanelModeQuestion.classList.toggle("btn-primary", mode === "question");
        els.fcPanelModeQuestion.classList.toggle("btn-secondary", mode !== "question");
        els.fcPanelModeChoices.classList.toggle("active", mode === "choices");
        els.fcPanelModeChoices.classList.toggle("btn-primary", mode === "choices");
        els.fcPanelModeChoices.classList.toggle("btn-secondary", mode !== "choices");
    }
    if (els.fcPanelModeDesc) {
        els.fcPanelModeDesc.textContent = mode === "question"
            ? "Front shows just the question. Flip to see the answer."
            : "Front shows question and answer choices. Flip to reveal the correct one.";
    }
}
function fcPanelSetFilter(filter) {
    setFlashcardFilter(filter);
    if (els.fcPanelFilterAll && els.fcPanelFilterReview) {
        els.fcPanelFilterAll.classList.toggle("active", filter === "all");
        els.fcPanelFilterAll.classList.toggle("btn-primary", filter === "all");
        els.fcPanelFilterAll.classList.toggle("btn-secondary", filter !== "all");
        els.fcPanelFilterReview.classList.toggle("active", filter === "review");
        els.fcPanelFilterReview.classList.toggle("btn-primary", filter === "review");
        els.fcPanelFilterReview.classList.toggle("btn-secondary", filter !== "review");
    }
    if (els.fcPanelReviewCount) {
        els.fcPanelReviewCount.textContent = els.flashcardReviewCount ? els.flashcardReviewCount.textContent : "";
    }
}
if (els.fcPanelModeQuestion) els.fcPanelModeQuestion.addEventListener("click", () => fcPanelSetMode("question"));
if (els.fcPanelModeChoices) els.fcPanelModeChoices.addEventListener("click", () => fcPanelSetMode("choices"));
if (els.fcPanelFilterAll) els.fcPanelFilterAll.addEventListener("click", () => fcPanelSetFilter("all"));
if (els.fcPanelFilterReview) els.fcPanelFilterReview.addEventListener("click", () => fcPanelSetFilter("review"));
if (els.fcPanelStartBtn) els.fcPanelStartBtn.addEventListener("click", () => {
    switchTab("flashcards");
    startFlashcards();
});

els.masteryStartBtn.addEventListener("click", startMasterySession);
els.masteryResetBtn.addEventListener("click", resetMastery);
if (els.masteryImmediateFeedbackToggle) {
    els.masteryImmediateFeedbackToggle.addEventListener("change", () => {
        state.masteryImmediateFeedback = els.masteryImmediateFeedbackToggle.checked;
        try {
            localStorage.setItem("mastery_immediate_feedback", state.masteryImmediateFeedback ? "1" : "0");
        } catch (e) {
            // ignore
        }
    });
}

if (els.tabHome) els.tabHome.addEventListener("click", () => switchTab("home"));
els.tabPractice.addEventListener("click", () => switchTab("practice"));
els.tabFlashcards.addEventListener("click", () => switchTab("flashcards"));
els.tabHistory.addEventListener("click", () => switchTab("history"));
els.tabCommunity.addEventListener("click", () => switchTab("community"));
els.tabAllApps.addEventListener("click", () => switchTab("gallery"));
if (els.tabAllAppsHeader) els.tabAllAppsHeader.addEventListener("click", () => switchTab("gallery"));

document.querySelectorAll(".app-tile[data-gallery-app]").forEach((tile) => {
    tile.addEventListener("click", () => switchTab(tile.dataset.galleryApp));
});
document.querySelectorAll("[data-back-to-gallery]").forEach((btn) => {
    btn.addEventListener("click", () => switchTab("gallery"));
});

// Hub section cards
document.querySelectorAll("[data-hub-section]").forEach((card) => {
    card.addEventListener("click", () => switchTab(card.dataset.hubSection));
});
if (els.ptBackHome) els.ptBackHome.addEventListener("click", () => switchTab("home"));

if (els.tabNav) {
    els.tabNav.querySelectorAll(".tab-btn").forEach((btn) => {
        btn.setAttribute("aria-selected", "false");
    });
}

document.querySelectorAll("button[data-tab]").forEach((btn) => {
    btn.addEventListener("click", () => switchTab(btn.dataset.tab));
});
els.historyLoginBtn.addEventListener("click", () => openAuthModal("login"));
const homeLoginBtn = document.getElementById("home-login-btn");
if (homeLoginBtn) homeLoginBtn.addEventListener("click", () => openAuthModal("login"));
const homeRecentStrip = document.getElementById("home-recent-activity");
if (homeRecentStrip) homeRecentStrip.addEventListener("click", () => {
    const tab = homeRecentStrip.dataset.tab;
    if (tab) switchTab(tab);
    else if (!state.user) openAuthModal("login");
    else switchTab("practice");
});
els.chatSendBtn.addEventListener("click", sendChatMessage);
els.chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendChatMessage();
});

els.flashcardModeQuestion.addEventListener("click", () => setFlashcardMode("question"));
els.flashcardModeChoices.addEventListener("click", () => setFlashcardMode("choices"));
els.flashcardFilterAll.addEventListener("click", () => setFlashcardFilter("all"));
els.flashcardFilterReview.addEventListener("click", () => setFlashcardFilter("review"));
els.flashcardStartBtn.addEventListener("click", startFlashcards);
els.flashcard.addEventListener("click", (e) => {
    if (e.target.closest(".card-arrow-btn")) return;
    flipFlashcard();
});
els.flashcardFlipBtn.addEventListener("click", flipFlashcard);
els.flashcardNextBtn.addEventListener("click", handleFlashcardNextAction);
els.flashcardPrevBtn.addEventListener("click", handleFlashcardPrevAction);
els.flashcardNextArrows.forEach((btn) => btn.addEventListener("click", handleFlashcardNextAction));
els.flashcardPrevArrows.forEach((btn) => btn.addEventListener("click", handleFlashcardPrevAction));
els.flashcardShuffleBtn.addEventListener("click", shuffleFlashcards);
els.flashcardMarkBtn.addEventListener("click", toggleFlashcardReview);
els.flashcardExitBtn.addEventListener("click", showFlashcardSetup);
els.flashcardResumeBtn.addEventListener("click", resumeFlashcardSession);
els.flashcardDiscardBtn.addEventListener("click", clearFlashcardSession);
window.addEventListener("pagehide", saveFlashcardSession);
window.addEventListener("beforeunload", saveFlashcardSession);

function isKeyboardShortcutContext() {
    if (isTouchDevice) return false;
    const active = document.activeElement;
    if (!active) return true;
    if (active.isContentEditable) return false;
    const tag = active.tagName;
    if (tag === "TEXTAREA") return false;
    if (tag === "INPUT") {
        // Allow shortcuts while an answer radio/checkbox is focused; block
        // typing in text/password fields and in modals.
        const type = active.type;
        return type === "radio" || type === "checkbox";
    }
    return true;
}

document.addEventListener("keydown", (e) => {
    if (!screens.flashcards.classList.contains("active")) return;
    if (!isKeyboardShortcutContext()) return;
    if (!els.flashcardStudyArea.classList.contains("hidden")) {
        const key = e.key || e.code;
        if (e.key === " " || e.code === "Space") {
            e.preventDefault();
            flipFlashcard();
        } else if (key === "ArrowRight" || key === "Right") {
            e.preventDefault();
            nextFlashcard();
        } else if (key === "ArrowLeft" || key === "Left") {
            e.preventDefault();
            prevFlashcard();
        } else if (e.key.toLowerCase() === "s") {
            shuffleFlashcards();
        } else if (e.key.toLowerCase() === "r") {
            toggleFlashcardReview();
        }
    }
});

// Desktop-only keyboard shortcuts for the quiz: left/right navigate, numbers
// 1-5 choose/toggle, up/down move focus, Enter/Space toggle multi-select.
document.addEventListener("keydown", (e) => {
    if (!screens.quiz.classList.contains("active")) return;
    if (!isKeyboardShortcutContext()) return;

    const q = state.testQuestions[state.currentIndex];
    if (!q) return;

    const key = e.key || e.code;
    const isLeft = key === "ArrowLeft" || key === "Left" || key === "Home";
    const isRight = key === "ArrowRight" || key === "Right" || key === "End";
    const isUp = key === "ArrowUp" || key === "Up";
    const isDown = key === "ArrowDown" || key === "Down";
    const isConfirm = key === "Enter" || key === " " || key === "Space";

    if (isLeft) {
        e.preventDefault();
        handlePrevAction();
        return;
    }
    if (isRight) {
        e.preventDefault();
        handleNextAction();
        return;
    }

    if (q.type === "matching" || !els.optionsContainer.querySelector(".option")) return;

    const inputs = Array.from(els.optionsContainer.querySelectorAll('input[name="answer"]'));
    if (!inputs.length) return;

    if (isUp || isDown) {
        e.preventDefault();
        const step = isDown ? 1 : -1;
        state.keyboardFocusIndex = Math.max(0, Math.min(state.keyboardFocusIndex + step, inputs.length - 1));
        updateKeyboardFocus();
        if (!state.multiSelect) {
            inputs[state.keyboardFocusIndex].click();
        }
        return;
    }

    const num = parseInt(e.key, 10);
    if (!Number.isNaN(num) && num >= 1 && num <= inputs.length) {
        e.preventDefault();
        state.keyboardFocusIndex = num - 1;
        updateKeyboardFocus();
        inputs[num - 1].click();
        return;
    }

    if (isConfirm && state.multiSelect) {
        e.preventDefault();
        const input = inputs[state.keyboardFocusIndex];
        if (input) input.click();
        return;
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

// ── Subnetting: Drills ──────────────────────────────────────────────────────
function randInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function ipToInt(ip) {
    return ip.split(".").reduce((acc, octet) => (acc << 8) + parseInt(octet, 10), 0) >>> 0;
}

function intToIp(int) {
    return [(int >>> 24) & 255, (int >>> 16) & 255, (int >>> 8) & 255, int & 255].join(".");
}

function toBinaryOctets(ip) {
    return ip.split(".").map((o) => parseInt(o, 10).toString(2).padStart(8, "0")).join(".");
}

function randomBaseIp(classType) {
    if (classType === "A") return `${randInt(1, 126)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(0, 255)}`;
    if (classType === "B") return `${randInt(128, 191)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(0, 255)}`;
    return `${randInt(192, 223)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(0, 255)}`;
}

function computeSubnetInfo(ipStr, cidr) {
    const ipInt = ipToInt(ipStr);
    const maskInt = cidr === 0 ? 0 : (0xFFFFFFFF << (32 - cidr)) >>> 0;
    const network = (ipInt & maskInt) >>> 0;
    const hostBits = 32 - cidr;
    const broadcast = (network | (hostBits === 0 ? 0 : (0xFFFFFFFF >>> cidr))) >>> 0;
    const totalHosts = hostBits >= 2 ? Math.pow(2, hostBits) - 2 : 0;
    const first = totalHosts > 0 ? network + 1 : network;
    const last = totalHosts > 0 ? broadcast - 1 : broadcast;
    return {
        network: intToIp(network),
        broadcast: intToIp(broadcast),
        first: intToIp(first),
        last: intToIp(last),
        hosts: totalHosts,
        mask: intToIp(maskInt),
        cidr,
    };
}

function generateSubnetProblem() {
    const diff = state.subnetDrill.difficulty;
    let ipStr, cidr, promptExtra = "";
    if (diff === "easy") {
        ipStr = randomBaseIp("C");
        cidr = randInt(25, 30);
    } else if (diff === "medium") {
        const cls = ["A", "B", "C"][randInt(0, 2)];
        ipStr = randomBaseIp(cls);
        cidr = cls === "A" ? randInt(9, 28) : cls === "B" ? randInt(17, 29) : randInt(25, 30);
    } else {
        const cls = ["A", "B", "C"][randInt(0, 2)];
        ipStr = randomBaseIp(cls);
        const hostsNeeded = randInt(2, 500);
        let hostBits = 2;
        while (Math.pow(2, hostBits) - 2 < hostsNeeded) hostBits++;
        cidr = 32 - hostBits;
        promptExtra = ` You need at least ${hostsNeeded} usable hosts on this subnet.`;
    }
    const info = computeSubnetInfo(ipStr, cidr);
    state.subnetDrill.current = { ipStr, cidr, info, promptExtra };
    renderSubnetProblem();
}

function renderSubnetProblem() {
    const d = state.subnetDrill.current;
    if (!d) return;
    els.subnetProblemText.textContent = `${d.ipStr} / ${d.cidr}${d.promptExtra}`;
    [els.subnetAnswerNetwork, els.subnetAnswerBroadcast, els.subnetAnswerFirst, els.subnetAnswerLast, els.subnetAnswerHosts].forEach((input) => {
        input.value = "";
        input.classList.remove("input-correct", "input-wrong");
    });
    els.subnetDrillMessage.textContent = "";
    els.subnetDrillMessage.className = "message";
    els.subnetBreakdown.classList.add("hidden");
    els.subnetBreakdown.innerHTML = "";
}

function updateSubnetStats() {
    els.subnetStatSolved.textContent = state.subnetDrill.solved;
    els.subnetStatCorrect.textContent = state.subnetDrill.correct;
    els.subnetStatAccuracy.textContent = state.subnetDrill.solved
        ? `${Math.round((state.subnetDrill.correct / state.subnetDrill.solved) * 100)}%`
        : "—";
}

function renderSubnetBreakdown() {
    const d = state.subnetDrill.current;
    const info = d.info;
    els.subnetBreakdown.classList.remove("hidden");
    els.subnetBreakdown.innerHTML = `
        <h4>Step-by-step breakdown</h4>
        <div class="subnet-breakdown-row"><span>IP address</span><code>${d.ipStr} &rarr; ${toBinaryOctets(d.ipStr)}</code></div>
        <div class="subnet-breakdown-row"><span>Subnet mask (/${d.cidr})</span><code>${info.mask} &rarr; ${toBinaryOctets(info.mask)}</code></div>
        <div class="subnet-breakdown-row"><span>Network address</span><code>${info.network}</code></div>
        <div class="subnet-breakdown-row"><span>Broadcast address</span><code>${info.broadcast}</code></div>
        <div class="subnet-breakdown-row"><span>Usable host range</span><code>${info.hosts > 0 ? `${info.first} &ndash; ${info.last}` : "None"}</code></div>
        <div class="subnet-breakdown-row"><span>Usable hosts</span><code>${info.hosts}</code></div>
    `;
}

function checkSubnetAnswers() {
    const d = state.subnetDrill.current;
    if (!d) return;
    const info = d.info;
    const fields = [
        { input: els.subnetAnswerNetwork, correct: info.network },
        { input: els.subnetAnswerBroadcast, correct: info.broadcast },
        { input: els.subnetAnswerFirst, correct: info.hosts > 0 ? info.first : "N/A" },
        { input: els.subnetAnswerLast, correct: info.hosts > 0 ? info.last : "N/A" },
        { input: els.subnetAnswerHosts, correct: String(info.hosts) },
    ];
    let allCorrect = true;
    fields.forEach(({ input, correct }) => {
        const val = input.value.trim();
        const isRight = val.toLowerCase() === String(correct).toLowerCase();
        input.classList.toggle("input-correct", isRight);
        input.classList.toggle("input-wrong", !isRight);
        if (!isRight) allCorrect = false;
    });
    state.subnetDrill.solved += 1;
    if (allCorrect) state.subnetDrill.correct += 1;
    updateSubnetStats();
    els.subnetDrillMessage.textContent = allCorrect ? "All correct! Nice work." : "Some answers were off — check the breakdown below.";
    els.subnetDrillMessage.className = "message " + (allCorrect ? "success" : "error");
    renderSubnetBreakdown();
}

function setSubnetDifficulty(diff) {
    state.subnetDrill.difficulty = diff;
    [[els.subnetDiffEasy, "easy"], [els.subnetDiffMedium, "medium"], [els.subnetDiffHard, "hard"]].forEach(([btn, key]) => {
        btn.classList.toggle("active", key === diff);
        btn.classList.toggle("btn-primary", key === diff);
        btn.classList.toggle("btn-secondary", key !== diff);
    });
    generateSubnetProblem();
}

els.subnetDiffEasy.addEventListener("click", () => setSubnetDifficulty("easy"));
els.subnetDiffMedium.addEventListener("click", () => setSubnetDifficulty("medium"));
els.subnetDiffHard.addEventListener("click", () => setSubnetDifficulty("hard"));
els.subnetCheckBtn.addEventListener("click", checkSubnetAnswers);
els.subnetNextBtn.addEventListener("click", generateSubnetProblem);

// ── Binary Bits Game ─────────────────────────────────────────────────────────
function generateBinaryProblem() {
    const bits = state.binaryGame.bits;
    const max = Math.pow(2, bits) - 1;
    let target;
    do {
        target = randInt(0, max);
    } while (target === state.binaryGame.target && max > 1);
    state.binaryGame.target = target;
    state.binaryGame.bitValues = new Array(bits).fill(0);
    renderBinaryGame();
}

function renderBinaryGame() {
    const g = state.binaryGame;
    const showPlaces = g.difficulty === "easy";
    const showCurrent = g.difficulty !== "hard";
    els.binaryTargetValue.textContent = g.target;
    els.binaryGameMessage.textContent = "";
    els.binaryGameMessage.className = "message";
    els.binaryCurrentRow.classList.toggle("hidden", !showCurrent);
    els.binaryBitsRow.innerHTML = "";
    for (let i = 0; i < g.bits; i++) {
        const bitValue = Math.pow(2, g.bits - 1 - i);
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "binary-bit-toggle";
        btn.dataset.index = i;
        btn.innerHTML = `<span class="binary-bit-value">${g.bitValues[i]}</span><span class="binary-bit-place${showPlaces ? "" : " hidden"}">${bitValue}</span>`;
        btn.classList.toggle("on", g.bitValues[i] === 1);
        btn.addEventListener("click", () => toggleBinaryBit(i));
        els.binaryBitsRow.appendChild(btn);
    }
    updateBinaryCurrentValue();
}

function updateBinaryCurrentValue() {
    const g = state.binaryGame;
    const current = g.bitValues.reduce((acc, bit, idx) => acc + bit * Math.pow(2, g.bits - 1 - idx), 0);
    els.binaryCurrentValue.textContent = current;
    return current;
}

function toggleBinaryBit(index) {
    const g = state.binaryGame;
    g.bitValues[index] = g.bitValues[index] === 1 ? 0 : 1;
    const btn = els.binaryBitsRow.querySelector(`[data-index="${index}"]`);
    if (btn) {
        btn.classList.toggle("on", g.bitValues[index] === 1);
        btn.querySelector(".binary-bit-value").textContent = g.bitValues[index];
    }
    const current = updateBinaryCurrentValue();
    if (current === g.target) {
        g.solved += 1;
        g.streak += 1;
        if (g.streak > g.bestStreak) g.bestStreak = g.streak;
        updateBinaryStats();
        els.binaryGameMessage.textContent = "Correct! 🎉";
        els.binaryGameMessage.className = "message success";
        setTimeout(generateBinaryProblem, 700);
    }
}

function updateBinaryStats() {
    els.binaryStatSolved.textContent = state.binaryGame.solved;
    els.binaryStatStreak.textContent = state.binaryGame.streak;
    els.binaryStatBest.textContent = state.binaryGame.bestStreak;
}

function setBinaryDifficulty(diff) {
    state.binaryGame.difficulty = diff;
    state.binaryGame.streak = 0;
    updateBinaryStats();
    [[els.binaryDiffEasy, "easy"], [els.binaryDiffMedium, "medium"], [els.binaryDiffHard, "hard"]].forEach(([btn, key]) => {
        btn.classList.toggle("active", key === diff);
        btn.classList.toggle("btn-primary", key === diff);
        btn.classList.toggle("btn-secondary", key !== diff);
    });
    generateBinaryProblem();
}

els.binaryDiffEasy.addEventListener("click", () => setBinaryDifficulty("easy"));
els.binaryDiffMedium.addEventListener("click", () => setBinaryDifficulty("medium"));
els.binaryDiffHard.addEventListener("click", () => setBinaryDifficulty("hard"));
els.binaryNextBtn.addEventListener("click", () => {
    state.binaryGame.streak = 0;
    updateBinaryStats();
    generateBinaryProblem();
});

// ── Port Match ───────────────────────────────────────────────────────────────
const PORT_DATA = [
    { port: 21, service: "FTP" },
    { port: 22, service: "SSH" },
    { port: 23, service: "Telnet" },
    { port: 25, service: "SMTP" },
    { port: 53, service: "DNS" },
    { port: 67, service: "DHCP" },
    { port: 69, service: "TFTP" },
    { port: 80, service: "HTTP" },
    { port: 110, service: "POP3" },
    { port: 123, service: "NTP" },
    { port: 143, service: "IMAP" },
    { port: 161, service: "SNMP" },
    { port: 389, service: "LDAP" },
    { port: 443, service: "HTTPS" },
    { port: 445, service: "SMB" },
    { port: 514, service: "Syslog" },
    { port: 3306, service: "MySQL" },
    { port: 3389, service: "RDP" },
];

function generatePortMatchQuestion() {
    const p = state.portMatch;
    let item;
    do {
        item = PORT_DATA[randInt(0, PORT_DATA.length - 1)];
    } while (item === p.current && PORT_DATA.length > 1);
    p.current = item;
    p.answered = false;
    renderPortMatchQuestion();
}

function renderPortMatchQuestion() {
    const p = state.portMatch;
    const forward = p.direction === "forward";
    els.portMatchLabel.textContent = forward ? "What service uses this port?" : "What port does this service use?";
    els.portMatchQuestion.textContent = forward ? p.current.port : p.current.service;
    els.portMatchMessage.textContent = "";
    els.portMatchMessage.className = "message";

    const correctValue = forward ? p.current.service : p.current.port;
    const pool = PORT_DATA.filter((x) => x !== p.current);
    const wrongItems = shuffleArray(pool).slice(0, 3);
    const choices = shuffleArray([correctValue, ...wrongItems.map((x) => (forward ? x.service : x.port))]);

    els.portMatchChoices.innerHTML = "";
    choices.forEach((choice) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "drill-choice-btn";
        btn.textContent = choice;
        btn.addEventListener("click", () => checkPortMatchAnswer(choice, correctValue, btn));
        els.portMatchChoices.appendChild(btn);
    });
}

function checkPortMatchAnswer(choice, correctValue, btn) {
    const p = state.portMatch;
    if (p.answered) return;
    p.answered = true;
    p.solved += 1;
    const isCorrect = choice === correctValue;
    if (isCorrect) p.correct += 1;
    btn.classList.add(isCorrect ? "correct" : "incorrect");
    els.portMatchChoices.querySelectorAll(".drill-choice-btn").forEach((b) => {
        b.disabled = true;
        if (b.textContent === String(correctValue)) b.classList.add("correct");
    });
    els.portMatchMessage.textContent = isCorrect ? "Correct!" : `Not quite — the answer is ${correctValue}.`;
    els.portMatchMessage.className = "message " + (isCorrect ? "success" : "error");
    updatePortMatchStats();
    setTimeout(generatePortMatchQuestion, 900);
}

function updatePortMatchStats() {
    const p = state.portMatch;
    els.portMatchStatSolved.textContent = p.solved;
    els.portMatchStatCorrect.textContent = p.correct;
    els.portMatchStatAccuracy.textContent = p.solved ? Math.round((p.correct / p.solved) * 100) + "%" : "—";
}

function setPortDirection(dir) {
    state.portMatch.direction = dir;
    els.portDirForward.classList.toggle("active", dir === "forward");
    els.portDirForward.classList.toggle("btn-primary", dir === "forward");
    els.portDirForward.classList.toggle("btn-secondary", dir !== "forward");
    els.portDirReverse.classList.toggle("active", dir === "reverse");
    els.portDirReverse.classList.toggle("btn-primary", dir === "reverse");
    els.portDirReverse.classList.toggle("btn-secondary", dir !== "reverse");
    generatePortMatchQuestion();
}

els.portDirForward.addEventListener("click", () => setPortDirection("forward"));
els.portDirReverse.addEventListener("click", () => setPortDirection("reverse"));
els.portMatchNextBtn.addEventListener("click", generatePortMatchQuestion);

// ── Command Match ────────────────────────────────────────────────────────────
const CLI_DATA = [
    { command: "show running-config", desc: "Displays the current active configuration running in memory." },
    { command: "show ip interface brief", desc: "Shows a summary of each interface's IP address and up/down status." },
    { command: "show interfaces", desc: "Displays detailed statistics for all interfaces, including packet counts and errors." },
    { command: "show ip route", desc: "Displays the device's routing table." },
    { command: "show vlan brief", desc: "Lists all VLANs configured on the switch and which ports belong to each." },
    { command: "show mac address-table", desc: "Displays the MAC addresses the switch has learned and their associated ports." },
    { command: "ping", desc: "Tests reachability of another device by sending ICMP echo requests." },
    { command: "traceroute", desc: "Shows the path (hop by hop) packets take to reach a destination." },
    { command: "configure terminal", desc: "Enters global configuration mode so you can change device settings." },
    { command: "interface vlan 1", desc: "Enters configuration mode for the VLAN 1 virtual interface." },
    { command: "ip address 192.168.1.1 255.255.255.0", desc: "Assigns an IP address and subnet mask to the current interface." },
    { command: "no shutdown", desc: "Administratively enables an interface (brings it up)." },
    { command: "hostname R1", desc: "Sets the device's hostname, shown in the CLI prompt." },
    { command: "enable", desc: "Enters privileged EXEC mode, unlocking more powerful commands." },
    { command: "copy running-config startup-config", desc: "Saves the current running configuration so it persists after a reboot." },
    { command: "reload", desc: "Restarts the device." },
    { command: "show version", desc: "Displays the IOS version, uptime, and hardware details of the device." },
    { command: "show cdp neighbors", desc: "Lists directly connected Cisco devices discovered via CDP." },
];

function generateCliMatchQuestion() {
    const c = state.cliMatch;
    let item;
    do {
        item = CLI_DATA[randInt(0, CLI_DATA.length - 1)];
    } while (item === c.current && CLI_DATA.length > 1);
    c.current = item;
    c.answered = false;
    renderCliMatchQuestion();
}

function renderCliMatchQuestion() {
    const c = state.cliMatch;
    els.cliMatchQuestion.textContent = c.current.command;
    els.cliMatchMessage.textContent = "";
    els.cliMatchMessage.className = "message";

    const pool = CLI_DATA.filter((x) => x !== c.current);
    const wrongItems = shuffleArray(pool).slice(0, 3);
    const choices = shuffleArray([c.current.desc, ...wrongItems.map((x) => x.desc)]);

    els.cliMatchChoices.innerHTML = "";
    choices.forEach((choice) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "drill-choice-btn drill-choice-btn-text";
        btn.textContent = choice;
        btn.addEventListener("click", () => checkCliMatchAnswer(choice, c.current.desc, btn));
        els.cliMatchChoices.appendChild(btn);
    });
}

function checkCliMatchAnswer(choice, correctValue, btn) {
    const c = state.cliMatch;
    if (c.answered) return;
    c.answered = true;
    c.solved += 1;
    const isCorrect = choice === correctValue;
    if (isCorrect) c.correct += 1;
    btn.classList.add(isCorrect ? "correct" : "incorrect");
    els.cliMatchChoices.querySelectorAll(".drill-choice-btn").forEach((b) => {
        b.disabled = true;
        if (b.textContent === correctValue) b.classList.add("correct");
    });
    els.cliMatchMessage.textContent = isCorrect ? "Correct!" : "Not quite — check the highlighted answer.";
    els.cliMatchMessage.className = "message " + (isCorrect ? "success" : "error");
    updateCliMatchStats();
    setTimeout(generateCliMatchQuestion, 1100);
}

function updateCliMatchStats() {
    const c = state.cliMatch;
    els.cliMatchStatSolved.textContent = c.solved;
    els.cliMatchStatCorrect.textContent = c.correct;
    els.cliMatchStatAccuracy.textContent = c.solved ? Math.round((c.correct / c.solved) * 100) + "%" : "—";
}

els.cliMatchNextBtn.addEventListener("click", generateCliMatchQuestion);

// ── OSI Sorter ───────────────────────────────────────────────────────────────
const OSI_LAYERS = [
    { num: 7, name: "Application" },
    { num: 6, name: "Presentation" },
    { num: 5, name: "Session" },
    { num: 4, name: "Transport" },
    { num: 3, name: "Network" },
    { num: 2, name: "Data Link" },
    { num: 1, name: "Physical" },
];

function startOsiRound() {
    const o = state.osiSorter;
    o.roundId += 1;
    o.order = shuffleArray(OSI_LAYERS);
    o.nextIndex = 0;
    o.mistakes = 0;
    els.osiSorterMessage.textContent = "";
    els.osiSorterMessage.className = "message";
    els.osiMnemonicText.classList.add("hidden");
    updateOsiStats();
    renderOsiChips();
}

function renderOsiChips() {
    const o = state.osiSorter;
    els.osiSorterChips.innerHTML = "";
    o.order.forEach((layer) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "osi-chip";
        chip.dataset.num = layer.num;
        chip.innerHTML = `<span class="osi-chip-num"></span><span class="osi-chip-name">${escapeHtml(layer.name)}</span>`;
        chip.addEventListener("click", () => tapOsiChip(layer, chip));
        els.osiSorterChips.appendChild(chip);
    });
}

function tapOsiChip(layer, chip) {
    const o = state.osiSorter;
    if (chip.classList.contains("placed")) return;
    const expectedNum = 7 - o.nextIndex;
    if (layer.num === expectedNum) {
        chip.classList.add("placed");
        chip.disabled = true;
        o.nextIndex += 1;
        const numEl = chip.querySelector(".osi-chip-num");
        if (numEl) numEl.textContent = o.nextIndex;
        if (o.nextIndex === OSI_LAYERS.length) {
            o.rounds += 1;
            if (o.bestMistakes === null || o.mistakes < o.bestMistakes) o.bestMistakes = o.mistakes;
            updateOsiStats();
            els.osiSorterMessage.textContent = "All 7 layers in order! 🎉";
            els.osiSorterMessage.className = "message success";
            const completedRoundId = o.roundId;
            setTimeout(() => {
                if (state.osiSorter.roundId === completedRoundId) startOsiRound();
            }, 1200);
        }
    } else {
        o.mistakes += 1;
        updateOsiStats();
        chip.classList.add("shake");
        setTimeout(() => chip.classList.remove("shake"), 400);
        els.osiSorterMessage.textContent = "Not next — try again.";
        els.osiSorterMessage.className = "message error";
    }
}

function updateOsiStats() {
    const o = state.osiSorter;
    els.osiStatRounds.textContent = o.rounds;
    els.osiStatMistakes.textContent = o.mistakes;
    els.osiStatBest.textContent = o.bestMistakes === null ? "—" : o.bestMistakes;
}

els.osiResetBtn.addEventListener("click", startOsiRound);
els.osiMnemonicBtn.addEventListener("click", () => {
    els.osiMnemonicText.classList.toggle("hidden");
});

// ── Acronym Drill ────────────────────────────────────────────────────────────
const ACRONYM_DATA = [
    { acronym: "LAN", full: "Local Area Network", desc: "A network confined to a small geographic area, like a home, office, or building." },
    { acronym: "WAN", full: "Wide Area Network", desc: "A network that spans a large geographic area, connecting multiple LANs together." },
    { acronym: "DNS", full: "Domain Name System", desc: "Translates human-readable domain names (like google.com) into IP addresses." },
    { acronym: "DHCP", full: "Dynamic Host Configuration Protocol", desc: "Automatically assigns IP addresses and other network settings to devices." },
    { acronym: "NAT", full: "Network Address Translation", desc: "Translates private IP addresses to a public IP address so devices can reach the internet." },
    { acronym: "VLAN", full: "Virtual Local Area Network", desc: "Logically separates a physical network into multiple isolated broadcast domains." },
    { acronym: "STP", full: "Spanning Tree Protocol", desc: "Prevents switching loops in a network with redundant paths." },
    { acronym: "ARP", full: "Address Resolution Protocol", desc: "Maps an IP address to a MAC address on a local network." },
    { acronym: "ICMP", full: "Internet Control Message Protocol", desc: "Used for diagnostics and error reporting, like ping and traceroute." },
    { acronym: "TCP", full: "Transmission Control Protocol", desc: "A connection-oriented protocol that guarantees reliable, ordered delivery of data." },
    { acronym: "UDP", full: "User Datagram Protocol", desc: "A connectionless protocol that sends data fast but without delivery guarantees." },
    { acronym: "IP", full: "Internet Protocol", desc: "The core protocol for addressing and routing packets across networks." },
    { acronym: "MAC", full: "Media Access Control", desc: "A hardware address burned into a network interface card, unique to that device." },
    { acronym: "OSI", full: "Open Systems Interconnection", desc: "A 7-layer conceptual model describing how network communication works." },
    { acronym: "VPN", full: "Virtual Private Network", desc: "Creates a secure, encrypted tunnel over a public network like the internet." },
    { acronym: "FTP", full: "File Transfer Protocol", desc: "Used to transfer files between a client and server over a network." },
    { acronym: "HTTP", full: "HyperText Transfer Protocol", desc: "The protocol used to load websites in a browser." },
    { acronym: "HTTPS", full: "HTTP Secure", desc: "HTTP encrypted with TLS/SSL for secure web browsing." },
    { acronym: "SSH", full: "Secure Shell", desc: "Provides an encrypted way to remotely access and manage a device's command line." },
    { acronym: "RDP", full: "Remote Desktop Protocol", desc: "Allows remote graphical access to a Windows computer's desktop." },
    { acronym: "SNMP", full: "Simple Network Management Protocol", desc: "Used to monitor and manage devices on a network, like switches and routers." },
    { acronym: "SMTP", full: "Simple Mail Transfer Protocol", desc: "Used to send email between mail servers." },
    { acronym: "POP3", full: "Post Office Protocol version 3", desc: "Downloads email from a server to a single device, typically removing it from the server." },
    { acronym: "IMAP", full: "Internet Message Access Protocol", desc: "Syncs email across multiple devices by keeping messages on the server." },
    { acronym: "CIDR", full: "Classless Inter-Domain Routing", desc: "A method for allocating IP addresses using variable-length prefixes, like /24." },
    { acronym: "VLSM", full: "Variable Length Subnet Masking", desc: "Allows subnets of different sizes within the same network for efficient addressing." },
    { acronym: "ACL", full: "Access Control List", desc: "A set of rules that permit or deny traffic based on criteria like IP address or port." },
    { acronym: "QoS", full: "Quality of Service", desc: "Prioritizes certain types of network traffic (like voice or video) over others." },
    { acronym: "VoIP", full: "Voice over IP", desc: "Transmits voice calls as data over an IP network instead of traditional phone lines." },
    { acronym: "ISP", full: "Internet Service Provider", desc: "A company that provides internet access to homes and businesses." },
];

function initAcronymDrill() {
    state.acronymDrill.deck = shuffleArray(ACRONYM_DATA);
    state.acronymDrill.index = 0;
    state.acronymDrill.flipped = false;
    renderAcronymCard();
}

function renderAcronymCard() {
    const a = state.acronymDrill;
    const item = a.deck[a.index];
    els.acronymFrontText.textContent = item.acronym;
    els.acronymBackFull.textContent = item.full;
    els.acronymBackDesc.textContent = item.desc;
    els.acronymCounterText.textContent = `${a.index + 1} / ${a.deck.length}`;
    els.acronymCard.classList.toggle("flipped", a.flipped);
}

function flipAcronymCard() {
    state.acronymDrill.flipped = !state.acronymDrill.flipped;
    els.acronymCard.classList.toggle("flipped", state.acronymDrill.flipped);
}

function goToAcronym(delta) {
    const a = state.acronymDrill;
    a.index = (a.index + delta + a.deck.length) % a.deck.length;
    a.flipped = false;
    renderAcronymCard();
}

els.acronymCard.addEventListener("click", flipAcronymCard);
els.acronymFlipBtn.addEventListener("click", flipAcronymCard);
els.acronymPrevBtn.addEventListener("click", () => goToAcronym(-1));
els.acronymNextBtn.addEventListener("click", () => goToAcronym(1));
els.acronymShuffleBtn.addEventListener("click", () => {
    state.acronymDrill.deck = shuffleArray(state.acronymDrill.deck);
    state.acronymDrill.index = 0;
    state.acronymDrill.flipped = false;
    renderAcronymCard();
});

// ── Process Sorter (TCP Handshake / DHCP DORA) ────────────────────────────────
const PROCESS_DATA = {
    tcp: [
        { num: 1, name: "SYN (client → server)" },
        { num: 2, name: "SYN-ACK (server → client)" },
        { num: 3, name: "ACK (client → server)" },
    ],
    dora: [
        { num: 1, name: "Discover (client broadcasts)" },
        { num: 2, name: "Offer (server responds)" },
        { num: 3, name: "Request (client requests offered IP)" },
        { num: 4, name: "Acknowledge (server confirms)" },
    ],
};

function startProcessRound() {
    const p = state.processSorter;
    p.roundId += 1;
    const items = PROCESS_DATA[p.mode];
    p.order = shuffleArray(items);
    p.nextIndex = 0;
    p.mistakes = 0;
    els.processSorterMessage.textContent = "";
    els.processSorterMessage.className = "message";
    updateProcessStats();
    renderProcessChips();
}

function renderProcessChips() {
    const p = state.processSorter;
    els.processSorterChips.innerHTML = "";
    p.order.forEach((step) => {
        const chip = document.createElement("button");
        chip.type = "button";
        chip.className = "osi-chip";
        chip.dataset.num = step.num;
        chip.innerHTML = `<span class="osi-chip-num"></span><span class="osi-chip-name">${escapeHtml(step.name)}</span>`;
        chip.addEventListener("click", () => tapProcessChip(step, chip));
        els.processSorterChips.appendChild(chip);
    });
}

function tapProcessChip(step, chip) {
    const p = state.processSorter;
    if (chip.classList.contains("placed")) return;
    const expectedNum = p.nextIndex + 1;
    if (step.num === expectedNum) {
        chip.classList.add("placed");
        chip.disabled = true;
        p.nextIndex += 1;
        const numEl = chip.querySelector(".osi-chip-num");
        if (numEl) numEl.textContent = p.nextIndex;
        if (p.nextIndex === PROCESS_DATA[p.mode].length) {
            p.rounds += 1;
            if (p.bestMistakes === null || p.mistakes < p.bestMistakes) p.bestMistakes = p.mistakes;
            updateProcessStats();
            els.processSorterMessage.textContent = "Correct sequence! 🎉";
            els.processSorterMessage.className = "message success";
            const completedRoundId = p.roundId;
            setTimeout(() => {
                if (state.processSorter.roundId === completedRoundId) startProcessRound();
            }, 1200);
        }
    } else {
        p.mistakes += 1;
        updateProcessStats();
        chip.classList.add("shake");
        setTimeout(() => chip.classList.remove("shake"), 400);
        els.processSorterMessage.textContent = "Not next — try again.";
        els.processSorterMessage.className = "message error";
    }
}

function updateProcessStats() {
    const p = state.processSorter;
    els.processSorterStatRounds.textContent = p.rounds;
    els.processSorterStatMistakes.textContent = p.mistakes;
    els.processSorterStatBest.textContent = p.bestMistakes === null ? "—" : p.bestMistakes;
}

function setProcessMode(mode) {
    const p = state.processSorter;
    p.mode = mode;
    p.rounds = 0;
    p.bestMistakes = null;
    els.processModeTcp.classList.toggle("active", mode === "tcp");
    els.processModeTcp.classList.toggle("btn-primary", mode === "tcp");
    els.processModeTcp.classList.toggle("btn-secondary", mode !== "tcp");
    els.processModeDora.classList.toggle("active", mode === "dora");
    els.processModeDora.classList.toggle("btn-primary", mode === "dora");
    els.processModeDora.classList.toggle("btn-secondary", mode !== "dora");
    startProcessRound();
}

els.processModeTcp.addEventListener("click", () => setProcessMode("tcp"));
els.processModeDora.addEventListener("click", () => setProcessMode("dora"));
els.processSorterResetBtn.addEventListener("click", startProcessRound);

// ── RAID Match ─────────────────────────────────────────────────────────────
const RAID_DATA = [
    { level: "RAID 0", desc: "Stripes data across drives for speed, but has zero fault tolerance — one drive failure loses everything." },
    { level: "RAID 1", desc: "Mirrors data across two drives for full redundancy, at the cost of half your usable storage." },
    { level: "RAID 5", desc: "Stripes data and parity across 3+ drives, tolerating a single drive failure without data loss." },
    { level: "RAID 6", desc: "Like RAID 5 but with double parity, tolerating two simultaneous drive failures." },
    { level: "RAID 10", desc: "Combines mirroring and striping (mirrored pairs, then striped) for both speed and redundancy." },
];

function generateRaidMatchQuestion() {
    const r = state.raidMatch;
    let item;
    do {
        item = RAID_DATA[randInt(0, RAID_DATA.length - 1)];
    } while (item === r.current && RAID_DATA.length > 1);
    r.current = item;
    r.answered = false;
    renderRaidMatchQuestion();
}

function renderRaidMatchQuestion() {
    const r = state.raidMatch;
    els.raidMatchQuestion.textContent = r.current.level;
    els.raidMatchMessage.textContent = "";
    els.raidMatchMessage.className = "message";

    const pool = RAID_DATA.filter((x) => x !== r.current);
    const wrongItems = shuffleArray(pool).slice(0, 3);
    const choices = shuffleArray([r.current.desc, ...wrongItems.map((x) => x.desc)]);

    els.raidMatchChoices.innerHTML = "";
    choices.forEach((choice) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "drill-choice-btn drill-choice-btn-text";
        btn.textContent = choice;
        btn.addEventListener("click", () => checkRaidMatchAnswer(choice, r.current.desc, btn));
        els.raidMatchChoices.appendChild(btn);
    });
}

function checkRaidMatchAnswer(choice, correctValue, btn) {
    const r = state.raidMatch;
    if (r.answered) return;
    r.answered = true;
    r.solved += 1;
    const isCorrect = choice === correctValue;
    if (isCorrect) r.correct += 1;
    btn.classList.add(isCorrect ? "correct" : "incorrect");
    els.raidMatchChoices.querySelectorAll(".drill-choice-btn").forEach((b) => {
        b.disabled = true;
        if (b.textContent === correctValue) b.classList.add("correct");
    });
    els.raidMatchMessage.textContent = isCorrect ? "Correct!" : "Not quite — check the highlighted answer.";
    els.raidMatchMessage.className = "message " + (isCorrect ? "success" : "error");
    updateRaidMatchStats();
    setTimeout(generateRaidMatchQuestion, 1100);
}

function updateRaidMatchStats() {
    const r = state.raidMatch;
    els.raidMatchStatSolved.textContent = r.solved;
    els.raidMatchStatCorrect.textContent = r.correct;
    els.raidMatchStatAccuracy.textContent = r.solved ? Math.round((r.correct / r.solved) * 100) + "%" : "—";
}

els.raidMatchNextBtn.addEventListener("click", generateRaidMatchQuestion);

// ── IPv4 Classifier ──────────────────────────────────────────────────────────
const IPV4_CATEGORIES = ["Private", "Public", "Loopback", "APIPA / Link-Local", "Multicast"];

function generateRandomIpv4(category) {
    switch (category) {
        case "Private": {
            const kind = randInt(0, 2);
            if (kind === 0) return `10.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`;
            if (kind === 1) return `172.${randInt(16, 31)}.${randInt(0, 255)}.${randInt(1, 254)}`;
            return `192.168.${randInt(0, 255)}.${randInt(1, 254)}`;
        }
        case "Loopback":
            return `127.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`;
        case "APIPA / Link-Local":
            return `169.254.${randInt(0, 255)}.${randInt(1, 254)}`;
        case "Multicast":
            return `${randInt(224, 239)}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`;
        default: {
            let first;
            do {
                first = randInt(1, 223);
            } while ([10, 127].includes(first) || (first >= 172 && first <= 172) || first === 192 || (first >= 224 && first <= 239));
            return `${first}.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`;
        }
    }
}

function generateIpv4ClassifyQuestion() {
    const c = state.ipv4Classify;
    const category = IPV4_CATEGORIES[randInt(0, IPV4_CATEGORIES.length - 1)];
    c.current = { ip: generateRandomIpv4(category), category };
    c.answered = false;
    renderIpv4ClassifyQuestion();
}

function renderIpv4ClassifyQuestion() {
    const c = state.ipv4Classify;
    els.ipv4ClassifyQuestion.textContent = c.current.ip;
    els.ipv4ClassifyMessage.textContent = "";
    els.ipv4ClassifyMessage.className = "message";

    const wrongCategories = shuffleArray(IPV4_CATEGORIES.filter((x) => x !== c.current.category)).slice(0, 3);
    const choices = shuffleArray([c.current.category, ...wrongCategories]);

    els.ipv4ClassifyChoices.innerHTML = "";
    choices.forEach((choice) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "drill-choice-btn";
        btn.textContent = choice;
        btn.addEventListener("click", () => checkIpv4ClassifyAnswer(choice, c.current.category, btn));
        els.ipv4ClassifyChoices.appendChild(btn);
    });
}

function checkIpv4ClassifyAnswer(choice, correctValue, btn) {
    const c = state.ipv4Classify;
    if (c.answered) return;
    c.answered = true;
    c.solved += 1;
    const isCorrect = choice === correctValue;
    if (isCorrect) c.correct += 1;
    btn.classList.add(isCorrect ? "correct" : "incorrect");
    els.ipv4ClassifyChoices.querySelectorAll(".drill-choice-btn").forEach((b) => {
        b.disabled = true;
        if (b.textContent === correctValue) b.classList.add("correct");
    });
    els.ipv4ClassifyMessage.textContent = isCorrect ? "Correct!" : `Not quite — this is ${correctValue}.`;
    els.ipv4ClassifyMessage.className = "message " + (isCorrect ? "success" : "error");
    updateIpv4ClassifyStats();
    setTimeout(generateIpv4ClassifyQuestion, 1000);
}

function updateIpv4ClassifyStats() {
    const c = state.ipv4Classify;
    els.ipv4ClassifyStatSolved.textContent = c.solved;
    els.ipv4ClassifyStatCorrect.textContent = c.correct;
    els.ipv4ClassifyStatAccuracy.textContent = c.solved ? Math.round((c.correct / c.solved) * 100) + "%" : "—";
}

els.ipv4ClassifyNextBtn.addEventListener("click", generateIpv4ClassifyQuestion);

// ── OS Command Match ─────────────────────────────────────────────────────────
const OS_CMD_DATA = [
    { command: "ipconfig /all", desc: "(Windows) Displays detailed IP configuration for all network adapters." },
    { command: "ifconfig", desc: "(Linux/Unix) Displays or configures network interface settings." },
    { command: "ip addr show", desc: "(Linux) Displays IP addresses and network interface information." },
    { command: "netstat -an", desc: "Displays all active network connections and listening ports." },
    { command: "nslookup", desc: "Queries DNS to resolve a hostname to an IP address (or vice versa)." },
    { command: "ping", desc: "Tests connectivity to another host by sending ICMP echo requests." },
    { command: "tracert", desc: "(Windows) Shows the path packets take to a destination, hop by hop." },
    { command: "traceroute", desc: "(Linux/Unix) Shows the path packets take to a destination, hop by hop." },
    { command: "chmod 755 file.sh", desc: "(Linux) Changes file permissions — here, read/write/execute for owner, read/execute for others." },
    { command: "chown user:group file", desc: "(Linux) Changes the owner and group of a file." },
    { command: "grep -i error log.txt", desc: "(Linux) Searches a file for lines matching a pattern, ignoring case." },
    { command: "ls -la", desc: "(Linux) Lists all files in a directory, including hidden ones, with detailed info." },
    { command: "sudo systemctl restart sshd", desc: "(Linux) Restarts the SSH service with elevated privileges." },
    { command: "tasklist", desc: "(Windows) Lists all currently running processes." },
    { command: "ps aux", desc: "(Linux) Lists all currently running processes with detailed info." },
    { command: "kill -9 1234", desc: "(Linux) Forcefully terminates the process with PID 1234." },
    { command: "taskkill /PID 1234 /F", desc: "(Windows) Forcefully terminates the process with PID 1234." },
    { command: "netsh winsock reset", desc: "(Windows) Resets the Winsock catalog, often used to fix network stack issues." },
    { command: "df -h", desc: "(Linux) Shows disk space usage in human-readable format." },
    { command: "route print", desc: "(Windows) Displays the local routing table." },
];

function generateOsCmdMatchQuestion() {
    const c = state.osCmdMatch;
    let item;
    do {
        item = OS_CMD_DATA[randInt(0, OS_CMD_DATA.length - 1)];
    } while (item === c.current && OS_CMD_DATA.length > 1);
    c.current = item;
    c.answered = false;
    renderOsCmdMatchQuestion();
}

function renderOsCmdMatchQuestion() {
    const c = state.osCmdMatch;
    els.osCmdMatchQuestion.textContent = c.current.command;
    els.osCmdMatchMessage.textContent = "";
    els.osCmdMatchMessage.className = "message";

    const pool = OS_CMD_DATA.filter((x) => x !== c.current);
    const wrongItems = shuffleArray(pool).slice(0, 3);
    const choices = shuffleArray([c.current.desc, ...wrongItems.map((x) => x.desc)]);

    els.osCmdMatchChoices.innerHTML = "";
    choices.forEach((choice) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "drill-choice-btn drill-choice-btn-text";
        btn.textContent = choice;
        btn.addEventListener("click", () => checkOsCmdMatchAnswer(choice, c.current.desc, btn));
        els.osCmdMatchChoices.appendChild(btn);
    });
}

function checkOsCmdMatchAnswer(choice, correctValue, btn) {
    const c = state.osCmdMatch;
    if (c.answered) return;
    c.answered = true;
    c.solved += 1;
    const isCorrect = choice === correctValue;
    if (isCorrect) c.correct += 1;
    btn.classList.add(isCorrect ? "correct" : "incorrect");
    els.osCmdMatchChoices.querySelectorAll(".drill-choice-btn").forEach((b) => {
        b.disabled = true;
        if (b.textContent === correctValue) b.classList.add("correct");
    });
    els.osCmdMatchMessage.textContent = isCorrect ? "Correct!" : "Not quite — check the highlighted answer.";
    els.osCmdMatchMessage.className = "message " + (isCorrect ? "success" : "error");
    updateOsCmdMatchStats();
    setTimeout(generateOsCmdMatchQuestion, 1100);
}

function updateOsCmdMatchStats() {
    const c = state.osCmdMatch;
    els.osCmdMatchStatSolved.textContent = c.solved;
    els.osCmdMatchStatCorrect.textContent = c.correct;
    els.osCmdMatchStatAccuracy.textContent = c.solved ? Math.round((c.correct / c.solved) * 100) + "%" : "—";
}

els.osCmdMatchNextBtn.addEventListener("click", generateOsCmdMatchQuestion);

// ── Cable ID ─────────────────────────────────────────────────────────────────
const CABLE_DATA = [
    { name: "RJ45", image: "/images/connector-rj45.jpg" },
    { name: "RJ11", image: "/images/connector-rj11.jpg" },
    { name: "Fiber LC", image: "/images/connector-fiber-lc.jpg" },
    { name: "Fiber SC", image: "/images/connector-fiber-sc.jpeg" },
    { name: "Fiber ST", image: "/images/connector-fiber-st.jpeg" },
    { name: "BNC", image: "/images/connector-bnc.jpg" },
    { name: "DB9", image: "/images/connector-db9.jpg" },
    { name: "DB25", image: "/images/connector-db25.jpg" },
];

function generateCableIdQuestion() {
    const c = state.cableId;
    let item;
    do {
        item = CABLE_DATA[randInt(0, CABLE_DATA.length - 1)];
    } while (item === c.current && CABLE_DATA.length > 1);
    c.current = item;
    c.answered = false;
    renderCableIdQuestion();
}

function renderCableIdQuestion() {
    const c = state.cableId;
    els.cableIdImage.src = c.current.image;
    els.cableIdImage.alt = "Identify this connector";
    els.cableIdMessage.textContent = "";
    els.cableIdMessage.className = "message";

    const pool = CABLE_DATA.filter((x) => x !== c.current);
    const wrongItems = shuffleArray(pool).slice(0, 3);
    const choices = shuffleArray([c.current.name, ...wrongItems.map((x) => x.name)]);

    els.cableIdChoices.innerHTML = "";
    choices.forEach((choice) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "drill-choice-btn";
        btn.textContent = choice;
        btn.addEventListener("click", () => checkCableIdAnswer(choice, c.current.name, btn));
        els.cableIdChoices.appendChild(btn);
    });
}

function checkCableIdAnswer(choice, correctValue, btn) {
    const c = state.cableId;
    if (c.answered) return;
    c.answered = true;
    c.solved += 1;
    const isCorrect = choice === correctValue;
    if (isCorrect) c.correct += 1;
    btn.classList.add(isCorrect ? "correct" : "incorrect");
    els.cableIdChoices.querySelectorAll(".drill-choice-btn").forEach((b) => {
        b.disabled = true;
        if (b.textContent === correctValue) b.classList.add("correct");
    });
    els.cableIdMessage.textContent = isCorrect ? "Correct!" : `Not quite — this is ${correctValue}.`;
    els.cableIdMessage.className = "message " + (isCorrect ? "success" : "error");
    updateCableIdStats();
    setTimeout(generateCableIdQuestion, 1000);
}

function updateCableIdStats() {
    const c = state.cableId;
    els.cableIdStatSolved.textContent = c.solved;
    els.cableIdStatCorrect.textContent = c.correct;
    els.cableIdStatAccuracy.textContent = c.solved ? Math.round((c.correct / c.solved) * 100) + "%" : "—";
}

els.cableIdNextBtn.addEventListener("click", generateCableIdQuestion);

// ── Topology ID ──────────────────────────────────────────────────────────────
function topologySvg(inner) {
    return `<svg viewBox="0 0 300 200" xmlns="http://www.w3.org/2000/svg">${inner}</svg>`;
}

const TOPOLOGY_DATA = [
    {
        name: "Star",
        svg: topologySvg(`
            <line class="topology-line" x1="150" y1="100" x2="220" y2="100"/>
            <line class="topology-line" x1="150" y1="100" x2="185" y2="39"/>
            <line class="topology-line" x1="150" y1="100" x2="115" y2="39"/>
            <line class="topology-line" x1="150" y1="100" x2="80" y2="100"/>
            <line class="topology-line" x1="150" y1="100" x2="115" y2="161"/>
            <line class="topology-line" x1="150" y1="100" x2="185" y2="161"/>
            <circle class="topology-node topology-node-center" cx="150" cy="100" r="12"/>
            <circle class="topology-node" cx="220" cy="100" r="9"/>
            <circle class="topology-node" cx="185" cy="39" r="9"/>
            <circle class="topology-node" cx="115" cy="39" r="9"/>
            <circle class="topology-node" cx="80" cy="100" r="9"/>
            <circle class="topology-node" cx="115" cy="161" r="9"/>
            <circle class="topology-node" cx="185" cy="161" r="9"/>
        `),
    },
    {
        name: "Bus",
        svg: topologySvg(`
            <line class="topology-line topology-line-thick" x1="30" y1="100" x2="270" y2="100"/>
            <line class="topology-line" x1="30" y1="85" x2="30" y2="115"/>
            <line class="topology-line" x1="270" y1="85" x2="270" y2="115"/>
            <circle class="topology-node" cx="70" cy="100" r="9"/>
            <circle class="topology-node" cx="120" cy="100" r="9"/>
            <circle class="topology-node" cx="170" cy="100" r="9"/>
            <circle class="topology-node" cx="220" cy="100" r="9"/>
        `),
    },
    {
        name: "Ring",
        svg: topologySvg(`
            <polygon class="topology-line topology-ring" points="220,100 171.6,33.4 93.4,58.9 93.4,141.1 171.6,166.6"/>
            <circle class="topology-node" cx="220" cy="100" r="9"/>
            <circle class="topology-node" cx="171.6" cy="33.4" r="9"/>
            <circle class="topology-node" cx="93.4" cy="58.9" r="9"/>
            <circle class="topology-node" cx="93.4" cy="141.1" r="9"/>
            <circle class="topology-node" cx="171.6" cy="166.6" r="9"/>
        `),
    },
    {
        name: "Mesh",
        svg: topologySvg(`
            <line class="topology-line" x1="220" y1="100" x2="171.6" y2="33.4"/>
            <line class="topology-line" x1="220" y1="100" x2="93.4" y2="58.9"/>
            <line class="topology-line" x1="220" y1="100" x2="93.4" y2="141.1"/>
            <line class="topology-line" x1="220" y1="100" x2="171.6" y2="166.6"/>
            <line class="topology-line" x1="171.6" y1="33.4" x2="93.4" y2="58.9"/>
            <line class="topology-line" x1="171.6" y1="33.4" x2="93.4" y2="141.1"/>
            <line class="topology-line" x1="171.6" y1="33.4" x2="171.6" y2="166.6"/>
            <line class="topology-line" x1="93.4" y1="58.9" x2="93.4" y2="141.1"/>
            <line class="topology-line" x1="93.4" y1="58.9" x2="171.6" y2="166.6"/>
            <line class="topology-line" x1="93.4" y1="141.1" x2="171.6" y2="166.6"/>
            <circle class="topology-node" cx="220" cy="100" r="9"/>
            <circle class="topology-node" cx="171.6" cy="33.4" r="9"/>
            <circle class="topology-node" cx="93.4" cy="58.9" r="9"/>
            <circle class="topology-node" cx="93.4" cy="141.1" r="9"/>
            <circle class="topology-node" cx="171.6" cy="166.6" r="9"/>
        `),
    },
    {
        name: "Tree",
        svg: topologySvg(`
            <line class="topology-line" x1="150" y1="40" x2="90" y2="110"/>
            <line class="topology-line" x1="150" y1="40" x2="210" y2="110"/>
            <line class="topology-line" x1="90" y1="110" x2="60" y2="175"/>
            <line class="topology-line" x1="90" y1="110" x2="120" y2="175"/>
            <line class="topology-line" x1="210" y1="110" x2="180" y2="175"/>
            <line class="topology-line" x1="210" y1="110" x2="240" y2="175"/>
            <circle class="topology-node topology-node-center" cx="150" cy="40" r="10"/>
            <circle class="topology-node" cx="90" cy="110" r="9"/>
            <circle class="topology-node" cx="210" cy="110" r="9"/>
            <circle class="topology-node" cx="60" cy="175" r="8"/>
            <circle class="topology-node" cx="120" cy="175" r="8"/>
            <circle class="topology-node" cx="180" cy="175" r="8"/>
            <circle class="topology-node" cx="240" cy="175" r="8"/>
        `),
    },
];

function generateTopologyIdQuestion() {
    const t = state.topologyId;
    let item;
    do {
        item = TOPOLOGY_DATA[randInt(0, TOPOLOGY_DATA.length - 1)];
    } while (item === t.current && TOPOLOGY_DATA.length > 1);
    t.current = item;
    t.answered = false;
    renderTopologyIdQuestion();
}

function renderTopologyIdQuestion() {
    const t = state.topologyId;
    els.topologyIdDiagram.innerHTML = t.current.svg;
    els.topologyIdMessage.textContent = "";
    els.topologyIdMessage.className = "message";

    const pool = TOPOLOGY_DATA.filter((x) => x !== t.current);
    const wrongItems = shuffleArray(pool).slice(0, 3);
    const choices = shuffleArray([t.current.name, ...wrongItems.map((x) => x.name)]);

    els.topologyIdChoices.innerHTML = "";
    choices.forEach((choice) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "drill-choice-btn";
        btn.textContent = choice;
        btn.addEventListener("click", () => checkTopologyIdAnswer(choice, t.current.name, btn));
        els.topologyIdChoices.appendChild(btn);
    });
}

function checkTopologyIdAnswer(choice, correctValue, btn) {
    const t = state.topologyId;
    if (t.answered) return;
    t.answered = true;
    t.solved += 1;
    const isCorrect = choice === correctValue;
    if (isCorrect) t.correct += 1;
    btn.classList.add(isCorrect ? "correct" : "incorrect");
    els.topologyIdChoices.querySelectorAll(".drill-choice-btn").forEach((b) => {
        b.disabled = true;
        if (b.textContent === correctValue) b.classList.add("correct");
    });
    els.topologyIdMessage.textContent = isCorrect ? "Correct!" : `Not quite — this is a ${correctValue} topology.`;
    els.topologyIdMessage.className = "message " + (isCorrect ? "success" : "error");
    updateTopologyIdStats();
    setTimeout(generateTopologyIdQuestion, 1000);
}

function updateTopologyIdStats() {
    const t = state.topologyId;
    els.topologyIdStatSolved.textContent = t.solved;
    els.topologyIdStatCorrect.textContent = t.correct;
    els.topologyIdStatAccuracy.textContent = t.solved ? Math.round((t.correct / t.solved) * 100) + "%" : "—";
}

els.topologyIdNextBtn.addEventListener("click", generateTopologyIdQuestion);

// ── Security+ Flashcards ─────────────────────────────────────────────────────
const SECPLUS_DATA = [
    { term: "CIA Triad", full: "Confidentiality, Integrity, Availability", desc: "The three core goals of information security: keep data private, keep it accurate/unaltered, and keep it accessible when needed." },
    { term: "AAA", full: "Authentication, Authorization, Accounting", desc: "The framework for controlling access: who you are, what you're allowed to do, and a log of what you did." },
    { term: "MFA", full: "Multi-Factor Authentication", desc: "Requires two or more independent credentials (something you know, have, or are) to verify identity." },
    { term: "Zero Trust", full: "Never trust, always verify", desc: "A security model that assumes no user or device is trusted by default, even inside the network perimeter." },
    { term: "Least Privilege", full: "Minimum necessary access", desc: "Users and systems should only have the access rights needed to perform their job, nothing more." },
    { term: "Defense in Depth", full: "Layered security controls", desc: "Uses multiple overlapping security measures so that if one layer fails, others still protect the system." },
    { term: "Phishing", full: "Social engineering via deceptive messages", desc: "An attack that tricks users into revealing sensitive info or clicking malicious links, usually via email." },
    { term: "Ransomware", full: "Malware that encrypts data for extortion", desc: "Malicious software that locks or encrypts a victim's files and demands payment to restore access." },
    { term: "Malware", full: "Malicious software", desc: "Any software designed to damage, disrupt, or gain unauthorized access to a system — viruses, worms, trojans, etc." },
    { term: "Firewall", full: "Traffic filtering device/software", desc: "Monitors and controls incoming/outgoing network traffic based on a defined set of security rules." },
    { term: "IDS", full: "Intrusion Detection System", desc: "Monitors network or system traffic for suspicious activity and alerts administrators, but doesn't block it." },
    { term: "IPS", full: "Intrusion Prevention System", desc: "Like an IDS, but actively blocks or prevents detected threats in real time." },
    { term: "PKI", full: "Public Key Infrastructure", desc: "The system of certificates, keys, and authorities used to manage encryption and digital identity verification." },
    { term: "Symmetric Encryption", full: "Same key encrypts and decrypts", desc: "A single shared secret key is used for both encrypting and decrypting data. Fast, but key distribution is a challenge." },
    { term: "Asymmetric Encryption", full: "Public/private key pair", desc: "Uses a public key to encrypt and a private key to decrypt (or vice versa for signing). Solves key distribution issues." },
    { term: "Hashing", full: "One-way data fingerprint", desc: "Converts data into a fixed-length value that can't be reversed, used to verify integrity (e.g., password storage)." },
    { term: "Social Engineering", full: "Human-based manipulation", desc: "Manipulating people into breaking security procedures or revealing confidential information." },
    { term: "DDoS", full: "Distributed Denial of Service", desc: "Overwhelms a target with traffic from many sources to make a service unavailable." },
    { term: "Patch Management", full: "Keeping software updated", desc: "The process of acquiring, testing, and installing updates to fix vulnerabilities and bugs." },
    { term: "Honeypot", full: "Decoy system", desc: "A trap system designed to lure attackers so their behavior can be observed and studied." },
];

function initSecplusFlash() {
    state.secplusFlash.deck = shuffleArray(SECPLUS_DATA);
    state.secplusFlash.index = 0;
    state.secplusFlash.flipped = false;
    renderSecplusCard();
}

function renderSecplusCard() {
    const s = state.secplusFlash;
    const item = s.deck[s.index];
    els.secplusFrontText.textContent = item.term;
    els.secplusBackFull.textContent = item.full;
    els.secplusBackDesc.textContent = item.desc;
    els.secplusCounterText.textContent = `${s.index + 1} / ${s.deck.length}`;
    els.secplusCard.classList.toggle("flipped", s.flipped);
}

function flipSecplusCard() {
    state.secplusFlash.flipped = !state.secplusFlash.flipped;
    els.secplusCard.classList.toggle("flipped", state.secplusFlash.flipped);
}

function goToSecplus(delta) {
    const s = state.secplusFlash;
    s.index = (s.index + delta + s.deck.length) % s.deck.length;
    s.flipped = false;
    renderSecplusCard();
}

els.secplusCard.addEventListener("click", flipSecplusCard);
els.secplusFlipBtn.addEventListener("click", flipSecplusCard);
els.secplusPrevBtn.addEventListener("click", () => goToSecplus(-1));
els.secplusNextBtn.addEventListener("click", () => goToSecplus(1));
els.secplusShuffleBtn.addEventListener("click", () => {
    state.secplusFlash.deck = shuffleArray(state.secplusFlash.deck);
    state.secplusFlash.index = 0;
    state.secplusFlash.flipped = false;
    renderSecplusCard();
});

// ── NATO Phonetic ─────────────────────────────────────────────────────────────
const NATO_DATA = [
    { letter: "A", word: "Alpha", decoys: ["Apple", "Anchor", "Arrow"] },
    { letter: "B", word: "Bravo", decoys: ["Banana", "Bishop", "Blaze"] },
    { letter: "C", word: "Charlie", decoys: ["Cactus", "Comet", "Cobra"] },
    { letter: "D", word: "Delta", decoys: ["Dagger", "Diamond", "Dolphin"] },
    { letter: "E", word: "Echo", decoys: ["Eagle", "Ember", "Emerald"] },
    { letter: "F", word: "Foxtrot", decoys: ["Falcon", "Fable", "Frost"] },
    { letter: "G", word: "Golf", decoys: ["Garnet", "Glacier", "Gravel"] },
    { letter: "H", word: "Hotel", decoys: ["Harbor", "Hazard", "Hunter"] },
    { letter: "I", word: "India", decoys: ["Iceberg", "Ivory", "Impulse"] },
    { letter: "J", word: "Juliett", decoys: ["Jasper", "Jaguar", "Jungle"] },
    { letter: "K", word: "Kilo", decoys: ["Kraken", "Kernel", "Karma"] },
    { letter: "L", word: "Lima", decoys: ["Lantern", "Laser", "Lynx"] },
    { letter: "M", word: "Mike", decoys: ["Marlin", "Mango", "Mercury"] },
    { letter: "N", word: "November", decoys: ["Nebula", "Nectar", "Nomad"] },
    { letter: "O", word: "Oscar", decoys: ["Onyx", "Otter", "Oracle"] },
    { letter: "P", word: "Papa", decoys: ["Panther", "Pepper", "Puzzle"] },
    { letter: "Q", word: "Quebec", decoys: ["Quartz", "Quill", "Quasar"] },
    { letter: "R", word: "Romeo", decoys: ["Raptor", "Raven", "Ripple"] },
    { letter: "S", word: "Sierra", decoys: ["Saber", "Storm", "Spark"] },
    { letter: "T", word: "Tango", decoys: ["Talon", "Thunder", "Tempest"] },
    { letter: "U", word: "Uniform", decoys: ["Umbra", "Utopia", "Urchin"] },
    { letter: "V", word: "Victor", decoys: ["Vortex", "Viper", "Velvet"] },
    { letter: "W", word: "Whiskey", decoys: ["Wraith", "Willow", "Wander"] },
    { letter: "X", word: "X-ray", decoys: ["Xenon", "Xylophone", "Xerox"] },
    { letter: "Y", word: "Yankee", decoys: ["Yonder", "Yeti", "Yield"] },
    { letter: "Z", word: "Zulu", decoys: ["Zephyr", "Zenith", "Zircon"] },
];

function generateNatoPhoneticQuestion() {
    const n = state.natoPhonetic;
    let item;
    do {
        item = NATO_DATA[randInt(0, NATO_DATA.length - 1)];
    } while (item === n.current && NATO_DATA.length > 1);
    n.current = item;
    n.answered = false;
    renderNatoPhoneticQuestion();
}

function renderNatoPhoneticQuestion() {
    const n = state.natoPhonetic;
    els.natoPhoneticQuestion.textContent = n.current.letter;
    els.natoPhoneticMessage.textContent = "";
    els.natoPhoneticMessage.className = "message";

    const choices = shuffleArray([n.current.word, ...n.current.decoys]);

    els.natoPhoneticChoices.innerHTML = "";
    choices.forEach((choice) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "drill-choice-btn";
        btn.textContent = choice;
        btn.addEventListener("click", () => checkNatoPhoneticAnswer(choice, n.current.word, btn));
        els.natoPhoneticChoices.appendChild(btn);
    });
}

function checkNatoPhoneticAnswer(choice, correctValue, btn) {
    const n = state.natoPhonetic;
    if (n.answered) return;
    n.answered = true;
    n.solved += 1;
    const isCorrect = choice === correctValue;
    if (isCorrect) n.correct += 1;
    btn.classList.add(isCorrect ? "correct" : "incorrect");
    els.natoPhoneticChoices.querySelectorAll(".drill-choice-btn").forEach((b) => {
        b.disabled = true;
        if (b.textContent === correctValue) b.classList.add("correct");
    });
    els.natoPhoneticMessage.textContent = isCorrect ? "Correct!" : `Not quite — it's ${correctValue}.`;
    els.natoPhoneticMessage.className = "message " + (isCorrect ? "success" : "error");
    updateNatoPhoneticStats();
    setTimeout(generateNatoPhoneticQuestion, 900);
}

function updateNatoPhoneticStats() {
    const n = state.natoPhonetic;
    els.natoPhoneticStatSolved.textContent = n.solved;
    els.natoPhoneticStatCorrect.textContent = n.correct;
    els.natoPhoneticStatAccuracy.textContent = n.solved ? Math.round((n.correct / n.solved) * 100) + "%" : "—";
}

els.natoPhoneticNextBtn.addEventListener("click", generateNatoPhoneticQuestion);

// ── Message Precedence ────────────────────────────────────────────────────────
const PRECEDENCE_DATA = [
    { level: "FLASH", desc: "Reserved for initial enemy contact reports or reports of vital importance — deliver within minutes, right behind Flash Override." },
    { level: "IMMEDIATE", desc: "For situations that gravely affect national/allied forces and require immediate action — deliver within 30 minutes." },
    { level: "PRIORITY", desc: "For messages requiring prompt action or containing important information — deliver within 3 hours." },
    { level: "ROUTINE", desc: "For all other official message traffic that doesn't require urgent handling — deliver within 6 hours." },
];

function generatePrecedenceMatchQuestion() {
    const p = state.precedenceMatch;
    let item;
    do {
        item = PRECEDENCE_DATA[randInt(0, PRECEDENCE_DATA.length - 1)];
    } while (item === p.current && PRECEDENCE_DATA.length > 1);
    p.current = item;
    p.answered = false;
    renderPrecedenceMatchQuestion();
}

function renderPrecedenceMatchQuestion() {
    const p = state.precedenceMatch;
    els.precedenceMatchQuestion.textContent = p.current.level;
    els.precedenceMatchMessage.textContent = "";
    els.precedenceMatchMessage.className = "message";

    const pool = PRECEDENCE_DATA.filter((x) => x !== p.current);
    const wrongItems = shuffleArray(pool).slice(0, 3);
    const choices = shuffleArray([p.current.desc, ...wrongItems.map((x) => x.desc)]);

    els.precedenceMatchChoices.innerHTML = "";
    choices.forEach((choice) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "drill-choice-btn drill-choice-btn-text";
        btn.textContent = choice;
        btn.addEventListener("click", () => checkPrecedenceMatchAnswer(choice, p.current.desc, btn));
        els.precedenceMatchChoices.appendChild(btn);
    });
}

function checkPrecedenceMatchAnswer(choice, correctValue, btn) {
    const p = state.precedenceMatch;
    if (p.answered) return;
    p.answered = true;
    p.solved += 1;
    const isCorrect = choice === correctValue;
    if (isCorrect) p.correct += 1;
    btn.classList.add(isCorrect ? "correct" : "incorrect");
    els.precedenceMatchChoices.querySelectorAll(".drill-choice-btn").forEach((b) => {
        b.disabled = true;
        if (b.textContent === correctValue) b.classList.add("correct");
    });
    els.precedenceMatchMessage.textContent = isCorrect ? "Correct!" : "Not quite — check the highlighted answer.";
    els.precedenceMatchMessage.className = "message " + (isCorrect ? "success" : "error");
    updatePrecedenceMatchStats();
    setTimeout(generatePrecedenceMatchQuestion, 1100);
}

function updatePrecedenceMatchStats() {
    const p = state.precedenceMatch;
    els.precedenceMatchStatSolved.textContent = p.solved;
    els.precedenceMatchStatCorrect.textContent = p.correct;
    els.precedenceMatchStatAccuracy.textContent = p.solved ? Math.round((p.correct / p.solved) * 100) + "%" : "—";
}

els.precedenceMatchNextBtn.addEventListener("click", generatePrecedenceMatchQuestion);

// ── RF Spectrum Match ─────────────────────────────────────────────────────────
const RF_SPECTRUM_DATA = [
    { band: "LF (Low Frequency)", desc: "30–300 kHz. Long wavelength, used for navigation beacons and submarine communications." },
    { band: "MF (Medium Frequency)", desc: "300 kHz–3 MHz. Used mainly for AM radio broadcasting." },
    { band: "HF (High Frequency)", desc: "3–30 MHz. Reflects off the ionosphere for long-range, over-the-horizon communication." },
    { band: "VHF (Very High Frequency)", desc: "30–300 MHz. Used for FM radio, TV broadcast, and line-of-sight aircraft/marine communication." },
    { band: "UHF (Ultra High Frequency)", desc: "300 MHz–3 GHz. Used for TV broadcast, cell phones, GPS, and satellite communication." },
    { band: "SHF (Super High Frequency)", desc: "3–30 GHz. Used for satellite links, radar, and Wi-Fi." },
];

function generateRfSpectrumQuestion() {
    const r = state.rfSpectrum;
    let item;
    do {
        item = RF_SPECTRUM_DATA[randInt(0, RF_SPECTRUM_DATA.length - 1)];
    } while (item === r.current && RF_SPECTRUM_DATA.length > 1);
    r.current = item;
    r.answered = false;
    renderRfSpectrumQuestion();
}

function renderRfSpectrumQuestion() {
    const r = state.rfSpectrum;
    els.rfSpectrumQuestion.textContent = r.current.band;
    els.rfSpectrumMessage.textContent = "";
    els.rfSpectrumMessage.className = "message";

    const pool = RF_SPECTRUM_DATA.filter((x) => x !== r.current);
    const wrongItems = shuffleArray(pool).slice(0, 3);
    const choices = shuffleArray([r.current.desc, ...wrongItems.map((x) => x.desc)]);

    els.rfSpectrumChoices.innerHTML = "";
    choices.forEach((choice) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "drill-choice-btn drill-choice-btn-text";
        btn.textContent = choice;
        btn.addEventListener("click", () => checkRfSpectrumAnswer(choice, r.current.desc, btn));
        els.rfSpectrumChoices.appendChild(btn);
    });
}

function checkRfSpectrumAnswer(choice, correctValue, btn) {
    const r = state.rfSpectrum;
    if (r.answered) return;
    r.answered = true;
    r.solved += 1;
    const isCorrect = choice === correctValue;
    if (isCorrect) r.correct += 1;
    btn.classList.add(isCorrect ? "correct" : "incorrect");
    els.rfSpectrumChoices.querySelectorAll(".drill-choice-btn").forEach((b) => {
        b.disabled = true;
        if (b.textContent === correctValue) b.classList.add("correct");
    });
    els.rfSpectrumMessage.textContent = isCorrect ? "Correct!" : "Not quite — check the highlighted answer.";
    els.rfSpectrumMessage.className = "message " + (isCorrect ? "success" : "error");
    updateRfSpectrumStats();
    setTimeout(generateRfSpectrumQuestion, 1100);
}

function updateRfSpectrumStats() {
    const r = state.rfSpectrum;
    els.rfSpectrumStatSolved.textContent = r.solved;
    els.rfSpectrumStatCorrect.textContent = r.correct;
    els.rfSpectrumStatAccuracy.textContent = r.solved ? Math.round((r.correct / r.solved) * 100) + "%" : "—";
}

els.rfSpectrumNextBtn.addEventListener("click", generateRfSpectrumQuestion);

// ── Server Roles Match ────────────────────────────────────────────────────────
const SERVER_ROLES_DATA = [
    { role: "AD DS (Active Directory Domain Services)", desc: "Provides centralized authentication and a directory of users, computers, and resources in a domain." },
    { role: "DNS Server", desc: "Resolves hostnames to IP addresses (and vice versa) for the network." },
    { role: "DHCP Server", desc: "Automatically assigns IP addresses and network settings to devices as they join the network." },
    { role: "File Server", desc: "Provides centralized storage where users can save, access, and share files over the network." },
    { role: "Print Server", desc: "Manages and shares printers on the network so multiple users can send print jobs to them." },
    { role: "Web Server (IIS)", desc: "Hosts websites and web applications, serving content to clients over HTTP/HTTPS." },
    { role: "Certificate Authority (AD CS)", desc: "Issues and manages digital certificates used for encryption and identity verification." },
    { role: "DFS (Distributed File System)", desc: "Organizes and replicates shared folders across multiple servers into a single logical namespace." },
];

function generateServerRolesQuestion() {
    const s = state.serverRoles;
    let item;
    do {
        item = SERVER_ROLES_DATA[randInt(0, SERVER_ROLES_DATA.length - 1)];
    } while (item === s.current && SERVER_ROLES_DATA.length > 1);
    s.current = item;
    s.answered = false;
    renderServerRolesQuestion();
}

function renderServerRolesQuestion() {
    const s = state.serverRoles;
    els.serverRolesQuestion.textContent = s.current.role;
    els.serverRolesMessage.textContent = "";
    els.serverRolesMessage.className = "message";

    const pool = SERVER_ROLES_DATA.filter((x) => x !== s.current);
    const wrongItems = shuffleArray(pool).slice(0, 3);
    const choices = shuffleArray([s.current.desc, ...wrongItems.map((x) => x.desc)]);

    els.serverRolesChoices.innerHTML = "";
    choices.forEach((choice) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "drill-choice-btn drill-choice-btn-text";
        btn.textContent = choice;
        btn.addEventListener("click", () => checkServerRolesAnswer(choice, s.current.desc, btn));
        els.serverRolesChoices.appendChild(btn);
    });
}

function checkServerRolesAnswer(choice, correctValue, btn) {
    const s = state.serverRoles;
    if (s.answered) return;
    s.answered = true;
    s.solved += 1;
    const isCorrect = choice === correctValue;
    if (isCorrect) s.correct += 1;
    btn.classList.add(isCorrect ? "correct" : "incorrect");
    els.serverRolesChoices.querySelectorAll(".drill-choice-btn").forEach((b) => {
        b.disabled = true;
        if (b.textContent === correctValue) b.classList.add("correct");
    });
    els.serverRolesMessage.textContent = isCorrect ? "Correct!" : "Not quite — check the highlighted answer.";
    els.serverRolesMessage.className = "message " + (isCorrect ? "success" : "error");
    updateServerRolesStats();
    setTimeout(generateServerRolesQuestion, 1100);
}

function updateServerRolesStats() {
    const s = state.serverRoles;
    els.serverRolesStatSolved.textContent = s.solved;
    els.serverRolesStatCorrect.textContent = s.correct;
    els.serverRolesStatAccuracy.textContent = s.solved ? Math.round((s.correct / s.solved) * 100) + "%" : "—";
}

els.serverRolesNextBtn.addEventListener("click", generateServerRolesQuestion);

// ── Ohm's Law Calculator ─────────────────────────────────────────────────────
function calculateOhmsLaw() {
    const inputs = {
        v: els.ohmsVoltage.value.trim() === "" ? null : parseFloat(els.ohmsVoltage.value),
        i: els.ohmsCurrent.value.trim() === "" ? null : parseFloat(els.ohmsCurrent.value),
        r: els.ohmsResistance.value.trim() === "" ? null : parseFloat(els.ohmsResistance.value),
        p: els.ohmsPower.value.trim() === "" ? null : parseFloat(els.ohmsPower.value),
    };
    const knownCount = Object.values(inputs).filter((x) => x !== null && !Number.isNaN(x)).length;

    if (knownCount < 2) {
        els.ohmsLawMessage.textContent = "Enter at least two values to solve for the rest.";
        els.ohmsLawMessage.className = "message error";
        return;
    }

    let { v, i, r, p } = inputs;
    try {
        if (v !== null && i !== null) {
            r = r === null ? v / i : r;
            p = v * i;
        } else if (v !== null && r !== null) {
            i = i === null ? v / r : i;
            p = v * (i !== null ? i : v / r);
        } else if (i !== null && r !== null) {
            v = v === null ? i * r : v;
            p = (v !== null ? v : i * r) * i;
        } else if (v !== null && p !== null) {
            i = i === null ? p / v : i;
            r = r === null ? v / (p / v) : r;
        } else if (i !== null && p !== null) {
            v = v === null ? p / i : v;
            r = r === null ? (p / i) / i : r;
        } else if (r !== null && p !== null) {
            v = v === null ? Math.sqrt(p * r) : v;
            i = i === null ? Math.sqrt(p / r) : i;
        } else {
            els.ohmsLawMessage.textContent = "Enter at least two values to solve for the rest.";
            els.ohmsLawMessage.className = "message error";
            return;
        }
    } catch (e) {
        els.ohmsLawMessage.textContent = "Couldn't solve with those values.";
        els.ohmsLawMessage.className = "message error";
        return;
    }

    if ([v, i, r, p].some((x) => x === null || Number.isNaN(x) || !Number.isFinite(x))) {
        els.ohmsLawMessage.textContent = "Couldn't solve with those values — check for a zero denominator.";
        els.ohmsLawMessage.className = "message error";
        return;
    }

    const round = (n) => Math.round(n * 10000) / 10000;
    els.ohmsVoltage.value = round(v);
    els.ohmsCurrent.value = round(i);
    els.ohmsResistance.value = round(r);
    els.ohmsPower.value = round(p);
    els.ohmsLawMessage.textContent = `V = ${round(v)}V, I = ${round(i)}A, R = ${round(r)}\u03a9, P = ${round(p)}W`;
    els.ohmsLawMessage.className = "message success";
}

els.ohmsLawCalcBtn.addEventListener("click", calculateOhmsLaw);
els.ohmsLawResetBtn.addEventListener("click", () => {
    els.ohmsVoltage.value = "";
    els.ohmsCurrent.value = "";
    els.ohmsResistance.value = "";
    els.ohmsPower.value = "";
    els.ohmsLawMessage.textContent = "";
    els.ohmsLawMessage.className = "message";
});

// ── Wireless Standards Match ──────────────────────────────────────────────────
const WIRELESS_DATA = [
    { standard: "802.11a", desc: "Up to 54 Mbps, 5 GHz band. Shorter range than 802.11b due to higher frequency." },
    { standard: "802.11b", desc: "Up to 11 Mbps, 2.4 GHz band. Longer range but slower and more prone to interference." },
    { standard: "802.11g", desc: "Up to 54 Mbps, 2.4 GHz band. Backward compatible with 802.11b." },
    { standard: "802.11n (Wi-Fi 4)", desc: "Up to 600 Mbps using MIMO, operates on both 2.4 GHz and 5 GHz bands." },
    { standard: "802.11ac (Wi-Fi 5)", desc: "Over 1 Gbps using wider channels and MU-MIMO, operates on the 5 GHz band." },
    { standard: "802.11ax (Wi-Fi 6)", desc: "Up to ~9.6 Gbps with OFDMA for better efficiency in crowded networks, operates on 2.4/5/6 GHz." },
];

function generateWirelessMatchQuestion() {
    const w = state.wirelessMatch;
    let item;
    do {
        item = WIRELESS_DATA[randInt(0, WIRELESS_DATA.length - 1)];
    } while (item === w.current && WIRELESS_DATA.length > 1);
    w.current = item;
    w.answered = false;
    renderWirelessMatchQuestion();
}

function renderWirelessMatchQuestion() {
    const w = state.wirelessMatch;
    els.wirelessMatchQuestion.textContent = w.current.standard;
    els.wirelessMatchMessage.textContent = "";
    els.wirelessMatchMessage.className = "message";

    const pool = WIRELESS_DATA.filter((x) => x !== w.current);
    const wrongItems = shuffleArray(pool).slice(0, 3);
    const choices = shuffleArray([w.current.desc, ...wrongItems.map((x) => x.desc)]);

    els.wirelessMatchChoices.innerHTML = "";
    choices.forEach((choice) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "drill-choice-btn drill-choice-btn-text";
        btn.textContent = choice;
        btn.addEventListener("click", () => checkWirelessMatchAnswer(choice, w.current.desc, btn));
        els.wirelessMatchChoices.appendChild(btn);
    });
}

function checkWirelessMatchAnswer(choice, correctValue, btn) {
    const w = state.wirelessMatch;
    if (w.answered) return;
    w.answered = true;
    w.solved += 1;
    const isCorrect = choice === correctValue;
    if (isCorrect) w.correct += 1;
    btn.classList.add(isCorrect ? "correct" : "incorrect");
    els.wirelessMatchChoices.querySelectorAll(".drill-choice-btn").forEach((b) => {
        b.disabled = true;
        if (b.textContent === correctValue) b.classList.add("correct");
    });
    els.wirelessMatchMessage.textContent = isCorrect ? "Correct!" : "Not quite — check the highlighted answer.";
    els.wirelessMatchMessage.className = "message " + (isCorrect ? "success" : "error");
    updateWirelessMatchStats();
    setTimeout(generateWirelessMatchQuestion, 1100);
}

function updateWirelessMatchStats() {
    const w = state.wirelessMatch;
    els.wirelessMatchStatSolved.textContent = w.solved;
    els.wirelessMatchStatCorrect.textContent = w.correct;
    els.wirelessMatchStatAccuracy.textContent = w.solved ? Math.round((w.correct / w.solved) * 100) + "%" : "—";
}

els.wirelessMatchNextBtn.addEventListener("click", generateWirelessMatchQuestion);

// ── Logic Gates ────────────────────────────────────────────────────────────────
const LOGIC_GATES = [
    { gate: "AND", inputs: 2, fn: (a, b) => (a && b ? 1 : 0) },
    { gate: "OR", inputs: 2, fn: (a, b) => (a || b ? 1 : 0) },
    { gate: "NOT", inputs: 1, fn: (a) => (a ? 0 : 1) },
    { gate: "XOR", inputs: 2, fn: (a, b) => (a !== b ? 1 : 0) },
    { gate: "NAND", inputs: 2, fn: (a, b) => (a && b ? 0 : 1) },
    { gate: "NOR", inputs: 2, fn: (a, b) => (a || b ? 0 : 1) },
    { gate: "XNOR", inputs: 2, fn: (a, b) => (a === b ? 1 : 0) },
];

function generateLogicGatesQuestion() {
    const l = state.logicGates;
    const gate = LOGIC_GATES[randInt(0, LOGIC_GATES.length - 1)];
    const a = randInt(0, 1);
    const b = randInt(0, 1);
    const output = gate.inputs === 1 ? gate.fn(a) : gate.fn(a, b);
    l.current = { gate: gate.gate, a, b, inputs: gate.inputs, output };
    l.answered = false;
    renderLogicGatesQuestion();
}

function renderLogicGatesQuestion() {
    const l = state.logicGates;
    const c = l.current;
    els.logicGatesQuestion.textContent = c.inputs === 1 ? `${c.gate}(${c.a}) = ?` : `${c.gate}(${c.a}, ${c.b}) = ?`;
    els.logicGatesMessage.textContent = "";
    els.logicGatesMessage.className = "message";

    els.logicGatesChoices.innerHTML = "";
    [0, 1].forEach((choice) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "drill-choice-btn";
        btn.textContent = choice;
        btn.addEventListener("click", () => checkLogicGatesAnswer(choice, c.output, btn));
        els.logicGatesChoices.appendChild(btn);
    });
}

function checkLogicGatesAnswer(choice, correctValue, btn) {
    const l = state.logicGates;
    if (l.answered) return;
    l.answered = true;
    l.solved += 1;
    const isCorrect = choice === correctValue;
    if (isCorrect) l.correct += 1;
    btn.classList.add(isCorrect ? "correct" : "incorrect");
    els.logicGatesChoices.querySelectorAll(".drill-choice-btn").forEach((b) => {
        b.disabled = true;
        if (Number(b.textContent) === correctValue) b.classList.add("correct");
    });
    els.logicGatesMessage.textContent = isCorrect ? "Correct!" : `Not quite — the answer is ${correctValue}.`;
    els.logicGatesMessage.className = "message " + (isCorrect ? "success" : "error");
    updateLogicGatesStats();
    setTimeout(generateLogicGatesQuestion, 800);
}

function updateLogicGatesStats() {
    const l = state.logicGates;
    els.logicGatesStatSolved.textContent = l.solved;
    els.logicGatesStatCorrect.textContent = l.correct;
    els.logicGatesStatAccuracy.textContent = l.solved ? Math.round((l.correct / l.solved) * 100) + "%" : "—";
}

els.logicGatesNextBtn.addEventListener("click", generateLogicGatesQuestion);

// ── Cloud Service Models ──────────────────────────────────────────────────────
const CLOUD_MODELS_DATA = [
    { model: "IaaS (Infrastructure as a Service)", desc: "Provides virtualized computing infrastructure — servers, storage, and networking — that you manage yourself. Example: AWS EC2, Azure VMs." },
    { model: "PaaS (Platform as a Service)", desc: "Provides a platform for developing and deploying applications without managing the underlying infrastructure. Example: Heroku, Azure App Service." },
    { model: "SaaS (Software as a Service)", desc: "Delivers fully-managed software applications over the internet, ready to use. Example: Gmail, Microsoft 365, Salesforce." },
    { model: "DaaS (Desktop as a Service)", desc: "Delivers a virtual desktop environment hosted in the cloud, accessible from any device. Example: Amazon WorkSpaces, Windows 365." },
];

function generateCloudModelsQuestion() {
    const c = state.cloudModels;
    let item;
    do {
        item = CLOUD_MODELS_DATA[randInt(0, CLOUD_MODELS_DATA.length - 1)];
    } while (item === c.current && CLOUD_MODELS_DATA.length > 1);
    c.current = item;
    c.answered = false;
    renderCloudModelsQuestion();
}

function renderCloudModelsQuestion() {
    const c = state.cloudModels;
    els.cloudModelsQuestion.textContent = c.current.model;
    els.cloudModelsMessage.textContent = "";
    els.cloudModelsMessage.className = "message";

    const pool = CLOUD_MODELS_DATA.filter((x) => x !== c.current);
    const wrongItems = shuffleArray(pool).slice(0, 3);
    const choices = shuffleArray([c.current.desc, ...wrongItems.map((x) => x.desc)]);

    els.cloudModelsChoices.innerHTML = "";
    choices.forEach((choice) => {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "drill-choice-btn drill-choice-btn-text";
        btn.textContent = choice;
        btn.addEventListener("click", () => checkCloudModelsAnswer(choice, c.current.desc, btn));
        els.cloudModelsChoices.appendChild(btn);
    });
}

function checkCloudModelsAnswer(choice, correctValue, btn) {
    const c = state.cloudModels;
    if (c.answered) return;
    c.answered = true;
    c.solved += 1;
    const isCorrect = choice === correctValue;
    if (isCorrect) c.correct += 1;
    btn.classList.add(isCorrect ? "correct" : "incorrect");
    els.cloudModelsChoices.querySelectorAll(".drill-choice-btn").forEach((b) => {
        b.disabled = true;
        if (b.textContent === correctValue) b.classList.add("correct");
    });
    els.cloudModelsMessage.textContent = isCorrect ? "Correct!" : "Not quite — check the highlighted answer.";
    els.cloudModelsMessage.className = "message " + (isCorrect ? "success" : "error");
    updateCloudModelsStats();
    setTimeout(generateCloudModelsQuestion, 1100);
}

function updateCloudModelsStats() {
    const c = state.cloudModels;
    els.cloudModelsStatSolved.textContent = c.solved;
    els.cloudModelsStatCorrect.textContent = c.correct;
    els.cloudModelsStatAccuracy.textContent = c.solved ? Math.round((c.correct / c.solved) * 100) + "%" : "—";
}

els.cloudModelsNextBtn.addEventListener("click", generateCloudModelsQuestion);

// ---------------------------------------------------------------------------
// My Flashcards — create your own study decks
// ---------------------------------------------------------------------------

const MY_FC_LOCAL_KEY = "answrit_my_flashcards";

async function loadMyFlashcards() {
    if (state.user) {
        try {
            const res = await fetch("/api/my-flashcards", { credentials: "same-origin" });
            const data = await res.json();
            if (data.ok) {
                state.myFc.decks = data.decks || [];
                saveMyFcLocal();
            }
        } catch (e) {
            const local = loadMyFcLocal();
            if (local) state.myFc.decks = local;
        }
    } else {
        const local = loadMyFcLocal();
        if (local) state.myFc.decks = local;
    }
    showMyFcDecksView();
}

function saveMyFcLocal() {
    try { localStorage.setItem(MY_FC_LOCAL_KEY, JSON.stringify(state.myFc.decks)); } catch (e) {}
}

function loadMyFcLocal() {
    try {
        const raw = localStorage.getItem(MY_FC_LOCAL_KEY);
        return raw ? JSON.parse(raw) : null;
    } catch (e) { return null; }
}

async function saveMyFcToServer() {
    if (!state.user) return;
    try {
        await fetch("/api/my-flashcards", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            credentials: "same-origin",
            body: JSON.stringify({ decks: state.myFc.decks }),
        });
    } catch (e) {}
}

// --- Deck list view ---

function showMyFcDecksView() {
    state.myFc.currentDeck = null;
    state.myFc.studying = false;
    els.myFcDecksView.classList.remove("hidden");
    els.myFcDeckDetail.classList.add("hidden");
    els.myFcStudyArea.classList.add("hidden");
    renderMyFcDeckList();
}

function renderMyFcDeckList() {
    const decks = state.myFc.decks;
    els.myFcDeckCount.textContent = `(${decks.length})`;

    if (!decks.length) {
        els.myFcDeckList.innerHTML = '<p class="my-fc-empty">No decks yet. Create one above!</p>';
        return;
    }

    els.myFcDeckList.innerHTML = "";
    decks.forEach((deck, idx) => {
        const row = document.createElement("button");
        row.className = "my-fc-deck-row";
        row.innerHTML = `
            <span class="my-fc-deck-row-name">${escapeHtml(deck.name)}</span>
            <span class="my-fc-deck-row-count">${deck.cards.length} card${deck.cards.length !== 1 ? "s" : ""}</span>
        `;
        row.addEventListener("click", () => openMyFcDeck(idx));
        els.myFcDeckList.appendChild(row);
    });
}

function createMyFcDeck() {
    const name = els.myFcDeckName.value.trim();
    if (!name) {
        els.myFcDeckMessage.textContent = "Enter a deck name.";
        els.myFcDeckMessage.className = "message error";
        return;
    }
    if (state.myFc.decks.some((d) => d.name.toLowerCase() === name.toLowerCase())) {
        els.myFcDeckMessage.textContent = "A deck with that name already exists.";
        els.myFcDeckMessage.className = "message error";
        return;
    }
    state.myFc.decks.push({ name, cards: [] });
    saveMyFcLocal();
    saveMyFcToServer();
    els.myFcDeckName.value = "";
    els.myFcDeckMessage.textContent = "Deck created!";
    els.myFcDeckMessage.className = "message success";
    setTimeout(() => { els.myFcDeckMessage.textContent = ""; }, 2000);
    renderMyFcDeckList();
}

// --- Deck detail view ---

function openMyFcDeck(idx) {
    state.myFc.currentDeck = idx;
    state.myFc.studying = false;
    els.myFcDecksView.classList.add("hidden");
    els.myFcDeckDetail.classList.remove("hidden");
    els.myFcStudyArea.classList.add("hidden");
    const deck = state.myFc.decks[idx];
    els.myFcDeckTitle.textContent = deck.name;
    renderMyFcCardList();
}

function renderMyFcCardList() {
    const deck = state.myFc.decks[state.myFc.currentDeck];
    if (!deck) return;
    const cards = deck.cards;
    els.myFcCount.textContent = `(${cards.length})`;
    els.myFcStudyBtn.disabled = cards.length === 0;

    if (!cards.length) {
        els.myFcList.innerHTML = '<p class="my-fc-empty">No cards yet. Add some above!</p>';
        return;
    }

    els.myFcList.innerHTML = "";
    cards.forEach((card) => {
        const row = document.createElement("div");
        row.className = "my-fc-card-row";
        row.innerHTML = `
            <div class="my-fc-card-preview">
                <span class="my-fc-card-front">${escapeHtml(card.front)}</span>
                <span class="my-fc-card-sep">→</span>
                <span class="my-fc-card-back">${escapeHtml(card.back)}</span>
            </div>
            <button class="btn btn-danger btn-small my-fc-delete-btn" data-id="${card.id}" title="Delete card">✕</button>
        `;
        els.myFcList.appendChild(row);
    });

    els.myFcList.querySelectorAll(".my-fc-delete-btn").forEach((btn) => {
        btn.addEventListener("click", () => deleteMyFcCard(btn.dataset.id));
    });
}

function addMyFlashcard() {
    const front = els.myFcFront.value.trim();
    const back = els.myFcBack.value.trim();
    if (!front || !back) {
        els.myFcMessage.textContent = "Fill in both front and back.";
        els.myFcMessage.className = "message error";
        return;
    }
    const deck = state.myFc.decks[state.myFc.currentDeck];
    if (!deck) return;

    deck.cards.push({ id: String(Date.now()), front, back });
    saveMyFcLocal();
    saveMyFcToServer();

    els.myFcFront.value = "";
    els.myFcBack.value = "";
    els.myFcMessage.textContent = "Card added!";
    els.myFcMessage.className = "message success";
    setTimeout(() => { els.myFcMessage.textContent = ""; }, 2000);
    renderMyFcCardList();
}

function deleteMyFcCard(cardId) {
    const deck = state.myFc.decks[state.myFc.currentDeck];
    if (!deck) return;
    deck.cards = deck.cards.filter((c) => c.id !== cardId);
    saveMyFcLocal();
    saveMyFcToServer();
    renderMyFcCardList();
}

function deleteMyFcDeck() {
    if (state.myFc.currentDeck === null) return;
    const deck = state.myFc.decks[state.myFc.currentDeck];
    if (!confirm(`Delete deck "${deck.name}" and all its cards?`)) return;
    state.myFc.decks.splice(state.myFc.currentDeck, 1);
    saveMyFcLocal();
    saveMyFcToServer();
    showMyFcDecksView();
}

// --- Study mode ---

function startMyFcStudy() {
    const deck = state.myFc.decks[state.myFc.currentDeck];
    if (!deck || !deck.cards.length) return;
    state.myFc.index = 0;
    state.myFc.flipped = false;
    state.myFc.studying = true;
    els.myFcDeckDetail.classList.add("hidden");
    els.myFcStudyArea.classList.remove("hidden");
    renderMyFcStudyCard();
}

function exitMyFcStudy() {
    state.myFc.studying = false;
    els.myFcStudyArea.classList.add("hidden");
    els.myFcDeckDetail.classList.remove("hidden");
    renderMyFcCardList();
}

function renderMyFcStudyCard() {
    const deck = state.myFc.decks[state.myFc.currentDeck];
    if (!deck) return;
    const card = deck.cards[state.myFc.index];
    if (!card) return;
    els.myFcCard.classList.toggle("flipped", state.myFc.flipped);
    els.myFcFrontText.textContent = card.front;
    els.myFcBackText.textContent = card.back;
    els.myFcCounter.textContent = `Card ${state.myFc.index + 1} of ${deck.cards.length}`;
    els.myFcPrevBtn.disabled = state.myFc.index === 0;
    els.myFcNextBtn.disabled = state.myFc.index === deck.cards.length - 1;
}

function flipMyFc() {
    state.myFc.flipped = !state.myFc.flipped;
    els.myFcCard.classList.toggle("flipped", state.myFc.flipped);
}

function nextMyFc() {
    const deck = state.myFc.decks[state.myFc.currentDeck];
    if (!deck) return;
    if (state.myFc.index < deck.cards.length - 1) {
        state.myFc.index += 1;
        state.myFc.flipped = false;
        renderMyFcStudyCard();
    }
}

function prevMyFc() {
    if (state.myFc.index > 0) {
        state.myFc.index -= 1;
        state.myFc.flipped = false;
        renderMyFcStudyCard();
    }
}

function shuffleMyFc() {
    const deck = state.myFc.decks[state.myFc.currentDeck];
    if (!deck) return;
    for (let i = deck.cards.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [deck.cards[i], deck.cards[j]] = [deck.cards[j], deck.cards[i]];
    }
    state.myFc.index = 0;
    state.myFc.flipped = false;
    renderMyFcStudyCard();
}

els.myFcCreateDeckBtn.addEventListener("click", createMyFcDeck);
els.myFcDeckName.addEventListener("keydown", (e) => { if (e.key === "Enter") createMyFcDeck(); });
els.myFcBackToDecks.addEventListener("click", showMyFcDecksView);
els.myFcDeleteDeckBtn.addEventListener("click", deleteMyFcDeck);
els.myFcAddBtn.addEventListener("click", addMyFlashcard);
els.myFcStudyBtn.addEventListener("click", startMyFcStudy);
els.myFcExitBtn.addEventListener("click", exitMyFcStudy);
els.myFcCard.addEventListener("click", flipMyFc);
els.myFcFlipBtn.addEventListener("click", flipMyFc);
els.myFcNextBtn.addEventListener("click", nextMyFc);
els.myFcPrevBtn.addEventListener("click", prevMyFc);
els.myFcShuffleBtn.addEventListener("click", shuffleMyFc);

// ---------------------------------------------------------------------------
// Packet Tracer Section — Subnetting & CLI Simulator
// ---------------------------------------------------------------------------

const ptState = {
    subnet: { problem: null },
    cli: { tasks: [], taskIndex: 0, history: [], currentMode: "user", hostname: "Router" },
};

// --- PT Subnetting ---

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

function generatePtSubnetProblem() {
    const prob = PT_SUBNET_PROBLEMS[Math.floor(Math.random() * PT_SUBNET_PROBLEMS.length)];
    const prefix = parseInt(prob.network.split("/")[1]);
    const bitsNeeded = Math.ceil(Math.log2(prob.requiredSubnets));
    const newPrefix = prefix + bitsNeeded;
    const hostBits = 32 - newPrefix;
    const usableHosts = Math.pow(2, hostBits) - 2;
    const actualSubnets = Math.pow(2, bitsNeeded);
    const maskOctets = [];
    for (let i = 0; i < 4; i++) {
        const bits = Math.min(8, Math.max(0, newPrefix - i * 8));
        maskOctets.push(256 - Math.pow(2, 8 - bits));
    }
    const mask = maskOctets.join(".");

    ptState.subnet.problem = {
        ...prob,
        answer: { mask, usableHosts, subnets: actualSubnets, prefix: newPrefix },
    };

    els.ptSubnetPrompt.textContent = prob.description;
    els.ptSubnetMask.value = "";
    els.ptSubnetHosts.value = "";
    els.ptSubnetSubnets.value = "";
    els.ptSubnetMessage.textContent = "";
    els.ptSubnetMessage.className = "message";
    els.ptSubnetBreakdown.classList.add("hidden");
    els.ptSubnetBreakdown.innerHTML = "";
}

function checkPtSubnet() {
    const prob = ptState.subnet.problem;
    if (!prob) return;
    const userMask = els.ptSubnetMask.value.trim();
    const userHosts = els.ptSubnetHosts.value.trim();
    const userSubnets = els.ptSubnetSubnets.value.trim();

    const correct = prob.answer;
    const maskOk = userMask === correct.mask;
    const hostsOk = parseInt(userHosts) === correct.usableHosts;
    const subnetsOk = parseInt(userSubnets) === correct.subnets;

    if (maskOk && hostsOk && subnetsOk) {
        els.ptSubnetMessage.textContent = "Correct! All values match.";
        els.ptSubnetMessage.className = "message success";
    } else {
        els.ptSubnetMessage.textContent = "Not quite. Check the breakdown below.";
        els.ptSubnetMessage.className = "message error";
    }

    els.ptSubnetBreakdown.classList.remove("hidden");
    els.ptSubnetBreakdown.innerHTML = `
        <table class="pt-subnet-table">
            <tr><th></th><th>Your Answer</th><th>Correct</th><th></th></tr>
            <tr class="${maskOk ? "row-correct" : "row-wrong"}"><td>Subnet Mask</td><td>${escapeHtml(userMask) || "—"}</td><td>${correct.mask}</td><td>${maskOk ? "✓" : "✗"}</td></tr>
            <tr class="${hostsOk ? "row-correct" : "row-wrong"}"><td>Usable Hosts</td><td>${escapeHtml(userHosts) || "—"}</td><td>${correct.usableHosts}</td><td>${hostsOk ? "✓" : "✗"}</td></tr>
            <tr class="${subnetsOk ? "row-correct" : "row-wrong"}"><td># Subnets</td><td>${escapeHtml(userSubnets) || "—"}</td><td>${correct.subnets}</td><td>${subnetsOk ? "✓" : "✗"}</td></tr>
        </table>
        <p class="pt-subnet-explain">New prefix: /${correct.prefix} — Host bits: ${32 - correct.prefix} — 2^${32 - correct.prefix} - 2 = ${correct.usableHosts} hosts</p>
    `;
}

function openPtActivity(activity) {
    document.querySelector(".pt-activities").classList.add("hidden");
    if (activity === "ptSubnet") {
        els.ptSubnetArea.classList.remove("hidden");
        els.ptCliArea.classList.add("hidden");
        generatePtSubnetProblem();
    } else if (activity === "ptCli") {
        els.ptCliArea.classList.remove("hidden");
        els.ptSubnetArea.classList.add("hidden");
        initPtCli();
    }
}

function closePtActivity() {
    document.querySelector(".pt-activities").classList.remove("hidden");
    els.ptSubnetArea.classList.add("hidden");
    els.ptCliArea.classList.add("hidden");
}

els.ptSubnetCheck.addEventListener("click", checkPtSubnet);
els.ptSubnetNext.addEventListener("click", generatePtSubnetProblem);
els.ptSubnetBack.addEventListener("click", closePtActivity);

document.querySelectorAll("[data-pt-activity]").forEach((card) => {
    card.addEventListener("click", () => openPtActivity(card.dataset.ptActivity));
});

// --- PT CLI Simulator ---

const PT_CLI_TASKS = [
    {
        title: "Enter privileged EXEC mode",
        hint: "Use the 'enable' command",
        steps: [
            { prompt: "Router>", expect: "enable", response: "", nextPrompt: "Router#", nextMode: "priv" }
        ]
    },
    {
        title: "Enter global configuration mode",
        hint: "From privileged EXEC, use 'configure terminal'",
        steps: [
            { prompt: "Router>", expect: "enable", response: "", nextPrompt: "Router#", nextMode: "priv" },
            { prompt: "Router#", expect: "configure terminal", response: "Enter configuration commands, one per line.  End with CNTL/Z.", nextPrompt: "Router(config)#", nextMode: "config" }
        ]
    },
    {
        title: "Set the hostname to 'CoreRouter'",
        hint: "In global config mode, use 'hostname CoreRouter'",
        steps: [
            { prompt: "Router>", expect: "enable", response: "", nextPrompt: "Router#", nextMode: "priv" },
            { prompt: "Router#", expect: "configure terminal", response: "Enter configuration commands, one per line.  End with CNTL/Z.", nextPrompt: "Router(config)#", nextMode: "config" },
            { prompt: "Router(config)#", expect: "hostname CoreRouter", response: "", nextPrompt: "CoreRouter(config)#", nextMode: "config" }
        ]
    },
    {
        title: "Configure interface GigabitEthernet0/0 with IP 192.168.1.1/24 and bring it up",
        hint: "Enter interface config, assign IP, then 'no shutdown'",
        steps: [
            { prompt: "Router>", expect: "enable", response: "", nextPrompt: "Router#", nextMode: "priv" },
            { prompt: "Router#", expect: "configure terminal", response: "Enter configuration commands, one per line.  End with CNTL/Z.", nextPrompt: "Router(config)#", nextMode: "config" },
            { prompt: "Router(config)#", expect: "interface gigabitethernet0/0", response: "", nextPrompt: "Router(config-if)#", nextMode: "config-if" },
            { prompt: "Router(config-if)#", expect: "ip address 192.168.1.1 255.255.255.0", response: "", nextPrompt: "Router(config-if)#", nextMode: "config-if" },
            { prompt: "Router(config-if)#", expect: "no shutdown", response: "%LINK-5-CHANGED: Interface GigabitEthernet0/0, changed state to up", nextPrompt: "Router(config-if)#", nextMode: "config-if" }
        ]
    },
    {
        title: "Set the enable secret password to 'class'",
        hint: "In global config, use 'enable secret class'",
        steps: [
            { prompt: "Router>", expect: "enable", response: "", nextPrompt: "Router#", nextMode: "priv" },
            { prompt: "Router#", expect: "configure terminal", response: "Enter configuration commands, one per line.  End with CNTL/Z.", nextPrompt: "Router(config)#", nextMode: "config" },
            { prompt: "Router(config)#", expect: "enable secret class", response: "", nextPrompt: "Router(config)#", nextMode: "config" }
        ]
    },
    {
        title: "Configure console line with password 'cisco' and enable login",
        hint: "Use 'line console 0', then 'password cisco', then 'login'",
        steps: [
            { prompt: "Router>", expect: "enable", response: "", nextPrompt: "Router#", nextMode: "priv" },
            { prompt: "Router#", expect: "configure terminal", response: "Enter configuration commands, one per line.  End with CNTL/Z.", nextPrompt: "Router(config)#", nextMode: "config" },
            { prompt: "Router(config)#", expect: "line console 0", response: "", nextPrompt: "Router(config-line)#", nextMode: "config-line" },
            { prompt: "Router(config-line)#", expect: "password cisco", response: "", nextPrompt: "Router(config-line)#", nextMode: "config-line" },
            { prompt: "Router(config-line)#", expect: "login", response: "", nextPrompt: "Router(config-line)#", nextMode: "config-line" }
        ]
    },
];

function initPtCli() {
    ptState.cli.taskIndex = 0;
    loadPtCliTask();
}

function loadPtCliTask() {
    const task = PT_CLI_TASKS[ptState.cli.taskIndex];
    if (!task) return;
    ptState.cli.history = [];
    ptState.cli.stepIndex = 0;
    els.ptCliTaskText.textContent = task.title;
    els.ptCliOutput.innerHTML = "";
    els.ptCliPromptText.textContent = task.steps[0].prompt;
    els.ptCliInput.value = "";
    els.ptCliMessage.textContent = "";
    els.ptCliMessage.className = "message";
    els.ptCliNextBtn.disabled = true;
    els.ptCliInput.focus();
}

function handlePtCliCommand() {
    const task = PT_CLI_TASKS[ptState.cli.taskIndex];
    if (!task) return;
    const input = els.ptCliInput.value.trim();
    if (!input) return;

    const step = task.steps[ptState.cli.stepIndex];
    const prompt = step.prompt;

    // Add input to output
    const line = document.createElement("div");
    line.className = "pt-cli-line";
    line.innerHTML = `<span class="pt-cli-prompt-label">${escapeHtml(prompt)}</span> ${escapeHtml(input)}`;
    els.ptCliOutput.appendChild(line);

    // Check if correct
    if (input.toLowerCase() === step.expect.toLowerCase()) {
        if (step.response) {
            const resp = document.createElement("div");
            resp.className = "pt-cli-response";
            resp.textContent = step.response;
            els.ptCliOutput.appendChild(resp);
        }
        ptState.cli.stepIndex++;
        if (ptState.cli.stepIndex >= task.steps.length) {
            // Task complete
            els.ptCliMessage.textContent = "Task complete!";
            els.ptCliMessage.className = "message success";
            els.ptCliNextBtn.disabled = ptState.cli.taskIndex >= PT_CLI_TASKS.length - 1;
            els.ptCliPromptText.textContent = step.nextPrompt;
            els.ptCliInput.value = "";
        } else {
            els.ptCliPromptText.textContent = step.nextPrompt;
            els.ptCliInput.value = "";
        }
    } else {
        const errLine = document.createElement("div");
        errLine.className = "pt-cli-error";
        errLine.textContent = `% Invalid input detected at '^' marker.`;
        els.ptCliOutput.appendChild(errLine);
        els.ptCliInput.value = "";
    }

    els.ptCliOutput.scrollTop = els.ptCliOutput.scrollHeight;
}

function showPtCliHint() {
    const task = PT_CLI_TASKS[ptState.cli.taskIndex];
    if (!task) return;
    els.ptCliMessage.textContent = "Hint: " + task.hint;
    els.ptCliMessage.className = "message";
}

function resetPtCliTask() {
    loadPtCliTask();
}

function nextPtCliTask() {
    if (ptState.cli.taskIndex < PT_CLI_TASKS.length - 1) {
        ptState.cli.taskIndex++;
        loadPtCliTask();
    }
}

els.ptCliInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handlePtCliCommand();
});
els.ptCliHintBtn.addEventListener("click", showPtCliHint);
els.ptCliResetBtn.addEventListener("click", resetPtCliTask);
els.ptCliNextBtn.addEventListener("click", nextPtCliTask);
els.ptCliBack.addEventListener("click", closePtActivity);

// Initialize — wrap defaults in _restoringPrefs so savePrefs is not called
state._restoringPrefs = true;
setFlashcardMode("question");
setFlashcardFilter("all");
state.masteryImmediateFeedback = localStorage.getItem("mastery_immediate_feedback") === "1";
if (els.masteryImmediateFeedbackToggle) {
    els.masteryImmediateFeedbackToggle.checked = state.masteryImmediateFeedback;
}
state._restoringPrefs = false;
loadExams();
checkAuth();

(function restoreTab() {
    const ROUTE_TO_TAB = { "/": "home", "/study": "practice", "/flashcards": "flashcards", "/apps": "gallery", "/history": "history", "/packet-tracer": "packetTracer" };
    const pathTab = ROUTE_TO_TAB[window.location.pathname.replace(/\/$/, "") || "/"];
    if (pathTab) {
        switchTab(pathTab);
    } else {
        const saved = localStorage.getItem(TAB_KEY);
        switchTab(saved || "home");
    }
})();

window.addEventListener("popstate", (e) => {
    const ROUTE_TO_TAB = { "/": "home", "/study": "practice", "/flashcards": "flashcards", "/apps": "gallery", "/history": "history", "/packet-tracer": "packetTracer" };
    const pathTab = ROUTE_TO_TAB[window.location.pathname.replace(/\/$/, "") || "/"];
    if (pathTab) switchTab(pathTab);
});

document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") {
        loadProfile();
    }
});
