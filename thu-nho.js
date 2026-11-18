const opening = document.querySelector('#opening');
const birthdayIntro = document.querySelector('#birthday-intro');
const introCakeTop = document.querySelector('#cake-top-surface');
const candleHeartRing = document.querySelector('#candle-heart-ring');
const birthdayStatus = document.querySelector('#birthday-status');
const micToggle = document.querySelector('#mic-toggle');
const musicToggle = document.querySelector('#music-toggle');
const holdBlow = document.querySelector('#hold-blow');
const birthdayCard = document.querySelector('#birthday-card');
const confettiCanvas = document.querySelector('#birthday-confetti');
const story = document.querySelector('#story');
const swipeArea = document.querySelector('#cut-swipe-area');
const knifeCursor = document.querySelector('.knife-cursor');
const cutHint = document.querySelector('#cut-hint');
const cutCountLabel = document.querySelector('#cut-count');
const finale = document.querySelector('#finale');
const heartOrbit = document.querySelector('#heart-orbit');
const scrollCelebration = document.querySelector('#scroll-celebration');
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
let lastCelebrationScroll = window.scrollY;
let candleCount = 0;
let blownOutCount = 0;
let extinguishInProgress = false;
let birthdayCelebrated = false;
let holdBlowTimer = 0;
let audioContext = null;
let micStream = null;
let micSource = null;
let analyser = null;
let micCheckTimer = 0;
let backgroundMusicTimer = 0;
let birthdayTuneNodes = [];
let blowThresholdStart = 0;
let introMusicGestureHandled = false;

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

function makePartyCandle(x, y, index) {
  const candle = document.createElement('button');
  candle.className = 'party-candle';
  candle.type = 'button';
    candle.dataset.candleNumber = String(index + 1);
  candle.style.left = `${x}%`;
  candle.style.top = `${y}%`;
  candle.style.setProperty('--candle-color', ['#f9a9bd', '#f5d67f', '#a9dce0', '#cab0ee', '#f6bd91'][index % 5]);
  candle.setAttribute('aria-label', `Nến ${index + 1}, đang cháy`);
  candle.setAttribute('aria-pressed', 'true');
  candle.innerHTML = '<span class="candle-flame" aria-hidden="true"></span><span class="candle-wick" aria-hidden="true"></span><span class="candle-body" aria-hidden="true"></span><span class="candle-smoke" aria-hidden="true"></span>';
  candleHeartRing.append(candle);
}

function setBirthdayStatus(message) {
  birthdayStatus.textContent = message;
}

function countLitCandles() {
  return candleHeartRing.querySelectorAll('.party-candle:not(.is-off)').length;
}

function paintCandleStatus() {
  const lit = countLitCandles();
  setBirthdayStatus(`${lit} / ${candleCount} ngọn nến đang cháy${extinguishInProgress ? ' · gió đang thổi qua bánh…' : ''}`);
  if (lit === 0 && candleCount && !birthdayCelebrated && !extinguishInProgress) celebrateBirthday();
}

function addPartyCandle(x, y) {
  if (extinguishInProgress || birthdayCelebrated) return;
  candleCount += 1;
  makePartyCandle(x, y, candleCount - 1);
  setBirthdayStatus(`Đã thêm nến thứ ${candleCount} · hãy gửi em một điều ước ✨`);
  playTone(659.25, .22, .035);
}

function togglePartyCandle(candle) {
  if (extinguishInProgress || birthdayCelebrated) return;
  const isOff = candle.classList.toggle('is-off');
  candle.setAttribute('aria-pressed', String(!isOff));
  candle.setAttribute('aria-label', `Nến ${Number(candle.dataset.candleNumber) || 1}, ${isOff ? 'đã tắt' : 'đang cháy'}`);
  if (isOff) candle.classList.add('is-smoking');
  else candle.classList.remove('is-smoking');
  if (isOff) window.setTimeout(() => candle.classList.remove('is-smoking'), 1900);
  paintCandleStatus();
}

function relightCandles() {
  birthdayCard.close();
  document.querySelector('#continue-intro-cut').hidden = true;
  birthdayCelebrated = false;
  extinguishInProgress = false;
  candleHeartRing.replaceChildren();
  candleCount = 24;
  blownOutCount = 0;
  for (let index = 0; index < candleCount; index++) {
    const t = index * Math.PI * 2 / candleCount;
    const x = 50 + (16 * Math.pow(Math.sin(t), 3) / 16) * 37;
    const heartY = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    const y = 8 + (13 - heartY) / 29 * 78;
    makePartyCandle(x, y, index);
  }
  setBirthdayStatus('24 ngọn nến đang chờ điều ước của em ✨');
  stopBirthdayTune();
}

introCakeTop.addEventListener('click', event => {
  const candle = event.target.closest('.party-candle');
  if (candle) { event.stopPropagation(); togglePartyCandle(candle); return; }
  const bounds = introCakeTop.getBoundingClientRect();
  const x = (event.clientX - bounds.left) / bounds.width;
  const y = (event.clientY - bounds.top) / bounds.height;
  if (((x - .5) / .49) ** 2 + ((y - .5) / .49) ** 2 > 1) return;
  addPartyCandle(Math.max(8, Math.min(92, x * 100)), Math.max(10, Math.min(88, y * 100)));
});

function makePartySprinkles() {
  const layer = document.querySelector('#cake-sprinkles');
  const colors = ['#fff0ad', '#c0e8e6', '#f5b1c1', '#dfc7fa', '#fff9e7'];
  for (let index = 0; index < 35; index++) {
    const sprinkle = document.createElement('i');
    sprinkle.className = 'cake-sprinkle';
    sprinkle.style.left = `${5 + ((index * 37) % 90)}%`;
    sprinkle.style.top = `${18 + ((index * 23) % 67)}%`;
    sprinkle.style.setProperty('--sprinkle-color', colors[index % colors.length]);
    sprinkle.style.setProperty('--sprinkle-rotate', `${(index * 47) % 160 - 80}deg`);
    layer.append(sprinkle);
  }
}

function makeBirthdayStars() {
  const layer = document.querySelector('#birthday-stars');
  for (let index = 0; index < 84; index++) {
    const star = document.createElement('i');
    star.className = 'birthday-star';
    star.style.left = `${(index * 47 + 13) % 100}%`;
    star.style.top = `${(index * 31 + 9) % 100}%`;
    star.style.setProperty('--star-size', `${index % 11 === 0 ? 3 : 1 + (index % 3)}px`);
    star.style.setProperty('--star-delay', `${-(index % 17) * .43}s`);
    star.style.setProperty('--star-duration', `${1.8 + (index % 9) * .48}s`);
    if (index % 11 === 0) star.classList.add('birthday-star-bright');
    layer.append(star);
  }
}

function getBirthdayAudio() {
  if (!audioContext) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return null;
    audioContext = new AudioContextClass();
  }
  if (audioContext.state === 'suspended') audioContext.resume();
  return audioContext;
}

function playTone(frequency, duration = .35, volume = .045) {
  const context = getBirthdayAudio();
  if (!context || context.state === 'closed') return;
  const oscillator = context.createOscillator();
  const overtone = context.createOscillator();
  const gain = context.createGain();
  const overtoneGain = context.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.value = frequency;
  overtone.type = 'triangle';
  overtone.frequency.value = frequency * 2;
  gain.gain.setValueAtTime(.0001, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(volume, context.currentTime + .025);
  gain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + duration);
  overtoneGain.gain.setValueAtTime(.0001, context.currentTime);
  overtoneGain.gain.exponentialRampToValueAtTime(volume * .22, context.currentTime + .03);
  overtoneGain.gain.exponentialRampToValueAtTime(.0001, context.currentTime + duration * .78);
  oscillator.connect(gain).connect(context.destination);
  overtone.connect(overtoneGain).connect(context.destination);
  oscillator.start(); overtone.start();
  oscillator.stop(context.currentTime + duration + .035);
  overtone.stop(context.currentTime + duration + .035);
}

function startBirthdayMusic() {
  if (backgroundMusicTimer) return;
  if (!getBirthdayAudio()) { setBirthdayStatus('Thiết bị này chưa hỗ trợ phát nhạc bằng Web Audio.'); return; }
  const notes = [392, 392, 440, 392, 523.25, 493.88, 392, 392, 440, 392, 587.33, 523.25];
  let noteIndex = 0;
  playTone(notes[noteIndex++], .48, .052);
  backgroundMusicTimer = window.setInterval(() => playTone(notes[noteIndex++ % notes.length], .48, .052), 500);
  musicToggle.setAttribute('aria-pressed', 'true');
  musicToggle.textContent = '♫ Nhạc hộp nhạc: bật';
}

function toggleBirthdayMusic() {
  introMusicGestureHandled = true;
  if (backgroundMusicTimer) {
    window.clearInterval(backgroundMusicTimer);
    backgroundMusicTimer = 0;
    musicToggle.setAttribute('aria-pressed', 'false');
    musicToggle.textContent = '🎵 Chạm để bắt đầu với nhạc';
    return;
  }
  startBirthdayMusic();
}

birthdayIntro.addEventListener('click', event => {
  if (introMusicGestureHandled || birthdayCelebrated || event.target.closest('.birthday-card')) return;
  if (event.target.closest('#music-toggle')) return;
  introMusicGestureHandled = true;
  startBirthdayMusic();
});

function stopBirthdayTune() {
  birthdayTuneNodes.forEach(node => { try { node.stop(); } catch {} });
  birthdayTuneNodes = [];
}

function playHappyBirthdayTune() {
  stopBirthdayTune();
  const context = getBirthdayAudio();
  if (!context || context.state === 'closed') return;
  const beat = .34;
  const notes = [
    [392, 1], [392, 1], [440, 2], [392, 2], [523.25, 2], [493.88, 3],
    [392, 1], [392, 1], [440, 2], [392, 2], [587.33, 2], [523.25, 3],
    [392, 1], [392, 1], [783.99, 2], [659.25, 2], [523.25, 2], [493.88, 2], [440, 3],
    [698.46, 1], [698.46, 1], [659.25, 2], [523.25, 2], [587.33, 2], [523.25, 4]
  ];
  let at = context.currentTime + .08;
  notes.forEach(([frequency, beats]) => {
    const oscillator = context.createOscillator();
    const overtone = context.createOscillator();
    const gain = context.createGain();
    const duration = beat * beats * .92;
    oscillator.type = 'sine';
    overtone.type = 'triangle';
    oscillator.frequency.setValueAtTime(frequency, at);
    overtone.frequency.setValueAtTime(frequency * 2, at);
    gain.gain.setValueAtTime(.0001, at);
    gain.gain.exponentialRampToValueAtTime(.075, at + .045);
    gain.gain.exponentialRampToValueAtTime(.0001, at + duration);
    oscillator.connect(gain);
    overtone.connect(gain);
    gain.connect(context.destination);
    oscillator.start(at); overtone.start(at);
    oscillator.stop(at + duration + .03); overtone.stop(at + duration + .03);
    birthdayTuneNodes.push(oscillator, overtone);
    at += beat * beats;
  });
  window.setTimeout(() => { birthdayTuneNodes = []; }, Math.max(0, (at - context.currentTime + .25) * 1000));
}

function stopMicrophone() {
  if (micCheckTimer) window.clearInterval(micCheckTimer);
  micCheckTimer = 0;
  if (micSource) { try { micSource.disconnect(); } catch {} }
  micSource = null;
  analyser = null;
  micStream?.getTracks().forEach(track => track.stop());
  micStream = null;
  micToggle.textContent = '🎤 Bật micro để thổi nến';
  micToggle.setAttribute('aria-pressed', 'false');
  micToggle.disabled = false;
}

async function startMicrophone() {
  if (micStream) { stopMicrophone(); setBirthdayStatus('Micro đã tắt · anh có thể dùng nút bấm giữ để thổi.'); return; }
  if (!navigator.mediaDevices?.getUserMedia || !window.isSecureContext) {
    setBirthdayStatus('Micro chưa khả dụng ở đây · chạm nút “Thổi nến” để tiếp tục nhé.');
    return;
  }
  micToggle.disabled = true;
  micToggle.textContent = 'Đang xin quyền micro…';
  try {
    const context = getBirthdayAudio();
    if (!context) throw new Error('AudioContext không được hỗ trợ.');
    micStream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false } });
    analyser = context.createAnalyser();
    analyser.fftSize = 2048;
    analyser.smoothingTimeConstant = .12;
    micSource = context.createMediaStreamSource(micStream);
    micSource.connect(analyser);
    const wave = new Uint8Array(analyser.fftSize);
      let noiseFloor = .01;
    blowThresholdStart = 0;
    micToggle.disabled = false;
    micToggle.textContent = '🎤 Micro đang bật · chạm để tắt';
    micToggle.setAttribute('aria-pressed', 'true');
    setBirthdayStatus('Hãy đưa micro lại gần và thổi nhẹ vào nến 💨');
    micCheckTimer = window.setInterval(() => {
      if (!analyser || birthdayCelebrated || extinguishInProgress) return;
      analyser.getByteTimeDomainData(wave);
      let sum = 0;
      for (const sample of wave) { const value = (sample - 128) / 128; sum += value * value; }
      const rms = Math.sqrt(sum / wave.length);
      // Breath is broadband, so don't reject it based on a bass-only spectrum test.
      // Slowly adapt to room noise, while keeping a low enough floor for a phone mic.
      if (rms < .16) noiseFloor = noiseFloor * .96 + rms * .04;
      const blowing = rms > Math.max(.034, noiseFloor * 1.7);
      if (blowing) {
        if (!blowThresholdStart) blowThresholdStart = performance.now();
        if (performance.now() - blowThresholdStart > 120) beginCandleBlowOut('micro');
      } else blowThresholdStart = 0;
    }, 70);
  } catch (error) {
    stopMicrophone();
    setBirthdayStatus('Không bật được micro · chạm nút “Thổi nến” để tiếp tục nhé.');
  }
}

function beginCandleBlowOut(source = 'hold') {
  if (birthdayCelebrated || extinguishInProgress) return;
  const litCandles = [...candleHeartRing.querySelectorAll('.party-candle:not(.is-off)')];
  if (!litCandles.length) { paintCandleStatus(); return; }
  stopMicrophone();
  extinguishInProgress = true;
  birthdayIntro.classList.add('is-windy');
  setBirthdayStatus(source === 'micro' ? 'Gió thổi qua rồi… những ngọn nến đang tắt dần ✨' : 'Điều ước bay theo làn gió… ✨');
  litCandles.forEach((candle, index) => {
    const delay = 80 + Math.random() * 1650 + index * 8;
    window.setTimeout(() => {
      if (birthdayCelebrated) return;
      candle.classList.add('is-blowing-out');
      window.setTimeout(() => {
        if (birthdayCelebrated) return;
        candle.classList.remove('is-blowing-out');
        candle.classList.add('is-off', 'is-smoking');
        candle.setAttribute('aria-pressed', 'false');
        candle.setAttribute('aria-label', `Nến ${Number(candle.dataset.candleNumber) || index + 1}, đã tắt`);
        blownOutCount += 1;
        window.setTimeout(() => candle.classList.remove('is-smoking'), 1900);
        if (blownOutCount >= litCandles.length) {
          extinguishInProgress = false;
          birthdayIntro.classList.remove('is-windy');
          paintCandleStatus();
        }
      }, 520 + Math.random() * 180);
    }, delay);
  });
}

function launchBirthdayFireworks() {
  const canvas = confettiCanvas;
  const context = canvas.getContext('2d');
  if (!context) return;
  const ratio = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.round(window.innerWidth * ratio);
  canvas.height = Math.round(window.innerHeight * ratio);
  canvas.style.width = `${window.innerWidth}px`;
  canvas.style.height = `${window.innerHeight}px`;
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  const colors = ['#f7a9bc', '#f8d889', '#b8e6e3', '#d6b4eb', '#fff2ce', '#ffa77e'];
  const particles = Array.from({ length: 150 }, (_, index) => {
    const burst = Math.floor(index / 38);
    const angle = Math.random() * Math.PI * 2;
    const speed = 1.4 + Math.random() * 5.5;
    return { x: window.innerWidth * (.18 + burst * .21) + (Math.random() - .5) * 50, y: window.innerHeight * (.18 + Math.random() * .25), vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 1.2, size: 2 + Math.random() * 4, color: colors[index % colors.length], spin: Math.random() * 6, life: .8 + Math.random() * .2, shape: index % 3 };
  });
  const started = performance.now();
  canvas.classList.add('is-celebrating');
  function frame(now) {
    const elapsed = now - started;
    context.clearRect(0, 0, window.innerWidth, window.innerHeight);
    particles.forEach(particle => {
      particle.x += particle.vx;
      particle.y += particle.vy;
      particle.vy += .035;
      particle.vx *= .996;
      particle.spin += .08;
      particle.life -= .004;
      context.globalAlpha = Math.max(0, particle.life);
      context.fillStyle = particle.color;
      context.save();
      context.translate(particle.x, particle.y);
      context.rotate(particle.spin);
      if (particle.shape === 0) {
        context.beginPath(); context.arc(0, 0, particle.size, 0, Math.PI * 2); context.fill();
      } else {
        context.fillRect(-particle.size / 2, -particle.size * 1.8, particle.size, particle.size * 3.6);
      }
      context.restore();
    });
    context.globalAlpha = 1;
    if (elapsed < 3400) requestAnimationFrame(frame);
    else { context.clearRect(0, 0, canvas.width, canvas.height); canvas.classList.remove('is-celebrating'); }
  }
  requestAnimationFrame(frame);
}

function celebrateBirthday() {
  if (birthdayCelebrated) return;
  birthdayCelebrated = true;
  extinguishInProgress = false;
  birthdayIntro.classList.remove('is-windy');
  birthdayIntro.classList.add('is-celebrating');
  stopMicrophone();
  if (backgroundMusicTimer) { window.clearInterval(backgroundMusicTimer); backgroundMusicTimer = 0; musicToggle.setAttribute('aria-pressed', 'false'); musicToggle.textContent = '🎵 Chạm để bắt đầu với nhạc'; }
  setBirthdayStatus('Mọi điều ước đang bay lên cùng những vì sao ✨');
  document.querySelector('#continue-intro-cut').hidden = false;
  launchBirthdayFireworks();
  playHappyBirthdayTune();
  window.setTimeout(() => { if (!birthdayCard.open) birthdayCard.showModal(); }, 650);
}

function stopBirthdayAudio() {
  stopMicrophone();
  if (backgroundMusicTimer) window.clearInterval(backgroundMusicTimer);
  backgroundMusicTimer = 0;
  stopBirthdayTune();
  if (audioContext && audioContext.state !== 'closed') audioContext.close();
  audioContext = null;
  musicToggle.setAttribute('aria-pressed', 'false');
  musicToggle.textContent = '🎵 Chạm để bắt đầu với nhạc';
}

function continueToCakeCut() {
  birthdayCard.close();
  stopBirthdayAudio();
  transitionScene(birthdayIntro, opening, () => {
    birthdayIntro.hidden = true;
    opening.hidden = false;
    document.body.classList.remove('birthday-intro-active');
    prepareCake();
  });
}

function startHoldBlow() {
  if (holdBlowTimer || birthdayCelebrated || extinguishInProgress) return;
  getBirthdayAudio();
  setBirthdayStatus('Đang giữ để thổi… 💨');
  holdBlow.classList.add('is-holding');
  holdBlowTimer = window.setTimeout(() => {
    holdBlowTimer = 0;
    holdBlow.classList.remove('is-holding');
    beginCandleBlowOut('hold');
  }, 430);
}

function cancelHoldBlow() {
  if (holdBlowTimer) {
    window.clearTimeout(holdBlowTimer);
    holdBlowTimer = 0;
    holdBlow.classList.remove('is-holding');
    if (!birthdayCelebrated && !extinguishInProgress) setBirthdayStatus('Chạm hoặc bấm giữ nút “Thổi nến” để gửi một làn gió nhé.');
  }
}

micToggle.addEventListener('click', startMicrophone);
musicToggle.addEventListener('click', toggleBirthdayMusic);
document.querySelector('#relight-candles').addEventListener('click', relightCandles);
document.querySelector('#continue-to-cut').addEventListener('click', continueToCakeCut);
document.querySelector('#continue-intro-cut').addEventListener('click', continueToCakeCut);
document.querySelector('#birthday-card-close').addEventListener('click', () => birthdayCard.close());
document.querySelector('#hold-blow').addEventListener('pointerdown', event => { event.preventDefault(); startHoldBlow(); });
document.querySelector('#hold-blow').addEventListener('pointerup', cancelHoldBlow);
document.querySelector('#hold-blow').addEventListener('pointercancel', cancelHoldBlow);
document.querySelector('#hold-blow').addEventListener('pointerleave', cancelHoldBlow);
document.querySelector('#hold-blow').addEventListener('click', () => beginCandleBlowOut('tap'));
document.querySelector('#hold-blow').addEventListener('keydown', event => { if (event.key === ' ' || event.key === 'Enter') { event.preventDefault(); startHoldBlow(); } });
document.querySelector('#hold-blow').addEventListener('keyup', event => { if (event.key === ' ' || event.key === 'Enter') cancelHoldBlow(); });

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
window.addEventListener('scroll', () => {
  requestMemoryUpdate();
  if (story.classList.contains('hidden') || photoLightbox.open || reduceMotion) return;
  const distance = Math.abs(window.scrollY - lastCelebrationScroll);
  if (distance < 44) return;
  lastCelebrationScroll = window.scrollY;
  if (scrollCelebration.childElementCount > 12) return;
  const burstSize = Math.min(4, Math.max(2, Math.round(distance / 170) + 1));
  for (let i = 0; i < burstSize; i++) {
    const particle = document.createElement('span');
    particle.className = 'scroll-particle';
    particle.textContent = ['♡', '♥', '🎂', '✧'][Math.floor(Math.random() * 4)];
    particle.style.setProperty('--particle-x', `${8 + Math.random() * 84}vw`);
    particle.style.setProperty('--particle-y', `${68 + Math.random() * 19}vh`);
    particle.style.setProperty('--particle-drift', `${Math.round(Math.random() * 100 - 50)}px`);
    particle.style.setProperty('--particle-duration', `${2.3 + Math.random() * 1.4}s`);
    scrollCelebration.append(particle);
    particle.addEventListener('animationend', () => particle.remove(), { once: true });
  }
}, { passive: true });
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
  sceneTransition.classList.toggle('is-birthday-unfold', from === birthdayIntro);
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

makePartySprinkles();
makeBirthdayStars();
relightCandles();
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
