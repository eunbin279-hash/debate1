const yard = document.getElementById('yard')
const catsWrap = document.getElementById('cats')

// Character click input logic - Updated to allow talking to anyone
catsWrap.addEventListener('click', e => {
  const cat = e.target.closest('.cat');
  if (!cat) return;

  const targetId = cat.dataset.id; // 'user' or the other user's nickname
  const realTargetName = targetId === 'user' ? (window.debateInfo ? window.debateInfo.nickname : '나') : targetId;

  // Prevent multiple inputs
  if (cat.querySelector('.inline-input-wrap')) return;

  // Hide bubbles temporarily
  const bubbleStack = cat.querySelector('.bubble-stack');
  if (bubbleStack) bubbleStack.style.display = 'none';

  const inputWrap = document.createElement('div');
  inputWrap.className = 'inline-input-wrap';
  inputWrap.style.position = 'absolute';
  inputWrap.style.bottom = '110%';
  inputWrap.style.left = '50%';
  inputWrap.style.transform = 'translateX(-50%)';
  inputWrap.style.zIndex = '500';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = targetId === 'user' ? '모두에게 외치기...' : `${targetId}에게 한마디...`;
  input.className = 'cat-inline-input';
  input.maxLength = 30;

  inputWrap.appendChild(input);
  cat.appendChild(inputWrap);
  input.focus();

  const removeInput = () => {
    inputWrap.remove();
    if (bubbleStack) bubbleStack.style.display = 'flex';
  };

  const handleSubmit = () => {
    const val = input.value.trim();
    if (val && window.debateInfo) {
      // Replaced nyanVal with direct val
      window.myMessages.push({
        target: realTargetName,
        text: val,
        time: Date.now()
      });
      window.saveMyPayload();

      // Update local thread immediately for responsiveness
      const localKey = targetId;
      if (!threads[localKey]) threads[localKey] = [];
      threads[localKey].push({ from: 'user', text: val, time: Date.now(), sender: window.debateInfo.nickname });
      renderCatBubbles(cat);
    }
    removeInput();
  };

  input.addEventListener('keydown', e => {
    if (e.isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      handleSubmit();
    } else if (e.key === 'Escape') {
      removeInput();
    }
  });

  input.addEventListener('blur', (e) => {
    // Small delay to allow enter key to register
    setTimeout(removeInput, 100);
  });
});

let adopted = []
const threads = {}
window.debateInfo = null;
window.myBoardLikes = [];
window.myBoardComments = [];
window.allBoardPosts = [];

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

    // Set dynamic title from info
    const titleEl = document.querySelector('.top h1');
    if (titleEl && info.title) titleEl.textContent = `[ ${info.title} ]`;

    window.myMessages = [];
    window.myAgrees = [];
    window.myBoardPosts = [];
    window.myBoardLikes = [];
    window.myBoardComments = [];
    window.saveMyPayload = () => {
      if (!window.debateInfo || window.debateInfo.status !== 'active') {
        if (window.debateInfo?.status === 'pending') {
          console.warn('[DebateCore] 토론이 대기 중(pending)이라 실시간 저장은 비활성화되었습니다. 테스트를 위해 ?demo=true를 사용해보세요.');
        }
        return;
      }
      window.debateInfo.savePayload({
        messages: window.myMessages || [],
        agrees: window.myAgrees || [],
        side: window.debateInfo.side || 'unassigned',
        boardPosts: window.myBoardPosts || [],
        boardLikes: window.myBoardLikes || [],
        boardComments: window.myBoardComments || []
      }).catch(err => console.error('Payload save error:', err));
    };

    // Only attempt initial save if active
    if (info.status === 'active') {
      window.saveMyPayload();
    }

    // Create and setup bulletin board UI
    // This is done only once when the app is ready
    if (!document.getElementById('bulletin-board')) {
      setupBulletinBoardUI(info);
    }

    window.saveMyPayload();

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
      let allBoardLikes = [];
      let allBoardComments = [];
      window.allBoardPosts = [];
      Object.keys(payloads).forEach(nick => {
        const data = payloads[nick];

        if (nick === info.nickname) {
          window.myMessages = data.messages || [];
          window.myAgrees = data.agrees || [];
          window.myBoardPosts = data.boardPosts || [];
          window.myBoardLikes = data.boardLikes || [];
          window.myBoardComments = data.boardComments || [];
        }

        if (data && data.messages && Array.isArray(data.messages)) {
          data.messages.forEach(m => allMessages.push({ ...m, sender: nick, side: data.side }));
        }
        if (data && data.agrees && Array.isArray(data.agrees)) {
          data.agrees.forEach(id => {
            agreeCounts[id] = (agreeCounts[id] || 0) + 1;
          });
        }
        if (data && data.boardPosts && Array.isArray(data.boardPosts)) {
          data.boardPosts.forEach(p => window.allBoardPosts.push({ ...p, id: `${p.author}_${p.time}`, side: data.side }));
        }
        if (data && data.boardLikes && Array.isArray(data.boardLikes)) {
          allBoardLikes.push(...data.boardLikes);
        }
        if (data && data.boardComments && Array.isArray(data.boardComments)) {
          allBoardComments.push(...data.boardComments);
        }
      });
      window.agreeCounts = agreeCounts;
      window.allMessages = allMessages;

      // Process likes and comments for the bulletin board
      const boardLikeCounts = allBoardLikes.reduce((acc, postId) => {
        acc[postId] = (acc[postId] || 0) + 1;
        return acc;
      }, {});
      window.boardLikeCounts = boardLikeCounts;

      const boardCommentsByPost = allBoardComments.reduce((acc, comment) => {
        if (!acc[comment.postId]) {
          acc[comment.postId] = [];
        }
        acc[comment.postId].push(comment);
        return acc;
      }, {});
      window.boardCommentsByPost = boardCommentsByPost;

      // Find most liked OPPONENT post for simulation
      let mostLikedOpponentPostId = null;
      let maxOpLikes = -1;
      const mySide = info.side || 'unassigned';
      window.allBoardPosts.forEach(p => {
        if (p.side !== mySide) {
          const likes = boardLikeCounts[p.id] || 0;
          if (likes > maxOpLikes) {
            maxOpLikes = likes;
            mostLikedOpponentPostId = p.id;
          }
        }
      });
      window.mostLikedOpponentPostId = mostLikedOpponentPostId;

      allMessages.sort((a, b) => a.time - b.time);
      window.allBoardPosts.sort((a, b) => b.time - a.time); // Newest first

      renderBulletinBoard(window.allBoardPosts);

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

      // Render all cats (and create if missing)
      const MAX_CATS = 6;
      // Identify all other connected users from payloads, not just those who spoke
      const currentOtherUsers = Object.keys(payloads).filter(nick => nick !== info.nickname);
      const usersToRender = currentOtherUsers.slice(-MAX_CATS);

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
            <div class="nametag" style="position:absolute;bottom:-30px;left:50%;transform:translateX(-50%); white-space:nowrap;">${nick}</div>
            <img src="img/stickman_neutral.svg" alt="cat" class="cat-img">
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

const CAT_IMAGES = {
  NEUTRAL: 'img/stickman_neutral.svg',
  SAD: 'img/stickman_sad.svg',
  HAPPY: 'img/stickman_happy.svg'
}

function pick(arr) { return arr[Math.floor(Math.random() * arr.length)] }

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

function escapeHTML(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, function (match) {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[match];
  });
}


// 1. Create computer icon
function setupBulletinBoardUI(info) {
  const computerIcon = document.createElement('div');
  computerIcon.id = 'computer-icon';
  computerIcon.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="color: var(--primary);">
          <rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect>
          <line x1="8" y1="21" x2="16" y2="21"></line>
          <line x1="12" y1="17" x2="12" y2="21"></line>
      </svg>
      <span class="icon-label">[게시판 작성]</span>
  `;
  // Positioning is handled in style.css for #computer-icon
  yard.appendChild(computerIcon);

  // 2. Create bulletin board container
  const boardContainer = document.createElement('div');
  boardContainer.id = 'bulletin-board';
  boardContainer.className = 'sidebar-board'; // New class for consistent styling
  boardContainer.innerHTML = `
    <div class="sidebar-header">
      <h3>게시판</h3>
      <p>토론자들의 한줄평</p>
    </div>
    <div id="board-posts" class="adopt-list"></div>
  `;
  document.body.appendChild(boardContainer);

  // 3. Create post submission modal
  const postModal = document.createElement('div');
  postModal.id = 'post-modal';
  postModal.className = 'input-modal hidden';
  postModal.innerHTML = `
      <div class="input-overlay"></div>
      <div class="input-card">
          <h3 class="modal-title">게시판에 글쓰기</h3>
          <textarea id="post-textarea" placeholder="내용을 입력하세요..." maxlength="100"></textarea>
          <div class="input-actions">
              <button id="cancel-post-btn" class="btn btn-secondary">취소</button>
              <button id="submit-post-btn" class="btn btn-primary">업로드</button>
          </div>
      </div>
  `;
  document.body.appendChild(postModal);

  // Create wait modal (Clean countdown style)
  const waitModal = document.createElement('div');
  waitModal.id = 'wait-modal';
  waitModal.className = 'waiting-modal hidden';
  waitModal.innerHTML = `
      <div class="input-overlay"></div>
      <div class="waiting-card">
          <div class="spinner"></div>
          <h3 class="modal-title">서버 접속 중...</h3>
          <div id="wait-queue-info" style="margin: 20px 0;">
              <p class="waiting-text" style="font-size: 14px; margin-bottom: 4px;">현재 대기열에 있습니다.</p>
              <div style="font-size: 24px; font-weight: 800; color: var(--primary);">앞에 <span id="wait-count-num">4</span>명 대기 중</div>
          </div>
          <div id="wait-progress-container" style="width: 100%; background: var(--bg-main); border-radius: 10px; height: 6px; overflow: hidden;">
              <div id="wait-progress-bar" style="width: 0%; height: 100%; background: var(--primary); transition: width 4s linear;"></div>
          </div>
          <p id="wait-status-text" style="font-size: 12px; color: var(--text-muted); margin-top: 12px;">잠시만 기다려 주세요...</p>
      </div>
  `;
  document.body.appendChild(waitModal);

  // Expose simple waiting modal controls
  window.showWaiting = function (count) {
    const modal = document.getElementById('waitingModal')
    const cnt = document.getElementById('waitingCount')
    if (modal && cnt) {
      cnt.textContent = `${count}명`
      modal.classList.remove('hidden')
      modal.setAttribute('aria-hidden', 'false')
    }
  }

  window.hideWaiting = function () {
    const modal = document.getElementById('waitingModal')
    if (modal) {
      modal.classList.add('hidden')
      modal.setAttribute('aria-hidden', 'true')
    }
  }

  // 4. Add event listeners
  computerIcon.addEventListener('click', () => {
    const waitModal = document.getElementById('wait-modal');
    const progressBar = document.getElementById('wait-progress-bar');
    const waitStatusText = document.getElementById('wait-status-text');
    const countNum = document.getElementById('wait-count-num');

    let currentWait = 4;
    countNum.textContent = currentWait;

    progressBar.style.transition = 'none';
    progressBar.style.width = '0%';
    waitModal.classList.remove('hidden');

    void progressBar.offsetWidth;

    progressBar.style.transition = 'width 3.5s linear';
    progressBar.style.width = '100%';

    // Countdown logic
    const interval = setInterval(() => {
      currentWait--;
      if (currentWait >= 0) {
        countNum.textContent = currentWait;
      }
      if (currentWait === 0) {
        clearInterval(interval);
        setTimeout(() => {
          waitModal.classList.add('hidden');
          const postModal = document.getElementById('post-modal');
          if (postModal) {
            postModal.classList.remove('hidden');
            const cancelBtn = document.getElementById('cancel-post-btn');
            if (cancelBtn) cancelBtn.style.display = 'block'; // Ensure cancel is visible for normal board use
            document.getElementById('post-textarea').focus();
          }
        }, 500);
      }
    }, 800);
  });

  document.getElementById('cancel-post-btn').addEventListener('click', () => postModal.classList.add('hidden'));
  postModal.addEventListener('click', (e) => { if (e.target.classList.contains('input-overlay')) postModal.classList.add('hidden'); });

  const boardPostsContainer = document.getElementById('board-posts');
  boardPostsContainer.addEventListener('click', e => {
    const likeBtn = e.target.closest('.like-btn');
    const commentSubmitBtn = e.target.closest('.comment-submit-btn');

    if (likeBtn) {
      const postId = likeBtn.dataset.postId;
      if (postId && !window.myBoardLikes.includes(postId)) {
        window.myBoardLikes.push(postId);
        window.saveMyPayload();
        likeBtn.classList.add('liked');
        const countEl = likeBtn.querySelector('span');
        countEl.textContent = parseInt(countEl.textContent, 10) + 1;
      }
    }

    if (commentSubmitBtn) {
      const postId = commentSubmitBtn.dataset.postId;
      const inputWrap = commentSubmitBtn.closest('.comment-input-wrap');
      const input = inputWrap.querySelector('.comment-input');
      const text = input.value.trim();

      if (postId && text) {
        const newComment = { postId, text, time: Date.now() };
        window.myBoardComments.push(newComment);
        window.saveMyPayload();
        const commentsList = input.closest('.comments-section').querySelector('.comments-list');
        const commentEl = document.createElement('div');
        commentEl.className = 'comment';
        commentEl.style.padding = '8px';
        commentEl.style.fontSize = '12px';
        commentEl.textContent = escapeHTML(text);
        commentsList.appendChild(commentEl);
        input.value = '';
      }
    }
  });

  document.getElementById('submit-post-btn').addEventListener('click', () => {
    const textarea = document.getElementById('post-textarea');
    const text = textarea.value.trim();
    if (text) {
      const newPost = { text: text, author: info.nickname, time: Date.now(), id: `${info.nickname}_${Date.now()}` };
      if (!window.myBoardPosts) window.myBoardPosts = [];
      window.myBoardPosts.push(newPost);
      window.saveMyPayload();
      window.allBoardPosts.unshift(newPost);
      renderBulletinBoard(window.allBoardPosts);
      textarea.value = '';
      postModal.classList.add('hidden');
    }
  });
}

function renderBulletinBoard(posts) {
  const postsContainer = document.getElementById('board-posts');
  if (!postsContainer) return;
  postsContainer.innerHTML = posts.length === 0 ? '<p style="color: var(--text-muted); padding: 20px; text-align: center;">아직 게시물이 없습니다.</p>' : '';

  posts.forEach(post => {
    const postEl = document.createElement('div');
    postEl.className = 'board-post';

    const postId = post.id;
    const likeCount = window.boardLikeCounts[postId] || 0;
    const comments = window.boardCommentsByPost[postId] || [];
    comments.sort((a, b) => a.time - b.time);

    const isLikedByMe = window.myBoardLikes.includes(postId);
    const postDate = new Date(post.time).toLocaleString('ko-KR', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    postEl.innerHTML = `
      <div style="font-size: 14px; font-weight: 700; color: var(--primary); margin-bottom: 4px;">${escapeHTML(post.author)}</div>
      <p style="margin-bottom: 12px; line-height: 1.5;">${escapeHTML(post.text)}</p>
      <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--border-ui); padding-top: 10px; margin-top: 10px;">
        <div class="like-btn ${isLikedByMe ? 'liked' : ''}" data-post-id="${postId}" style="cursor: pointer; font-size: 13px; color: ${isLikedByMe ? 'var(--primary)' : 'var(--text-muted)'};">
          ❤️ <span>${likeCount}</span>
        </div>
        <span style="font-size: 11px; color: var(--text-muted);">${postDate}</span>
      </div>
      <div class="comments-section" style="margin-top: 12px;">
        <div class="comments-list" style="display: flex; flex-direction: column; gap: 4px;">
          ${comments.map(c => `<div class="comment" style="padding: 6px 10px; font-size: 12px;">${escapeHTML(c.text)}</div>`).join('')}
        </div>
        <div class="comment-input-wrap" style="display: flex; gap: 4px; margin-top: 8px;">
          <input type="text" class="comment-input" placeholder="댓글 달기..." maxlength="50" style="flex: 1; font-size: 12px; border: 1px solid var(--border-ui); border-radius: 4px; padding: 4px 8px; outline: none;">
          <button class="comment-submit-btn" data-post-id="${postId}" style="background: var(--primary); color: #fff; border: none; border-radius: 4px; padding: 4px 8px; font-size: 12px; cursor: pointer;">등록</button>
        </div>
      </div>
    `;
    postsContainer.appendChild(postEl);
  });
}


function renderCatBubbles(catEl) {
  const id = catEl.dataset.id
  const thread = threads[id] || []
  const stack = catEl.querySelector('.bubble-stack')

  stack.innerHTML = ''
  if (thread.length === 0) {
    stack.style.display = 'none'
    return
  }
  stack.style.display = 'flex'

  const latest = thread[thread.length - 1]
  const b = document.createElement('div')
  b.className = 'bubble'

  const fromLabel = document.createElement('div')
  fromLabel.style.fontSize = '10px'
  fromLabel.style.fontWeight = '700'
  fromLabel.style.color = 'var(--primary)'
  fromLabel.style.marginBottom = '2px'
  fromLabel.textContent = (id === 'user' || latest.from === 'user') ? '나' : (latest.sender || '친구')
  b.appendChild(fromLabel)

  const content = document.createElement('div')
  content.textContent = latest ? getFirstSentence(latest.text) : ''
  b.appendChild(content)

  stack.appendChild(b)
}


function updateAdoptList() {
  const list = document.getElementById('adoptList');
  if (!list) return;
  if (adopted.length === 0) {
    list.innerHTML = '<p style="color: var(--text-muted); font-size: 14px; text-align: center; padding: 20px;">아직 없습니다.</p>';
    return;
  }
  list.innerHTML = '';
  adopted.forEach(item => {
    const div = document.createElement('div');
    div.className = 'adopted-item';
    div.innerHTML = `
      <img src="img/stickman_happy.svg" style="width: 32px; height: 32px;">
      <div class="adopted-text">
        <strong>${escapeHTML(item.sender)}</strong>: ${escapeHTML(item.text)}
      </div>
    `;
    list.appendChild(div);
  });
}

// Removed initial demo state for cats
// Only render through payloads

// Crying/Struggling Grandma SVG
const GRANDMA_SVG = `
<svg width="240" height="320" viewBox="0 0 240 320" fill="none" xmlns="http://www.w3.org/2000/svg">
  <circle cx="120" cy="80" r="35" stroke="#3B82F6" stroke-width="6"/>
  <circle cx="120" cy="40" r="15" stroke="#3B82F6" stroke-width="6"/>
  <path d="M105 88C110 83 115 88 120 83C125 88 130 83 135 88" stroke="#3B82F6" stroke-width="3" stroke-linecap="round"/>
  <circle cx="100" cy="70" r="8" stroke="#3B82F6" stroke-width="3"/>
  <circle cx="140" cy="70" r="8" stroke="#3B82F6" stroke-width="3"/>
  <path d="M100 78V92" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
  <path d="M140 78V92" stroke="#3B82F6" stroke-width="2" stroke-linecap="round" opacity="0.7"/>
  <line x1="120" y1="115" x2="120" y2="240" stroke="#3B82F6" stroke-width="6" stroke-linecap="round"/>
  <path d="M120 135L80 170" stroke="#3B82F6" stroke-width="4" stroke-linecap="round"/>
  <path d="M120 135L160 170" stroke="#3B82F6" stroke-width="4" stroke-linecap="round"/>
  <line x1="120" y1="240" x2="80" y2="310" stroke="#3B82F6" stroke-width="6" stroke-linecap="round"/>
  <line x1="120" y1="240" x2="160" y2="310" stroke="#3B82F6" stroke-width="6" stroke-linecap="round"/>
</svg>`;

// Simulation Game Logic
let currentSimStep = 0;
const simulationData = [
  { text: "저기...", speaker: "???" },
  { text: "나 좀 도와줄 수 있는가...?", speaker: "할머니", showChar: true },
  {
    text: "손주가 과제를 놓고가서... 이걸 기계에 받아적기만 하면 된다고 했는데 참 어렵네. 내가 기계를 잘 몰라서...",
    speaker: "할머니",
    choices: [
      { text: "도와준다", nextId: "a1_reply" },
      { text: "거절한다", nextId: "a2_reply" }
    ]
  },
  { id: "a1_reply", text: "네! 그럼요", speaker: "나", nextId: "a1_hal" },
  { id: "a1_hal", text: "여기.. (쪽지를 내민다)", speaker: "할머니", nextId: "b" },
  { id: "a2_reply", text: "...제가 왜요?", speaker: "나", nextId: "a2_hal" },
  { id: "a2_hal", text: "손주가 부탁한 건데 한 번 보기만 해줄 수 있을까? 내가 기계를 잘 몰라.. (쪽지를 내민다)", speaker: "할머니", nextId: "b" },
  { id: "b", text: "(쪽지를 펼쳤다...)", speaker: "나", showNote: true },
  {
    text: "이게 손주 분의 과제인가보다. 게시판에 올려드리면 되겠지.",
    speaker: "나",
    choices: [
      { text: "할머니를 돕는다", nextId: "b1_reply" },
      { text: "내 갈 길을 간다", nextId: "b2_reply" }
    ]
  },
  { id: "b1_reply", text: "일단 내가 업로드 해드려야겠다!", speaker: "나", nextId: "b1_hal" },
  { id: "b1_hal", text: "정말 고마워... 학생 없었으면 큰일날 뻔 했어..", speaker: "할머니", nextId: "typing_intro" },
  { id: "b2_reply", text: "(아 귀찮아...) 가세요! 자기 할 일은 자기가 해야지...", speaker: "나", nextId: "b2_hal" },
  { id: "b2_hal", text: "내가 잘 몰라서... 미안혀. 조심히 가요...", speaker: "할머니", nextId: "drop" },
  {
    id: "drop", text: "(쪽지가 바닥에 떨어진다)", speaker: "나", hideChar: true, triggerEffect: "drop-lonely", choices: [
      { text: "그냥 간다", nextId: "end_bad" },
      { text: "쪽지를 줍는다", nextId: "pick_up_reply" }
    ]
  },
  { id: "end_bad", text: "할머니는 쓸쓸히 사라지셨다.", speaker: "나", isEnd: true, triggerEffect: "shake-red" },
  { id: "pick_up_reply", text: "(줍고 나니 왠지 마음이 무겁다...)", speaker: "나", isEnd: true, showNote: true },
  { id: "typing_intro", text: "나: 타닥 타닥.. (내용을 입력한다)", speaker: "나", runAutoType: true, showNote: true },
  { id: "typing_continue", text: "나: 계속 이어서 적어야겠다...!", speaker: "나", showNote: true, showFinal: true }
];

function startSimulation() {
  currentSimStep = 0;
  const container = document.getElementById('grandmaSvgContainer');
  const simChar = document.getElementById('simCharacter');
  const simModal = document.getElementById('simModal');
  const simUI = document.querySelector('.sim-ui');
  const simOverlay = document.querySelector('.sim-overlay');
  const postModal = document.getElementById('post-modal');
  const simNote = document.getElementById('simNote');
  const lonelyFx = document.querySelector('.sim-lonely-fx');

  // 1. Reset Visibility & States with Safety Checks
  if (container) container.innerHTML = GRANDMA_SVG;
  if (simChar) simChar.classList.remove('hidden');
  if (lonelyFx) lonelyFx.classList.remove('active');

  if (simModal) {
    simModal.classList.remove('hidden');
    simModal.style.pointerEvents = 'auto';
  }
  if (simUI) simUI.classList.remove('hidden');
  if (simOverlay) simOverlay.classList.remove('hidden');

  document.getElementById('yard').classList.remove('shake-red');
  if (postModal) postModal.classList.remove('dimmed');

  if (simNote) {
    simNote.classList.add('hidden');
    simNote.classList.remove('dropping');
    simNote.style.filter = '';
    simNote.style.zIndex = "";
    simNote.style.transform = "";
    simNote.style.pointerEvents = 'auto';
  }

  // 2. Initialize progression
  renderSimStep();
}

function renderSimStep() {
  const step = simulationData[currentSimStep];
  const speakerEl = document.getElementById('simSpeaker');
  const textEl = document.getElementById('simText');
  const choicesEl = document.getElementById('simChoices');
  const nextIndicator = document.getElementById('simNextIndicator');
  const simChar = document.getElementById('simCharacter');
  const simNote = document.getElementById('simNote');
  const finalBtn = document.getElementById('simFinalBtn');

  speakerEl.textContent = step.speaker || "";
  textEl.textContent = step.text;

  if (step.showChar) simChar.classList.remove('hidden');
  if (step.hideChar) simChar.classList.add('hidden');

  if (step.showNote) {
    simNote.classList.remove('hidden');
    // Find most liked opponent post
    const opPost = window.allBoardPosts.find(p => p.id === window.mostLikedOpponentPostId);
    const defaultText = `동물원은 동물의 권리를 침해하는 공간입니다. 자연에서 살 수 있도록 보장해야 합니다.`;
    window.currentNoteText = opPost ? opPost.text : defaultText;
    simNote.innerHTML = `<b><레포트></b><br><br>${escapeHTML(window.currentNoteText)}`;
  } else if (!step.choices && !simulationData[currentSimStep - 1]?.showNote) {
    // Hide note only if it wasn't just shown and we aren't in a choice step
    simNote.classList.add('hidden');
  }

  if (step.triggerEffect === "shake-red") {
    const yardEl = document.getElementById('yard');
    yardEl.classList.add('shake-red');
    setTimeout(() => yardEl.classList.remove('shake-red'), 3000);
  }

  if (step.triggerEffect === "drop-lonely") {
    simNote.classList.add('dropping');
    const lonelyFx = document.querySelector('.sim-lonely-fx');
    if (lonelyFx) lonelyFx.classList.add('active');
  }

  if (step.runAutoType) {
    runAutoTypingStep();
  }

  if (step.choices) {
    nextIndicator.classList.add('hidden');
    choicesEl.classList.remove('hidden');
    choicesEl.innerHTML = '';
    step.choices.forEach(c => {
      const btn = document.createElement('button');
      btn.className = 'sim-choice-btn';
      btn.textContent = c.text;
      btn.onclick = () => {
        const nextIdx = simulationData.findIndex(s => s.id === c.nextId);
        if (nextIdx !== -1) {
          currentSimStep = nextIdx;
          renderSimStep();
        } else if (c.nextId === 'end_bad') {
          document.getElementById('simModal').classList.add('hidden');
          document.getElementById('yard').classList.add('shake-red');
          setTimeout(() => document.getElementById('yard').classList.remove('shake-red'), 3000);
        }
      };
      choicesEl.appendChild(btn);
    });
  } else {
    choicesEl.classList.add('hidden');
    nextIndicator.classList.remove('hidden');
  }

  if (step.showFinal) {
    finalBtn.classList.remove('hidden');
    finalBtn.textContent = '과제 제출하기';
    nextIndicator.classList.add('hidden');
  } else {
    finalBtn.classList.add('hidden');
  }

  if (step.isEnd) {
    nextIndicator.classList.add('hidden');

    // Specifically for picking up the note after it drops
    if (step.id === 'pick_up_reply') {
      simNote.classList.remove('hidden', 'dropping');
      simNote.style.display = 'block';
      simNote.style.position = 'absolute';
      simNote.style.top = '50%';
      simNote.style.left = '50%';
      simNote.style.transform = 'translate(-50%, -50%)';
      simNote.style.zIndex = '500';
    }

    // Automatically close after a meaningful delay
    setTimeout(() => {
      document.getElementById('simModal').classList.add('hidden');
      // Reset note styles for next simulation run
      simNote.style.position = "";
      simNote.style.top = "";
      simNote.style.left = "";
      simNote.style.transform = "";
    }, 5000);
  }
}

function runAutoTypingStep() {
  const textarea = document.getElementById('post-textarea');
  const postModal = document.getElementById('post-modal');
  const submitBtn = document.getElementById('submit-post-btn');
  const cancelBtn = document.getElementById('cancel-post-btn');
  const simChar = document.getElementById('simCharacter');

  if (simChar) simChar.classList.add('hidden');

  postModal.classList.remove('hidden');
  textarea.value = "";
  textarea.disabled = true;
  submitBtn.disabled = true;
  cancelBtn.style.display = 'none';

  const fullText = window.currentNoteText || "내용이 없습니다.";
  const partialText = fullText.substring(0, Math.max(0, fullText.length - 10));

  let i = 0;
  const interval = setInterval(() => {
    textarea.value = partialText.substring(0, i);
    i++;
    if (i > partialText.length) {
      clearInterval(interval);
      setTimeout(() => {
        const card = postModal.querySelector('.input-card');
        if (card) card.classList.add('dimmed');

        currentSimStep++;
        renderSimStep();

        enableManualTypingPhase();
      }, 500);
    }
  }, 30);
}

function enableManualTypingPhase() {
  const textarea = document.getElementById('post-textarea');
  const submitBtn = document.getElementById('submit-post-btn');
  const postModal = document.getElementById('post-modal');
  const card = postModal ? postModal.querySelector('.input-card') : null;
  const cancelBtn = document.getElementById('cancel-post-btn');
  const simNote = document.getElementById('simNote');
  const simChar = document.getElementById('simCharacter');
  const simModal = document.getElementById('simModal');

  if (card) card.classList.remove('dimmed');

  if (textarea) {
    textarea.disabled = false;
    textarea.focus();
    textarea.setSelectionRange(textarea.value.length, textarea.value.length);
  }

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.classList.add('btn-focus');
  }
  if (cancelBtn) cancelBtn.style.display = 'none'; // Hide cancel during simulation as requested

  if (simChar) simChar.classList.add('hidden');

  if (simNote) {
    // Force visibility and set premium fixed positioning
    simNote.classList.remove('hidden');
    simNote.style.display = 'block';

    // Position at the very top of the viewport
    simNote.style.zIndex = "999999";
    simNote.style.position = "fixed";
    simNote.style.top = "30px";
    simNote.style.left = "50%";
    simNote.style.transform = "translateX(-50%) rotate(-0.5deg)";

    // Aesthetic polish
    simNote.style.boxShadow = "0 30px 70px rgba(0,0,0,0.6)";
    simNote.style.border = "3px solid var(--primary)";
    simNote.style.backgroundColor = "#fff";
    simNote.style.maxWidth = "420px";
    simNote.style.width = "90%";
    simNote.style.padding = "32px";
    simNote.style.fontFamily = "var(--font-note)";
  }

  // Make the simulation overlay click-through
  if (simModal) {
    simModal.style.pointerEvents = 'none';
    if (simNote) simNote.style.pointerEvents = 'auto';

    // Capture board submission to clean up simulation
    const originalSubmitHandler = submitBtn ? submitBtn.onclick : null;
    if (submitBtn) {
      submitBtn.onclick = (e) => {
        simModal.classList.add('hidden');
        simModal.style.pointerEvents = 'auto';
        if (simNote) {
          simNote.style.zIndex = "";
          simNote.style.transform = "";
        }
        if (typeof originalSubmitHandler === 'function') originalSubmitHandler(e);
      };
    }
  }
}

// Unified Simulation Click Logic
document.getElementById('simModal').onclick = (e) => {
  if (e.target.closest('.sim-choices') || e.target.closest('.sim-final-btn')) return;
  const step = simulationData[currentSimStep];

  // Ignore clicks during automation, if sim is in click-through mode, OR if it is an end step
  if (!step || step.runAutoType || step.isEnd || document.getElementById('simModal').style.pointerEvents === 'none') return;

  // Choice/Final steps handle their own clicks
  if (step.choices || step.showFinal) return;

  if (step.nextId) {
    const nextIdx = simulationData.findIndex(s => s.id === step.nextId);
    if (nextIdx !== -1) {
      currentSimStep = nextIdx;
      renderSimStep();
    }
  } else {
    currentSimStep++;
    if (currentSimStep < simulationData.length) {
      renderSimStep();
    } else {
      document.getElementById('simModal').classList.add('hidden');
    }
  }
};

document.getElementById('simStartTab').onclick = startSimulation;
