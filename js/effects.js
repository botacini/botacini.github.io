/* ════════════════════════════════════════════════════════════
   GP DA FAMÍLIA — effects.js
   ════════════════════════════════════════════════════════════
   Efeitos de interface: som, vibração, toast, popup de
   conquista desbloqueada e confete. Não conhece `state` nem
   regras de negócio — só recebe o que precisa mostrar/tocar e
   mexe no DOM. Sem arquivos de áudio, sem bibliotecas externas:
   tudo sintetizado via Web Audio API, para funcionar 100% no
   GitHub Pages.
   ════════════════════════════════════════════════════════════ */

/* ════════════════ SOM ════════════════ */
let audioCtx = null;
function getCtx() {
  if (!audioCtx) {
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    } catch (e) {
      return null;
    }
  }
  return audioCtx;
}

export function playSound(type) {
  try {
    const ctx = getCtx();
    if (!ctx) return;
    if (ctx.state === 'suspended') ctx.resume();

    const notes = type === 'done' ? [660, 880]
      : type === 'badge' ? [523, 659, 784, 1046]
      : type === 'fail' ? [220]
      : [440];

    const t0 = ctx.currentTime;
    notes.forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'square';
      osc.frequency.value = freq;
      const start = t0 + i * 0.09;
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.15, start + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.16);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(start);
      osc.stop(start + 0.18);
    });
  } catch (e) {
    /* Som é decorativo — nunca deve derrubar o app. */
  }
}

/* ════════════════ VIBRAÇÃO ════════════════ */
export function vibrate(pattern) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch (e) { /* ignora silenciosamente */ }
}

/* ════════════════ TOAST ════════════════ */
let toastTimer = null;
export function showToast(msg) {
  const toast = document.getElementById('toast');
  if (!toast) return;
  toast.textContent = msg;
  toast.style.display = 'block';
  toast.classList.remove('toast-show');
  void toast.offsetWidth; // força reflow para reiniciar a animação
  toast.classList.add('toast-show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => {
    toast.classList.remove('toast-show');
    toast.style.display = 'none';
  }, 2600);
}

/* ════════════════ POPUP DE CONQUISTA ════════════════ */
export function showBadgeUnlockPopup(badge) {
  const overlay = document.getElementById('badge-popup-overlay');
  if (!overlay) return;
  const icon = document.getElementById('badge-popup-icon');
  const name = document.getElementById('badge-popup-name');
  const desc = document.getElementById('badge-popup-desc');
  if (icon) icon.textContent = badge.icon;
  if (name) name.textContent = badge.name;
  if (desc) desc.textContent = badge.desc;

  overlay.style.display = 'flex';
  playSound('badge');
  vibrate([40, 40, 40, 40, 80]);
}

/* ════════════════ CONFETE ════════════════ */
let confettiInterval = null;
const CONFETTI_COLORS = ['#e8b800', '#5cb832', '#378add', '#cb3232', '#ffffff'];

export function startConfetti() {
  const container = document.getElementById('confetti-container');
  if (!container) return;
  stopConfetti();
  confettiInterval = setInterval(() => {
    const piece = document.createElement('div');
    piece.className = 'confetti-piece';
    piece.style.left = Math.random() * 100 + '%';
    piece.style.background = CONFETTI_COLORS[Math.floor(Math.random() * CONFETTI_COLORS.length)];
    piece.style.animationDuration = (2 + Math.random() * 1.5) + 's';
    piece.style.transform = `rotate(${Math.random() * 360}deg)`;
    container.appendChild(piece);
    setTimeout(() => piece.remove(), 3600);
  }, 80);
  setTimeout(stopConfetti, 4000);
}

export function stopConfetti() {
  if (confettiInterval) {
    clearInterval(confettiInterval);
    confettiInterval = null;
  }
}
