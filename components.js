export const STEP_LABELS = [
  { key: "closeness", label: "קרבה" },
  { key: "event", label: "אירוע" },
  { key: "location", label: "מקום" },
  { key: "attendees", label: "כמה אתם" }
];

export const OPTIONS = {
  closeness: [
    "קולגה",
    "חברים הכי טובים",
    "חברים במידה בינונית",
    "חברים רחוקים",
    "משפחה קרובה",
    "משפחה רחוקה",
    "אח של חבר או חברה",
    "חברים מהצבא"
  ],
  event: ["חתונה", "ברית/בריתה", "בר/בת מצווה", "חינה"],
  location: ["אולם או גן אירועים", "מסעדה", "בית כנסת", "בית או חצר"],
  attendees: ["מגיע לבד", "מגיע כזוג", "זוג +1", "יותר מ-3 אנשים"]
};

export const STEP_TITLES = {
  closeness: "מה הקרבה ביניכם?",
  event: "איזה אירוע זה?",
  location: "איפה זה קורה?",
  attendees: "כמה אתם באים?"
};

export const STEP_SUBTITLES = {
  closeness: "בקטנה, זה עוזר לקלוע.",
  event: "כל אירוע והאווירה שלו.",
  location: "איפה חוגגים משפיע קצת על הטון.",
  attendees: "נחשב לפי כמה אנשים אתם באמת." 
};

export const QUIPS = [
  "שיהיה במזל טוב, ושלא יתקפל בדרך!",
  "הסכום הזה ירגיש בדיוק נכון.",
  "מתנה נעימה, בלי לחשוב יותר מדי.",
  "זה יעשה להם טוב על הלב.",
  "קצת אהבה, הרבה כבוד."
];

export function renderHeader() {
  return `
    <header class="header">
      <div class="brand">
        <h1>KAMALA</h1>
        <p>בואו נסגור את עניין המתנה בכיף.</p>
      </div>
      <div class="badge" aria-hidden="true">
        <span class="badge-dot"></span>
        נעים, ברור, קצר
      </div>
    </header>
  `;
}

export function renderBreadcrumbs(currentStep, selections) {
  const currentIndex = STEP_LABELS.findIndex((item) => item.key === currentStep);
  const progress = Math.max(0, (currentIndex / (STEP_LABELS.length - 1)) * 100);

  return `
    <nav class="breadcrumbs" role="navigation" aria-label="שלבי התהליך">
      <div class="stepper-track" aria-hidden="true">
        <span class="stepper-track-fill" style="width:${progress}%"></span>
      </div>
      <ol class="stepper">
        ${STEP_LABELS.map((item, index) => {
          const isCurrent = index === currentIndex;
          const isCompleted = selections[item.key] && index < currentIndex;
          return `
            <li class="stepper-item">
              <button
                type="button"
                data-action="breadcrumb"
                data-step="${item.key}"
                ${isCurrent ? "aria-current=\"step\"" : ""}
                class="stepper-dot ${isCompleted ? "completed" : ""} ${isCurrent ? "current" : ""}"
                ${isCompleted ? "" : "disabled"}
                aria-disabled="${isCompleted ? "false" : "true"}"
              >
                <span class="stepper-number">${index + 1}</span>
                <span class="sr-only">${item.label}</span>
              </button>
            </li>
          `;
        }).join("")}
      </ol>
    </nav>
  `;
}

export function renderWelcome() {
  return `
    <section class="card section welcome">
      <div class="hero-ornaments" aria-hidden="true">✨ 💌 🎉</div>
      <h2>יאללה, נסגור מתנה</h2>
      <p>כמה שאלות קצרות ואנחנו נותנים סכום שמרגיש נכון.</p>
      <div class="welcome-actions">
        <button class="button primary" data-action="start">בואו נתחיל</button>
        <span class="welcome-hint">4 צעדים קטנים, מותאם לנייד.</span>
      </div>
    </section>
  `;
}

export function renderStep(stepKey, selected) {
  return `
    <section class="card section">
      <div class="section-title">
        <h2>${STEP_TITLES[stepKey]}</h2>
        <small>שלב ${STEP_LABELS.findIndex((s) => s.key === stepKey) + 1} מתוך 4</small>
      </div>
      <div class="grid" role="radiogroup" aria-label="${STEP_TITLES[stepKey]}">
        ${OPTIONS[stepKey].map((option, index) => `
          <button
            type="button"
            class="option ${selected === option ? "selected" : ""}"
            data-action="select"
            data-step="${stepKey}"
            data-value="${option}"
            role="radio"
            aria-checked="${selected === option ? "true" : "false"}"
            style="--option-hue:${(index * 50) % 320}"
          >
            <span class="option-sheen" aria-hidden="true"></span>
            <span class="option-burst" aria-hidden="true"></span>
            <span class="option-label">${option}</span>
            <span class="option-check" aria-hidden="true">✓</span>
          </button>
        `).join("")}
      </div>
    </section>
  `;
}

export function renderReview(selections) {
  return `
    <section class="card section">
      <div class="section-title">
        <h2>בדיקה זריזה</h2>
        <small>אפשר לשנות אם משהו לא יושב</small>
      </div>
      <div class="review-list">
        <div class="review-item"><span>קרבה</span><strong>${selections.closeness}</strong></div>
        <div class="review-item"><span>אירוע</span><strong>${selections.event}</strong></div>
        <div class="review-item"><span>מקום</span><strong>${selections.location}</strong></div>
        <div class="review-item"><span>כמה אתם</span><strong>${selections.attendees}</strong></div>
      </div>
    </section>
  `;
}

export function renderResult({ amount, recipient, amountWords, quip, dateLabel }) {
  return `
    <section class="card section">
      <div class="section-title">
        <h2>הצ'ק מוכן</h2>
        <small>זה הסכום שהיינו נותנים</small>
      </div>
      <div class="check-wrap">
        <div class="check" id="check-card">
          <div class="confetti" aria-hidden="true">
            ${Array.from({ length: 12 }).map((_, index) => `
              <span style="left:${8 + index * 7}%; top:${-10 + (index % 4) * 6}px; background:${index % 2 === 0 ? "var(--accent-2)" : "var(--accent-3)"}; animation-delay:${index * 0.08}s"></span>
            `).join("")}
          </div>
          <div class="check-header">
            <div>
              <div class="check-label">PAY TO / שלם ל</div>
              <div class="write-wrap">
                <span class="write-text">${recipient}</span>
                <span class="pen-dot" aria-hidden="true"></span>
              </div>
            </div>
            <div class="amount-box" aria-live="polite">₪<span data-amount>${amount}</span></div>
          </div>
          <div class="check-body">
            <div class="check-field">
              <div>
                <div class="label">סכום במילים</div>
                <div class="write-wrap">
                  <span class="write-text">${amountWords}</span>
                  <span class="pen-dot" aria-hidden="true"></span>
                </div>
              </div>
              <div class="label">${dateLabel}</div>
            </div>
            <div class="check-field">
              <div>
                <div class="label">חתימה</div>
                <div class="write-wrap">
                  <span class="write-text">__________</span>
                  <span class="pen-dot" aria-hidden="true"></span>
                </div>
              </div>
              <div class="label">מס' צ'ק 3281</div>
            </div>
          </div>
          <div class="micr">||: 1337  0469  88  12 ||</div>
          <div class="stamp">מאושר</div>
        </div>
      </div>
      <p class="quip">${quip}</p>
      <div class="result-actions">
        <button class="button secondary" data-action="randomize">תן עוד אופציה</button>
        <button class="button primary" data-action="share">לשלוח לחברים</button>
        <button class="button ghost" data-action="restart">להתחיל מחדש</button>
      </div>
    </section>
  `;
}

export function renderBar({ label, value, nextLabel, canProceed, showBack }) {
  return `
    <div class="bar">
      <div class="bar-inner">
        <div class="preview">
          <span class="label">${label}</span>
          <span class="value">${value}</span>
        </div>
        <div class="bar-actions">
          ${showBack ? `<button class="button ghost" data-action="back">חזרה</button>` : ""}
          <button class="button primary" data-action="next" ${canProceed ? "" : "disabled"}>
            ${nextLabel}
          </button>
        </div>
      </div>
    </div>
  `;
}

export function renderBackBar() {
  return `
    <div class="bar">
      <div class="bar-inner bar-inner--start">
        <button class="button ghost" data-action="back">חזרה</button>
      </div>
    </div>
  `;
}
