const cushions = ['저기..', '혹시..', '그런데..', '솔직히..']
const yard = document.getElementById('yard')
const catsWrap = document.getElementById('cats')
const adoptList = document.getElementById('adoptList')
const sendBtn = document.getElementById('sendBtn')
const userInput = document.getElementById('userInput')

let adopted = []
const threads = {}

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
  if (!showHistory && thread.length > 1) {
    const viewMoreBtn = document.createElement('button')
    viewMoreBtn.className = 'view-more-btn'
    viewMoreBtn.textContent = '자세히 보기'
    viewMoreBtn.style.padding = '5px 10px'
    viewMoreBtn.style.marginBottom = '10px'
    viewMoreBtn.style.border = '2px dashed var(--border-color)'
    viewMoreBtn.style.background = '#fff'
    viewMoreBtn.style.color = 'var(--border-color)'
    viewMoreBtn.style.cursor = 'pointer'
    viewMoreBtn.style.fontFamily = 'inherit'
    viewMoreBtn.style.fontWeight = 'bold'
    viewMoreBtn.onclick = () => {
      catEl._showHistory = true
      renderCatBubbles(catEl)
    }
    overlay.appendChild(viewMoreBtn)
  }

  const msgsToShow = showHistory ? thread : [thread[thread.length - 1]]

  msgsToShow.forEach((msg) => {
    const isLastMsg = (msg === thread[thread.length - 1])
    const b = document.createElement('div')
    b.className = `bubble ${msg.from}`
    b.style.opacity = '1'
    b.style.transform = 'scale(1)'

    const fromLabel = document.createElement('div')
    fromLabel.style.fontSize = '12px'
    fromLabel.style.color = '#888'
    fromLabel.style.marginBottom = '4px'
    fromLabel.textContent = msg.from === 'user' ? '나' : '냥이'
    b.appendChild(fromLabel)

    const content = document.createElement('div')
    content.textContent = msg.text
    b.appendChild(content)

    if (msg.from === 'cat' && isLastMsg) {
      const actions = document.createElement('div')
      actions.className = 'bubble-actions'

      const agree = document.createElement('button')
      agree.textContent = '인정'
      agree.onclick = () => handleAgree(catEl)

      const reject = document.createElement('button')
      reject.textContent = '인정 X'
      reject.onclick = () => handleReject(catEl)

      const showRebut = document.createElement('button')
      showRebut.textContent = '내 생각엔...'
      showRebut.onclick = () => toggleRebutInput(b, catEl)

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

    // Ensure overlay scroll shows latest
    overlay.scrollTop = overlay.scrollHeight
  }

  // Schedule two frames to allow layout to stabilize (safer on some browsers)
  requestAnimationFrame(() => requestAnimationFrame(positionOverlay))
}

function handleAgree(catEl) {
  const id = catEl.dataset.id
  // Prevent adding the same cat multiple times
  if (adopted.some(a => a.id === id)) return

  catEl.querySelector('img').src = CAT_IMAGES.HAPPY
  catEl.classList.add('fade-out')
  adopted.push({ id, text: threads[id][0].text })
  updateAdoptList()
  setTimeout(() => {
    // Remove any floating overlay tied to this cat
    if (catEl._bubbleOverlay) {
      catEl._bubbleOverlay.remove()
      catEl._bubbleOverlay = null
    }
    catEl.remove()
  }, 700)
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
  send.onclick = () => {
    const val = textarea.value.trim()
    if (!val) return
    const id = catEl.dataset.id
    threads[id].push({ from: 'user', text: val, time: Date.now() })

    catEl._showHistory = true
    renderCatBubbles(catEl)

    setTimeout(() => {
      const responses = ['그렇지는 않다', '그건 오해다', '사실이 아니다', '내 생각은 다르다']
      threads[id].push({ from: 'cat', text: toNyanSpeak(pick(responses)), time: Date.now() })
      renderCatBubbles(catEl)
      catEl.style.transition = 'all 0.5s ease-out'
      catEl.style.transform = 'scale(1.2)'
      setTimeout(() => catEl.style.transform = 'scale(1)', 1000)
    }, 1000)
  }

  wrap.appendChild(textarea)
  wrap.appendChild(counter)
  wrap.appendChild(send)
  bubbleEl.appendChild(wrap)
  textarea.focus()
}

sendBtn.addEventListener('click', () => {
  const v = userInput.value.trim()
  if (!v) return

  const container = document.getElementById('userArguments')
  const el = document.createElement('div')
  el.className = 'user-bubble'
  el.textContent = v

  // Prepend to keep latest at the top
  container.prepend(el)
  container.scrollTop = 0

  userInput.value = ''
  document.getElementById('charCount').textContent = '0/30'
})

function updateAdoptList() {
  const adoptList = document.getElementById('adoptList')
  if (!adoptList) return
  if (adopted.length === 0) { adoptList.textContent = '아직 없습니다.'; return }
  adoptList.innerHTML = ''
  adopted.forEach(item => {
    const d = document.createElement('div')
    d.className = 'adopted-item'
    d.style.cursor = 'pointer'
    d.innerHTML = `
      <img src="${CAT_IMAGES.HAPPY}">
      <div class="adopted-text">${item.text}</div>
    `
    d.onclick = (e) => {
      e.stopPropagation()
      showHistory(item.id, e)
    }
    adoptList.appendChild(d)
  })
}

function showHistory(id, event) {
  const modal = document.getElementById('historyModal')
  const list = document.getElementById('historyList')
  const card = modal.querySelector('.history-card')
  const thread = threads[id] || []

  if (thread.length === 0) return

  // Create bubbles
  list.innerHTML = thread.map(m => `
    <div class="bubble" style="opacity:1; transform:scale(1); pointer-events:none; align-self: ${m.from === 'user' ? 'flex-end' : 'flex-start'};">
      <strong style="display:block; font-size:11px; color:#888; margin-bottom:4px; text-align:left;">${m.from === 'user' ? '나' : '냥이'}</strong>
      ${m.text}
    </div>
  `).join('')

  modal.classList.remove('hidden')

  // Position the card near the clicked item but clamp inside the viewport
  const rect = event.currentTarget.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  card.style.position = 'fixed'
  card.style.bottom = 'auto'

  // Mobile / narrow screens: make the card full-width-ish and place below the item
  if (vw <= 700) {
    card.style.left = '10px'
    card.style.right = '10px'
    card.style.width = 'auto'
    const top = Math.min(Math.max(10, rect.top - 20), vh - 120)
    card.style.top = top + 'px'
    return
  }

  // Desktop: try to place to the left of the clicked element; otherwise center above it
  // Ensure card has a measured width
  const cardWidth = card.offsetWidth || Math.min(360, vw - 40)
  let left = rect.left - cardWidth - 12
  if (left < 12) {
    // place centered above the item
    left = rect.left + rect.width / 2 - cardWidth / 2
  }
  left = Math.min(Math.max(12, left), vw - cardWidth - 12)
  card.style.left = left + 'px'
  card.style.right = 'auto'

  // Clamp top so card stays visible
  const top = Math.min(Math.max(10, rect.top - 40), vh - (card.offsetHeight || 200) - 12)
  card.style.top = (isNaN(top) ? 20 : top) + 'px'
}

document.getElementById('historyClose').onclick = () => {
  document.getElementById('historyModal').classList.add('hidden')
}

// Initial state for all cats
document.querySelectorAll('.cat').forEach(cat => {
  const id = cat.dataset.id
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



