import {
  STEP_LABELS,
  OPTIONS,
  STEP_TITLES,
  STEP_SUBTITLES,
  QUIPS,
  renderHeader,
  renderBreadcrumbs,
  renderWelcome,
  renderStep,
  renderReview,
  renderResult,
  renderBar,
  renderBackBar
} from "./components.js";

// Theme timings: tweak animation durations in styles.css keyframes or adjust ANIMATION_TIMINGS below.
const ANIMATION_TIMINGS = {
  counterMs: 900
};

const BASE_AMOUNT = 200;
const MIN_AMOUNT = 200;
const MAX_AMOUNT = 1200;

const CLOSENESS_POINTS = {
  "קולגה": 80,
  "חברים הכי טובים": 260,
  "חברים במידה בינונית": 180,
  "חברים רחוקים": 120,
  "משפחה קרובה": 320,
  "משפחה רחוקה": 200,
  "אח של חבר או חברה": 140,
  "חברים מהצבא": 220
};

const EVENT_POINTS = {
  "חתונה": 220,
  "ברית/בריתה": 140,
  "בר/בת מצווה": 160,
  "חינה": 180
};

const LOCATION_POINTS = {
  "אולם או גן אירועים": 200,
  "מסעדה": 140,
  "בית כנסת": 120,
  "בית או חצר": 100
};

const ATTENDEES_MULTIPLIER = {
  "מגיע לבד": 1.0,
  "מגיע כזוג": 1.6,
  "זוג +1": 2.1,
  "יותר מ-3 אנשים": 2.6
};

const RECIPIENT_TEXT = {
  "חתונה": "לחתן ולכלה",
  "ברית/בריתה": "להורים המאושרים",
  "בר/בת מצווה": "לחתן/כלת השמחה",
  "חינה": "לזוג ולמשפחה"
};

const STEPS_FLOW = ["welcome", "closeness", "event", "location", "attendees", "review", "result"];
const STORAGE_KEY = "kamaslasim-state";

const state = {
  step: "welcome",
  selections: {
    closeness: "",
    event: "",
    location: "",
    attendees: ""
  },
  computed: {
    amount: null,
    recipient: "",
    amountWords: ""
  },
  ui: {
    reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    lastQuipIndex: 0,
    transition: "forward"
  }
};

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function roundToNearest10(value) {
  return Math.round(value / 10) * 10;
}

function computeResult(selections) {
  const subtotal =
    BASE_AMOUNT +
    CLOSENESS_POINTS[selections.closeness] +
    EVENT_POINTS[selections.event] +
    LOCATION_POINTS[selections.location];

  const raw = subtotal * ATTENDEES_MULTIPLIER[selections.attendees];
  let result = clamp(raw, MIN_AMOUNT, MAX_AMOUNT);
  result = roundToNearest10(result);
  result = clamp(result, MIN_AMOUNT, MAX_AMOUNT);

  return result;
}

function randomizeAmount(amount) {
  const delta = Math.floor(Math.random() * 101) - 50;
  let result = clamp(amount + delta, MIN_AMOUNT, MAX_AMOUNT);
  result = roundToNearest10(result);
  result = clamp(result, MIN_AMOUNT, MAX_AMOUNT);
  return result;
}

function formatAmountWords(amount) {
  return `${amount} שקלים בלבד`;
}

function getNextStep(current) {
  const index = STEPS_FLOW.indexOf(current);
  return STEPS_FLOW[Math.min(index + 1, STEPS_FLOW.length - 1)];
}

function getPreviousStep(current) {
  const index = STEPS_FLOW.indexOf(current);
  return STEPS_FLOW[Math.max(index - 1, 0)];
}

function setStep(step, direction = "forward") {
  state.ui.transition = direction;
  state.step = step;
  saveState();
  render();
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ selections: state.selections }));
}

function loadState() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.selections) {
      state.selections = { ...state.selections, ...parsed.selections };
    }
  } catch (error) {
    console.warn("Failed to parse stored state", error);
  }
}

function vibrate() {
  if (navigator.vibrate) {
    navigator.vibrate(12);
  }
}

function getQuip() {
  const nextIndex = (state.ui.lastQuipIndex + 1) % QUIPS.length;
  state.ui.lastQuipIndex = nextIndex;
  return QUIPS[nextIndex];
}

function getProgressValue() {
  const currentIndex = STEP_LABELS.findIndex((item) => item.key === state.step);
  if (currentIndex === -1) return "";
  return `${currentIndex + 1} מתוך 4`;
}

function render() {
  const app = document.querySelector("#app");
  const showBreadcrumbs = STEP_LABELS.some((item) => state.step === item.key || state.step === "review" || state.step === "result");
  const screenClass = `screen screen--${state.ui.transition}`;

  let content = renderHeader();

  if (showBreadcrumbs && state.step !== "welcome") {
    const breadcrumbStep = state.step === "review" || state.step === "result" ? "attendees" : state.step;
    content += renderBreadcrumbs(breadcrumbStep, state.selections);
  }

  if (state.step === "welcome") {
    content += `<div class="${screenClass}">${renderWelcome()}</div>`;
  }

  if (STEP_LABELS.some((item) => item.key === state.step)) {
    const selected = state.selections[state.step];
    content += `<div class="${screenClass}">${renderStep(state.step, selected)}</div>`;
    content += renderBar({
      label: `שלב ${getProgressValue()}`,
      value: STEP_SUBTITLES[state.step],
      nextLabel: "הבא",
      canProceed: Boolean(selected),
      showBack: state.step !== "closeness"
    });
  }

  if (state.step === "review") {
    content += `<div class="${screenClass}">${renderReview(state.selections)}</div>`;
    content += renderBar({
      label: "סיכום",
      value: "בודקים שהכול נכון",
      nextLabel: "חשב",
      canProceed: true,
      showBack: true
    });
  }

  if (state.step === "result") {
    const date = new Date();
    const dateLabel = `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}`;
    const quip = getQuip();
    content += `<div class="${screenClass}">${renderResult({
      amount: state.computed.amount,
      recipient: state.computed.recipient,
      amountWords: state.computed.amountWords,
      quip,
      dateLabel
    })}</div>`;
    content += renderBackBar();
  }

  app.innerHTML = content;
  bindEvents();
  if (state.step === "result") {
    animateAmount();
  }
}

function bindEvents() {
  const app = document.querySelector("#app");

  app.querySelectorAll("[data-action='select']").forEach((button) => {
    button.addEventListener("click", () => {
      const stepKey = button.dataset.step;
      const value = button.dataset.value;
      state.selections[stepKey] = value;
      vibrate();
      render();
    });
  });

  app.querySelectorAll("[data-action='next']").forEach((button) => {
    button.addEventListener("click", () => {
      if (button.disabled) return;
      if (state.step === "review") {
        const amount = computeResult(state.selections);
        state.computed.amount = amount;
        state.computed.recipient = RECIPIENT_TEXT[state.selections.event];
        state.computed.amountWords = formatAmountWords(amount);
        setStep("result", "forward");
        return;
      }
      setStep(getNextStep(state.step), "forward");
    });
  });

  app.querySelectorAll("[data-action='back']").forEach((button) => {
    button.addEventListener("click", () => {
      const prev = getPreviousStep(state.step);
      setStep(prev, "back");
    });
  });

  app.querySelectorAll("[data-action='start']").forEach((button) => {
    button.addEventListener("click", () => {
      setStep("closeness", "forward");
    });
  });

  app.querySelectorAll("[data-action='breadcrumb']").forEach((button) => {
    if (button.disabled) return;
    button.addEventListener("click", () => {
      const step = button.dataset.step;
      setStep(step, "back");
    });
  });

  const randomizeButton = app.querySelector("[data-action='randomize']");
  if (randomizeButton) {
    randomizeButton.addEventListener("click", () => {
      const nextAmount = randomizeAmount(state.computed.amount);
      state.computed.amount = nextAmount;
      state.computed.amountWords = formatAmountWords(nextAmount);
      render();
    });
  }

  const shareButton = app.querySelector("[data-action='share']");
  if (shareButton) {
    shareButton.addEventListener("click", () => {
      handleShare();
    });
  }

  const restartButton = app.querySelector("[data-action='restart']");
  if (restartButton) {
    restartButton.addEventListener("click", () => {
      state.selections = { closeness: "", event: "", location: "", attendees: "" };
      state.computed = { amount: null, recipient: "", amountWords: "" };
      setStep("closeness", "back");
    });
  }
}

function animateAmount() {
  const amountNode = document.querySelector("[data-amount]");
  if (!amountNode) return;
  const target = Number(state.computed.amount) || 0;
  if (state.ui.reducedMotion) {
    amountNode.textContent = target;
    return;
  }
  const start = performance.now();
  const startValue = 0;
  const duration = ANIMATION_TIMINGS.counterMs;

  const tick = (now) => {
    const progress = Math.min((now - start) / duration, 1);
    const value = Math.round(startValue + (target - startValue) * progress);
    amountNode.textContent = value;
    if (progress < 1) {
      requestAnimationFrame(tick);
    }
  };

  requestAnimationFrame(tick);
}

async function handleShare() {
  const recipient = state.computed.recipient;
  const amount = state.computed.amount;
  const shareText = `KamaLasim אומר/ת: ₪${amount} — ${recipient}`;

  const check = document.querySelector("#check-card");
  if (check && window.html2canvas && navigator.canShare) {
    try {
      const canvas = await window.html2canvas(check, { backgroundColor: null, scale: 2 });
      const blob = await new Promise((resolve) => canvas.toBlob(resolve, "image/png"));
      if (blob) {
        const file = new File([blob], "kamaslasim-check.png", { type: "image/png" });
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text: shareText });
          return;
        }
      }
    } catch (error) {
      console.warn("Image share failed", error);
    }
  }

  if (navigator.share) {
    try {
      await navigator.share({ text: shareText });
      return;
    } catch (error) {
      console.warn("Text share failed", error);
    }
  }

  try {
    await navigator.clipboard.writeText(shareText);
    alert("הטקסט הועתק ללוח. אפשר לשתף עכשיו!");
  } catch (error) {
    prompt("העתיקו את הטקסט לשיתוף:", shareText);
  }
}

function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./sw.js");
  }
}

loadState();
registerServiceWorker();
render();
