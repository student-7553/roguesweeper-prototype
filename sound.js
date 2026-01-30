// --- Audio System ---
const AudioContext = window.AudioContext || window.webkitAudioContext;
window.audioCtx = new AudioContext();

window.SoundManager = {
    playTone: (freq, type, duration, vol = 0.1) => {
        if (window.audioCtx.state === 'suspended') window.audioCtx.resume();
        const osc = window.audioCtx.createOscillator();
        const gain = window.audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, window.audioCtx.currentTime);
        gain.gain.setValueAtTime(vol, window.audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.01, window.audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(window.audioCtx.destination);
        osc.start();
        osc.stop(window.audioCtx.currentTime + duration);
    },
    playMove: () => SoundManager.playTone(300, 'sine', 0.1, 0.05),
    playReveal: () => SoundManager.playTone(800, 'triangle', 0.1, 0.05),
    playCoin: () => {
        SoundManager.playTone(1200, 'sine', 0.1, 0.1);
        setTimeout(() => SoundManager.playTone(1800, 'square', 0.2, 0.1), 50);
    },
    playAttack: () => {
        const duration = 0.1;
        const bufferSize = window.audioCtx.sampleRate * duration;
        const buffer = window.audioCtx.createBuffer(1, bufferSize, window.audioCtx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        const noise = window.audioCtx.createBufferSource();
        noise.buffer = buffer;
        const gain = window.audioCtx.createGain();
        gain.gain.value = 0.1;
        gain.gain.exponentialRampToValueAtTime(0.01, window.audioCtx.currentTime + duration);
        noise.connect(gain);
        gain.connect(window.audioCtx.destination);
        noise.start();
    },
    playDamage: () => SoundManager.playTone(100, 'sawtooth', 0.3, 0.2),
    playWin: () => {
        [400, 500, 600, 800].forEach((f, i) => setTimeout(() => SoundManager.playTone(f, 'square', 0.2, 0.1), i * 100));
    },
    playLose: () => {
        [300, 200, 100].forEach((f, i) => setTimeout(() => SoundManager.playTone(f, 'sawtooth', 0.4, 0.2), i * 200));
    }
};
