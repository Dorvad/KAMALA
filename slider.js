// DEV NOTES: Snapping keeps the reel centered by translating the track so the chosen card sits
// in the viewport midpoint. We calculate an offset per index, update it during drag/wheel, then
// on release snap to the nearest index with an easing/overshoot animation (or instantly if reduced motion).
const DEFAULT_SNAP_DURATION = 460;
const SHUFFLE_DURATION = 520;

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeOutBack(t) {
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
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
    const track = slider.querySelector(".reel-track");
    const cards = Array.from(slider.querySelectorAll(".reel-card"));
    const quipNode = slider.querySelector("[data-slider-quip]");
    const liveNode = slider.querySelector("[data-slider-live]");
    const dots = Array.from(slider.querySelectorAll(".reel-dot"));
    const shuffleButton = slider.querySelector("[data-action='shuffle']");
    const isVertical = slider.dataset.orientation === "vertical";
    let navContainer = slider.querySelector(".reel-nav");
    let prevBtn = slider.querySelector(".reel-nav-prev");
    let nextBtn = slider.querySelector(".reel-nav-next");

    if (!viewport || !track || cards.length === 0) return;

    if (!navContainer) {
      navContainer = document.createElement("div");
      navContainer.className = "reel-nav";
      slider.appendChild(navContainer);
    }
    if (!prevBtn) {
      prevBtn = document.createElement("button");
      prevBtn.className = "reel-nav-button reel-nav-prev";
      navContainer.appendChild(prevBtn);
    }
    if (!nextBtn) {
      nextBtn = document.createElement("button");
      nextBtn.className = "reel-nav-button reel-nav-next";
      navContainer.appendChild(nextBtn);
    }
    if (prevBtn && prevBtn.parentElement !== navContainer) {
      navContainer.appendChild(prevBtn);
    }
    if (nextBtn && nextBtn.parentElement !== navContainer) {
      navContainer.appendChild(nextBtn);
    }
    [prevBtn, nextBtn].forEach((button) => {
      if (!button) return;
      button.type = "button";
    });
    prevBtn?.setAttribute("aria-label", "הקודם");
    nextBtn?.setAttribute("aria-label", "הבא");
    const arrowIcon = `
      <svg class="reel-nav-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M15.5 5.5L9 12l6.5 6.5" fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2"></path>
      </svg>
    `;
    if (prevBtn && !prevBtn.querySelector(".reel-nav-icon")) {
      prevBtn.innerHTML = arrowIcon;
    }
    if (nextBtn && !nextBtn.querySelector(".reel-nav-icon")) {
      nextBtn.innerHTML = arrowIcon;
    }

    const values = cards.map((card) => card.dataset.value || "");
    const initialSelection = selections[stepKey];
    let hasSelection = Boolean(initialSelection);
    let currentIndex = Math.max(0, values.indexOf(initialSelection));
    let currentOffset = 0;
    let centerOffset = 0;
    let stepSize = 0;
    let maxOffset = 0;
    let minOffset = 0;
    let animationFrame = null;
    let isDragging = false;
    let pointerStart = 0;
    let pointerLast = 0;
    let pointerStartOffset = 0;
    let pointerLastTime = 0;
    let velocity = 0;
    let wheelTimer = null;

    function measure() {
      const cardRect = cards[0].getBoundingClientRect();
      const viewportRect = viewport.getBoundingClientRect();
      const trackStyle = getComputedStyle(track);
      const gap = parseFloat(trackStyle.gap || trackStyle.columnGap || "0");
      const cardSize = isVertical ? cardRect.height : cardRect.width;
      const viewportSize = isVertical ? viewportRect.height : viewportRect.width;
      stepSize = cardSize + gap;
      centerOffset = (viewportSize - cardSize) / 2;
      maxOffset = centerOffset;
      minOffset = centerOffset - (cards.length - 1) * stepSize;
      snapToIndex(currentIndex, true);
    }

    function offsetForIndex(index) {
      return clamp(centerOffset - index * stepSize, minOffset, maxOffset);
    }

    function indexForOffset(offset) {
      return clamp((centerOffset - offset) / stepSize, 0, cards.length - 1);
    }

    function setOffset(offset) {
      currentOffset = clamp(offset, minOffset, maxOffset);
      scheduleUpdate();
    }

    function scheduleUpdate() {
      if (animationFrame) return;
      animationFrame = requestAnimationFrame(() => {
        animationFrame = null;
        track.style.transform = isVertical
          ? `translate3d(0, ${currentOffset}px, 0)`
          : `translate3d(${currentOffset}px, 0, 0)`;
        updateVisuals();
      });
    }

    function updateVisuals() {
      const floatIndex = indexForOffset(currentOffset);
      cards.forEach((card, index) => {
        const distance = Math.abs(index - floatIndex);
        const scale = clamp(1 - distance * 0.04, 0.92, 1);
        const desaturate = clamp(distance * 0.22, 0, 0.45);
        card.style.setProperty("--scale", scale.toFixed(3));
        card.style.setProperty("--desaturate", desaturate.toFixed(3));
      });

      const nearest = Math.round(floatIndex);
      if (dots[nearest]) {
        dots.forEach((dot, dotIndex) => {
          dot.classList.toggle("is-active", dotIndex === nearest);
        });
      }
      const spectrumFill = slider.querySelector(".spectrum-fill");
      if (spectrumFill) {
        const progress = cards.length > 1 ? nearest / (cards.length - 1) : 0;
        spectrumFill.style.setProperty("--progress", progress.toFixed(3));
      }
      if (feedbackMessages?.length && quipNode) {
        const messageIndex = nearest % feedbackMessages.length;
        quipNode.textContent = feedbackMessages[messageIndex];
      }
    }

    function updateSelection(nextIndex, announce = true) {
      currentIndex = clamp(nextIndex, 0, cards.length - 1);
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

    function isRTL() {
      return getComputedStyle(slider).direction === "rtl";
    }

    function navDelta(isNext) {
      if (isVertical) return isNext ? 1 : -1;
      if (isRTL()) {
        return isNext ? -1 : 1;
      }
      return isNext ? 1 : -1;
    }

    function updateNavButtons() {
      if (!prevBtn || !nextBtn) return;
      const prevTarget = currentIndex + navDelta(false);
      const nextTarget = currentIndex + navDelta(true);
      prevBtn.disabled = prevTarget < 0 || prevTarget > cards.length - 1;
      nextBtn.disabled = nextTarget < 0 || nextTarget > cards.length - 1;
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
      updateSelection(currentIndex, true);
      triggerSpark();
      if (value && value !== selections[stepKey]) {
        onSelect(stepKey, value);
      }
    }

    function snapToIndex(index, immediate = false, announce = false) {
      const targetOffset = offsetForIndex(index);
      if (immediate || reducedMotion) {
        currentOffset = targetOffset;
        track.style.transform = isVertical
          ? `translate3d(0, ${currentOffset}px, 0)`
          : `translate3d(${currentOffset}px, 0, 0)`;
        updateSelection(index, announce);
        updateVisuals();
        if (announce) {
          commitSelection();
        }
        return;
      }

      const startOffset = currentOffset;
      const duration = DEFAULT_SNAP_DURATION;
      const startTime = performance.now();
      const ease = reducedMotion ? easeOutCubic : easeOutBack;

      function animate(now) {
        const progress = clamp((now - startTime) / duration, 0, 1);
        const eased = ease(progress);
        currentOffset = startOffset + (targetOffset - startOffset) * eased;
        track.style.transform = isVertical
          ? `translate3d(0, ${currentOffset}px, 0)`
          : `translate3d(${currentOffset}px, 0, 0)`;
        updateVisuals();
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          currentOffset = targetOffset;
          updateSelection(index, announce);
          updateVisuals();
          if (announce) {
            commitSelection();
          }
        }
      }
      requestAnimationFrame(animate);
    }

    function handlePointerDown(event) {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      isDragging = true;
      pointerStart = isVertical ? event.clientY : event.clientX;
      pointerLast = pointerStart;
      pointerStartOffset = currentOffset;
      pointerLastTime = performance.now();
      velocity = 0;
      viewport.setPointerCapture(event.pointerId);
      viewport.classList.add("is-dragging");
    }

    function handlePointerMove(event) {
      if (!isDragging) return;
      event.preventDefault();
      const now = performance.now();
      const position = isVertical ? event.clientY : event.clientX;
      const delta = position - pointerStart;
      const deltaTime = now - pointerLastTime || 1;
      velocity = (position - pointerLast) / deltaTime;
      pointerLast = position;
      pointerLastTime = now;
      setOffset(pointerStartOffset + delta);
    }

    function handlePointerUp(event) {
      if (!isDragging) return;
      isDragging = false;
      viewport.releasePointerCapture(event.pointerId);
      viewport.classList.remove("is-dragging");
      const projected = currentOffset + velocity * 180;
      const targetIndex = Math.round(indexForOffset(projected));
      snapToIndex(targetIndex, false, true);
    }

    function handleWheel(event) {
      event.preventDefault();
      const delta = isVertical ? (event.deltaY || event.deltaX || 0) : (event.deltaX || event.deltaY || 0);
      setOffset(currentOffset - delta);
      window.clearTimeout(wheelTimer);
      wheelTimer = window.setTimeout(() => {
        const targetIndex = Math.round(indexForOffset(currentOffset));
        snapToIndex(targetIndex, false, true);
      }, 140);
    }

    function handleKeydown(event) {
      const leftKey = isRTL() ? "ArrowRight" : "ArrowLeft";
      const rightKey = isRTL() ? "ArrowLeft" : "ArrowRight";
      if (!isVertical && event.key === leftKey) {
        event.preventDefault();
        snapToIndex(currentIndex - 1, false, true);
      }
      if (!isVertical && event.key === rightKey) {
        event.preventDefault();
        snapToIndex(currentIndex + 1, false, true);
      }
      if (isVertical && (event.key === "ArrowUp" || event.key === "ArrowDown")) {
        event.preventDefault();
        const delta = event.key === "ArrowUp" ? -1 : 1;
        snapToIndex(currentIndex + delta, false, true);
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
      const targetOffset = offsetForIndex(nextIndex);
      const startOffset = currentOffset;
      const startTime = performance.now();
      const duration = reducedMotion ? 0 : SHUFFLE_DURATION;

      function animate(now) {
        const progress = clamp((now - startTime) / duration, 0, 1);
        const eased = easeOutCubic(progress);
        currentOffset = startOffset + (targetOffset - startOffset) * eased;
        track.style.transform = isVertical
          ? `translate3d(0, ${currentOffset}px, 0)`
          : `translate3d(${currentOffset}px, 0, 0)`;
        updateVisuals();
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          snapToIndex(nextIndex, true, true);
        }
      }

      if (duration === 0) {
        snapToIndex(nextIndex, true, true);
        return;
      }
      requestAnimationFrame(animate);
    }

    cards.forEach((card, index) => {
      card.addEventListener("click", () => {
        snapToIndex(index, false, true);
      });
    });

    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        snapToIndex(currentIndex + navDelta(false), false, true);
      });
    }

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        snapToIndex(currentIndex + navDelta(true), false, true);
      });
    }

    viewport.addEventListener("pointerdown", handlePointerDown);
    viewport.addEventListener("pointermove", handlePointerMove, { passive: false });
    viewport.addEventListener("pointerup", handlePointerUp);
    viewport.addEventListener("pointercancel", handlePointerUp);
    viewport.addEventListener("wheel", handleWheel, { passive: false });
    viewport.addEventListener("keydown", handleKeydown);

    if (shuffleButton) {
      shuffleButton.addEventListener("click", shuffle);
    }

    window.addEventListener("resize", measure);
    updateSelection(currentIndex, false);
    measure();
  });
}
