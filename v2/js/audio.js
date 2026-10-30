
/**
 * audio.js
 * 《再切一刀就好》音效系統
 *
 * 功能：
 * 1. 主音量、音樂音量、音效音量
 * 2. 靜音
 * 3. 舒緩環境背景音
 * 4. 開石、鑑定、切石、玉料發現音效
 * 5. 電鋸持續運轉音效
 *
 * 注意：
 * 目前使用 Web Audio API 合成聲音作為第一版。
 * 後續可替換成真實錄製的工具與石材音效。
 */

let audioContext = null;

let masterGain = null;
let musicGain = null;
let sfxGain = null;

let initialized = false;
let muted = false;
let ambientStarted = false;

let masterVolume = 0.75;
let musicVolume = 0.3;
let sfxVolume = 0.8;

let ambientNodes = [];
let sawNodes = [];

function clamp(value) {
  return Math.max(0, Math.min(1, Number(value) || 0));
}

/**
 * 初始化音效引擎
 * 必須由使用者操作觸發
 */
export async function initAudio() {
  if (!audioContext) {
    const AudioContextClass =
      window.AudioContext || window.webkitAudioContext;

    if (!AudioContextClass) {
      console.warn("[Audio] 瀏覽器不支援 Web Audio API");
      return false;
    }

    audioContext = new AudioContextClass();

    masterGain = audioContext.createGain();
    musicGain = audioContext.createGain();
    sfxGain = audioContext.createGain();

    musicGain.connect(masterGain);
    sfxGain.connect(masterGain);
    masterGain.connect(audioContext.destination);

    initialized = true;

    updateVolumes();

    console.log("[Audio] 音效系統初始化完成");
  }

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  return initialized;
}

/**
 * 更新音量
 */
function updateVolumes() {
  if (!initialized) return;

  masterGain.gain.setTargetAtTime(
    muted ? 0 : masterVolume,
    audioContext.currentTime,
    0.05
  );

  musicGain.gain.setTargetAtTime(
    musicVolume,
    audioContext.currentTime,
    0.05
  );

  sfxGain.gain.setTargetAtTime(
    sfxVolume,
    audioContext.currentTime,
    0.05
  );
}

/**
 * 設定音量
 *
 * type:
 * master / music / sfx
 *
 * value:
 * 0 ~ 1
 */
export function setVolume(type, value) {
  value = clamp(value);

  if (type === "master") {
    masterVolume = value;
  } else if (type === "music") {
    musicVolume = value;
  } else if (type === "sfx") {
    sfxVolume = value;
  } else {
    return;
  }

  updateVolumes();
}

/**
 * 取得目前音量
 */
export function getVolumes() {
  return {
    master: masterVolume,
    music: musicVolume,
    sfx: sfxVolume,
    muted
  };
}

/**
 * 靜音
 */
export function setMuted(value) {
  muted = Boolean(value);
  updateVolumes();
}

export function toggleMute() {
  setMuted(!muted);
  return muted;
}

/**
 * 建立簡單音調
 */
function playTone(
  frequency,
  duration,
  type = "sine",
  volume = 0.2,
  endFrequency = null
) {
  if (!initialized || muted) return;

  const now = audioContext.currentTime;

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();

  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, now);

  if (endFrequency) {
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(1, endFrequency),
      now + duration
    );
  }

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(
    volume,
    now + 0.02
  );

  gain.gain.exponentialRampToValueAtTime(
    0.001,
    now + duration
  );

  oscillator.connect(gain);
  gain.connect(sfxGain);

  oscillator.start(now);
  oscillator.stop(now + duration + 0.03);
}

/**
 * 建立短暫雜訊
 * 用於石頭碰撞、摩擦等聲音
 */
function playNoise(duration, volume = 0.15, filterFrequency = 1200) {
  if (!initialized || muted) return;

  const now = audioContext.currentTime;

  const bufferSize = Math.floor(
    audioContext.sampleRate * duration
  );

  const buffer = audioContext.createBuffer(
    1,
    bufferSize,
    audioContext.sampleRate
  );

  const data = buffer.getChannelData(0);

  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }

  const source = audioContext.createBufferSource();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();

  source.buffer = buffer;

  filter.type = "lowpass";
  filter.frequency.value = filterFrequency;

  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(
    0.001,
    now + duration
  );

  source.connect(filter);
  filter.connect(gain);
  gain.connect(sfxGain);

  source.start(now);
  source.stop(now + duration);
}

/**
 * 播放遊戲音效
 */
export function playSound(name) {
  if (!initialized || muted) return;

  switch (name) {

    case "button":
      playTone(520, 0.07, "sine", 0.08, 420);
      break;

    case "draw":
      playTone(330, 0.15, "triangle", 0.12, 660);
      break;

    case "stone":
      playNoise(0.18, 0.12, 900);
      playTone(180, 0.2, "sine", 0.12, 100);
      break;

    case "rare":
      playTone(520, 0.25, "sine", 0.12, 780);
      setTimeout(() => {
        playTone(780, 0.3, "sine", 0.12, 1040);
      }, 120);
      break;

    case "legendary":
      playTone(440, 0.45, "sine", 0.14, 880);
      setTimeout(() => {
        playTone(660, 0.55, "sine", 0.15, 1320);
      }, 180);
      setTimeout(() => {
        playTone(990, 0.7, "triangle", 0.12, 1480);
      }, 360);
      break;

    case "flashlight":
      playTone(850, 0.08, "sine", 0.06, 700);
      break;

    case "scan":
      playTone(400, 0.4, "sine", 0.08, 1100);
      break;

    case "stoneDrop":
      playNoise(0.25, 0.2, 650);
      playTone(120, 0.3, "triangle", 0.15, 65);
      break;

    case "jade":
      playTone(880, 0.35, "sine", 0.12, 1200);
      setTimeout(() => {
        playTone(1175, 0.4, "sine", 0.1, 1500);
      }, 130);
      break;

    case "cutComplete":
      playNoise(0.3, 0.12, 1800);
      playTone(250, 0.35, "triangle", 0.1, 520);
      break;

    case "polish":
      playNoise(0.4, 0.08, 3000);
      break;

    case "sell":
      playTone(600, 0.12, "triangle", 0.1, 900);
      break;

    case "error":
      playTone(180, 0.18, "square", 0.08, 100);
      break;

    default:
      console.warn(`[Audio] 未知音效：${name}`);
  }
}

/**
 * 舒緩背景環境音
 */
export async function startAmbient() {
  if (!initialized || ambientStarted) return;

  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }

  ambientStarted = true;

  const frequencies = [110, 164.81, 220];

  frequencies.forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;

    gain.gain.value = 0.001;

    oscillator.connect(gain);
    gain.connect(musicGain);

    oscillator.start();

    gain.gain.setTargetAtTime(
      0.025 / (index + 1),
      audioContext.currentTime,
      3
    );

    ambientNodes.push({
      oscillator,
      gain
    });
  });

  console.log("[Audio] 背景環境音已啟動");
}

/**
 * 停止背景音樂
 */
export function stopAmbient() {
  if (!ambientStarted || !initialized) return;

  const now = audioContext.currentTime;

  ambientNodes.forEach(node => {
    node.gain.gain.cancelScheduledValues(now);
    node.gain.gain.setTargetAtTime(0.001, now, 0.3);

    node.oscillator.stop(now + 1.5);
  });

  ambientNodes = [];
  ambientStarted = false;
}

/**
 * 電鋸啟動
 */
export function startSaw() {
  if (!initialized || muted || sawNodes.length > 0) return;

  const now = audioContext.currentTime;

  const oscillator = audioContext.createOscillator();
  const filter = audioContext.createBiquadFilter();
  const gain = audioContext.createGain();

  oscillator.type = "sawtooth";
  oscillator.frequency.value = 65;

  filter.type = "lowpass";
  filter.frequency.value = 500;

  gain.gain.setValueAtTime(0.001, now);
  gain.gain.linearRampToValueAtTime(0.045, now + 0.8);

  oscillator.connect(filter);
  filter.connect(gain);
  gain.connect(sfxGain);

  oscillator.start();

  sawNodes.push({
    oscillator,
    gain
  });
}

/**
 * 電鋸停止
 */
export function stopSaw() {
  if (!initialized || sawNodes.length === 0) return;

  const now = audioContext.currentTime;

  sawNodes.forEach(node => {
    node.gain.gain.cancelScheduledValues(now);

    node.gain.gain.setTargetAtTime(
      0.001,
      now,
      0.15
    );

    node.oscillator.stop(now + 1);
  });

  sawNodes = [];
}

/**
 * 清理音效資源
 */
export function disposeAudio() {
  stopSaw();
  stopAmbient();

  if (audioContext) {
    audioContext.close();
  }

  audioContext = null;
  masterGain = null;
  musicGain = null;
  sfxGain = null;

  initialized = false;
}
