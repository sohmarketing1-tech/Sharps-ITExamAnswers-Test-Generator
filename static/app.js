const API = {
    exams: "/api/exams",
    load: "/api/load",
    state: "/api/state",
    test: "/api/test",
    score: "/api/score",
};

const state = {
    exams: [],
    currentFilename: null,
    title: "IT Exam Practice Test",
    url: "",
    allQuestions: [],
    testQuestions: [],
    answers: {}, // { questionId: [selectedOption, ...] }
    currentIndex: 0,
    timerInterval: null,
    secondsElapsed: 0,
    multiSelect: false,
};

// DOM refs
const screens = {
    setup: document.getElementById("setup-screen"),
    quiz: document.getElementById("quiz-screen"),
    results: document.getElementById("results-screen"),
};

const els = {
    examTitle: document.getElementById("exam-title"),
    examUrl: document.getElementById("exam-url"),
    examSelect: document.getElementById("exam-select"),
    totalQuestions: document.getElementById("total-questions"),
    questionCount: document.getElementById("question-count"),
    startBtn: document.getElementById("start-btn"),
    setupMessage: document.getElementById("setup-message"),
    progressBar: document.getElementById("progress-bar"),
    progress: document.getElementById("progress"),
    timer: document.getElementById("timer"),
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
    reviewBtn: document.getElementById("review-btn"),
    reviewPanel: document.getElementById("review-panel"),
    reviewList: document.getElementById("review-list"),
};

function showScreen(name) {
    Object.values(screens).forEach((s) => s.classList.remove("active"));
    screens[name].classList.add("active");
    window.scrollTo({ top: 0, behavior: "smooth" });
}

function updateHeader() {
    els.examTitle.textContent = state.title || "IT Exam Practice Test";
    els.examUrl.textContent = state.url || "";
    document.title = state.title ? `${state.title} - Practice Test` : "ITExamAnswers Practice Test Generator";
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
        populateExamDropdown();
        if (state.exams.length > 0) {
            const current = data.current_filename || state.exams[0].filename;
            els.examSelect.value = current;
            await loadExam(current);
        } else {
            setMessage("No pre-scraped exams found.", "error");
            setAvailableCount(0);
        }
    } catch (err) {
        setMessage(err.message, "error");
        els.examSelect.innerHTML = '<option value="">Error loading exams</option>';
        setAvailableCount(0);
    }
}

function populateExamDropdown() {
    els.examSelect.innerHTML = "";
    if (!state.exams.length) {
        els.examSelect.innerHTML = '<option value="">No exams found</option>';
        return;
    }
    state.exams.forEach((exam) => {
        const opt = document.createElement("option");
        opt.value = exam.filename;
        opt.textContent = `${exam.title} (${exam.count} questions)`;
        els.examSelect.appendChild(opt);
    });
    els.examSelect.disabled = false;
}

async function loadExam(filename) {
    const examMeta = state.exams.find((e) => e.filename === filename);
    if (!examMeta) return;
    setMessage(`Loading ${examMeta.title}…`);
    try {
        const res = await fetch(API.load, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ filename }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) throw new Error(data.error || "Failed to load exam");
        state.title = data.title;
        state.url = data.url;
        state.currentFilename = data.filename;
        state.allQuestions = []; // count only needed; loaded server-side
        updateHeader();
        setAvailableCount(data.count);
        const requested = parseInt(els.questionCount.value, 10) || 20;
        els.questionCount.value = Math.min(requested, data.count);
        setMessage("Ready to start.");
    } catch (err) {
        setMessage(err.message, "error");
        setAvailableCount(0);
    }
}

async function startTest() {
    const total = parseInt(els.totalQuestions.dataset.count || "0") || state.allQuestions.length || 0;
    const requested = parseInt(els.questionCount.value, 10) || 10;
    const n = Math.max(1, Math.min(requested, total || 1));

    try {
        const res = await fetch(`${API.test}?n=${n}`);
        if (!res.ok) {
            const err = await res.json();
            throw new Error(err.error || "Could not generate test");
        }
        const data = await res.json();
        state.testQuestions = data.quiz;
        state.title = data.title;
        updateHeader();
    } catch (err) {
        setMessage(err.message, "error");
        return;
    }

    state.answers = {};
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

function formatTime(totalSeconds) {
    const m = String(Math.floor(totalSeconds / 60)).padStart(2, "0");
    const s = String(totalSeconds % 60).padStart(2, "0");
    return `${m}:${s}`;
}

function isMultiCorrect(question) {
    return question._correct_answer.includes("|");
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
    const selected = state.answers[q.id] || [];
    const isMulti = isMultiCorrect(q);
    state.multiSelect = isMulti;

    updateProgress();
    els.questionText.textContent = q.question;

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

        optionEl.addEventListener("click", (e) => {
            if (e.target.tagName !== "INPUT") {
                input.checked = !input.checked;
            }
            updateAnswer(q.id, input.checked, opt);
        });
    });

    const total = state.testQuestions.length;
    els.prevBtn.disabled = state.currentIndex === 0;
    els.nextBtn.textContent = state.currentIndex === total - 1 ? "Finish" : "Next";
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
    const payload = { answers: state.answers };
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
        alert(err.message);
    }
}

function showResults(data) {
    showScreen("results");
    els.resultsTitle.textContent = `Results: ${data.title || state.title || "Practice Test"}`;
    els.scoreValue.textContent = `${data.score}%`;
    els.scoreDetail.textContent = `You got ${data.correct} out of ${data.total} correct in ${formatTime(state.secondsElapsed)}.`;
    els.reviewPanel.classList.add("hidden");

    const deg = data.total ? Math.round((data.correct / data.total) * 360) : 0;
    document.querySelector(".score-circle").style.setProperty("--score-deg", `${deg}deg`);

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
        selectedText.textContent = r.selected.length ? r.selected.join(", ") : "(no answer)";
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
        correctText.textContent = r.correct_answer.join(", ");
        correctRow.appendChild(correctLabel);
        correctRow.appendChild(correctText);
        item.appendChild(correctRow);

        els.reviewList.appendChild(item);
    });
}

els.examSelect.addEventListener("change", () => loadExam(els.examSelect.value));
els.startBtn.addEventListener("click", startTest);
els.prevBtn.addEventListener("click", () => navigate(-1));
els.nextBtn.addEventListener("click", () => {
    if (state.currentIndex === state.testQuestions.length - 1) {
        submitTest();
    } else {
        navigate(1);
    }
});
els.submitBtn.addEventListener("click", submitTest);
els.restartBtn.addEventListener("click", () => showScreen("setup"));
els.reviewBtn.addEventListener("click", () => {
    els.reviewPanel.classList.toggle("hidden");
});

// Initialize
loadExams();
