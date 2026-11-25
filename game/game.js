// Dapur Kilat — a timed order cooking game. Static, offline, keyboard + mouse.
'use strict';

// --- ingredients: id, name, key, inline SVG icon (drawn, no external assets) ---
const INGREDIENTS = [
  { id: 'nasi', name: 'Nasi', key: '1', svg: '<svg viewBox="0 0 64 64"><ellipse cx="32" cy="26" rx="20" ry="10" fill="#fff" stroke="#d9c9a8"/><path d="M12 28 Q32 52 52 28 L48 40 Q32 56 16 40 Z" fill="#3b6ea5"/><rect x="40" y="6" width="3" height="26" rx="1.5" fill="#8a5a2b" transform="rotate(18 41 19)"/><rect x="46" y="8" width="3" height="24" rx="1.5" fill="#8a5a2b" transform="rotate(24 47 20)"/></svg>' },
  { id: 'telur', name: 'Telur', key: '2', svg: '<svg viewBox="0 0 64 64"><ellipse cx="32" cy="34" rx="24" ry="20" fill="#fff" stroke="#d9c9a8"/><circle cx="32" cy="34" r="11" fill="#ffb703" stroke="#e85d04" stroke-width="2"/></svg>' },
  { id: 'ayam', name: 'Ayam', key: '3', svg: '<svg viewBox="0 0 64 64"><ellipse cx="28" cy="36" rx="18" ry="14" fill="#c2703d" transform="rotate(-20 28 36)"/><circle cx="44" cy="18" r="4" fill="#f3ead6" stroke="#b08968"/><circle cx="50" cy="24" r="4" fill="#f3ead6" stroke="#b08968"/><path d="M40 26 L46 20" stroke="#b08968" stroke-width="4" stroke-linecap="round"/></svg>' },
  { id: 'sayur', name: 'Sayur', key: '4', svg: '<svg viewBox="0 0 64 64"><ellipse cx="32" cy="38" rx="8" ry="16" fill="#43aa3a" transform="rotate(-18 32 38)"/><ellipse cx="24" cy="34" rx="7" ry="13" fill="#74c69d" transform="rotate(-40 24 34)"/><ellipse cx="42" cy="34" rx="7" ry="13" fill="#2a7f2a" transform="rotate(35 42 34)"/><path d="M32 52 L32 58" stroke="#2a7f2a" stroke-width="4" stroke-linecap="round"/></svg>' },
  { id: 'cabai', name: 'Cabai', key: '5', svg: '<svg viewBox="0 0 64 64"><path d="M18 22 Q40 12 48 30 Q52 46 34 50 Q16 52 18 22" fill="#d62828"/><path d="M44 28 Q52 20 56 12" stroke="#2a7f2a" stroke-width="5" fill="none" stroke-linecap="round"/></svg>' },
];
const ING = Object.fromEntries(INGREDIENTS.map((i) => [i.id, i]));

// --- dishes: name, recipe (ingredient ids in order) ---
const DISHES = [
  { name: 'Nasi Goreng', recipe: ['nasi', 'telur', 'cabai'] },
  { name: 'Ayam Geprek', recipe: ['ayam', 'cabai', 'nasi'] },
  { name: 'Tumis Sayur', recipe: ['sayur', 'telur', 'nasi'] },
];
const CUSTOMERS = ['Budi', 'Siti', 'Agus', 'Rani', 'Joko', 'Maya', 'Dedi', 'Lina'];

const ORDER_TIME = 45;      // seconds per order
const SHIFT_TIME = 180;     // 3-minute shift
const WIN_SERVES = 10;
const MAX_LOST = 3;

// --- state ---
let running = false;
let score = 0, coins = 0, served = 0, lost = 0;
let shiftLeft = SHIFT_TIME;
let orders = [];            // {id, customer, dish, timeLeft, strikes}
let selected = 0;           // index of the selected order
let plate = [];             // ingredient ids on the plate, in order
let nextOrderId = 1;
let timer = null;

// --- dom helpers ---
const $ = (id) => document.getElementById(id);
const fmt = (s) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
function log(msg) { $('log').textContent = msg; }

// --- rendering ---
function renderStations() {
  $('stations').innerHTML = INGREDIENTS.map((ing) => `
    <button class="station" data-ing="${ing.id}" title="Tekan ${ing.key}">
      ${ing.svg}<span class="name">${ing.name}</span><br><span class="key">${ing.key}</span>
    </button>`).join('');
  document.querySelectorAll('.station').forEach((b) => {
    b.addEventListener('click', () => addIngredient(b.dataset.ing));
  });
}

function renderOrders() {
  $('order-board').innerHTML = orders.map((o, i) => {
    const done = plate.length && i === selected ? plate.length : 0;
    const items = o.dish.recipe.map((ingId, k) => {
      const cls = i === selected && k < plate.length ? 'done' : (i === selected && k === plate.length ? 'next' : '');
      return `<li class="${cls}">${ING[ingId].svg.replace('<svg', '<svg width="18" height="18"')} ${ING[ingId].name}</li>`;
    }).join('');
    const pct = Math.max(0, (o.timeLeft / ORDER_TIME) * 100);
    return `<div class="order-card ${i === selected ? 'selected' : ''} ${o.timeLeft <= 0 ? 'lost' : ''}" data-order="${i}">
      <div class="order-head"><span class="order-customer">👤 ${o.customer}</span><b>${o.dish.name}</b><span>⏱ ${o.timeLeft} dtk</span></div>
      <ul class="recipe">${items}</ul>
      <div class="timer-bar"><div class="timer-fill ${pct <= 25 ? 'low' : ''}" style="width:${pct}%"></div></div>
      <div class="strikes">${o.strikes > 0 ? '✕'.repeat(o.strikes) + ' coretan' : ''}</div>
    </div>`;
  }).join('');
  document.querySelectorAll('.order-card').forEach((c) => {
    c.addEventListener('click', () => { selected = +c.dataset.order; plate = []; renderAll(); });
  });
}

function renderPlate() {
  const o = orders[selected];
  $('plate-for').textContent = o ? `— ${o.customer} (${o.dish.name})` : '';
  let html = '';
  for (let k = 0; k < 3; k++) {
    html += plate[k] ? ING[plate[k]].svg : '<div class="slot">?</div>';
  }
  $('plate-items').innerHTML = html;
  const ready = o && plate.length === 3 && plate.every((id, k) => id === o.dish.recipe[k]);
  const btn = $('serve-btn');
  btn.disabled = !ready;
  btn.classList.toggle('ready', !!ready);
  $('plate-msg').textContent = !o ? 'Tidak ada pesanan aktif.'
    : ready ? 'Piring lengkap — siap disajikan!'
    : plate.length === 0 ? 'Susun bahannya sesuai urutan resep di kartu pesanan.'
    : `Sudah ${plate.length}/3 bahan. Berikutnya: ${ING[o.dish.recipe[plate.length]].name}.`;
}

function renderStats() {
  $('score').textContent = score;
  $('coins').textContent = coins;
  $('served').textContent = served;
  $('shift').textContent = fmt(Math.max(0, shiftLeft));
}

function renderAll() { renderOrders(); renderPlate(); renderStats(); }

// --- game logic ---
function newOrder() {
  const dish = DISHES[Math.floor(Math.random() * DISHES.length)];
  const customer = CUSTOMERS[Math.floor(Math.random() * CUSTOMERS.length)];
  return { id: nextOrderId++, customer, dish, timeLeft: ORDER_TIME, strikes: 0 };
}

function loseOrder(o, why) {
  lost++;
  log(`❌ Pesanan ${o.customer} (${o.dish.name}) hangus — ${why}. Pesanan hangus: ${lost}/${MAX_LOST}.`);
  const idx = orders.indexOf(o);
  if (idx >= 0) orders.splice(idx, 1);
  if (idx === selected) { selected = 0; plate = []; }
  else if (idx < selected) selected--;
  orders.push(newOrder());
  if (lost >= MAX_LOST) return endGame(false, 'Tiga pesanan hangus — dapur kewalahan!');
  renderAll();
}

function addIngredient(id) {
  if (!running) return;
  const o = orders[selected];
  if (!o || plate.length >= 3) return;
  const expected = o.dish.recipe[plate.length];
  if (id === expected) {
    plate.push(id);
    log(`✅ ${ING[id].name} masuk piring. ${plate.length}/3 bahan untuk ${o.customer}.`);
  } else {
    o.strikes++;
    const el = document.querySelector(`.order-card[data-order="${selected}"]`);
    if (el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); }
    log(`✕ Salah! ${o.dish.name} butuh ${ING[expected].name}, bukan ${ING[id].name}. Coretan ${o.strikes}/3.`);
    if (o.strikes >= 3) { loseOrder(o, 'tiga bahan salah'); return; }
  }
  renderAll();
}

function serve() {
  if (!running) return;
  const o = orders[selected];
  if (!o || plate.length !== 3 || !plate.every((id, k) => id === o.dish.recipe[k])) return;
  const bonus = o.timeLeft * 2;
  score += 100 + bonus;
  coins += 10;
  served++;
  log(`🍽️ Tersaji! ${o.dish.name} untuk ${o.customer} — +${100 + bonus} poin, +10 koin.`);
  orders.splice(selected, 1);
  orders.push(newOrder());
  selected = 0; plate = [];
  if (served >= WIN_SERVES) return endGame(true, `Kamu menyajikan ${WIN_SERVES} hidangan!`);
  renderAll();
}

function clearPlate() { if (!running) return; plate = []; log('🗑️ Piring dikosongkan.'); renderAll(); }

function tick() {
  if (!running) return;
  shiftLeft--;
  for (const o of [...orders]) {
    o.timeLeft--;
    if (o.timeLeft <= 0) { loseOrder(o, 'waktu habis'); if (!running) return; }
  }
  if (shiftLeft <= 0) {
    endGame(served >= 6, served >= 6 ? 'Shift selesai dengan dapur yang rapi!' : 'Shift selesai — hidangan tersaji kurang dari target.');
    return;
  }
  renderAll();
}

function startGame() {
  score = 0; coins = 0; served = 0; lost = 0; shiftLeft = SHIFT_TIME;
  orders = [newOrder(), newOrder()];
  selected = 0; plate = []; running = true;
  $('overlay').classList.add('hidden');
  $('end-overlay').classList.add('hidden');
  log('🔥 Dapur buka! Pesanan pertama sudah masuk — susun bahannya sesuai urutan.');
  renderStations(); renderAll();
  clearInterval(timer);
  timer = setInterval(tick, 1000);
}

function endGame(won, reason) {
  running = false;
  clearInterval(timer);
  $('end-title').textContent = won ? '🎉 Shift Selesai — Menang!' : '😵 Dapur Tutup — Kalah';
  $('end-text').textContent = reason;
  $('end-score').textContent = score;
  $('end-coins').textContent = coins;
  $('end-served').textContent = served;
  $('end-overlay').classList.remove('hidden');
  log(won ? `🎉 Menang! Skor ${score}, ${served} hidangan tersaji.` : `😵 Kalah. Skor ${score}, ${served} hidangan tersaji.`);
}

// --- demo states for screenshots (?demo=cover|assembly|served): real game states ---
function applyDemo(mode) {
  if (!mode) return;
  if (mode === 'assembly' && orders[0]) {
    selected = 0;
    addIngredient(orders[0].dish.recipe[0]);
  } else if (mode === 'served' && orders[0]) {
    selected = 0;
    for (const id of orders[0].dish.recipe) addIngredient(id);
  }
  renderAll();
}

// --- wiring ---
$('serve-btn').addEventListener('click', serve);
$('clear-btn').addEventListener('click', clearPlate);
$('start-btn').addEventListener('click', startGame);
$('restart-btn').addEventListener('click', startGame);
document.addEventListener('keydown', (e) => {
  if (!running) { if (e.key === 'Enter') startGame(); return; }
  const ing = INGREDIENTS.find((i) => i.key === e.key);
  if (ing) addIngredient(ing.id);
  else if (e.key === 's' || e.key === 'S') serve();
  else if (e.key === 'x' || e.key === 'X') clearPlate();
});

// --- init: paint the stations + two sample orders behind the start overlay ---
renderStations();
orders = [newOrder(), newOrder()];
renderAll();
const demo = new URLSearchParams(location.search).get('demo');
if (demo) { startGame(); applyDemo(demo); }

