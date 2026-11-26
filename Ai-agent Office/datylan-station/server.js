/**
 * DATYLAN STATION — AI Office Game Server
 * Express + WebSocket backend for managing AI character tasks via Claude CLI.
 */

const express = require('express');
const http = require('http');
const { WebSocketServer } = require('ws');
const crypto = require('crypto');
const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');

// ─── Configuration ──────────────────────────────────────────────────────────────

const PORT = 3947;
const HOST = '127.0.0.1';
const CLAUDE_PATH = 'C:\\Users\\Chana\\.local\\bin\\claude.exe';
const DATA_DIR = path.join(__dirname, 'data');
const OUTPUT_DIR = path.join(__dirname, 'output');
const HISTORY_FILE = path.join(DATA_DIR, 'history.json');
const TASK_TIMEOUT_MS = 120_000;

// ─── Character Definitions ─────────────────────────────────────────────────────

const CHARACTERS = {
  poysai: {
    name: 'Poysai', role: 'Content Creator Lead', team: 'content',
    systemPrompt: 'คุณคือ Poysai หัวหน้าฝ่าย Content Creator คุณเก่งเรื่องวางแผนคอนเทนต์ จัดตารางลงคลิป คิดไอเดียเรื่องที่จะทำ คุยได้ทุกเรื่อง ตอบเป็นภาษาไทยเป็นหลัก พูดสั้นกระชับ มีพลัง'
  },
  james: {
    name: 'James', role: 'Script Writer', team: 'content',
    systemPrompt: 'คุณคือ James นักเขียนสคริปต์ เขียนสคริปต์วิดีโอ แคปชัน บทพูด ให้น่าสนใจ กระชับ ดึงดูดคนดู ตอบเป็นภาษาไทยเป็นหลัก'
  },
  pangpon: {
    name: 'Pangpon', role: 'Analyst', team: 'content',
    systemPrompt: 'คุณคือ Pangpon นักวิเคราะห์คอนเทนต์ วิเคราะห์แนวโน้ม ความเป็นไปได้ที่จะมียอดวิวสูง เทรนด์ที่กำลังมา ให้ข้อมูลเชิงกลยุทธ์ ตอบเป็นภาษาไทย'
  },
  cobe: {
    name: 'Cobe', role: 'Creative', team: 'content',
    systemPrompt: 'คุณคือ Cobe ฝ่าย Creative หาคอนเทนต์ที่น่าสนใจ คิดมุมใหม่ ไอเดียแปลกๆ สร้างสรรค์ เสนอแนวทางคอนเทนต์ที่โดดเด่น ตอบเป็นภาษาไทย'
  },
  tylan: {
    name: 'Tylan', role: 'Game Dev Lead', team: 'game',
    systemPrompt: 'คุณคือ Tylan หัวหน้าฝ่ายทำเกม เก่งเขียนโค้ด สร้างเกม วางแผนระบบเกม ออกแบบ game mechanics ตอบเป็นภาษาไทยผสมอังกฤษ (คำศัพท์เทคนิค)'
  },
  dummy: {
    name: 'Dummy', role: 'Sound Designer', team: 'game',
    systemPrompt: 'คุณคือ Dummy นักออกแบบเสียง ทำ BGM, SFX, sound effects สำหรับเกมและวิดีโอ แนะนำแนวเพลง เครื่องมือ เทคนิค ตอบเป็นภาษาไทย'
  },
};

// ─── Demo Responses ─────────────────────────────────────────────────────────────

const DEMO_RESPONSES = {
  poysai: '📋 ตาราง Content สัปดาห์นี้:\n\nจันทร์: คลิปรีวิว AI Tools ใหม่\nอังคาร: Behind the scenes ทำงาน\nพุธ: Tutorial สั้น 60 วินาที\nพฤหัสฯ: Q&A ตอบคำถามแฟนๆ\nศุกร์: คลิปสรุปประจำสัปดาห์\n\n💡 แนะนำ: คลิปรีวิว AI น่าจะปังสุดช่วงนี้!',
  james: '🎬 สคริปต์ตัวอย่าง: "AI ในชีวิตประจำวัน"\n\n[เปิดเรื่อง - 5 วิ]\nHook: "คุณรู้ไหมว่า AI ช่วยชีวิตคุณได้ทุกวัน?"\n\n[เนื้อหา - 45 วิ]\n1. AI ช่วยตั้งปลุก จัดตาราง\n2. AI ช่วยแปลภาษาแบบ real-time\n3. AI ช่วยเขียนอีเมลให้เป็นทางการ\n\n[ปิดเรื่อง - 10 วิ]\nCTA: "ลองใช้ดูนะ แล้วบอกเราว่าชอบอันไหนสุด!"',
  pangpon: '📊 วิเคราะห์เทรนด์:\n\n🔥 หัวข้อที่มีโอกาสปัง:\n1. AI Tools รีวิว - ความสนใจ +340% (30 วัน)\n2. วิธีหาเงินออนไลน์ - คงที่สูง\n3. เปรียบเทียบมือถือ - ตามฤดูกาล\n\n⚠️ ควรหลีกเลี่ยง:\n- ข่าวเก่า / ซ้ำคนอื่น\n\n✅ แนะนำ: ทำคลิป AI Tools + วิธีใช้จริง จะได้ทั้งยอดวิวและ engagement',
  cobe: '💡 ไอเดียคอนเทนต์ใหม่:\n\n🌟 คอนเซ็ปต์: "AI Battle"\nให้ AI 3 ตัวแข่งกันทำงานเดียวกัน แล้วให้คนดูโหวต\n\n🎯 ทำไมน่าสนใจ:\n- Interactive กับคนดู\n- เปรียบเทียบ AI ได้ชัด\n- ทำเป็น series ได้\n\n📱 Format: Short-form 60 วิ + Full version 10 นาที',
  tylan: '🎮 Game Design Concept:\n\n## Puzzle Quest Mini\n- Genre: Puzzle + RPG\n- Platform: Web (HTML5 Canvas)\n- Core mechanic: Match-3 + character abilities\n\n```\nTech Stack:\n- Engine: Vanilla JS + Canvas\n- Assets: Pixel art 16x16\n- Audio: Web Audio API\n```\n\n📋 Sprint 1: Basic grid + matching\n📋 Sprint 2: Characters + abilities\n📋 Sprint 3: Levels + progression',
  dummy: '🎵 Sound Design Plan:\n\n🎹 BGM Concept: "8-bit Adventure"\n- Tempo: 120 BPM\n- Key: C Major (สดใส)\n- Style: Chiptune + Lo-fi\n\n🔊 SFX List:\n1. UI Click - สั้น กรอบ\n2. Success - melody ขึ้น 3 notes\n3. Error - buzz สั้น\n4. Typing - mechanical keyboard soft\n\n🛠 Tools: Bosca Ceoil (free), sfxr, Audacity',
};

// ─── State ───────────────────────────────────────────────────────────────────────

const tasks = new Map();          // taskId → task object
const characterQueues = new Map(); // characterId → [taskId, ...]
const runningProcesses = new Map(); // taskId → ChildProcess
const sessions = new Map();        // sessionId → { csrfToken, createdAt }
let history = [];

// ─── Ensure Directories ─────────────────────────────────────────────────────────

function ensureDirs() {
  for (const dir of [DATA_DIR, OUTPUT_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
}

// ─── History Persistence ─────────────────────────────────────────────────────────

function loadHistory() {
  try {
    if (fs.existsSync(HISTORY_FILE)) {
      const raw = fs.readFileSync(HISTORY_FILE, 'utf-8');
      history = JSON.parse(raw);
    }
  } catch (err) {
    console.error('[History] Failed to load:', err.message);
    history = [];
  }
}

function saveHistory() {
  try {
    fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2), 'utf-8');
  } catch (err) {
    console.error('[History] Failed to save:', err.message);
  }
}

function addToHistory(task) {
  history.push({
    taskId: task.id,
    characterId: task.characterId,
    prompt: task.prompt,
    mode: task.mode,
    status: task.status,
    result: task.result || null,
    error: task.error || null,
    createdAt: task.createdAt,
    completedAt: task.completedAt || new Date().toISOString(),
    duration: task.duration || null,
  });
  saveHistory();
}

// ─── WebSocket Broadcast ─────────────────────────────────────────────────────────

let wss;

function broadcast(msg) {
  const data = JSON.stringify(msg);
  if (!wss) return;
  for (const client of wss.clients) {
    if (client.readyState === 1) { // OPEN
      client.send(data);
    }
  }
}

// ─── Origin Validation ───────────────────────────────────────────────────────────

function isLocalOrigin(req) {
  const origin = req.headers.origin || '';
  const host = req.headers.host || '';
  const allowedOrigins = [
    `http://127.0.0.1:${PORT}`,
    `http://localhost:${PORT}`,
  ];
  const allowedHosts = [
    `127.0.0.1:${PORT}`,
    `localhost:${PORT}`,
  ];
  // If no Origin header (same-origin navigation, non-browser), check Host
  if (!origin) {
    return allowedHosts.includes(host);
  }
  return allowedOrigins.includes(origin) && allowedHosts.includes(host);
}

// ─── CSRF Middleware ─────────────────────────────────────────────────────────────

function validateCsrf(req, res, next) {
  const token = req.body?.csrfToken || req.headers['x-csrf-token'];
  if (!token) {
    return res.status(403).json({ error: 'Missing CSRF token' });
  }
  // Check token belongs to any valid session
  let valid = false;
  for (const session of sessions.values()) {
    if (session.csrfToken === token) {
      valid = true;
      break;
    }
  }
  if (!valid) {
    return res.status(403).json({ error: 'Invalid CSRF token' });
  }
  next();
}

// ─── AI Task Runner ──────────────────────────────────────────────────────────────

function runAITask(task) {
  const character = CHARACTERS[task.characterId];
  if (!character) {
    task.status = 'error';
    task.error = `Unknown character: ${task.characterId}`;
    task.completedAt = new Date().toISOString();
    broadcast({ type: 'task_error', taskId: task.id, characterId: task.characterId, error: task.error, status: 'error' });
    addToHistory(task);
    processQueue(task.characterId);
    return;
  }

  // Demo mode — return canned response
  if (task.demo) {
    task.status = 'running';
    broadcast({ type: 'task_update', taskId: task.id, status: 'running', characterId: task.characterId });

    setTimeout(() => {
      task.status = 'done';
      task.result = DEMO_RESPONSES[task.characterId] || `[${character.name}] Demo response for: ${task.prompt}`;
      task.completedAt = new Date().toISOString();
      task.duration = Date.now() - new Date(task.createdAt).getTime();
      broadcast({ type: 'task_complete', taskId: task.id, characterId: task.characterId, result: task.result, duration: task.duration });
      addToHistory(task);
      processQueue(task.characterId);
    }, 1500 + Math.random() * 1500); // simulate 1.5–3s delay
    return;
  }

  // Real Claude CLI execution
  task.status = 'running';
  broadcast({ type: 'task_update', taskId: task.id, status: 'running', characterId: task.characterId });

  const startTime = Date.now();
  let stdout = '';
  let stderr = '';

  const child = spawn(CLAUDE_PATH, [
    '-p', task.prompt,
    '--system-prompt', character.systemPrompt,
    '--output-format', 'text',
    '--tools', '',
    '--permission-prompts', 'none',
    '--no-session-persistence'
  ], { shell: false, windowsHide: true });

  runningProcesses.set(task.id, child);

  // Timeout
  const timeout = setTimeout(() => {
    if (child.exitCode === null) {
      child.kill('SIGTERM');
      setTimeout(() => {
        if (child.exitCode === null) child.kill('SIGKILL');
      }, 3000);
      task.status = 'error';
      task.error = 'Task timed out after 120 seconds';
      task.completedAt = new Date().toISOString();
      task.duration = Date.now() - startTime;
      runningProcesses.delete(task.id);
      broadcast({ type: 'task_error', taskId: task.id, characterId: task.characterId, error: task.error, status: 'error' });
      addToHistory(task);
      processQueue(task.characterId);
    }
  }, TASK_TIMEOUT_MS);

  child.stdout.on('data', (chunk) => {
    stdout += chunk.toString();
    broadcast({ type: 'task_update', taskId: task.id, status: 'running', characterId: task.characterId, progress: stdout.length });
  });

  child.stderr.on('data', (chunk) => {
    stderr += chunk.toString();
  });

  child.on('error', (err) => {
    clearTimeout(timeout);
    runningProcesses.delete(task.id);

    task.status = 'error';
    task.error = `Failed to start Claude CLI: ${err.message}`;
    task.completedAt = new Date().toISOString();
    task.duration = Date.now() - startTime;
    broadcast({ type: 'task_error', taskId: task.id, characterId: task.characterId, error: task.error, status: 'error' });
    addToHistory(task);
    processQueue(task.characterId);
  });

  child.on('close', (code) => {
    clearTimeout(timeout);
    runningProcesses.delete(task.id);

    // Already handled (timeout / cancel)
    if (task.status !== 'running') return;

    const duration = Date.now() - startTime;
    task.duration = duration;
    task.completedAt = new Date().toISOString();

    const authErrors = ['not logged in', 'authentication', 'rate limit'];
    const hasAuthError = authErrors.some(e => stderr.toLowerCase().includes(e));

    if (code === 0) {
      task.status = 'done';
      task.result = stdout.trim();
      broadcast({ type: 'task_complete', taskId: task.id, characterId: task.characterId, result: task.result, duration });
    } else if (hasAuthError) {
      task.status = 'needs_setup';
      task.error = stderr.trim() || 'Claude CLI needs authentication setup';
      broadcast({ type: 'task_error', taskId: task.id, characterId: task.characterId, error: task.error, status: 'needs_setup' });
    } else {
      task.status = 'error';
      task.error = stderr.trim() || `Process exited with code ${code}`;
      broadcast({ type: 'task_error', taskId: task.id, characterId: task.characterId, error: task.error, status: 'error' });
    }

    addToHistory(task);
    processQueue(task.characterId);
  });
}

// ─── Task Queue ──────────────────────────────────────────────────────────────────

function enqueueTask(task) {
  tasks.set(task.id, task);
  const charId = task.characterId;
  if (!characterQueues.has(charId)) {
    characterQueues.set(charId, []);
  }
  characterQueues.get(charId).push(task.id);

  // If this character has no running task, start immediately
  const isRunning = Array.from(tasks.values()).some(
    t => t.characterId === charId && t.status === 'running'
  );
  if (!isRunning) {
    processQueue(charId);
  }
}

function processQueue(characterId) {
  const queue = characterQueues.get(characterId);
  if (!queue || queue.length === 0) return;

  // Check if character already has a running task
  const isRunning = Array.from(tasks.values()).some(
    t => t.characterId === characterId && t.status === 'running'
  );
  if (isRunning) return;

  // Find next queued task
  while (queue.length > 0) {
    const nextId = queue.shift();
    const task = tasks.get(nextId);
    if (task && task.status === 'queued') {
      runAITask(task);
      return;
    }
  }
}

function cancelTask(taskId) {
  const task = tasks.get(taskId);
  if (!task) return false;

  if (task.status === 'running') {
    const child = runningProcesses.get(taskId);
    if (child && child.exitCode === null) {
      child.kill('SIGTERM');
      setTimeout(() => {
        if (child.exitCode === null) child.kill('SIGKILL');
      }, 3000);
    }
    runningProcesses.delete(taskId);
  }

  task.status = 'cancelled';
  task.completedAt = new Date().toISOString();
  broadcast({ type: 'task_error', taskId: task.id, characterId: task.characterId, error: 'Task cancelled', status: 'cancelled' });
  addToHistory(task);
  processQueue(task.characterId);
  return true;
}

// ─── Chain / Parallel Mode ───────────────────────────────────────────────────────

function createChainTasks(prompt, chainIds, demo) {
  const groupId = crypto.randomUUID();
  const taskIds = [];

  for (let i = 0; i < chainIds.length; i++) {
    const charId = chainIds[i];
    const task = {
      id: crypto.randomUUID(),
      groupId,
      characterId: charId,
      prompt: i === 0
        ? prompt
        : `${prompt}\n\n--- ผลจากขั้นตอนก่อนหน้า ---\n(จะแนบผลเมื่อเสร็จ)`,
      mode: 'chain',
      chainIndex: i,
      chainTotal: chainIds.length,
      chainIds,
      status: i === 0 ? 'queued' : 'queued',
      demo: !!demo,
      createdAt: new Date().toISOString(),
    };
    tasks.set(task.id, task);
    taskIds.push(task.id);
  }

  // Start the first task; subsequent tasks are triggered by completion watcher
  const firstTask = tasks.get(taskIds[0]);
  enqueueTask(firstTask);

  // Set up chain watcher
  watchChain(taskIds, prompt);

  return { groupId, taskIds };
}

function watchChain(taskIds, originalPrompt) {
  // After each completion, start the next one with previous result appended
  const checkInterval = setInterval(() => {
    for (let i = 0; i < taskIds.length - 1; i++) {
      const current = tasks.get(taskIds[i]);
      const next = tasks.get(taskIds[i + 1]);

      if (!current || !next) continue;

      if (current.status === 'done' && next.status === 'queued' && !next._chainStarted) {
        next._chainStarted = true;
        // Append previous result to prompt
        next.prompt = `${originalPrompt}\n\n--- ผลจาก ${CHARACTERS[current.characterId]?.name || current.characterId} ---\n${current.result}`;
        enqueueTask(next);
      }

      if ((current.status === 'error' || current.status === 'cancelled' || current.status === 'needs_setup') && next.status === 'queued') {
        next.status = 'cancelled';
        next.error = `Previous step (${current.characterId}) failed: ${current.status}`;
        next.completedAt = new Date().toISOString();
        broadcast({ type: 'task_error', taskId: next.id, characterId: next.characterId, error: next.error, status: 'cancelled' });
        addToHistory(next);
      }
    }

    // Clear interval when all done
    const allDone = taskIds.every(id => {
      const t = tasks.get(id);
      return t && ['done', 'error', 'cancelled', 'needs_setup'].includes(t.status);
    });
    if (allDone) clearInterval(checkInterval);
  }, 500);
}

function createParallelTasks(prompt, chainIds, demo) {
  const groupId = crypto.randomUUID();
  const taskIds = [];

  for (const charId of chainIds) {
    const task = {
      id: crypto.randomUUID(),
      groupId,
      characterId: charId,
      prompt,
      mode: 'parallel',
      status: 'queued',
      demo: !!demo,
      createdAt: new Date().toISOString(),
    };
    taskIds.push(task.id);
    enqueueTask(task);
  }

  return { groupId, taskIds };
}

// ─── Express App ─────────────────────────────────────────────────────────────────

const app = express();
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Origin check for all API routes
app.use('/api', (req, res, next) => {
  if (!isLocalOrigin(req)) {
    return res.status(403).json({ error: 'Forbidden: invalid origin' });
  }
  next();
});

// ─── Routes ──────────────────────────────────────────────────────────────────────

// Session & CSRF
app.get('/api/session', (req, res) => {
  const sessionId = crypto.randomUUID();
  const csrfToken = crypto.randomBytes(32).toString('hex');
  sessions.set(sessionId, { csrfToken, createdAt: Date.now() });

  // Cleanup old sessions (older than 24h)
  const DAY = 86_400_000;
  for (const [id, s] of sessions) {
    if (Date.now() - s.createdAt > DAY) sessions.delete(id);
  }

  res.json({ csrfToken, sessionId });
});

// Create task
app.post('/api/task', validateCsrf, (req, res) => {
  const { prompt, characterId, mode = 'single', chainIds, demo } = req.body;

  if (!prompt || typeof prompt !== 'string') {
    return res.status(400).json({ error: 'prompt is required' });
  }

  // Validate mode
  if (!['single', 'chain', 'parallel'].includes(mode)) {
    return res.status(400).json({ error: 'Invalid mode. Use: single, chain, parallel' });
  }

  // Chain/Parallel modes
  if (mode === 'chain' || mode === 'parallel') {
    const ids = chainIds || [];
    if (!Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: 'chainIds array is required for chain/parallel mode' });
    }
    for (const id of ids) {
      if (!CHARACTERS[id]) {
        return res.status(400).json({ error: `Unknown character: ${id}` });
      }
    }

    if (mode === 'chain') {
      const { groupId, taskIds } = createChainTasks(prompt, ids, demo);
      return res.json({ groupId, taskIds, status: 'queued' });
    } else {
      const { groupId, taskIds } = createParallelTasks(prompt, ids, demo);
      return res.json({ groupId, taskIds, status: 'queued' });
    }
  }

  // Single mode
  if (!characterId || !CHARACTERS[characterId]) {
    return res.status(400).json({ error: `Unknown character: ${characterId}` });
  }

  const task = {
    id: crypto.randomUUID(),
    characterId,
    prompt,
    mode: 'single',
    status: 'queued',
    demo: !!demo,
    createdAt: new Date().toISOString(),
  };

  enqueueTask(task);
  res.json({ taskId: task.id, status: 'queued' });
});

// List active tasks
app.get('/api/tasks', (req, res) => {
  const active = [];
  for (const task of tasks.values()) {
    if (['queued', 'running'].includes(task.status)) {
      active.push({
        taskId: task.id,
        characterId: task.characterId,
        mode: task.mode,
        status: task.status,
        prompt: task.prompt.substring(0, 200),
        createdAt: task.createdAt,
        groupId: task.groupId || null,
      });
    }
  }
  res.json(active);
});

// Task history
app.get('/api/history', (req, res) => {
  const { characterId, limit = 50 } = req.query;
  let filtered = history;
  if (characterId) {
    filtered = filtered.filter(h => h.characterId === characterId);
  }
  // Return most recent first
  const result = filtered.slice(-Number(limit)).reverse();
  res.json(result);
});

// Cancel task
app.delete('/api/task/:id', validateCsrf, (req, res) => {
  const { id } = req.params;
  const task = tasks.get(id);
  if (!task) {
    return res.status(404).json({ error: 'Task not found' });
  }
  if (!['queued', 'running'].includes(task.status)) {
    return res.status(400).json({ error: `Cannot cancel task in state: ${task.status}` });
  }
  cancelTask(id);
  res.json({ taskId: id, status: 'cancelled' });
});

// Export task result
app.post('/api/export/:taskId', validateCsrf, (req, res) => {
  const { taskId } = req.params;
  const task = tasks.get(taskId);

  // Also check history if not in active tasks
  let record = task;
  if (!record) {
    record = history.find(h => h.taskId === taskId);
  }
  if (!record) {
    return res.status(404).json({ error: 'Task not found' });
  }
  if (!record.result) {
    return res.status(400).json({ error: 'Task has no result to export' });
  }

  const character = CHARACTERS[record.characterId];
  const charName = character ? character.name : record.characterId;
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `${charName}-${timestamp}.md`;
  const filepath = path.join(OUTPUT_DIR, filename);

  const content = [
    `# Task Result — ${charName}`,
    ``,
    `**Character:** ${charName} (${character?.role || 'Unknown'})`,
    `**Date:** ${record.completedAt || new Date().toISOString()}`,
    `**Prompt:** ${record.prompt}`,
    `**Duration:** ${record.duration ? `${(record.duration / 1000).toFixed(1)}s` : 'N/A'}`,
    ``,
    `---`,
    ``,
    record.result,
  ].join('\n');

  try {
    fs.writeFileSync(filepath, content, 'utf-8');
    res.json({ path: filepath });
  } catch (err) {
    res.status(500).json({ error: `Failed to export: ${err.message}` });
  }
});

// Characters list (bonus endpoint for the frontend)
app.get('/api/characters', (req, res) => {
  const chars = {};
  for (const [id, char] of Object.entries(CHARACTERS)) {
    chars[id] = { name: char.name, role: char.role, team: char.team };
  }
  res.json(chars);
});

// ─── HTTP + WebSocket Server ─────────────────────────────────────────────────────

const server = http.createServer(app);
wss = new WebSocketServer({ server });

wss.on('connection', (ws, req) => {
  // Validate WebSocket origin
  const origin = req.headers.origin || '';
  const allowedOrigins = [
    `http://127.0.0.1:${PORT}`,
    `http://localhost:${PORT}`,
  ];
  if (origin && !allowedOrigins.includes(origin)) {
    ws.close(1008, 'Forbidden origin');
    return;
  }

  console.log('[WS] Client connected');

  ws.on('message', (raw) => {
    try {
      const msg = JSON.parse(raw.toString());

      if (msg.type === 'cancel_task' && msg.taskId) {
        const success = cancelTask(msg.taskId);
        ws.send(JSON.stringify({
          type: 'task_update',
          taskId: msg.taskId,
          status: success ? 'cancelled' : 'not_found',
        }));
      }
    } catch (err) {
      console.error('[WS] Bad message:', err.message);
    }
  });

  ws.on('close', () => {
    console.log('[WS] Client disconnected');
  });
});

// ─── Startup ─────────────────────────────────────────────────────────────────────

ensureDirs();
loadHistory();

server.listen(PORT, HOST, () => {
  console.log(`\n🏢 DATYLAN STATION Server running at http://${HOST}:${PORT}`);
  console.log(`📡 WebSocket ready on ws://${HOST}:${PORT}`);
  console.log(`🤖 Claude CLI: ${CLAUDE_PATH}`);
  console.log(`📁 Data dir: ${DATA_DIR}`);
  console.log(`📤 Output dir: ${OUTPUT_DIR}`);
  console.log(`👥 Characters: ${Object.keys(CHARACTERS).join(', ')}\n`);
});

// ─── Graceful Shutdown ───────────────────────────────────────────────────────────

function gracefulShutdown(signal) {
  console.log(`\n[${signal}] Shutting down gracefully...`);

  // Kill all running child processes
  for (const [taskId, child] of runningProcesses) {
    console.log(`  Killing task ${taskId}...`);
    if (child.exitCode === null) {
      child.kill('SIGTERM');
    }
  }
  runningProcesses.clear();

  // Close WebSocket connections
  if (wss) {
    for (const client of wss.clients) {
      client.close(1001, 'Server shutting down');
    }
  }

  // Save history
  saveHistory();

  // Close HTTP server
  server.close(() => {
    console.log('Server closed.');
    process.exit(0);
  });

  // Force exit after 5s
  setTimeout(() => {
    console.error('Forced exit after timeout.');
    process.exit(1);
  }, 5000);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
