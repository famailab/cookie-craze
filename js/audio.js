/* COOKIE CRAZE - WebAudio synth SFX + original chiptune BGM. No samples. */
(function (global) {
  'use strict';

  function AudioEngine() {
    this.ctx = null;
    this.master = null;
    this.bgmGain = null;
    this.muted = false;
    this.bgmTimer = null;
    this.noiseBuf = null;
  }

  AudioEngine.prototype.ensure = function () {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return true;
    }
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 1;
    this.master.connect(this.ctx.destination);
    this.bgmGain = this.ctx.createGain();
    this.bgmGain.gain.value = 0.5;
    this.bgmGain.connect(this.master);
    // noise buffer
    var len = this.ctx.sampleRate * 0.5;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    var d = this.noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return true;
  };

  AudioEngine.prototype.setMuted = function (m) {
    this.muted = m;
    if (this.master) this.master.gain.value = m ? 0 : 1;
  };

  AudioEngine.prototype.tone = function (freq, dur, type, vol, when, slideTo) {
    if (!this.ensure()) return;
    var t = this.ctx.currentTime + (when || 0);
    var o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type || 'square';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol || 0.2, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.master);
    o.start(t); o.stop(t + dur + 0.05);
  };

  AudioEngine.prototype.noise = function (dur, vol, when, filterFreq, type) {
    if (!this.ensure()) return;
    var t = this.ctx.currentTime + (when || 0);
    var s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf; s.loop = true;
    var f = this.ctx.createBiquadFilter();
    f.type = type || 'bandpass'; f.frequency.value = filterFreq || 2000; f.Q.value = 0.8;
    var g = this.ctx.createGain();
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    s.connect(f); f.connect(g); g.connect(this.master);
    s.start(t); s.stop(t + dur + 0.05);
  };

  // ---- SFX ----
  AudioEngine.prototype.click = function () { this.tone(660, 0.07, 'square', 0.12); };
  AudioEngine.prototype.shuffle = function () {
    this.noise(0.09, 0.10, 0, 1400, 'highpass');
    this.tone(220, 0.06, 'triangle', 0.08, 0, 330);
  };
  AudioEngine.prototype.pop = function (combo) {
    var base = 420 + Math.min(combo, 8) * 60;
    this.tone(base, 0.12, 'sine', 0.28, 0, base * 0.4);
    this.noise(0.10, 0.16, 0, 2600); // crunch
    if (combo >= 2) this.tone(base * 1.5, 0.10, 'square', 0.10, 0.05);
    if (combo >= 4) this.tone(base * 2, 0.12, 'square', 0.10, 0.10);
  };
  AudioEngine.prototype.invade = function () {
    this.noise(0.22, 0.12, 0, 500, 'lowpass');
    this.tone(140, 0.18, 'triangle', 0.16, 0, 90);
  };
  AudioEngine.prototype.warn = function () {
    this.tone(880, 0.07, 'square', 0.10);
    this.tone(880, 0.07, 'square', 0.10, 0.12);
  };
  AudioEngine.prototype.levelup = function () {
    var n = [523, 659, 784, 1047];
    for (var i = 0; i < n.length; i++) this.tone(n[i], 0.14, 'square', 0.14, i * 0.09);
  };
  AudioEngine.prototype.gameover = function () {
    var n = [392, 370, 349, 311, 262];
    for (var i = 0; i < n.length; i++) this.tone(n[i], 0.22, 'triangle', 0.2, i * 0.16);
  };
  AudioEngine.prototype.pauseSfx = function () { this.tone(330, 0.09, 'square', 0.12, 0, 220); };
  AudioEngine.prototype.boot = function () {
    this.tone(523, 0.12, 'square', 0.16);
    this.tone(1047, 0.3, 'square', 0.16, 0.12);
  };

  // ---- BGM: original cheerful chiptune loop ----
  var LEAD = [ // midi, 0 = rest; 32 sixteenth steps
    76, 0, 79, 0, 84, 0, 79, 0,
    83, 0, 81, 0, 79, 0, 76, 0,
    81, 0, 84, 0, 88, 0, 84, 0,
    81, 0, 79, 0, 77, 0, 76, 0
  ];
  var BASS = [ // roots per 8 steps: C G Am F
    36, 0, 36, 0, 36, 0, 43, 0,
    43, 0, 43, 0, 43, 0, 38, 0,
    33, 0, 33, 0, 33, 0, 40, 0,
    41, 0, 41, 0, 41, 0, 36, 0
  ];
  function midi(m) { return 440 * Math.pow(2, (m - 69) / 12); }

  AudioEngine.prototype.startBgm = function () {
    if (!this.ensure() || this.bgmTimer) return;
    var self = this, step = 0, spb = 60 / 138 / 4; // 16th at 138bpm
    var nextT = this.ctx.currentTime + 0.06;
    this.bgmTimer = setInterval(function () {
      while (nextT < self.ctx.currentTime + 0.15) {
        (function (s, t) {
          var dt = t - self.ctx.currentTime;
          var L = LEAD[s], B = BASS[s];
          if (L) self.bgmNote(midi(L), dt, 'square', 0.055, spb * 0.95);
          if (B) self.bgmNote(midi(B), dt, 'triangle', 0.085, spb * 1.8);
          if (s % 2 === 0) self.bgmHat(dt);
        })(step, nextT);
        nextT += spb;
        step = (step + 1) % 32;
      }
    }, 30);
  };

  AudioEngine.prototype.bgmNote = function (freq, when, type, vol, dur) {
    var t = this.ctx.currentTime + Math.max(0, when);
    var o = this.ctx.createOscillator(), g = this.ctx.createGain();
    o.type = type; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g); g.connect(this.bgmGain);
    o.start(t); o.stop(t + dur + 0.05);
  };

  AudioEngine.prototype.bgmHat = function (when) {
    var t = this.ctx.currentTime + Math.max(0, when);
    var s = this.ctx.createBufferSource();
    s.buffer = this.noiseBuf; s.loop = true;
    var f = this.ctx.createBiquadFilter();
    f.type = 'highpass'; f.frequency.value = 7000;
    var g = this.ctx.createGain();
    g.gain.setValueAtTime(0.028, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
    s.connect(f); f.connect(g); g.connect(this.bgmGain);
    s.start(t); s.stop(t + 0.08);
  };

  AudioEngine.prototype.stopBgm = function () {
    if (this.bgmTimer) { clearInterval(this.bgmTimer); this.bgmTimer = null; }
  };

  global.AudioEngine = AudioEngine;
})(typeof window !== 'undefined' ? window : global);
