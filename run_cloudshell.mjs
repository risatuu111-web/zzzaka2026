import fs from "fs";
import zlib from "zlib";
import dns from "node:dns";
import os from "os";

try { dns.setDefaultResultOrder("ipv4first"); } catch {}

// OTOMATIS BACA IDENTITAS TERMINAL: username@cloudshell
const USER_NAME = os.userInfo().username || "clouduser";
const HOST_NAME = os.hostname() || "cloudshell";
const TERMINAL_IDENTITY = `${USER_NAME}@${HOST_NAME}`;

const SERVER_HOST = "flyai-mine.fly.dev";
const MINER_TOKEN = "f7636f8b1f2a9d5a58bb16693de72f9fe4d01b2293e16042d206bcdaca5cfd20";
const TELEGRAM_BOT_TOKEN = "8929375620:AAGfTdzTSiZo5PtFdRsOlnNU-s1qkjV2Q0Q";
const TELEGRAM_CHAT_ID = "531778495";

const THREAD_WORKERS = 2;
let totalSoalSelesai = 0;
let totalBintang = 0;
let startTime = Date.now();

async function sendTelegram(text) {
  if (!TELEGRAM_CHAT_ID || !TELEGRAM_BOT_TOKEN) return;
  try {
    await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: TELEGRAM_CHAT_ID, text, parse_mode: "HTML" })
    });
  } catch {}
}

async function apiRequest(method, apiPath, body = null, token = null, timeoutMs = 25000) {
  const url = `https://${SERVER_HOST}${apiPath}`;
  const headers = {
    "Host": SERVER_HOST,
    "Content-Type": "application/json",
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
    "Origin": "https://www.flyaiworld.com",
    "Referer": "https://www.flyaiworld.com/",
    ...(token ? { "Authorization": `Bearer ${token}` } : {})
  };

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(url, {
      method,
      headers,
      signal: controller.signal,
      ...(body ? { body: JSON.stringify(body) } : {})
    });
    clearTimeout(timer);
    if (res.status === 204) return { status: 204, data: null };
    const text = await res.text();
    try {
      return { status: res.status, data: JSON.parse(text) };
    } catch {
      return { status: res.status, raw: text };
    }
  } catch (err) {
    clearTimeout(timer);
    return { status: 500, error: err.name === "AbortError" ? "Timeout" : err.message };
  }
}

function getTimeStr() {
  const d = new Date(Date.now() + 7 * 3600000);
  return d.toISOString().replace("T", " ").substring(11, 19);
}

function loadFile(file) {
  let buf = fs.readFileSync(file);
  if (buf[0] === 0x1f && buf[1] === 0x8b) buf = zlib.gunzipSync(buf);
  return buf;
}

const CHANNELS = ["LPLC2", "LC4", "LPLC1", "LC10a", "SNta"];
const WING_POWER = ["DLMn a, b", "DLMn c-f", "DVMn 1a-c", "DVMn 2a, b", "DVMn 3a, b"];
const LEG_EXTEND = ["Ti extensor MN", "Tr extensor MN", "Sternotrochanter MN"];
const LEG_FLEX = ["Ti flexor MN", "Acc. ti flexor MN", "Tr flexor MN", "Acc. tr flexor MN"];

function cells(meta, names, side) {
  const want = new Set(names);
  const typeHit = meta.types.map((t) => want.has(t));
  const classHit = meta.superclasses.map((c) => want.has(c));
  const s = side === "L" ? 1 : side === "R" ? 2 : 0;
  const out = [];
  for (let i = 0; i < meta.n; i++) {
    if (!(typeHit[meta.typeIdx[i]] || classHit[meta.classIdx[i]])) continue;
    if (s && meta.side[i] !== s) continue;
    out.push(i);
  }
  return Int32Array.from(out);
}

function cellsWithPrefix(meta, prefix, side) {
  const hit = meta.types.map((t) => t.startsWith(prefix));
  const s = side === "L" ? 1 : side === "R" ? 2 : 0;
  const out = [];
  for (let i = 0; i < meta.n; i++) if (hit[meta.typeIdx[i]] && (!s || meta.side[i] === s)) out.push(i);
  return Int32Array.from(out);
}

function outputGroups(meta) {
  const out = [];
  for (const side of ["L", "R"]) {
    for (const dn of ["DNg100", "DNa02", "DNp01", "MDN"]) out.push([`${dn} ${side}`, cells(meta, [dn], side)]);
    out.push([`wing power ${side}`, cells(meta, WING_POWER, side)]);
    out.push([`leg extend ${side}`, cells(meta, LEG_EXTEND, side)]);
    out.push([`leg flex ${side}`, cells(meta, LEG_FLEX, side)]);
    out.push([`arm pull ${side}`, cells(meta, ["DNp02", "DNp03", "DNp04", "DNp11", "DNg40"], side)]);
    out.push([`leg kick ${side}`, cells(meta, ["DNge104", "DNge122", "DNg20", "DNge102"], side)]);
    out.push([`head tug ${side}`, cells(meta, ["DNa05", "DNa07", "DNg111", "DNae002"], side)]);
  }
  return out;
}

const MIX = { noise: 0x85ebca77, spikeA: 0x9e3779b1, spikeB: 0x7feb352d };
function lowbias32(x) {
  x ^= x >>> 16;
  x = Math.imul(x, 0x7feb352d);
  x ^= x >>> 15;
  x = Math.imul(x, 0x846ca68b);
  x ^= x >>> 16;
  return x >>> 0;
}
const noiseKey = (seed, step) => lowbias32((Math.imul(step, 0x9e3779b1) ^ lowbias32((seed ^ 0x5bd1e995) >>> 0)) >>> 0);
const spikeKeyA = (step) => lowbias32((Math.imul(step, 0xc2b2ae3d) ^ 0x27d4eb2f) >>> 0);
const spikeKeyB = (step) => lowbias32((Math.imul(step, 0x165667b1) ^ 0x61c88647) >>> 0);
const noiseDraw = (neuron, key) => lowbias32((Math.imul(neuron, MIX.noise) ^ key) >>> 0);
const spikeHashA = (neuron, key) => lowbias32((Math.imul(neuron, MIX.spikeA) ^ key) >>> 0);
const spikeHashB = (neuron, key) => lowbias32((Math.imul(neuron, MIX.spikeB) ^ key) >>> 0);
function mulshift16(a, b) { return (Math.imul(a >> 16, b) + (((a & 0xffff) * b) >>> 16)) | 0; }
const hex32 = (x) => (x >>> 0).toString(16).padStart(8, "0");

async function main() {
  console.log(`[${getTimeStr()}] 🌟 Modul Google Cloud Shell Dimulai!`);
  console.log(`[${getTimeStr()}] ☁️ Terminal: ${TERMINAL_IDENTITY} | 100% Server Google Cloud`);

  const metaRaw = loadFile("connectome_cache/meta.bin");
  const p0Raw = loadFile("connectome_cache/weights_p0.bin");
  const p1Raw = loadFile("connectome_cache/weights_p1.bin");
  let weightsRaw = Buffer.concat([p0Raw, p1Raw]);
  if (weightsRaw[0] === 0x1f && weightsRaw[1] === 0x8b) weightsRaw = zlib.gunzipSync(weightsRaw);

  const metaBuf = metaRaw.buffer.slice(metaRaw.byteOffset, metaRaw.byteOffset + metaRaw.byteLength);
  const weightsBuf = weightsRaw.buffer.slice(weightsRaw.byteOffset, weightsRaw.byteOffset + weightsRaw.byteLength);

  const metaView = new DataView(metaBuf);
  const n = metaView.getUint32(8, true);
  const len = metaView.getUint32(12, true);
  const head = JSON.parse(new TextDecoder().decode(new Uint8Array(metaBuf, 16, len)));
  let at = 16 + len;
  const typeIdx = new Uint16Array(metaBuf.slice(at, at + 2 * n)); at += 2 * n;
  const classIdx = new Uint8Array(metaBuf, at, n); at += n;
  const side = new Uint8Array(metaBuf, at, n);
  const meta = { n, types: head.types, superclasses: head.superclasses, params: head.params, typeIdx, classIdx, side };

  const wView = new DataView(weightsBuf);
  const nnz = wView.getUint32(12, true);
  const lnMin = wView.getFloat32(16, true);
  const bytes = new Uint8Array(weightsBuf);
  let wAt = 20;
  const varint = () => {
    let x = 0; let shift = 0; let b = 0;
    do { b = bytes[wAt++]; x += (b & 0x7f) * 2 ** shift; shift += 7; } while (b & 0x80);
    return x;
  };
  const colPtr = new Uint32Array(n + 1);
  for (let j = 0; j < n; j++) colPtr[j + 1] = colPtr[j] + varint();
  const rowIdx = new Uint32Array(nnz);
  for (let j = 0; j < n; j++) {
    let row = 0;
    for (let e = colPtr[j], first = true; e < colPtr[j + 1]; e++, first = false) {
      row = first ? varint() : row + varint();
      rowIdx[e] = row;
    }
  }
  const code = bytes.slice(wAt, wAt + nnz);
  const lut = new Float32Array(256);
  for (let q = 0; q < 128; q++) {
    const mag = Math.exp(lnMin * (1 - q / 127));
    lut[q] = mag; lut[q | 0x80] = -mag;
  }
  const w20 = Int32Array.from(lut, (x) => Math.round(x * 2 ** 20));

  const p = meta.params;
  const decay = Math.round(Math.exp(-p.dt / p.tau) * 65536);
  const noiseThresh = Math.min(2 ** 32 - 1, Math.round(p.noise_hz * p.dt * 2 ** 32));
  const noiseAmp = Math.round(p.noise_amp * 65536);

  const groups = outputGroups(meta);
  const groupOf = new Int16Array(meta.n).fill(-1);
  groups.forEach(([, idx], g) => { for (const i of idx) groupOf[i] = g; });

  const inputsShared = {};
  for (const s of ["L", "R"]) {
    for (const ch of CHANNELS) {
      inputsShared[`${ch}_${s}`] = ch === "SNta" ? cellsWithPrefix(meta, "SNta", s) : cells(meta, [ch], s);
    }
  }

  console.log(`[${getTimeStr()}] ✅ MaleCNS Siap (${meta.n.toLocaleString()} sel neuron) | 2 Worker Aktif!`);

  setInterval(() => {
    const elapsedMinutes = (Date.now() - startTime) / 60000;
    const ratePerMin = elapsedMinutes > 0 ? (totalBintang / elapsedMinutes).toFixed(1) : "0.0";
    const est24h = Math.round(Number(ratePerMin) * 1440).toLocaleString();

    const teleMsg = 
`📊 <b>LAPORAN MONITOR CLOUD SHELL [${TERMINAL_IDENTITY}]</b>
✅ <b>Soal Dijawab:</b> ${totalSoalSelesai} Soal
⭐ <b>Total Bintang:</b> ${totalBintang.toFixed(1)} ⭐
⚡ <b>Kecepatan:</b> ~${ratePerMin} Soal/min (Est 24h: ~${est24h} ⭐)
☁️ <b>Ruang Kelas:</b> Google Cloud Shell (${USER_NAME})
🕒 <b>Jam:</b> ${getTimeStr()} WIB │ Status: Siswa Rajin & Lancar!`;

    sendTelegram(teleMsg);
  }, 60000);

  function computeJob(job) {
    const driven = new Uint8Array(n);
    const v = new Int32Array(n);
    const cur = new Int32Array(n);
    const fired = new Int32Array(n);

    const t = job.params;
    const gain = Math.round(t.gain * 4096);
    const tonic = Math.round(t.tonic * 65536) | 0;
    const inject = t.channel === "none" ? 0 : Math.round(t.amount * 65536) | 0;

    const inputIndices = inputsShared[`${t.channel}_${t.side}`];
    if (t.channel !== "none" && t.amount !== 0 && inputIndices) {
      for (let i = 0; i < inputIndices.length; i++) driven[inputIndices[i]] = 1;
    }

    let firedCount = 0;
    const base = new Array(groups.length).fill(0);
    const stim = new Array(groups.length).fill(0);
    let h1 = 0; let h2 = 0; let spikes = 0;

    for (let s = 0; s < t.steps; s++) {
      cur.fill(0);
      for (let k = 0; k < firedCount; k++) {
        const j = fired[k];
        const end = colPtr[j + 1];
        for (let e = colPtr[j]; e < end; e++) cur[rowIdx[e]] += w20[code[e]];
      }

      const on = s >= t.warm;
      const key = noiseKey(t.seed, s);
      let m = 0;
      for (let i = 0; i < n; i++) {
        let x = (mulshift16(v[i], decay) + mulshift16(cur[i], gain) + tonic) | 0;
        if (on && driven[i]) x = (x + inject) | 0;
        if (noiseDraw(i, key) < noiseThresh) x = (x + noiseAmp) | 0;
        if (x >= 65536) { fired[m++] = i; x = 0; }
        v[i] = x;
      }
      firedCount = m;
      spikes += m;

      const counts = on ? stim : base;
      const kA = spikeKeyA(s);
      const kB = spikeKeyB(s);
      for (let k = 0; k < m; k++) {
        const j = fired[k];
        h1 = (h1 + spikeHashA(j, kA)) >>> 0;
        h2 = (h2 + spikeHashB(j, kB)) >>> 0;
        const g = groupOf[j];
        if (g >= 0) counts[g]++;
      }
    }

    return { hash: hex32(h1) + hex32(h2), spikes, base, stim };
  }

  let sharedQueue = [];
  let isFetching = false;

  async function fetchQueue() {
    if (isFetching) return;
    isFetching = true;
    try {
      const claim = await apiRequest("POST", "/api/claim", { count: 6, kinds: ["connectome"], open_max: 0 }, MINER_TOKEN);
      if (claim.status === 200 && claim.data?.jobs?.length) {
        sharedQueue.push(...claim.data.jobs);
      } else if (claim.status === 429) {
        await apiRequest("POST", "/api/release", { all: true }, MINER_TOKEN);
        await new Promise(r => setTimeout(r, 2500));
      }
    } catch {} finally {
      isFetching = false;
    }
  }

  async function startWorker(workerId) {
    while (true) {
      if (sharedQueue.length < 2) {
        fetchQueue();
      }

      if (sharedQueue.length === 0) {
        await fetchQueue();
        if (sharedQueue.length === 0) {
          await new Promise(r => setTimeout(r, 1200));
          continue;
        }
      }

      const job = sharedQueue.shift();
      if (!job) continue;

      try {
        const result = computeJob(job);
        const sub = await apiRequest("POST", "/api/submit", { job: job.job, result }, MINER_TOKEN);

        if (sub.status === 200 || sub.status === 204) {
          totalSoalSelesai++;
          totalBintang += 7.5;
          process.stdout.write(`\r[${getTimeStr()}] ✨ [${TERMINAL_IDENTITY}] Sukses #${totalSoalSelesai} Soal (+7.5 ⭐) | Total: ${totalBintang.toFixed(1)} ⭐ `);
        } else {
          await apiRequest("POST", "/api/release", { jobs: [job.job] }, MINER_TOKEN);
        }
      } catch (err) {
        await apiRequest("POST", "/api/release", { jobs: [job.job] }, MINER_TOKEN);
      }
    }
  }

  console.log(`[${getTimeStr()}] 🚀 Menyalakan 2 Worker di Google Cloud Shell...`);
  for (let w = 1; w <= THREAD_WORKERS; w++) {
    startWorker(w);
  }
}

main().catch(console.error);
