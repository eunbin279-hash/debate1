const yard = document.getElementById('yard')
const catsWrap = document.getElementById('cats')

// Safe global waiting modal stubs so calls from console won't error before UI setup.
window.showWaiting = window.showWaiting || function (count) {
  try {
    const modal = document.getElementById('waitingModal')
    const cnt = document.getElementById('waitingCount')
    if (modal && cnt) {
      cnt.textContent = `${count}명`
      modal.classList.remove('hidden')
      modal.setAttribute('aria-hidden', 'false')
    }
  } catch (e) { /* ignore */ }
}
window.hideWaiting = window.hideWaiting || function () {
  try {
    const modal = document.getElementById('waitingModal')
    if (modal) {
      modal.classList.add('hidden')
      modal.setAttribute('aria-hidden', 'true')
    }
  } catch (e) { /* ignore */ }
}

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
    window.myMessages = [];
    window.myAgrees = [];
    window.myBoardPosts = [];
    window.myBoardLikes = [];
    window.myBoardComments = [];
    window.saveMyPayload = () => {
      if (!window.debateInfo) return;
      window.debateInfo.savePayload({
        messages: window.myMessages || [],
        agrees: window.myAgrees || [],
        side: window.debateInfo.side || 'unassigned',
        boardPosts: window.myBoardPosts || [],
        boardLikes: window.myBoardLikes || [],
        boardComments: window.myBoardComments || []
      }).catch(err => console.error('Payload save error:', err));
    };

    // Create and setup bulletin board UI
    // This is done only once when the app is ready
    if (!document.getElementById('bulletin-board')) {
      setupBulletinBoardUI(info);
    }

    // Attempt saving side once to initialize
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
          data.boardPosts.forEach(p => window.allBoardPosts.push({ ...p, id: `${p.author}_${p.time}` }));
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

      // Find most liked post
      let mostLikedPostId = null;
      let maxLikes = 0;
      for (const postId in boardLikeCounts) {
        if (boardLikeCounts[postId] > maxLikes) {
          maxLikes = boardLikeCounts[postId];
          mostLikedPostId = postId;
        }
      }
      window.mostLikedPostId = mostLikedPostId;

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


// Initial state for all cats
document.querySelectorAll('.cat').forEach(cat => {
  const id = cat.dataset.id
  if (id === 'user') return;
  if (!threads[id]) {
    threads[id] = [{ from: 'cat', text: (cat.dataset.text || ''), time: Date.now() }]
  }
  renderCatBubbles(cat)
})

// Simulation Game Logic can stay as it has its own UI inside the modal, 
// but the toggle button in the main UI is gone.
// However, the user said "remove the bottom input area", which included the sim button.
// I'll keep the logic but it will be unreachable unless triggered elsewhere.
