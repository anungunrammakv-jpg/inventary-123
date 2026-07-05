// Единая точка расчёта "ожидаемого количества"
export const getExpectedQty = (item) => item.imeis?.length > 0 ? item.imeis.length : (parseFloat(item.expectedQty) || 0);

// Звук/вибро-фидбек при сканировании (работает офлайн на ТСД)
const playBeep = (frequency, duration, volume = 0.3) => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain); gain.connect(ctx.destination);
    osc.type = 'square';
    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(volume, ctx.currentTime);
    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch { /* звук не критичен — молча игнорируем, если AudioContext недоступен */ }
};

// Привычный сигнал ошибки (как у сканеров/касс) — два низких тона подряд, но громко
const playHarshErrorTone = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const notes = [
      { freq: 440, start: 0,    dur: 0.15 },
      { freq: 440, start: 0.18, dur: 0.15 },
    ];
    notes.forEach(({ freq, start, dur }) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = 'square';
      osc.frequency.value = freq;
      const startTime = ctx.currentTime + start;
      gain.gain.setValueAtTime(0.8, startTime);
      gain.gain.setValueAtTime(0.8, startTime + dur - 0.02);
      gain.gain.linearRampToValueAtTime(0, startTime + dur);
      osc.start(startTime);
      osc.stop(startTime + dur);
    });
  } catch { /* звук не критичен — молча игнорируем, если AudioContext недоступен */ }
};

// Успешное сканирование больше не озвучивается — оставлено как no-op, чтобы не трогать вызовы в остальном коде
export const playSuccessBeep = () => {};
export const playErrorBeep = () => { playHarshErrorTone(); if (navigator.vibrate) navigator.vibrate([200, 80, 200]); };

// Ключи localStorage — чтобы не потерять сессию при перезагрузке
export const STORAGE_KEYS = {
  inventoryData: 'tsd_inventoryData',
  scannedItems: 'tsd_scannedItems',
  scanHistory: 'tsd_scanHistory',
};

export const loadFromStorage = (key, fallback) => {
  try {
    const saved = localStorage.getItem(key);
    return saved ? JSON.parse(saved) : fallback;
  } catch { return fallback; }
};

export const saveToStorage = (key, value) => {
  try { localStorage.setItem(key, JSON.stringify(value));
  } catch { /* квота/приватный режим — не критично */ }
};
