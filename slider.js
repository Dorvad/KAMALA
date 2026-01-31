const SCROLL_SETTLE_MS = 140;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

let rtlScrollType = null;

function getRtlScrollType() {
  if (rtlScrollType) return rtlScrollType;
  const probe = document.createElement("div");
  probe.dir = "rtl";
  probe.style.width = "120px";
  probe.style.height = "120px";
  probe.style.overflow = "scroll";
  probe.style.position = "absolute";
  probe.style.top = "-9999px";
  probe.innerHTML = "<div style='width:200px;height:1px;'></div>";
  document.body.appendChild(probe);
  if (probe.scrollLeft > 0) {
    rtlScrollType = "default";
  } else {
    probe.scrollLeft = 1;
    rtlScrollType = probe.scrollLeft === 0 ? "negative" : "reverse";
  }
  document.body.removeChild(probe);
  return rtlScrollType;
}

function getScrollPosition(viewport, isVertical, isRtl) {
  if (isVertical) return viewport.scrollTop;
  if (!isRtl) return viewport.scrollLeft;
  const type = getRtlScrollType();
  if (type === "negative") {
    return -viewport.scrollLeft;
  }
  if (type === "reverse") {
    return viewport.scrollWidth - viewport.clientWidth - viewport.scrollLeft;
  }
  return viewport.scrollLeft;
}

function setScrollPosition(viewport, isVertical, value, behavior, isRtl) {
  let left = 0;
  let top = 0;
  if (isVertical) {
    top = value;
  } else if (!isRtl) {
    left = value;
  } else {
    const type = getRtlScrollType();
    if (type === "negative") {
      left = -value;
    } else if (type === "reverse") {
      left = viewport.scrollWidth - viewport.clientWidth - value;
    } else {
      left = value;
    }
  }
  viewport.scrollTo({ left, top, behavior });
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
    let isPointerDown = false;
    let dragStartPosition = 0;
    let dragStartScroll = 0;
    let dragMoved = false;
    let suppressClickUntil = 0;
    let activePointerId = null;

    function isRTL() {
      return getComputedStyle(slider).direction === "rtl";
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
        const scrollPos = getScrollPosition(viewport, isVertical, isRTL());
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
      const scrollPos = getScrollPosition(viewport, isVertical, isRTL());
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
      setScrollPosition(viewport, isVertical, targetScroll, behavior, isRTL());
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

    function getPointerPosition(event) {
      return isVertical ? event.clientY : event.clientX;
    }

    function handlePointerDown(event) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      isPointerDown = true;
      dragMoved = false;
      activePointerId = event.pointerId;
      dragStartPosition = getPointerPosition(event);
      dragStartScroll = getScrollPosition(viewport, isVertical, isRTL());
      viewport.setPointerCapture(activePointerId);
      if (event.pointerType === "mouse") {
        viewport.classList.add("is-dragging");
      }
    }

    function handlePointerMove(event) {
      if (!isPointerDown || event.pointerId !== activePointerId) return;
      const delta = dragStartPosition - getPointerPosition(event);
      if (Math.abs(delta) > 6) {
        dragMoved = true;
      }
      if (dragMoved) {
        setScrollPosition(viewport, isVertical, dragStartScroll + delta, "auto", isRTL());
      }
    }

    function endPointerDrag() {
      if (!isPointerDown) return;
      if (activePointerId !== null) {
        viewport.releasePointerCapture(activePointerId);
      }
      if (dragMoved) {
        suppressClickUntil = Date.now() + 250;
        settleSelection(true);
      }
      viewport.classList.remove("is-dragging");
      isPointerDown = false;
      dragMoved = false;
      activePointerId = null;
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
        if (Date.now() < suppressClickUntil) return;
        scrollToIndex(index, true);
      });
    });

    viewport.addEventListener("scroll", handleScroll, { passive: true });
    viewport.addEventListener("keydown", handleKeydown);
    viewport.addEventListener("pointerdown", handlePointerDown);
    viewport.addEventListener("pointermove", handlePointerMove);
    viewport.addEventListener("pointerup", endPointerDrag);
    viewport.addEventListener("pointercancel", endPointerDrag);

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
