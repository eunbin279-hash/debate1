const cushions = ['저기..', '혹시..', '그런데..', '솔직히..']
const yard = document.getElementById('yard')
const catsWrap = document.getElementById('cats')
const adoptList = document.getElementById('adoptList')
const sendBtn = document.getElementById('sendBtn')
const userInput = document.getElementById('userInput')

let adopted = []
const threads = {}
window.debateInfo = null;

if (window.DebateCore) {
  window.DebateCore.onReady(function (info) {
    if (!info.nickname) {
      document.body.innerHTML = '<div style="display:flex; justify-content:center; align-items:center; height:100vh; font-weight:bold; font-size:1.2rem;">토론 플랫폼을 통해 접속하세요.</div>';
      return;
    }
    if (info.status !== 'active' && info.status !== 'pending') {
      document.body.innerHTML = `<div style="display:flex; justify-content:center; align-items:center; height:100vh; font-weight:bold; font-size:1.2rem;">토론이 진행중이지 않습니다. (상태: ${info.status})</div>`;
      return;
    }
    window.debateInfo = info;
    // Show simulation button only for user 'ian'
    try {
      const simBtn = document.getElementById('simFinalBtn')
      if (simBtn) {
        if (info.nickname === 'ian') simBtn.classList.remove('hidden')
        else simBtn.classList.add('hidden')
      }
      // Also hide the bottom toggle button unless user is 'ian'
      const simToggle = document.getElementById('simToggleBtn')
      if (simToggle) {
        if (info.nickname === 'ian') {
          simToggle.style.display = ''
        } else {
          simToggle.style.display = 'none'
        }
      }
    } catch (e) { /* ignore */ }
    window.myMessages = [];
    window.myAgrees = [];
    window.saveMyPayload = () => {
      if (!window.debateInfo) return;
      window.debateInfo.savePayload({
        messages: window.myMessages || [],
        agrees: window.myAgrees || [],
        side: window.debateInfo.side || 'unassigned'
      }).catch(err => console.error('Payload save error:', err));
    };

    // Move window.myMessages and window.myAgrees initialization here
    // but DON'T call saveMyPayload immediately as it overwrites existing data on server.
    // window.saveMyPayload(); 

    window.usedSlots = new Set();
    const slots = [
      { left: 10, top: 15 }, { left: 25, top: 25 }, { left: 75, top: 15 }, { left: 85, top: 35 },
      { left: 15, top: 45 }, { left: 80, top: 55 }, { left: 30, top: 60 }, { left: 70, top: 65 },
      { left: 5, top: 30 }, { left: 90, top: 20 }, { left: 20, top: 35 }, { left: 65, top: 40 },
      { left: 35, top: 45 }, { left: 60, top: 20 }, { left: 10, top: 55 }, { left: 85, top: 50 },
    ];

    // Listen for payloads
    info.onPayloadsChange(payloads => {
      const catsWrap = document.getElementById('cats');

      // Clear all threads to rebuild
      Object.keys(threads).forEach(k => { threads[k] = [] });

      // Collect all messages and agrees
      let allMessages = [];
      let agreeCounts = {};
      Object.keys(payloads).forEach(nick => {
        const data = payloads[nick];

        if (nick === info.nickname) {
          // Only update if data exists to avoid resetting to empty on accidental empty payload triggers
          if (data) {
            window.myMessages = data.messages || [];
            window.myAgrees = data.agrees || [];
          }
        }

        if (data && data.messages && Array.isArray(data.messages)) {
          data.messages.forEach(m => allMessages.push({ ...m, sender: nick, side: data.side }));
        }
        if (data && data.agrees && Array.isArray(data.agrees)) {
          data.agrees.forEach(id => {
            agreeCounts[id] = (agreeCounts[id] || 0) + 1;
          });
        }
      });
      window.agreeCounts = agreeCounts;
      window.allMessages = allMessages;

      allMessages.sort((a, b) => a.time - b.time);

      // Reconstruct adopted array
      adopted = [];
      if (window.myAgrees) {
        window.myAgrees.forEach(bubbleId => {
          const msg = allMessages.find(m => `${m.sender}_${m.time}` === bubbleId);
          if (msg) adopted.push({ id: bubbleId, text: msg.text, sender: msg.sender });
        });
      }
      allMessages.forEach(m => {
        let localTarget = m.target === info.nickname ? 'user' : m.target;
        let fromStr = m.sender === info.nickname ? 'user' : 'cat';
        if (!threads[localTarget]) threads[localTarget] = [];
        threads[localTarget].push({
          from: fromStr,
          text: m.text,
          time: m.time,
          sender: m.sender
        });
      });

      updateAdoptList();

      // If an auto-sim trigger checker is defined, call it now (safe to call repeatedly)
      if (typeof window.checkAutoSimTrigger === 'function') {
        try { window.checkAutoSimTrigger(); } catch (err) { console.error('auto-sim trigger error', err); }
      }

      // Render all cats (and create if missing)
      const MAX_CATS = 6;
      const usersToRender = Object.keys(threads).filter(t => t !== 'user').slice(-MAX_CATS);

      // Clean up old cats beyond max limit
      Array.from(document.querySelectorAll('.cat')).forEach(catEl => {
        const id = catEl.dataset.id;
        if (id !== 'user' && !usersToRender.includes(id)) {
          window.usedSlots.delete(parseFloat(catEl.style.left));
          catEl.remove();
        }
      });

      usersToRender.forEach(nick => {
        let catEl = document.querySelector(`.cat[data-id="${nick}"]`);
        if (!catEl) {
          catEl = document.createElement('div');
          catEl.className = 'cat';
          catEl.dataset.id = nick;

          let slot = slots.find(s => !window.usedSlots.has(s.left));
          if (!slot) slot = { left: 10 + Math.random() * 80, top: 10 + Math.random() * 60 };
          window.usedSlots.add(slot.left);

          catEl.style.left = `${slot.left}%`;
          catEl.style.top = `${slot.top}%`;
          catEl.innerHTML = `
            <div class="bubble-stack"></div>
            <img src="img/cat_neutral.png" alt="cat" class="cat-img">
          `;
          catsWrap.appendChild(catEl);
        }
        renderCatBubbles(catEl);
      });

      // Also render user cat
      const userCatEl = document.querySelector('.cat[data-id="user"]');
      if (userCatEl) renderCatBubbles(userCatEl);
    });
  });
}

// --- Auto-simulation helpers for non-ian users ---
// Ensure each debate triggers auto-sim only once per debate key
window._autoSimRunSet = window._autoSimRunSet || new Set();

function getDebateKey() {
  if (!window.debateInfo) return 'debate-unknown';
  const t = window.debateInfo.title || `${window.debateInfo.agendaSetter || ''}-${window.debateInfo.architect || ''}`;
  return (t && t.length > 0) ? `debate:${t}` : 'debate-unknown';
}

window.startSimulationAuto = window.startSimulationAuto || function () {
  // Reuse existing sim toggle behavior but keep it callable
  const evt = new Event('sim-auto');
  if (typeof window.startSimulationAuto === 'function' && typeof runSimStep === 'function') {
    // If sim UI is already wired via simToggleBtn, just call that flow
    // Build the note content similarly to manual flow
    let bestMsgText = '아직 상대방의 의견이 엄슴미다.';
    if (window.agreeCounts && Object.keys(window.agreeCounts).length > 0) {
      const mySide = window.debateInfo ? window.debateInfo.side : 'pro';
      const oppositeSide = mySide === 'pro' ? 'con' : 'pro';
      const oppositeMessages = window.allMessages ? window.allMessages.filter(m => m.side === oppositeSide) : [];
      let maxAgrees = 0;
      let bestMsg = null;
      oppositeMessages.forEach(m => {
        const id = `${m.sender}_${m.time}`;
        const count = window.agreeCounts[id] || 0;
        if (count >= maxAgrees && count > 0) {
          maxAgrees = count;
          bestMsg = m;
        }
      });
      if (bestMsg) bestMsgText = bestMsg.text;
    }

    function distort(t) {
      t = t.replace(/\.\.\.냥/g, '').replace(/냥/g, '');
      return t
        .replace(/습니다/g, '슴미다')
        .replace(/입니다/g, '임미당')
        .replace(/합니다/g, '함미다')
        .replace(/요/g, '염')
        .replace(/의 /g, '에 ')
        .replace(/것/g, '거')
        .replace(/는/g, '능')
        .replace(/를/g, '룰')
        .replace(/은/g, '응')
        .replace(/다([.?!])/g, '당$1')
        .replace(/다$/g, '당')
        .replace(/없/g, '업')
        .replace(/있/g, '잇')
        .replace(/많/g, '만')
        .replace(/않/g, '안')
        .replace(/생각/g, '셍각');
    }

    const distortedText = distort(bestMsgText);

    if (simNote) simNote.innerHTML = `<b>쪽지</b><br><br>${distortedText}`;
    if (simModal) simModal.classList.remove('hidden');
    if (simNote) { simNote.classList.remove('show', 'dropped'); simNote.classList.add('hidden'); }
    if (simCharacter) simCharacter.classList.add('hidden');
    if (simFinalBtn) simFinalBtn.classList.add('hidden');
    const tUI = document.getElementById('simTypeUI'); if (tUI) tUI.classList.add('hidden');
    if (simUi) simUi.classList.remove('hidden');
    const tInput = document.getElementById('simTypeInput'); if (tInput) tInput.value = '';
    const tCount = document.getElementById('simTypeCount'); if (tCount) tCount.textContent = '0/100';
    if (simNextIndicator) simNextIndicator.classList.remove('hidden');
    runSimStep(0);
  }
};

window.checkAutoSimTrigger = window.checkAutoSimTrigger || function () {
  try {
    if (!window.debateInfo) return;
    if (window.debateInfo.nickname === 'ian') return; // only for non-ian users

    const key = getDebateKey();
    // per-session guard
    if (window._autoSimRunSet.has(key)) return; // already triggered in this session

    // per-user persisted guard (localStorage) so the same person on the same device won't see it again
    const nick = window.debateInfo.nickname || 'anon';
    const seenKey = `seenSim:${key}:${nick}`;
    try {
      if (localStorage.getItem(seenKey)) return; // already seen by this user on this device
    } catch (err) {
      // localStorage may be unavailable in some environments; ignore and proceed with session-only guard
    }

    const opinionsCount = (window.allMessages && Array.isArray(window.allMessages)) ? window.allMessages.length : 0;
    if (opinionsCount < 5) return; // need at least 5 opinions

    // Find the highest-agreed message and require it has at least 1 agree
    let maxAgrees = 0;
    let bestMsg = null;
    if (window.allMessages && window.agreeCounts) {
      window.allMessages.forEach(m => {
        const id = `${m.sender}_${m.time}`;
        const c = window.agreeCounts[id] || 0;
        if (c > maxAgrees) {
          maxAgrees = c;
          bestMsg = m;
        }
      });
    }

    if (!bestMsg || maxAgrees <= 0) return; // no agreed opinion yet

    // Mark as triggered (session) and persist seen flag (per-device/user)
    window._autoSimRunSet.add(key);
    try {
      localStorage.setItem(seenKey, String(Date.now()));
    } catch (err) {
      // ignore storage errors
    }
    if (typeof window.startSimulationAuto === 'function') window.startSimulationAuto();
  } catch (err) {
    console.error('checkAutoSimTrigger error', err);
  }
};

// Helper to clear the local seen flag (for testing)
window.clearSeenSimForCurrent = function () {
  try {
    if (!window.debateInfo) return;
    const key = getDebateKey();
    const nick = window.debateInfo.nickname || 'anon';
    localStorage.removeItem(`seenSim:${key}:${nick}`);
    // Also remove from session set so it can trigger again in this session
    window._autoSimRunSet.delete(key);
  } catch (e) { /* ignore */ }
}

// Dev helper: if URL has ?debug=1, show a small test button to simulate payloads and trigger auto-sim
function createAutoSimTestButton() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (!params.get('debug')) return;

    const btn = document.createElement('button');
    btn.textContent = 'TEST: AutoSim';
    btn.style.position = 'fixed';
    btn.style.right = '12px';
    btn.style.bottom = '12px';
    btn.style.zIndex = 99999;
    btn.style.padding = '8px 10px';
    btn.style.background = '#0b5fff';
    btn.style.color = '#fff';
    btn.style.border = 'none';
    btn.style.borderRadius = '6px';
    btn.style.boxShadow = '0 2px 8px rgba(0,0,0,0.12)';
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      // Build 5 mock messages and set agreeCounts so one has agrees
      const now = Date.now();
      window.allMessages = [
        { sender: 'u1', text: '의견 1', time: now - 5000, side: 'con' },
        { sender: 'u2', text: '의견 2', time: now - 4000, side: 'con' },
        { sender: 'u3', text: '의견 3', time: now - 3000, side: 'con' },
        { sender: 'u4', text: '의견 4', time: now - 2000, side: 'con' },
        { sender: 'u5', text: '의견 5', time: now - 1000, side: 'con' }
      ];
      // give one message some agrees
      const bid = `${window.allMessages[2].sender}_${window.allMessages[2].time}`;
      window.agreeCounts = {};
      window.agreeCounts[bid] = 2;

      // Mirror payload-like structure so other code can inspect
      try { window.checkAutoSimTrigger(); } catch (err) { console.error('auto-sim test trigger failed', err); }
    });
    document.body.appendChild(btn);
  } catch (e) { /* ignore in restricted environments */ }
}

createAutoSimTestButton();


const CAT_IMAGES = {
  NEUTRAL: 'img/cat_neutral.png',
  SAD: 'img/cat_sad.png',
  HAPPY: 'img/cat_happy.png'
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

/**
 * Sophisticated Nyan-speak logic
 */
function toNyanSpeak(text) {
  if (!text) return ''
  return text.replace(/([^.!?\n]+)([.!?\n]*)/g, (match, body, tail) => {
    body = body.trim()
    if (!body) return tail
    const lastChar = body.slice(-1)
    const lastCharCode = lastChar.charCodeAt(0)
    let isMBatchim = false
    if (lastCharCode >= 0xAC00 && lastCharCode <= 0xD7A3) {
      if ((lastCharCode - 0xAC00) % 28 === 6) isMBatchim = true
    }
    const suffixes = ['요', '다', '까', '어', '해', '지']
    let result = body
    if (isMBatchim || suffixes.includes(lastChar)) {
      result += '냥'
    } else {
      result += '...냥'
    }
    return result + tail
  })
}

function getFirstSentence(text) {
  if (!text) return ''
  // Get first sentence or up to 40 chars
  const match = text.match(/[^.!?\n]+[.!?\n]*/)
  let first = match ? match[0].trim() : text.trim()
  if (first.length > 40) first = first.substring(0, 37) + '...'
  return first
}

// Global UI feedback (Hurt effect)
function showHurtEffect(catEl) {
  const overlay = document.getElementById('hurtOverlay')
  catEl.querySelector('img').src = CAT_IMAGES.SAD
  overlay.classList.remove('hidden')
  catEl.classList.add('shake') // Re-added shake

  setTimeout(() => {
    overlay.classList.add('hidden')
    catEl.classList.add('shrunken-cat')
    catEl.style.zIndex = '1'
  }, 2000)
}

// Main cat click: toggle expansion
catsWrap.addEventListener('click', e => {
  const cat = e.target.closest('.cat')
  if (!cat) return

  // If clicked on buttons or input, don't toggle
  if (e.target.closest('.bubble-actions') || e.target.closest('.bubble-rebut-input') || e.target.closest('.view-more-btn')) return

  const id = cat.dataset.id
  if (!threads[id]) {
    threads[id] = [{ from: 'cat', text: toNyanSpeak(cat.dataset.text || '원문이 없습니다.'), time: Date.now() }]
  }

  // Close others and re-render them to collapse
  document.querySelectorAll('.cat').forEach(c => {
    if (c !== cat) {
      c.classList.remove('expanded')
      c._showHistory = false
      renderCatBubbles(c)
    }
  })

  cat.classList.toggle('expanded')
  if (!cat.classList.contains('expanded')) {
    cat._showHistory = false
  } else {
    cat._showHistory = true
  }
  renderCatBubbles(cat)
})

function renderCatBubbles(catEl) {
  const id = catEl.dataset.id
  const thread = threads[id] || []
  const stack = catEl.querySelector('.bubble-stack')
  const isExpanded = catEl.classList.contains('expanded')

  // Clear original stack content
  stack.innerHTML = ''

  // If collapsed, only show latest (first sentence)
  if (!isExpanded) {
    // If there was a floating overlay, remove it
    const existingOverlay = catEl._bubbleOverlay
    if (existingOverlay) {
      existingOverlay.remove()
      catEl._bubbleOverlay = null
    }

    const latest = thread[thread.length - 1]
    const b = document.createElement('div')
    b.className = 'bubble'
    b.textContent = getFirstSentence(latest.text)
    stack.appendChild(b)
    return
  }

  // If expanded, render a fixed-position overlay near the cat so it won't be clipped
  // Create overlay container if not exists
  let overlay = catEl._bubbleOverlay
  if (!overlay) {
    overlay = document.createElement('div')
    overlay.className = 'bubble-stack-overlay'
    // Keep reference to remove later
    catEl._bubbleOverlay = overlay
    document.body.appendChild(overlay)
  }

  // Reset overlay content
  overlay.innerHTML = ''
  overlay.style.position = 'fixed'
  overlay.style.zIndex = 2000
  overlay.style.maxHeight = '60vh'
  overlay.style.overflowY = 'auto'
  overlay.style.display = 'flex'
  overlay.style.flexDirection = 'column'
  overlay.style.alignItems = 'center'
  overlay.style.gap = '10px'
  overlay.style.padding = '10px'

  // Build bubbles into overlay
  const showHistory = catEl._showHistory || false

  const msgsToShow = showHistory ? thread : [thread[thread.length - 1]]

  msgsToShow.forEach((msg, idx) => {
    const isLastMsg = (msg === thread[thread.length - 1])
    const b = document.createElement('div')
    b.className = `bubble ${msg.from}`
    b.style.opacity = '1'
    b.style.transform = 'scale(1)'

    if (thread.length > 1) {
      b.style.cursor = 'pointer'
      b.onclick = (e) => {
        e.stopPropagation()
        catEl._showHistory = !showHistory
        renderCatBubbles(catEl)
      }

      // Add a small hint to the very first bubble rendered in the stack
      if (idx === 0) {
        const hint = document.createElement('div')
        hint.style.fontSize = '10px'
        hint.style.color = '#888'
        hint.style.textAlign = 'center'
        hint.style.marginBottom = '5px'
        hint.textContent = showHistory ? '▲ 말풍선을 눌러 접기' : '▼ 말풍선을 눌러 이전 대화 보기'
        overlay.appendChild(hint)
      }
    }

    if (msg.from === 'user') {
      const fromLabel = document.createElement('div')
      fromLabel.style.fontSize = '12px'
      fromLabel.style.color = '#888'
      fromLabel.style.marginBottom = '4px'
      fromLabel.textContent = '나'
      b.appendChild(fromLabel)
    }

    const bubbleId = `${msg.sender}_${msg.time}`;

    const content = document.createElement('div')
    content.textContent = msg.text
    b.appendChild(content)

    if (msg.from === 'cat') {
      const actions = document.createElement('div')
      actions.className = 'bubble-actions'

      const agreeCount = window.agreeCounts ? (window.agreeCounts[bubbleId] || 0) : 0;
      const agree = document.createElement('button')

      if (window.myAgrees && window.myAgrees.includes(bubbleId)) {
        agree.textContent = `인정됨 (${agreeCount})`;
        agree.disabled = true;
        agree.style.opacity = '0.5';
      } else {
        agree.textContent = `인정 (${agreeCount})`;
        agree.onclick = (e) => { e.stopPropagation(); handleAgreeBubble(bubbleId, msg, catEl); };
      }

      const reject = document.createElement('button')
      reject.textContent = '인정 X'
      reject.onclick = (e) => { e.stopPropagation(); handleReject(catEl) }

      const showRebut = document.createElement('button')
      showRebut.textContent = '내 생각엔...'
      showRebut.onclick = (e) => { e.stopPropagation(); toggleRebutInput(b, catEl) }

      actions.appendChild(agree)
      actions.appendChild(reject)
      actions.appendChild(showRebut)
      b.appendChild(actions)
    }

    overlay.appendChild(b)
  })
  // Add a close button to overlay (recreate if necessary)
  let closeBtn = overlay.querySelector('.overlay-close')
  if (!closeBtn) {
    closeBtn = document.createElement('button')
    closeBtn.className = 'overlay-close'
    closeBtn.setAttribute('aria-label', '닫기')
    closeBtn.textContent = '×'
    closeBtn.onclick = (ev) => {
      ev.stopPropagation()
      // collapse the cat and remove overlay
      catEl.classList.remove('expanded')
      catEl._showHistory = false
      renderCatBubbles(catEl)
    }
    overlay.appendChild(closeBtn)
  }

  // Position overlay near the cat within viewport bounds using requestAnimationFrame
  const positionOverlay = () => {
    const rect = catEl.getBoundingClientRect()
    const vw = window.innerWidth
    const overlayWidth = Math.min(320, vw - 20)
    overlay.style.width = overlayWidth + 'px'

    const preferTop = rect.top > window.innerHeight / 3

    // make sure overlay has rendered size
    const oh = overlay.offsetHeight || 0

    const left = Math.min(Math.max(10, rect.left + rect.width / 2 - overlayWidth / 2), vw - overlayWidth - 10)

    if (preferTop) {
      // place above if space
      const top = Math.max(10, rect.top - oh - 12)
      overlay.style.left = left + 'px'
      overlay.style.top = top + 'px'
    } else {
      // place below
      const top = Math.min(window.innerHeight - 10 - oh, rect.bottom + 8)
      overlay.style.left = left + 'px'
      overlay.style.top = top + 'px'
    }

    // Ensure overlay scroll. If history is shown just now, scroll to top? Or keep it at bottom?
    if (showHistory) {
      // Just keep scroll or let them scroll. Let's make it scroll to top so they see history.
      overlay.scrollTop = 0
    } else {
      overlay.scrollTop = overlay.scrollHeight
    }
  }

  // Schedule two frames to allow layout to stabilize (safer on some browsers)
  requestAnimationFrame(() => requestAnimationFrame(positionOverlay))
}

function handleAgreeBubble(bubbleId, msg, catEl) {
  if (!window.myAgrees) window.myAgrees = [];
  if (window.myAgrees.includes(bubbleId)) return;
  window.myAgrees.push(bubbleId);

  if (window.debateInfo) {
    window.myMessages = window.myMessages || [];
    window.saveMyPayload();
  } else {
    // Demo fallback
    adopted.push({ id: bubbleId, text: msg.text, sender: msg.sender });
    updateAdoptList();
  }

  catEl.querySelector('img').src = CAT_IMAGES.HAPPY;
  setTimeout(() => {
    catEl.querySelector('img').src = CAT_IMAGES.NEUTRAL;
  }, 1500);

  renderCatBubbles(catEl);
}

function handleReject(catEl) {
  showHurtEffect(catEl)
  catEl.classList.remove('expanded')
  renderCatBubbles(catEl)
}

// Main character count
userInput.addEventListener('input', () => {
  if (userInput.value.length > 30) {
    userInput.value = userInput.value.slice(0, 30)
  }
  document.getElementById('charCount').textContent = `${userInput.value.length}/30`
})

function toggleRebutInput(bubbleEl, catEl) {
  let existing = bubbleEl.querySelector('.bubble-rebut-input')
  if (existing) {
    existing.remove()
    return
  }

  const wrap = document.createElement('div')
  wrap.className = 'bubble-rebut-input'

  const textarea = document.createElement('textarea')
  textarea.placeholder = '어떤 부분이 틀렸나요? (30자 이내)'
  textarea.maxLength = 30

  const counter = document.createElement('div')
  counter.style.fontSize = '10px'
  counter.style.color = '#888'
  counter.style.textAlign = 'right'
  counter.textContent = '0/30'

  textarea.addEventListener('input', () => {
    if (textarea.value.length > 30) {
      textarea.value = textarea.value.slice(0, 30)
    }
    counter.textContent = `${textarea.value.length}/30`
  })

  const send = document.createElement('button')
  send.textContent = '보내기'
  send.onclick = (e) => {
    e.stopPropagation()
    const nyanVal = toNyanSpeak(textarea.value.trim());
    if (!nyanVal) return
    const id = catEl.dataset.id

    // Save to my global messages payload
    if (window.debateInfo) {
      let targetID = id === 'user' ? window.debateInfo.nickname : id;
      window.myMessages.push({ target: targetID, text: nyanVal, time: Date.now() });
      window.saveMyPayload();
      threads[id].push({ from: 'user', text: nyanVal, time: Date.now() });
    } else {
      threads[id].push({ from: 'user', text: nyanVal, time: Date.now() })
    }

    catEl._showHistory = true
    renderCatBubbles(catEl)
  }

  wrap.appendChild(textarea)
  wrap.appendChild(counter)
  wrap.appendChild(send)
  bubbleEl.appendChild(wrap)
  textarea.focus()
}

sendBtn.addEventListener('click', () => {
  const v = toNyanSpeak(userInput.value.trim());
  if (!v) return

  const userCat = document.querySelector('.cat[data-id="user"]');
  if (userCat) {
    if (window.debateInfo) {
      window.myMessages.push({ target: window.debateInfo.nickname, text: v, time: Date.now() });
      window.saveMyPayload();
      if (!threads['user']) threads['user'] = [];
      threads['user'].push({ from: 'user', text: v, time: Date.now() });
      renderCatBubbles(userCat);
    } else {
      if (!threads['user']) threads['user'] = [];
      threads['user'].push({ from: 'user', text: v, time: Date.now() });
      renderCatBubbles(userCat);
    }
  }

  userInput.value = ''
  document.getElementById('charCount').textContent = '0/30'
})

function updateAdoptList() {
  const adoptList = document.getElementById('adoptList')
  if (!adoptList) return
  if (adopted.length === 0) { adoptList.textContent = '아직 없습니다.'; return }
  adoptList.innerHTML = ''
  adopted.forEach(item => {
    const localTarget = item.sender === window.debateInfo?.nickname ? 'user' : item.sender;
    const thread = threads[localTarget] || []
    const d = document.createElement('div')
    d.className = 'adopted-item'

    const header = document.createElement('div')
    header.style.cursor = 'pointer'
    header.style.display = 'flex'
    header.style.alignItems = 'center'
    header.innerHTML = `
      <img src="${CAT_IMAGES.HAPPY}">
      <div class="adopted-text" style="flex:1;">${item.text}</div>
      <div class="toggle-icon" style="font-size:12px; color:var(--point-color); font-weight:bold; margin-left:5px;">▼</div>
    `

    const historyBox = document.createElement('div')
    historyBox.className = 'history-box hidden'
    historyBox.style.marginTop = '10px'
    historyBox.style.paddingTop = '10px'
    historyBox.style.borderTop = '1px dashed #ccc'

    // Filter to only show messages BEFORE the agree?
    // Actually just show all thread messages.
    historyBox.innerHTML = thread.map(m => `
      <div class="bubble" style="margin-bottom:8px; align-self: ${m.from === 'user' ? 'flex-end' : 'flex-start'}; width:100%; text-align:left; transform:none; opacity:1;">
        ${m.from === 'user' ? '<strong style="display:block; font-size:11px; color:#888; margin-bottom:2px;">나</strong>' : ''}
        ${m.text}
      </div>
    `).join('')

    header.onclick = (e) => {
      e.stopPropagation()
      historyBox.classList.toggle('hidden')
      const isOpen = !historyBox.classList.contains('hidden')
      header.querySelector('.toggle-icon').textContent = isOpen ? '▲' : '▼'
    }

    d.appendChild(header)
    d.appendChild(historyBox)
    adoptList.appendChild(d)
  })
}

function showHistory(id, event) {
  const modal = document.getElementById('historyModal')
  const list = document.getElementById('historyList')
}

// Initial state for all cats
document.querySelectorAll('.cat').forEach(cat => {
  const id = cat.dataset.id
  if (id === 'user') return; // don't populate dummy for user
  if (!threads[id]) {
    threads[id] = [{ from: 'cat', text: toNyanSpeak(cat.dataset.text || ''), time: Date.now() }]
  }
  renderCatBubbles(cat)
})


userInput.addEventListener('keydown', e => {
  if (e.isComposing) return // Fixes Korean IME duplicate event
  if (e.key === 'Enter') sendBtn.click()
})

// Close expanded cats when clicking outside a cat or its overlay
document.addEventListener('click', (e) => {
  // If click is inside a .cat or inside any bubble-stack-overlay, do nothing
  if (e.target.closest('.cat')) return
  if (e.target.closest('.bubble-stack-overlay')) return

  // Otherwise collapse any expanded cats and remove overlays
  document.querySelectorAll('.cat.expanded').forEach(cat => {
    cat.classList.remove('expanded')
    cat._showHistory = false
    renderCatBubbles(cat)
  })
})

// --- Simulation Game Logic ---
const simScript = [
  { id: 'start', speaker: '', text: '냐...(저기...)', onEnter: (ui) => ui.hideChar() },
  { id: 's2', speaker: '할머니', text: '냐, 냐냐...?(나 좀 도와줄 수 있는가...?)', onEnter: (ui) => ui.showChar() },
  { id: 's3', speaker: '할머니', text: '냐냐냥... 냐냐...(내가 글을 잘 몰라가지고.. 손주를 도와줄 수가 없네...)' },
  {
    id: 'choice1', speaker: '할머니', text: '냐냐냥... 냐냐...(내가 글을 잘 몰라가지고.. 손주를 도와줄 수가 없네...)',
    choices: [
      { text: '도와준다', next: 'help1' },
      { text: '거절한다', next: 'reject1' }
    ]
  },

  // 도와준다 path
  { id: 'help1', speaker: '나', text: '네!' },
  { id: 'help2', speaker: '할머니', text: '냐...(저기, 글이 많이 올라가면 좋다는데.. 할미가 글도 틀리고 그러면 애가 부끄럽잖아...)(쪽지를 내민다)', next: 'open_note' },

  // 거절한다 path
  { id: 'reject1', speaker: '나', text: '...제가 왜요?' },
  { id: 'reject2', speaker: '할머니', text: '냐냐........냐?(저기, 글이 많이 올라가면 좋다는데.. 할미가 글도 틀리고 그러면 애가 부끄럽잖아... 한 번 읽어만 봐줄 수 있을까?)(쪽지를 내민다)', next: 'open_note' },

  // Note interaction
  { id: 'open_note', speaker: '', text: '(쪽지가 펼쳐진다)', onEnter: (ui) => ui.showNote() },
  {
    id: 'choice2', speaker: '', text: '(쪽지 내용을 읽었다)',
    choices: [
      { text: '할머니를 돕는다', next: 'help_construct' },
      { text: '내 갈 길을 간다', next: 'go_my_way' }
    ]
  },

  // 할머니를 돕는다
  { id: 'help_construct', speaker: '나', text: '틀린 부분이 있네. 맞춤법을 고쳐서 올려드려야겠다!' }, // don't hide note yet
  { id: 'help_construct2', speaker: '할머니', text: '냐냐냥... 냐냐...(정말 고마워... 학생 없었으면 큰일날 뻔 했어. 애가 아주 좋아할 거여.)' },
  { id: 'typing_phase', speaker: '', text: '(할머니의 쪽지를 올바른 맞춤법으로 고쳐 적자.)', onEnter: (ui) => ui.showTypeUI() },

  // 내 갈 길을 간다
  { id: 'go_my_way', speaker: '나', text: '아 귀찮게... 가세요. 자기 일은 자기가 알아서 해야지...', onEnter: (ui) => ui.hideNote() },
  { id: 'go_my_way2', speaker: '할머니', text: '냐냐냥..... 냥냥.(내가 잘 몰라서.. 미안혀... 조심히 가요.)' },
  { id: 'drop_note', speaker: '', text: '(쪽지가 바닥에 떨어진다)', onEnter: (ui) => ui.dropNote(), next: 'choice3' },

  {
    id: 'choice3', speaker: '', text: '(바닥에 떨어진 쪽지)',
    choices: [
      { text: '그냥 간다', next: 'just_go' },
      { text: '쪽지를 줍는다', next: 'pickup_note' }
    ]
  },

  // 그냥 간다
  { id: 'just_go', speaker: '나', text: '(할머니를 뒤로하고 길을 나선다.)' },
  { id: 'just_go_end', speaker: '', text: '...', onEnter: (ui) => { ui.endSim(); ui.showFinalButton(); } },

  // 쪽지를 줍는다
  { id: 'pickup_note', speaker: '나', text: '......' },
  { id: 'pickup_note2', speaker: '', text: '(쪽지를 펼친다........)', onEnter: (ui) => ui.showNote(), next: 'typing_phase' }
];

let currentSimStep = 0;

const simModal = document.getElementById('simModal');
const simSpeaker = document.getElementById('simSpeaker');
const simText = document.getElementById('simText');
const simChoices = document.getElementById('simChoices');
const simCharacter = document.getElementById('simCharacter');
const simNote = document.getElementById('simNote');
const simFinalBtn = document.getElementById('simFinalBtn');
const simUi = document.querySelector('.sim-ui');
const simNextIndicator = document.getElementById('simNextIndicator');

const uiController = {
  showChar: () => simCharacter.classList.remove('hidden'),
  hideChar: () => simCharacter.classList.add('hidden'),
  showNote: () => {
    simNote.classList.remove('hidden');
    simNote.classList.remove('dropped');
    // slight delay to allow display flex/block to apply before animating opacity
    setTimeout(() => simNote.classList.add('show'), 10);
  },
  hideNote: () => {
    simNote.classList.remove('show');
    setTimeout(() => simNote.classList.add('hidden'), 400);
  },
  dropNote: () => {
    simNote.classList.remove('hidden');
    simNote.classList.remove('show');
    setTimeout(() => simNote.classList.add('dropped'), 10);
  },
  showFinalButton: () => {
    simFinalBtn.classList.remove('hidden');
    simNextIndicator.classList.add('hidden');
    simUi.classList.add('hidden'); // hide dialogue when final button shows
  },
  showTypeUI: () => {
    document.getElementById('simTypeUI').classList.remove('hidden');
    simUi.classList.add('hidden'); // hide dialogue while typing
  },
  endSim: () => {
    simModal.classList.add('hidden');
  }
};

function runSimStep(index) {
  const step = typeof index === 'string' ? simScript.find(s => s.id === index) : simScript[index];
  if (!step) {
    uiController.endSim();
    return;
  }
  currentSimStep = simScript.indexOf(step);

  simSpeaker.textContent = step.speaker;
  simText.textContent = step.text;

  if (step.onEnter) step.onEnter(uiController);

  if (step.choices) {
    simChoices.innerHTML = '';
    simChoices.classList.remove('hidden');
    simNextIndicator.classList.add('hidden');

    step.choices.forEach(c => {
      const btn = document.createElement('button');
      btn.textContent = c.text;
      btn.style.pointerEvents = 'auto'; // ensure it's clickable
      btn.onclick = (e) => {
        e.stopPropagation();
        simChoices.classList.add('hidden');
        simNextIndicator.classList.remove('hidden');
        runSimStep(c.next);
      };
      simChoices.appendChild(btn);
    });
  } else {
    simChoices.classList.add('hidden');
    simNextIndicator.classList.remove('hidden');
  }
}

if (simUi) {
  simUi.addEventListener('click', () => {
    if (!simChoices.classList.contains('hidden')) return;
    if (!simFinalBtn.classList.contains('hidden')) return;

    const step = simScript[currentSimStep];
    if (step && step.next) {
      runSimStep(step.next);
    } else if (currentSimStep < simScript.length - 1) {
      runSimStep(currentSimStep + 1);
    }
  });
}

const simToggleBtn = document.getElementById('simToggleBtn');
if (simToggleBtn) {
  simToggleBtn.addEventListener('click', () => {
    let bestMsgText = '아직 상대방의 의견이 엄슴미다.';
    if (window.agreeCounts && Object.keys(window.agreeCounts).length > 0) {
      const mySide = window.debateInfo ? window.debateInfo.side : 'pro';
      const oppositeSide = mySide === 'pro' ? 'con' : 'pro';
      const oppositeMessages = window.allMessages ? window.allMessages.filter(m => m.side === oppositeSide) : [];
      let maxAgrees = 0;
      let bestMsg = null;
      oppositeMessages.forEach(m => {
        const id = `${m.sender}_${m.time}`;
        const count = window.agreeCounts[id] || 0;
        if (count >= maxAgrees && count > 0) {
          maxAgrees = count;
          bestMsg = m;
        }
      });
      if (bestMsg) bestMsgText = bestMsg.text;
    }

    function distort(t) {
      t = t.replace(/\.{3}냥/g, '').replace(/냥/g, '');
      return t
        .replace(/습니다/g, '슴미다')
        .replace(/입니다/g, '임미당')
        .replace(/합니다/g, '함미다')
        .replace(/요/g, '염')
        .replace(/의 /g, '에 ')
        .replace(/것/g, '거')
        .replace(/는/g, '능')
        .replace(/를/g, '룰')
        .replace(/은/g, '응')
        .replace(/다([.?!])/g, '당$1')
        .replace(/다$/g, '당')
        .replace(/없/g, '업')
        .replace(/있/g, '잇')
        .replace(/많/g, '만')
        .replace(/않/g, '안')
        .replace(/생각/g, '셍각');
    }

    const distortedText = distort(bestMsgText);
    simNote.innerHTML = `<b>쪽지</b><br><br>${distortedText}`;

    simModal.classList.remove('hidden');
    simNote.classList.remove('show', 'dropped');
    simNote.classList.add('hidden');
    simCharacter.classList.add('hidden');
    simFinalBtn.classList.add('hidden');
    document.getElementById('simTypeUI').classList.add('hidden');
    simUi.classList.remove('hidden');
    document.getElementById('simTypeInput').value = '';
    document.getElementById('simTypeCount').textContent = '0/100';
    simNextIndicator.classList.remove('hidden');
    runSimStep(0);
  });
}

if (simFinalBtn) {
  simFinalBtn.addEventListener('click', () => {
    let finalArgument = '';
    const simTypeInput = document.getElementById('simTypeInput');
    if (simTypeInput && simTypeInput.value.trim() !== '') {
      finalArgument = simTypeInput.value.trim();
    } else {
      // Default argument if user skipped typing
      finalArgument = '쪽지에 적힌 내용을 바탕으로 입론합니다. 동물의 권리는 보장되어야 하므로 동물원에 반대합니다!';
    }

    const userCat = document.querySelector('.cat[data-id="user"]');
    if (userCat) {
      if (window.debateInfo) {
        window.myMessages.push({ target: window.debateInfo.nickname, text: finalArgument, time: Date.now() });
        window.saveMyPayload();
        if (!threads['user']) threads['user'] = [];
        threads['user'].push({ from: 'user', text: finalArgument, time: Date.now() });
        renderCatBubbles(userCat);
      } else {
        if (!threads['user']) threads['user'] = [];
        threads['user'].push({ from: 'user', text: finalArgument, time: Date.now() });
        renderCatBubbles(userCat);
      }
    }

    simModal.classList.add('hidden');
    // Here we can trigger the next phase of the debate eventually.
  });
}

// ------ Typing UI Events ------
const simTypeUI = document.getElementById('simTypeUI');
const simTypeInput = document.getElementById('simTypeInput');
const simTypeCount = document.getElementById('simTypeCount');
const simTypeSubmitBtn = document.getElementById('simTypeSubmitBtn');

if (simTypeInput) {
  simTypeInput.addEventListener('input', () => {
    if (simTypeInput.value.length > 100) simTypeInput.value = simTypeInput.value.slice(0, 100);
    simTypeCount.textContent = `${simTypeInput.value.length}/100`;
  });
}

if (simTypeSubmitBtn) {
  simTypeSubmitBtn.addEventListener('click', () => {
    if (simTypeInput.value.trim() === '') return;
    simTypeUI.classList.add('hidden');
    uiController.hideNote();
    uiController.showFinalButton();
  });
}


