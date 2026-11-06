// Rendert die Spieluhr „Stille Nacht“ (F. X. Gruber, 1818 – gemeinfrei) als nahtlose Schleife.
// Aufruf im Ordner wichteln/:  node tools/render_music.js && ffmpeg -y -i tools/stille-nacht.wav -codec:a libmp3lame -b:a 112k stille-nacht.mp3
'use strict';
const fs = require('fs');
const path = require('path');

const SR = 44100;
const EIGHTH = 0.36, RIT = 1.14;                 // ≈ 55 punktierte Viertel/Min., die letzten 2 Takte etwas langsamer
const toSec = x => x <= 60 ? x * EIGHTH : 60 * EIGHTH + (x - 60) * EIGHTH * RIT;

// Melodie in C-Dur als [MIDI, Achtel], 6/8-Takt, 12 Takte
const MEL = [
  [67, 1.5], [69, .5], [67, 1], [64, 3],   [67, 1.5], [69, .5], [67, 1], [64, 3],
  [74, 2], [74, 1], [71, 3],               [72, 2], [72, 1], [67, 3],
  [69, 2], [69, 1], [72, 1.5], [71, .5], [69, 1],   [67, 1.5], [69, .5], [67, 1], [64, 3],
  [69, 2], [69, 1], [72, 1.5], [71, .5], [69, 1],   [67, 1.5], [69, .5], [67, 1], [64, 3],
  [74, 2], [74, 1], [77, 1.5], [74, .5], [71, 1],   [72, 3], [76, 3],
  [72, 1], [67, 1], [64, 1], [67, 1.5], [65, .5], [62, 1],   [60, 6]
];
const HARM = 'C C C C G G C C F F C C F F C C G G C C C G C C'.split(' '); // Akkord je halber Takt
const CHORD = { C: [48, 55, 64], F: [53, 60, 69], G: [55, 62, 65] };

// kleiner, fester Zufall → jedes Rendern klingt gleich
let seed = 20261224;
const rand = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

const LEAD = 0.15;
const events = [];
let x = 0;
MEL.forEach(([m, d], i) => { events.push({ t: toSec(x), m: m + 12, v: .2, d: i === MEL.length - 1 ? 4.5 : 2.6 }); x += d; });
HARM.forEach((c, i) => CHORD[c].forEach((m, k) => events.push({ t: toSec(i * 3 + k), m, v: k ? .055 : .08, d: k ? 1.6 : 2.4 })));

const lastT = Math.max(...events.map(e => e.t));
const LOOP = LEAD + lastT + 4.8;                 // Schleifenlänge: letzter Ton klingt ganz aus
const TAIL = 3.0;                                // Hallfahne, wird an den Anfang zurückgefaltet
const N = Math.round((LOOP + TAIL) * SR);
const dry = new Float32Array(N);

// Spieluhr-Zunge: Grundton + leise Oktave + kurzer, unharmonischer Anschlag
for (const e of events) {
  const t0 = LEAD + e.t + rand() * 0.01;
  const vel = e.v * (0.9 + rand() * 0.2);
  const f = 440 * Math.pow(2, (e.m - 69) / 12);
  for (const [mul, v, d] of [[1, vel, e.d], [2, vel * .14, e.d * .45], [6.27, vel * .3, .16]]) {
    const fr = f * mul; if (fr > 15000) continue;
    const s0 = Math.round(t0 * SR), len = Math.round((d + 0.05) * SR), att = Math.round(0.003 * SR);
    const k = Math.log(1e-4 / v) / (d * SR);     // exponentielles Ausklingen wie in Web Audio
    const w = 2 * Math.PI * fr / SR;
    for (let i = 0; i < len && s0 + i < N; i++) {
      const env = i < att ? v * i / att : v * Math.exp(k * (i - att));
      dry[s0 + i] += env * Math.sin(w * i);
    }
  }
}

// Freeverb-Hall (Schroeder: 8 Kammfilter + 4 Allpässe je Kanal)
function freeverb(input, spread) {
  const combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map(n => n + spread);
  const apT = [556, 441, 341, 225].map(n => n + spread);
  const fb = 0.86;                               // Nachhall ca. 2–2,5 s
  const damp = 0.25;
  const combs = combT.map(n => ({ buf: new Float32Array(n), i: 0, store: 0 }));
  const aps = apT.map(n => ({ buf: new Float32Array(n), i: 0 }));
  const out = new Float32Array(input.length);
  for (let s = 0; s < input.length; s++) {
    const inp = input[s] * 0.015;
    let acc = 0;
    for (const c of combs) {
      const y = c.buf[c.i];
      c.store = y * (1 - damp) + c.store * damp;
      c.buf[c.i] = inp + c.store * fb;
      if (++c.i >= c.buf.length) c.i = 0;
      acc += y;
    }
    for (const a of aps) {
      const b = a.buf[a.i];
      a.buf[a.i] = acc + b * 0.5;
      acc = b - acc;
      if (++a.i >= a.buf.length) a.i = 0;
    }
    out[s] = acc;
  }
  return out;
}
const wetL = freeverb(dry, 0), wetR = freeverb(dry, 23);
const rms = a => Math.sqrt(a.reduce((s, v) => s + v * v, 0) / a.length);
const WET = Number(process.env.WET || 0.8);
console.log(`Hall-Anteil: ${(20 * Math.log10(rms(wetL) * WET / rms(dry))).toFixed(1)} dB gegenüber trocken`);

// Mischen, Hallfahne an den Anfang falten (nahtlose Schleife), normalisieren
const L0 = Math.round(LOOP * SR);
const L = new Float32Array(L0), R = new Float32Array(L0);
for (let i = 0; i < N; i++) {
  const j = i % L0;
  L[j] += dry[i] + wetL[i] * WET;
  R[j] += dry[i] + wetR[i] * WET;
}
let peak = 0;
for (let i = 0; i < L0; i++) peak = Math.max(peak, Math.abs(L[i]), Math.abs(R[i]));
const TARGET = 0.42;                             // Hintergrund-Lautstärke (iPhone ignoriert audio.volume → im File festgelegt)
const g = TARGET / peak;

// 16-bit-WAV schreiben
const data = Buffer.alloc(L0 * 4);
for (let i = 0; i < L0; i++) {
  data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(L[i] * g * 32767))), i * 4);
  data.writeInt16LE(Math.max(-32768, Math.min(32767, Math.round(R[i] * g * 32767))), i * 4 + 2);
}
const hdr = Buffer.alloc(44);
hdr.write('RIFF', 0); hdr.writeUInt32LE(36 + data.length, 4); hdr.write('WAVE', 8);
hdr.write('fmt ', 12); hdr.writeUInt32LE(16, 16); hdr.writeUInt16LE(1, 20); hdr.writeUInt16LE(2, 22);
hdr.writeUInt32LE(SR, 24); hdr.writeUInt32LE(SR * 4, 28); hdr.writeUInt16LE(4, 32); hdr.writeUInt16LE(16, 34);
hdr.write('data', 36); hdr.writeUInt32LE(data.length, 40);
const out = path.join(__dirname, 'stille-nacht.wav');
fs.writeFileSync(out, Buffer.concat([hdr, data]));
console.log(`Schleife ${LOOP.toFixed(2)} s, ${events.length} Töne, Rohspitze ${peak.toFixed(3)}, Verstärkung ${g.toFixed(2)} → ${out}`);
