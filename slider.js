const SCROLL_SETTLE_MS = 140;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function getScrollPosition(viewport, isVertical) {
  return isVertical ? viewport.scrollTop : viewport.scrollLeft;
}

function setScrollPosition(viewport, isVertical, value, behavior) {
  viewport.scrollTo({
    left: isVertical ? 0 : value,
    top: isVertical ? value : 0,
    behavior
  });
}

function getViewportSize(viewport, isVertical) {
  return isVertical ? viewport.clientHeight : viewport.clientWidth;
}

function getCardCenter(card, isVertical) {
  return (isVertical ? card.offsetTop : card.offsetLeft) +
    (isVertical ? card.offsetHeight : card.offsetWidth) / 2;
}

export function initStepSliders({
  root,
  selections,
  reducedMotion,
  feedbackMessages,
  onSelect
}) {
  const sliders = root.querySelectorAll("[data-slider]");
  sliders.forEach((slider) => {
    const stepKey = slider.dataset.step;
    const viewport = slider.querySelector(".reel-viewport");
    const cards = Array.from(slider.querySelectorAll(".reel-card"));
    const quipNode = slider.querySelector("[data-slider-quip]");
    const liveNode = slider.querySelector("[data-slider-live]");
    const dots = Array.from(slider.querySelectorAll(".reel-dot"));
    const shuffleButton = slider.querySelector("[data-action='shuffle']");
    const prevBtn = slider.querySelector(".reel-nav-prev");
    const nextBtn = slider.querySelector(".reel-nav-next");
    const isVertical = slider.dataset.orientation === "vertical";

    if (!viewport || cards.length === 0) return;

    const values = cards.map((card) => card.dataset.value || "");
    const initialSelection = selections[stepKey];
    let hasSelection = Boolean(initialSelection);
    let currentIndex = Math.max(0, values.indexOf(initialSelection));
    let rafId = null;
    let scrollTimer = null;
    let programmaticScroll = false;
    let programmaticCommit = false;

    function isRTL() {
      return getComputedStyle(slider).direction === "rtl";
    }

    function navDelta(isNext) {
      if (isVertical) return isNext ? 1 : -1;
      if (isRTL()) return isNext ? -1 : 1;
      return isNext ? 1 : -1;
    }

    function updateNavButtons() {
      if (!prevBtn || !nextBtn) return;
      const prevTarget = currentIndex + navDelta(false);
      const nextTarget = currentIndex + navDelta(true);
      prevBtn.disabled = prevTarget < 0 || prevTarget > cards.length - 1;
      nextBtn.disabled = nextTarget < 0 || nextTarget > cards.length - 1;
    }

    function updateIndicators(nearestIndex) {
      if (dots[nearestIndex]) {
        dots.forEach((dot, index) => {
          dot.classList.toggle("is-active", index === nearestIndex);
        });
      }
      const spectrumFill = slider.querySelector(".spectrum-fill");
      if (spectrumFill) {
        const progress = cards.length > 1 ? nearestIndex / (cards.length - 1) : 0;
        spectrumFill.style.setProperty("--progress", progress.toFixed(3));
      }
      if (feedbackMessages?.length && quipNode) {
        const messageIndex = nearestIndex % feedbackMessages.length;
        quipNode.textContent = feedbackMessages[messageIndex];
      }
    }

    function scheduleVisualUpdate() {
      if (rafId) return;
      rafId = requestAnimationFrame(() => {
        rafId = null;
        const scrollPos = getScrollPosition(viewport, isVertical);
        const viewportCenter = scrollPos + getViewportSize(viewport, isVertical) / 2;
        let closestIndex = 0;
        let closestDistance = Number.POSITIVE_INFINITY;

        cards.forEach((card, index) => {
          const cardCenter = getCardCenter(card, isVertical);
          const distance = Math.abs(cardCenter - viewportCenter);
          if (distance < closestDistance) {
            closestDistance = distance;
            closestIndex = index;
          }
          const normalized = distance / Math.max(getViewportSize(viewport, isVertical) * 0.6, 1);
          const scale = clamp(1 - normalized * 0.12, 0.92, 1);
          const desaturate = clamp(normalized * 0.45, 0, 0.45);
          card.style.setProperty("--scale", scale.toFixed(3));
          card.style.setProperty("--desaturate", desaturate.toFixed(3));
        });

        updateIndicators(closestIndex);
      });
    }

    function findClosestIndex() {
      const scrollPos = getScrollPosition(viewport, isVertical);
      const viewportCenter = scrollPos + getViewportSize(viewport, isVertical) / 2;
      let closestIndex = 0;
      let closestDistance = Number.POSITIVE_INFINITY;
      cards.forEach((card, index) => {
        const distance = Math.abs(getCardCenter(card, isVertical) - viewportCenter);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      });
      return closestIndex;
    }

    function updateSelection(announce) {
      cards.forEach((card, index) => {
        const isSelected = hasSelection && index === currentIndex;
        card.classList.toggle("is-selected", isSelected);
        card.setAttribute("aria-checked", isSelected ? "true" : "false");
        card.setAttribute("tabindex", index === currentIndex ? "0" : "-1");
      });
      updateNavButtons();
      if (announce && hasSelection && liveNode) {
        liveNode.textContent = `נבחר: ${values[currentIndex]}`;
      }
    }

    function triggerSpark() {
      const card = cards[currentIndex];
      if (!card) return;
      card.classList.remove("spark");
      void card.offsetWidth;
      card.classList.add("spark");
    }

    function commitSelection() {
      const value = values[currentIndex];
      hasSelection = true;
      updateSelection(true);
      triggerSpark();
      if (value && value !== selections[stepKey]) {
        onSelect(stepKey, value);
      }
    }

    function applyIndex(index, { announce = false, commit = false } = {}) {
      currentIndex = clamp(index, 0, cards.length - 1);
      if (commit) {
        hasSelection = true;
      }
      updateSelection(announce || commit);
      updateIndicators(currentIndex);
      if (commit) {
        commitSelection();
      }
    }

    function scrollToIndex(index, announce = true, immediate = false) {
      const card = cards[index];
      if (!card) return;
      const targetCenter = getCardCenter(card, isVertical);
      const targetScroll = targetCenter - getViewportSize(viewport, isVertical) / 2;
      const behavior = immediate || reducedMotion ? "auto" : "smooth";
      programmaticScroll = true;
      programmaticCommit = announce;
      setScrollPosition(viewport, isVertical, targetScroll, behavior);
      if (behavior === "auto") {
        applyIndex(index, { announce, commit: announce });
        programmaticScroll = false;
        programmaticCommit = false;
      }
    }

    function settleSelection(commit) {
      const closestIndex = findClosestIndex();
      applyIndex(closestIndex, { announce: commit, commit });
    }

    function handleScroll() {
      scheduleVisualUpdate();
      window.clearTimeout(scrollTimer);
      scrollTimer = window.setTimeout(() => {
        const commit = programmaticScroll ? programmaticCommit : true;
        settleSelection(commit);
        programmaticScroll = false;
        programmaticCommit = false;
      }, SCROLL_SETTLE_MS);
    }

    function handleKeydown(event) {
      const leftKey = isRTL() ? "ArrowRight" : "ArrowLeft";
      const rightKey = isRTL() ? "ArrowLeft" : "ArrowRight";
      if (!isVertical && event.key === leftKey) {
        event.preventDefault();
        scrollToIndex(currentIndex - 1, true);
      }
      if (!isVertical && event.key === rightKey) {
        event.preventDefault();
        scrollToIndex(currentIndex + 1, true);
      }
      if (isVertical && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        const delta = event.key === "ArrowUp" ? -1 : 1;
        scrollToIndex(currentIndex + delta, true);
      }
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        commitSelection();
      }
    }

    function shuffle() {
      if (cards.length <= 1) return;
      let nextIndex = Math.floor(Math.random() * cards.length);
      if (nextIndex === currentIndex) {
        nextIndex = (nextIndex + 1) % cards.length;
      }
      scrollToIndex(nextIndex, true, false);
    }

    cards.forEach((card, index) => {
      card.addEventListener("click", () => {
        scrollToIndex(index, true);
      });
    });

    prevBtn?.addEventListener("click", () => {
      scrollToIndex(currentIndex + navDelta(false), true);
    });

    nextBtn?.addEventListener("click", () => {
      scrollToIndex(currentIndex + navDelta(true), true);
    });

    viewport.addEventListener("scroll", handleScroll, { passive: true });
    viewport.addEventListener("keydown", handleKeydown);

    shuffleButton?.addEventListener("click", shuffle);

    window.addEventListener("resize", () => {
      scrollToIndex(currentIndex, false, true);
      scheduleVisualUpdate();
    });

    applyIndex(currentIndex, { announce: false, commit: false });
    scrollToIndex(currentIndex, false, true);
    scheduleVisualUpdate();
  });
}
