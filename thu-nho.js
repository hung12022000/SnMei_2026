const opening = document.querySelector('#opening');
const story = document.querySelector('#story');
const swipeArea = document.querySelector('#cut-swipe-area');
const knifeCursor = document.querySelector('.knife-cursor');
const cutHint = document.querySelector('#cut-hint');
const cutCountLabel = document.querySelector('#cut-count');
const finale = document.querySelector('#finale');
const heartOrbit = document.querySelector('#heart-orbit');
const memoryGrid = document.querySelector('#memory-grid');
const memoryExperience = document.querySelector('#memory-experience');
const memoryTrack = document.querySelector('#memory-track');
const memoryStageCount = document.querySelector('#memory-stage-count');
const memoryProgressFill = document.querySelector('#memory-progress-fill');
const photoLightbox = document.querySelector('#photo-lightbox');
const lightboxImage = document.querySelector('#lightbox-image');
const lightboxCaption = document.querySelector('#lightbox-caption');
const memoryImages = Array.from({ length: 19 }, (_, index) => new URL(`images/sn-mei/${String(index + 1).padStart(2, '0')}.jpg`, document.baseURI).href);
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
let cutCount = 0;
let startPoint = null;
let readyTimer;
let heartTimers = [];
let finaleVisible = false;
let transitionBusy = false;
const sceneTransition = document.querySelector('#scene-transition');
let activeMemoryIndex = 0;
let lastMemoryTrigger = null;
let memoryFrame = 0;
let memoryNearViewport = false;

// Stable art direction: every photograph appears once in a deliberate scene.
const memoryScenes = [
  { layout: 'center', photos: [0, 1, 2] },
  { layout: 'left', photos: [3, 4, 5] },
  { layout: 'wide', photos: [6, 7, 8] },
  { layout: 'solo', photos: [9] },
  { layout: 'right', photos: [10, 11, 12] },
  { layout: 'split', photos: [13, 14, 15] },
  { layout: 'close', photos: [16, 17, 18] }
];

function makeMemoryGallery() {
  memoryScenes.forEach((scene, sceneIndex) => {
    const layer = document.createElement('div');
    layer.className = `memory-scene scene-${scene.layout}`;
    layer.dataset.scene = String(sceneIndex);
    layer.setAttribute('aria-hidden', sceneIndex === 0 ? 'false' : 'true');
    if (sceneIndex !== 0) layer.inert = true;
    scene.photos.forEach((photoIndex, slotIndex) => {
      const card = document.createElement('button');
      card.className = `memory-photo memory-photo-${slotIndex === 0 ? 'main' : 'support'} memory-photo-slot-${slotIndex + 1}`;
      card.type = 'button';
      card.dataset.index = String(photoIndex);
      card.setAttribute('aria-label', `Mở ảnh ${String(photoIndex + 1).padStart(2, '0')} trong ${memoryImages.length} ảnh`);
      const image = document.createElement('img');
      image.dataset.src = memoryImages[photoIndex];
      image.alt = `Ảnh kỷ niệm ${String(photoIndex + 1).padStart(2, '0')}`;
      image.loading = sceneIndex < 2 ? 'eager' : 'lazy';
      image.decoding = 'async';
      image.fetchPriority = sceneIndex === 0 ? 'high' : 'auto';
      card.append(image);
      layer.append(card);
    });
    memoryGrid.append(layer);
  });
  memoryTrack.style.setProperty('--memory-scene-count', memoryScenes.length);
}

function showMemory(index) {
  activeMemoryIndex = (index + memoryImages.length) % memoryImages.length;
  lightboxImage.src = memoryImages[activeMemoryIndex];
  lightboxImage.alt = `Khoảnh khắc ${String(activeMemoryIndex + 1).padStart(2, '0')}`;
  lightboxCaption.textContent = `Ảnh ${String(activeMemoryIndex + 1).padStart(2, '0')} · ${activeMemoryIndex + 1} / ${memoryImages.length}`;
}

memoryGrid.addEventListener('click', event => {
  const card = event.target.closest('.memory-photo');
  if (!card || card.closest('.memory-scene')?.inert) return;
  lastMemoryTrigger = card;
  showMemory(Number(card.dataset.index));
  photoLightbox.showModal();
});
photoLightbox.querySelector('.lightbox-close').addEventListener('click', () => photoLightbox.close());
photoLightbox.querySelector('.lightbox-prev').addEventListener('click', () => showMemory(activeMemoryIndex - 1));
photoLightbox.querySelector('.lightbox-next').addEventListener('click', () => showMemory(activeMemoryIndex + 1));
photoLightbox.addEventListener('click', event => { if (event.target === photoLightbox) photoLightbox.close(); });
photoLightbox.addEventListener('close', () => {
  if (lastMemoryTrigger?.isConnected && !lastMemoryTrigger.closest('.memory-scene')?.inert) lastMemoryTrigger.focus({ preventScroll: true });
});
photoLightbox.addEventListener('keydown', event => {
  if (event.key === 'ArrowLeft') showMemory(activeMemoryIndex - 1);
  if (event.key === 'ArrowRight') showMemory(activeMemoryIndex + 1);
});

function updateMemoryScenes() {
  memoryFrame = 0;
  if (!memoryNearViewport || document.hidden) return;
  const rect = memoryExperience.getBoundingClientRect();
  const scrollable = Math.max(1, memoryExperience.offsetHeight - window.innerHeight);
  const progress = Math.max(0, Math.min(1, -rect.top / scrollable));
  const scenePosition = progress * (memoryScenes.length - 1);
  const base = Math.min(memoryScenes.length - 1, Math.floor(scenePosition));
  const fraction = scenePosition - base;
  // Decode the current scene and the next one before its crossfade begins.
  [base, Math.min(base + 1, memoryScenes.length - 1)].forEach(sceneIndex => {
    memoryGrid.querySelectorAll(`.memory-scene[data-scene="${sceneIndex}"] img[data-src]`).forEach(image => {
      image.src = image.dataset.src;
      delete image.dataset.src;
    });
  });
  if (reduceMotion) {
    const stillIndex = Math.min(memoryScenes.length - 1, Math.round(scenePosition));
    memoryGrid.querySelectorAll('.memory-scene').forEach((layer, index) => {
      const shown = index === stillIndex;
      layer.style.opacity = shown ? '1' : '0';
      layer.style.transform = 'none';
      layer.style.filter = 'none';
      layer.style.pointerEvents = shown ? 'auto' : 'none';
      layer.setAttribute('aria-hidden', shown ? 'false' : 'true');
      layer.inert = !shown;
    });
    memoryStageCount.textContent = `${String(stillIndex + 1).padStart(2, '0')} / ${String(memoryScenes.length).padStart(2, '0')}`;
    memoryProgressFill.style.transform = `scaleX(${progress})`;
    return;
  }
  const fadeStart = .58;
  const blend = base === memoryScenes.length - 1 ? 0 : Math.max(0, Math.min(1, (fraction - fadeStart) / (1 - fadeStart)));
  const activeIndex = blend > .48 ? Math.min(base + 1, memoryScenes.length - 1) : base;
  memoryGrid.querySelectorAll('.memory-scene').forEach((layer, index) => {
    let opacity = 0;
    let depth = 0;
    if (index === base) { opacity = 1 - blend; depth = -blend; }
    else if (index === base + 1 && base < memoryScenes.length - 1) { opacity = blend; depth = 1 - blend; }
    layer.style.opacity = String(opacity);
    layer.style.pointerEvents = opacity > .2 ? 'auto' : 'none';
    layer.style.transform = `translate3d(0, ${depth * -2.2}%, ${depth * -24}px) scale(${1 + depth * .035})`;
    layer.style.filter = `blur(${Math.min(2, depth * 1.4)}px)`;
    const available = opacity > .35;
    layer.setAttribute('aria-hidden', available ? 'false' : 'true');
    layer.inert = !available;
  });
  memoryStageCount.textContent = `${String(activeIndex + 1).padStart(2, '0')} / ${String(memoryScenes.length).padStart(2, '0')}`;
  memoryProgressFill.style.transform = `scaleX(${progress})`;
}
function requestMemoryUpdate() {
  if (!memoryFrame && memoryNearViewport && !document.hidden) memoryFrame = window.requestAnimationFrame(updateMemoryScenes);
}
if ('IntersectionObserver' in window) {
  const memoryObserver = new IntersectionObserver(entries => {
    memoryNearViewport = entries.some(entry => entry.isIntersecting);
    if (memoryNearViewport) requestMemoryUpdate();
  }, { rootMargin: '100% 0px' });
  memoryObserver.observe(memoryExperience);
} else {
  memoryNearViewport = true;
}
window.addEventListener('scroll', requestMemoryUpdate, { passive: true });
window.addEventListener('resize', requestMemoryUpdate, { passive: true });
document.addEventListener('visibilitychange', requestMemoryUpdate);
requestMemoryUpdate();

function jumpToScene(scene) {
  window.scrollTo({ top: scene.getBoundingClientRect().top + window.scrollY, behavior: 'instant' });
}

function transitionScene(from, to, swap = () => {}) {
  if (transitionBusy) return;
  if (reduceMotion) { swap(); jumpToScene(to); return; }
  transitionBusy = true;
  sceneTransition.hidden = false;
  sceneTransition.classList.remove('is-unfolding');
  sceneTransition.classList.add('is-gathering');
  from?.classList.add('scene-folding');
  window.setTimeout(() => {
    swap(); jumpToScene(to);
    from?.classList.remove('scene-folding');
    to.classList.add('scene-unfolding');
    sceneTransition.classList.remove('is-gathering');
    sceneTransition.classList.add('is-unfolding');
  }, 590);
  window.setTimeout(() => {
    sceneTransition.hidden = true;
    sceneTransition.className = 'scene-transition';
    to.classList.remove('scene-unfolding');
    transitionBusy = false;
  }, 1320);
}

function seedMagicDust() {
  const layer = document.querySelector('#magic-dust');
  for (let index = 0; index < 22; index++) {
    const mote = document.createElement('i');
    mote.className = 'magic-mote';
    const hue = index % 4 === 0 ? '#e5a6b4' : index % 4 === 1 ? '#f2d4a6' : index % 4 === 2 ? '#d6b9d0' : '#c8d8c7';
    mote.style.setProperty('--mx', `${Math.random() * 100}%`);
    mote.style.setProperty('--my', `${Math.random() * 100}%`);
    mote.style.setProperty('--size', `${2 + Math.random() * 5}px`);
    mote.style.setProperty('--dx', `${Math.round(Math.random() * 90 - 45)}px`);
    mote.style.setProperty('--dy', `${Math.round(Math.random() * 120 - 60)}px`);
    mote.style.setProperty('--duration', `${8 + Math.random() * 9}s`);
    mote.style.setProperty('--delay', `${-Math.random() * 12}s`);
    mote.style.setProperty('--mote-color', hue);
    mote.style.setProperty('--mote-glow', `${hue}85`);
    layer.append(mote);
  }
}

function observeChapterEntrances() {
  if (!('IntersectionObserver' in window)) {
    document.querySelectorAll('.chapter').forEach(chapter => chapter.classList.add('is-visible'));
    return;
  }
  const chapterObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      const chapter = entry.target;
      if (entry.isIntersecting && !chapter.classList.contains('is-visible')) {
        chapter.classList.add('is-visible', 'is-entering');
        window.setTimeout(() => chapter.classList.remove('is-entering'), 900);
      } else if (!entry.isIntersecting) {
        chapter.classList.remove('is-visible');
      }
    });
  }, { threshold: .22 });
  document.querySelectorAll('.chapter').forEach(chapter => chapterObserver.observe(chapter));
}

function prepareCake() {
  window.clearTimeout(readyTimer);
  cutCount = 0;
  startPoint = null;
  opening.dataset.cuts = '0';
  opening.classList.remove('ready', 'is-cut', 'opening-away', 'cuts-1', 'cuts-2', 'cuts-3');
  swipeArea.dataset.dragging = 'false';
  swipeArea.setAttribute('aria-disabled', 'true');
  cutCountLabel.textContent = '0 / 3 NHÁT DỌC';
  cutHint.textContent = 'ĐANG CHUẨN BỊ MÓN QUÀ CHO EM…';
  readyTimer = window.setTimeout(() => {
    opening.classList.add('ready');
    swipeArea.setAttribute('aria-disabled', 'false');
    cutHint.textContent = 'VUỐT DỌC QUA BÁNH 3 LẦN ĐỂ CẮT';
  }, reduceMotion ? 250 : 4200);
}

function cutOnce() {
  if (!opening.classList.contains('ready') || opening.classList.contains('is-cut')) return;
  cutCount = Math.min(cutCount + 1, 3);
  opening.dataset.cuts = String(cutCount);
  opening.classList.add(`cuts-${cutCount}`);
  cutCountLabel.textContent = `${cutCount} / 3 NHÁT DỌC`;
  if (cutCount < 3) {
    cutHint.textContent = cutCount === 1 ? 'ĐẸP LẮM · CÒN 2 NHÁT NỮA' : 'BÁNH ĐANG TÁCH RA · CÒN 1 NHÁT';
    return;
  }
  swipeArea.setAttribute('aria-disabled', 'true');
  opening.classList.add('is-cut');
  cutHint.textContent = 'BÁNH TÁCH RA · MÓN QUÀ CHO EM ĐANG MỞ…';
  window.setTimeout(() => transitionScene(opening, document.querySelector('#hello'), () => {
    opening.hidden = true;
    story.classList.remove('hidden');
  }), 320);
}

function pointInSwipeArea(event) {
  const bounds = swipeArea.getBoundingClientRect();
  return { x: event.clientX - bounds.left, y: event.clientY - bounds.top };
}

swipeArea.addEventListener('pointerdown', event => {
  if (!opening.classList.contains('ready') || opening.classList.contains('is-cut')) return;
  event.preventDefault();
  startPoint = pointInSwipeArea(event);
  swipeArea.dataset.dragging = 'true';
  swipeArea.setPointerCapture(event.pointerId);
});

swipeArea.addEventListener('pointermove', event => {
  if (!startPoint) return;
  const point = pointInSwipeArea(event);
  const dx = point.x - startPoint.x;
  const dy = point.y - startPoint.y;
  knifeCursor.style.left = `${point.x}px`;
  knifeCursor.style.top = `${point.y}px`;
  knifeCursor.style.setProperty('--blade-angle', `${Math.atan2(dy, dx) * 180 / Math.PI - 90}deg`);
});

function finishSwipe(event) {
  if (!startPoint) return;
  const point = pointInSwipeArea(event);
  const dx = point.x - startPoint.x;
  const dy = point.y - startPoint.y;
  startPoint = null;
  swipeArea.dataset.dragging = 'false';
  if (Math.abs(dy) >= 52 && Math.abs(dy) >= Math.abs(dx) * .65) {
    cutOnce();
  } else if (opening.classList.contains('ready')) {
    cutHint.textContent = 'KÉO DỌC QUA MẶT BÁNH ĐỂ CẮT';
    window.setTimeout(() => {
      if (!opening.classList.contains('is-cut')) cutHint.textContent = 'VUỐT DỌC QUA BÁNH 3 LẦN ĐỂ CẮT';
    }, 1300);
  }
}

swipeArea.addEventListener('pointerup', finishSwipe);
swipeArea.addEventListener('pointercancel', () => {
  startPoint = null;
  swipeArea.dataset.dragging = 'false';
});
swipeArea.addEventListener('keydown', event => {
  if (event.key === 'Enter' || event.key === ' ') {
    event.preventDefault();
    cutOnce();
  }
});

document.querySelectorAll('[data-next]').forEach(button => button.addEventListener('click', () => {
  transitionScene(button.closest('.chapter'), document.getElementById(button.dataset.next));
}));

function makeHeartTrail() {
  const count = 38;
  for (let i = 0; i < count; i++) {
    const t = i * Math.PI * 2 / count;
    const x = 16 * Math.pow(Math.sin(t), 3);
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const nextT = t + .01;
    const nextX = 16 * Math.pow(Math.sin(nextT), 3);
    const nextY = 13 * Math.cos(nextT) - 5 * Math.cos(2 * nextT) - 2 * Math.cos(3 * nextT) - Math.cos(4 * nextT);
    const tile = document.createElement('span');
    tile.className = 'heart-photo';
    tile.setAttribute('aria-hidden', 'true');
    const memory = document.createElement('img');
    memory.src = memoryImages[i % memoryImages.length];
    memory.alt = '';
    memory.loading = 'lazy';
    memory.decoding = 'async';
    tile.append(memory);
    tile.style.setProperty('--heart-x', `${50 + x / 16 * 43}%`);
    tile.style.setProperty('--heart-y', `${10 + (12 - y) / 29 * 78}%`);
    tile.dataset.xPercent = String(50 + x / 16 * 43);
    tile.dataset.yPercent = String(10 + (12 - y) / 29 * 78);
    tile.style.setProperty('--heart-angle', `${Math.atan2(-(nextY - y), nextX - x) * 180 / Math.PI}deg`);
    tile.style.setProperty('--delay', `${i * .045}s`);
    tile.style.setProperty('--pulse-delay', `${(i % 9) * .075}s`);
    tile.style.setProperty('--scatter-delay', `${(i % 8) * .035}s`);
    tile.style.setProperty('--scatter-x', `${Math.round(x * 8 + Math.sin(i * 17) * 24)}px`);
    tile.style.setProperty('--scatter-y', `${Math.round(-y * 7 + Math.cos(i * 13) * 20)}px`);
    heartOrbit.append(tile);
  }
}

function clearHeartTimers() {
  heartTimers.forEach(window.clearTimeout);
  heartTimers = [];
}

function playHeartCycle() {
  if (!finaleVisible) return;
  const bounds = heartOrbit.getBoundingClientRect();
  heartOrbit.querySelectorAll('.heart-photo').forEach(tile => {
    tile.style.setProperty('--travel-x', `${(Number(tile.dataset.xPercent) / 100 - .5) * bounds.width}px`);
    tile.style.setProperty('--travel-y', `${(Number(tile.dataset.yPercent) / 100 - .52) * bounds.height}px`);
  });
  clearHeartTimers();
  finale.classList.remove('is-active', 'is-formed', 'is-scattering');
  void finale.offsetWidth;
  finale.classList.add('is-active');
  if (reduceMotion) {
    finale.classList.add('is-formed');
    return;
  }
  heartTimers.push(window.setTimeout(() => finale.classList.add('is-formed'), 3650));
  heartTimers.push(window.setTimeout(() => {
    finale.classList.remove('is-formed');
    finale.classList.add('is-scattering');
  }, 6700));
  heartTimers.push(window.setTimeout(playHeartCycle, 8550));
}

makeMemoryGallery();
seedMagicDust();
observeChapterEntrances();
makeHeartTrail();
if ('IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => {
    finaleVisible = entries.some(entry => entry.isIntersecting && entry.intersectionRatio > .25);
    if (finaleVisible) playHeartCycle();
    else {
      clearHeartTimers();
      finale.classList.remove('is-active', 'is-formed', 'is-scattering');
    }
  }, { threshold: [.25, .5] });
  observer.observe(finale);
} else {
  finaleVisible = true;
  playHeartCycle();
}

document.querySelector('#restart').addEventListener('click', () => transitionScene(finale, opening, () => {
  story.classList.add('hidden');
  opening.hidden = false;
  prepareCake();
}));

prepareCake();
