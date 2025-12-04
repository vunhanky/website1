const boardElement = document.getElementById('board');
const statusText = document.getElementById('status');
const difficultySelect = document.getElementById('difficulty');
const boardSizeSelect = document.getElementById('board-size');
const expandControls = document.getElementById('expand-controls');
const zoomControls = document.getElementById('zoom-controls');
const zoomInBtn = document.getElementById('zoom-in');
const zoomOutBtn = document.getElementById('zoom-out');
const playerScoreEl = document.getElementById('player-score');
const aiScoreEl = document.getElementById('ai-score');
const drawScoreEl = document.getElementById('draw-score');
const resetGameBtn = document.getElementById('reset-game');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginUsernameInput = document.getElementById('login-username');
const loginPasswordInput = document.getElementById('login-password');
const registerUsernameInput = document.getElementById('register-username');
const registerPasswordInput = document.getElementById('register-password');
const sessionStatusEl = document.getElementById('session-status');
const sessionUsernameEl = document.getElementById('session-username');
const sessionNoteEl = document.getElementById('session-note');
const logoutBtn = document.getElementById('logout-btn');
const statWinEl = document.getElementById('stat-win');
const statLossEl = document.getElementById('stat-loss');
const statDrawEl = document.getElementById('stat-draw');
const leaderboardBody = document.getElementById('leaderboard-body');

const STORAGE_KEYS = {
    users: 'tttUsers',
    session: 'tttSessionUser'
};

const DYNAMIC_BASE_SIZE = 3;
const DYNAMIC_INITIAL_LAYERS = 1;
const DYNAMIC_START_SIZE = DYNAMIC_BASE_SIZE + DYNAMIC_INITIAL_LAYERS * 2;
const DYNAMIC_WIN_LENGTH = 5;

const defaultBoardOption = boardSizeSelect ? boardSizeSelect.value : String(DYNAMIC_BASE_SIZE);
let mode = defaultBoardOption === 'dynamic' ? 'dynamic' : 'static';
let boardRows = mode === 'dynamic' ? DYNAMIC_START_SIZE : Number(defaultBoardOption) || DYNAMIC_BASE_SIZE;
let boardCols = boardRows;
let winLength = getWinLength();
let board = createEmptyBoard(boardRows, boardCols);
let winningCombos = buildWinningCombos(boardRows, boardCols, winLength);
let isGameActive = true;
let currentPlayer = 'X';
const scores = { player: 0, ai: 0, draw: 0 };
let currentDifficulty = difficultySelect ? difficultySelect.value : 'easy';
let cells = [];
let hiddenLayers = 0;
let users = loadUsers();
let currentUser = null;

initApp();

function initApp() {
    restoreSession();
    attachAuthHandlers();

    if (boardElement) {
        initGame();
    } else if (leaderboardBody) {
        refreshLeaderboard();
    }
}

function initGame() {
    if (!boardElement) return;

    renderBoard();
    resetGame();

    if (difficultySelect) difficultySelect.addEventListener('change', handleDifficultyChange);
    if (boardSizeSelect) boardSizeSelect.addEventListener('change', handleBoardSizeChange);
    if (resetGameBtn) {
        resetGameBtn.addEventListener('click', () => resetGame({ resetDynamic: mode === 'dynamic', redraw: true }));
    }

    if (zoomInBtn) zoomInBtn.addEventListener('click', () => adjustZoom(1));
    if (zoomOutBtn) zoomOutBtn.addEventListener('click', () => adjustZoom(-1));

    if (expandControls) {
        expandControls.querySelectorAll('.expand-btn').forEach(btn => {
            btn.addEventListener('click', () => expandBoard(btn.dataset.dir));
        });
    }

    toggleExpandControls();
    updateScoreboard();
    refreshLeaderboard();
    updateStatus('Lượt của bạn (X)');
}

function createEmptyBoard(rows, cols) {
    return Array(rows * cols).fill('');
}

function getWinLength() {
    return mode === 'dynamic' ? DYNAMIC_WIN_LENGTH : boardRows;
}

function renderBoard() {
    if (!boardElement) return;

    boardElement.innerHTML = '';
    const { offset, visibleRows, visibleCols } = getVisibleBounds();
    boardElement.style.gridTemplateColumns = `repeat(${visibleCols}, 1fr)`;

    cells = [];
    for (let r = 0; r < visibleRows; r += 1) {
        for (let c = 0; c < visibleCols; c += 1) {
            const realRow = r + offset;
            const realCol = c + offset;
            const realIndex = coordToIndex(realRow, realCol);
            const cell = document.createElement('button');
            cell.className = 'cell';
            if (mode === 'dynamic' && isVisibleOuterRingIndex(realIndex, visibleRows, visibleCols, offset)) {
                cell.classList.add('outer-ring');
            }
            cell.dataset.index = realIndex;
            cell.addEventListener('click', handleCellClick);
            boardElement.appendChild(cell);
            cells[realIndex] = cell;
        }
    }

    updateZoomControls();
}

function repaintBoardFromState() {
    board.forEach((value, index) => {
        if (value) {
            paintCell(index, value);
        }
    });
}

function revealIndex(index) {
    const { row, col } = indexToCoord(index);
    const distToEdge = Math.min(row, col, boardRows - 1 - row, boardCols - 1 - col);
    if (hiddenLayers > distToEdge) {
        hiddenLayers = distToEdge;
        renderBoard();
        repaintBoardFromState();
    }
}

function handleCellClick(event) {
    const index = Number(event.currentTarget.dataset.index);

    if (!isGameActive || currentPlayer !== 'X' || board[index]) {
        return;
    }

    if (mode === 'dynamic' && !isIndexVisible(index)) {
        return;
    }

    const shouldExpand = mode === 'dynamic' && isVisibleOuterRingIndex(index);

    makeMove(index, 'X');

    if (shouldExpand) {
        expandBoard('ring');
    }

    const result = checkWinner(board);
    if (result.winner) {
        endGame(result.winner, result.combo);
        return;
    }

    if (result.isDraw) {
        endGame('draw');
        return;
    }

    currentPlayer = 'O';
    updateStatus('Máy đang suy nghĩ...');

    setTimeout(aiMove, 750);
}

function makeMove(index, player) {
    board[index] = player;
    paintCell(index, player);
}

function paintCell(index, player) {
    const cell = cells[index];
    if (!cell) return;

    cell.innerHTML = '';

    const mark = document.createElement('span');
    mark.className = `mark ${player === 'X' ? 'neon-x' : 'neon-o'}`;
    mark.setAttribute('aria-hidden', 'true');

    cell.appendChild(mark);
    cell.classList.add('filled', player === 'X' ? 'filled-x' : 'filled-o');
}

function checkWinner(boardToCheck) {
    for (const combo of winningCombos) {
        const firstValue = boardToCheck[combo[0]];
        if (firstValue && combo.every(index => boardToCheck[index] === firstValue)) {
            return { winner: firstValue, combo, isDraw: false };
        }
    }

    const isDraw = boardToCheck.every(cell => cell);
    return { winner: null, combo: null, isDraw };
}

function endGame(winner, combo = []) {
    isGameActive = false;

    if (winner === 'X') {
        scores.player += 1;
        updateStatus('Bạn thắng!');
    } else if (winner === 'O') {
        scores.ai += 1;
        updateStatus('Máy thắng!');
    } else {
        scores.draw += 1;
        updateStatus('Hòa!');
    }

    highlightWinners(combo);
    updateScoreboard();
    persistScoresForUser();

    if (mode === 'dynamic') {
        setTimeout(() => resetGame({ redraw: true, resetDynamic: true }), 650);
    }
}

function highlightWinners(combo) {
    cells.forEach(cell => cell.classList.remove('winner'));
    combo.forEach(index => {
        if (cells[index]) cells[index].classList.add('winner');
    });
}

function aiMove() {
    if (!isGameActive) return;

    const useVisibleOnly = mode === 'dynamic' && currentDifficulty !== 'impossible';
    const availableCells = getAvailableCells(board, { visibleOnly: useVisibleOnly });
    if (availableCells.length === 0) return;

    let aiIndex;

    switch (currentDifficulty) {
        case 'easy':
            aiIndex = getEasyMove(availableCells);
            break;
        case 'medium':
            aiIndex = getMediumMove(availableCells);
            break;
        case 'hard':
            aiIndex = getHardMove(availableCells, { respectVisibility: useVisibleOnly });
            break;
        case 'impossible':
            aiIndex = getBestMoveMinimax({ respectVisibility: useVisibleOnly });
            break;
        default:
            aiIndex = getEasyMove(availableCells);
    }

    if (mode === 'dynamic' && !isIndexVisible(aiIndex)) {
        revealIndex(aiIndex);
    }

    const shouldExpand = mode === 'dynamic' && isVisibleOuterRingIndex(aiIndex);
    makeMove(aiIndex, 'O');

    if (shouldExpand) {
        expandBoard('ring');
    }

    const result = checkWinner(board);
    if (result.winner) {
        endGame(result.winner, result.combo);
        return;
    }

    if (result.isDraw) {
        endGame('draw');
        return;
    }

    currentPlayer = 'X';
    updateStatus('Lượt của bạn (X)');
}

function getAvailableCells(boardToCheck, options = {}) {
    const { visibleOnly = false } = options;
    const indices = [];

    if (visibleOnly && mode === 'dynamic') {
        for (const index of getVisibleIndices()) {
            if (!boardToCheck[index]) indices.push(index);
        }
        return indices;
    }

    boardToCheck.forEach((cell, index) => {
        if (!cell) indices.push(index);
    });
    return indices;
}

function getEasyMove(availableCells) {
    const randomIndex = Math.floor(Math.random() * availableCells.length);
    return availableCells[randomIndex];
}

function getCriticalMoveFor(player, options = {}) {
    const { respectVisibility = true } = options;
    for (const combo of winningCombos) {
        const empties = combo.filter(i => {
            if (board[i]) return false;
            return respectVisibility ? isIndexVisible(i) : true;
        });
        const playerCount = combo.filter(i => board[i] === player).length;

        if (playerCount === winLength - 1 && empties.length === 1) {
            return empties[0];
        }
    }
    return null;
}

function getMediumMove(
    availableCells = getAvailableCells(board, { visibleOnly: mode === 'dynamic' }),
    options = {}
) {
    const { respectVisibility = true } = options;
    const blockMove = getCriticalMoveFor('X', { respectVisibility });
    if (blockMove !== null) return blockMove;

    return getEasyMove(availableCells);
}

function getHardMove(
    availableCells = getAvailableCells(board, { visibleOnly: mode === 'dynamic' }),
    options = {}
) {
    const { respectVisibility = true } = options;

    const winMove = getCriticalMoveFor('O', { respectVisibility });
    if (winMove !== null) return winMove;

    const blockMove = getCriticalMoveFor('X', { respectVisibility });
    if (blockMove !== null) return blockMove;

    const { centerRow, centerCol } = getCenterCoords({ respectVisibility });
    const centerIndex = coordToIndex(centerRow, centerCol);
    if (!board[centerIndex]) return centerIndex;

    const corners = getCornerIndices({ respectVisibility }).filter(i => !board[i]);
    if (corners.length) return getEasyMove(corners);

    return getEasyMove(availableCells);
}

function getCornerIndices(options = {}) {
    const { respectVisibility = true } = options;
    const { offset, visibleRows, visibleCols } = respectVisibility
        ? getVisibleBounds()
        : { offset: 0, visibleRows: boardRows, visibleCols: boardCols };

    const firstRow = offset;
    const firstCol = offset;
    const lastRow = offset + visibleRows - 1;
    const lastCol = offset + visibleCols - 1;
    return [
        coordToIndex(firstRow, firstCol),
        coordToIndex(firstRow, lastCol),
        coordToIndex(lastRow, firstCol),
        coordToIndex(lastRow, lastCol)
    ];
}

function getCenterCoords(options = {}) {
    const { respectVisibility = true } = options;
    const bounds = respectVisibility
        ? getVisibleBounds()
        : { offset: 0, visibleRows: boardRows, visibleCols: boardCols };
    const centerRow = bounds.offset + Math.floor(bounds.visibleRows / 2);
    const centerCol = bounds.offset + Math.floor(bounds.visibleCols / 2);
    return { centerRow, centerCol };
}

function getBestMoveMinimax(options = {}) {
    const { respectVisibility = true } = options;
    if (boardRows !== 3 || boardCols !== 3 || winLength !== 3) {
        return getHardMove(
            getAvailableCells(board, { visibleOnly: respectVisibility && mode === 'dynamic' }),
            { respectVisibility }
        );
    }

    let bestScore = -Infinity;
    let move = null;

    for (const index of getAvailableCells(board)) {
        board[index] = 'O';
        const score = minimax(board, 0, false);
        board[index] = '';

        if (score > bestScore) {
            bestScore = score;
            move = index;
        }
    }

    return move !== null ? move : getHardMove();
}

function minimax(boardState, depth, isMaximizing) {
    const result = checkWinner(boardState);
    if (result.winner === 'O') return 10 - depth;
    if (result.winner === 'X') return -10 + depth;
    if (result.isDraw) return 0;

    if (isMaximizing) {
        let best = -Infinity;
        for (const index of getAvailableCells(boardState)) {
            boardState[index] = 'O';
            const score = minimax(boardState, depth + 1, false);
            boardState[index] = '';
            best = Math.max(best, score);
        }
        return best;
    }

    let best = Infinity;
    for (const index of getAvailableCells(boardState)) {
        boardState[index] = 'X';
        const score = minimax(boardState, depth + 1, true);
        boardState[index] = '';
        best = Math.min(best, score);
    }
    return best;
}

function updateStatus(message) {
    if (statusText) {
        statusText.textContent = message;
    }
}

function updateScoreboard() {
    if (playerScoreEl) playerScoreEl.textContent = scores.player;
    if (aiScoreEl) aiScoreEl.textContent = scores.ai;
    if (drawScoreEl) drawScoreEl.textContent = scores.draw;
    updateSessionStats();
}

function updateSessionStats() {
    if (!statWinEl || !statLossEl || !statDrawEl) return;
    statWinEl.textContent = scores.player;
    statLossEl.textContent = scores.ai;
    statDrawEl.textContent = scores.draw;
}

function attachAuthHandlers() {
    if (loginForm) loginForm.addEventListener('submit', handleLogin);
    if (registerForm) registerForm.addEventListener('submit', handleRegister);
    if (logoutBtn) logoutBtn.addEventListener('click', logoutUser);
}

function handleRegister(event) {
    event.preventDefault();
    if (!registerUsernameInput || !registerPasswordInput) return;

    const username = registerUsernameInput.value.trim();
    const password = registerPasswordInput.value.trim();

    if (!username || !password) {
        updateSessionUI('Điền đủ tên và mật khẩu để đăng ký.');
        return;
    }

    const exists = users.some(user => user.username.toLowerCase() === username.toLowerCase());
    if (exists) {
        updateSessionUI('Tên người chơi đã tồn tại, hãy chọn tên khác.');
        return;
    }

    const newUser = {
        username,
        password,
        scores: getEmptyScores()
    };

    users.push(newUser);
    saveUsers();
    registerForm.reset();
    setCurrentUser(username);
    updateSessionUI('Tạo tài khoản thành công, bắt đầu chơi thôi!');
    refreshLeaderboard();
}

function handleLogin(event) {
    event.preventDefault();
    if (!loginUsernameInput || !loginPasswordInput) return;

    const username = loginUsernameInput.value.trim();
    const password = loginPasswordInput.value.trim();

    if (!username || !password) {
        updateSessionUI('Nhập đủ tên và mật khẩu để đăng nhập.');
        return;
    }

    const user = users.find(
        entry => entry.username.toLowerCase() === username.toLowerCase() && entry.password === password
    );

    if (!user) {
        updateSessionUI('Sai tên hoặc mật khẩu.');
        return;
    }

    setCurrentUser(user.username);
    loginForm.reset();
    updateSessionUI('Đăng nhập thành công. Điểm sẽ được lưu tự động.');
    refreshLeaderboard();
}

function logoutUser() {
    setCurrentUser(null);
    updateSessionUI('Đã đăng xuất, tiếp tục chơi ở chế độ khách.');
    if (boardElement) {
        resetGame({ resetDynamic: mode === 'dynamic', redraw: true });
    }
}

function restoreSession() {
    const savedUsername = localStorage.getItem(STORAGE_KEYS.session);
    if (savedUsername && users.some(user => user.username === savedUsername)) {
        setCurrentUser(savedUsername);
    } else {
        setCurrentUser(null);
    }
}

function setCurrentUser(username) {
    currentUser = users.find(user => user.username === username) || null;

    if (currentUser) {
        Object.assign(scores, normalizeScores(currentUser.scores));
        localStorage.setItem(STORAGE_KEYS.session, currentUser.username);
    } else {
        Object.assign(scores, getEmptyScores());
        localStorage.removeItem(STORAGE_KEYS.session);
    }

    updateScoreboard();
    updateSessionUI();
    refreshLeaderboard();
}

function persistScoresForUser() {
    if (!currentUser) return;
    currentUser.scores = { ...scores, updatedAt: Date.now() };
    saveUsers();
    refreshLeaderboard();
}

function updateSessionUI(message = '') {
    if (sessionStatusEl) {
        sessionStatusEl.textContent = currentUser
            ? `Xin chào, ${currentUser.username}`
            : 'Đang ở chế độ khách';
    }

    if (sessionUsernameEl) {
        sessionUsernameEl.textContent = currentUser ? currentUser.username : '-';
    }

    if (logoutBtn) {
        logoutBtn.disabled = !currentUser;
    }

    if (sessionNoteEl) {
        sessionNoteEl.textContent = message || (currentUser
            ? 'Điểm được lưu tự động sau mỗi ván.'
            : 'Đăng nhập để lưu điểm và xếp hạng.');
    }

    updateSessionStats();
}

function refreshLeaderboard() {
    if (!leaderboardBody) return;

    leaderboardBody.innerHTML = '';
    if (!users.length) {
        const emptyRow = document.createElement('div');
        emptyRow.className = 'leaderboard-row empty';
        emptyRow.innerHTML = '<span>-</span><span>Chưa có người chơi</span><span>0</span><span>0</span><span>0</span><span>0</span>';
        leaderboardBody.appendChild(emptyRow);
        return;
    }

    const sorted = [...users].sort(sortUsersByScore);
    sorted.forEach((user, index) => {
        const stats = normalizeScores(user.scores);
        const total = stats.player + stats.ai + stats.draw;
        const row = document.createElement('div');
        row.className = 'leaderboard-row';
        const marker = currentUser && currentUser.username === user.username ? ' (bạn)' : '';
        row.innerHTML = `
            <span>${index + 1}</span>
            <span>${user.username}${marker}</span>
            <span>${stats.player}</span>
            <span>${stats.draw}</span>
            <span>${stats.ai}</span>
            <span>${total}</span>
        `;
        leaderboardBody.appendChild(row);
    });
}

function sortUsersByScore(a, b) {
    const scoreA = normalizeScores(a.scores);
    const scoreB = normalizeScores(b.scores);

    if (scoreA.player !== scoreB.player) return scoreB.player - scoreA.player;
    if (scoreA.draw !== scoreB.draw) return scoreB.draw - scoreA.draw;
    if (scoreA.ai !== scoreB.ai) return scoreA.ai - scoreB.ai;
    return (scoreB.updatedAt || 0) - (scoreA.updatedAt || 0);
}

function normalizeScores(scoreObj = {}) {
    return {
        player: Number(scoreObj.player) || 0,
        ai: Number(scoreObj.ai) || 0,
        draw: Number(scoreObj.draw) || 0,
        updatedAt: scoreObj.updatedAt || Date.now()
    };
}

function getEmptyScores() {
    return { player: 0, ai: 0, draw: 0, updatedAt: Date.now() };
}

function loadUsers() {
    try {
        const raw = localStorage.getItem(STORAGE_KEYS.users);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map(user => ({
            ...user,
            scores: normalizeScores(user.scores)
        }));
    } catch (error) {
        console.warn('Không thể đọc danh sách người chơi', error);
        return [];
    }
}

function saveUsers() {
    localStorage.setItem(STORAGE_KEYS.users, JSON.stringify(users));
}

function resetGame(options = {}) {
    const shouldRedraw = options.redraw || options.resetDynamic || false;
    const resetDynamic = options.resetDynamic || false;

    if (resetDynamic && mode === 'dynamic') {
        resetDynamicBoard();
    }

    board = createEmptyBoard(boardRows, boardCols);
    isGameActive = true;
    currentPlayer = 'X';
    winLength = getWinLength();
    winningCombos = buildWinningCombos(boardRows, boardCols, winLength);
    updateStatus('Lượt của bạn (X)');

    if (shouldRedraw) {
        renderBoard();
    }

    cells.forEach(cell => {
        cell.innerHTML = '';
        cell.classList.remove('filled', 'winner', 'filled-x', 'filled-o');
    });

    updateZoomControls();
}

function resetDynamicBoard() {
    hiddenLayers = 0;
    boardRows = DYNAMIC_START_SIZE;
    boardCols = DYNAMIC_START_SIZE;
}

function handleDifficultyChange(event) {
    currentDifficulty = event.target.value;
    resetGame();
}

function handleBoardSizeChange(event) {
    const value = event.target.value;
    mode = value === 'dynamic' ? 'dynamic' : 'static';

    if (mode === 'dynamic') {
        boardRows = DYNAMIC_START_SIZE;
        boardCols = DYNAMIC_START_SIZE;
        hiddenLayers = 0;
    } else {
        boardRows = Number(value) || DYNAMIC_BASE_SIZE;
        boardCols = boardRows;
        hiddenLayers = 0;
    }

    winLength = getWinLength();
    winningCombos = buildWinningCombos(boardRows, boardCols, winLength);
    toggleExpandControls();
    updateZoomControls();
    resetGame({ redraw: true });
}

function toggleExpandControls() {
    if (!expandControls) return;
    expandControls.style.display = 'none';
}

function canZoomIn() {
    if (mode !== 'dynamic') return false;
    return hiddenLayers < getMaxHiddenLayers();
}

function canZoomOut() {
    if (mode !== 'dynamic') return false;
    return hiddenLayers > 0;
}

function getMaxHiddenLayers() {
    const smallestSide = Math.min(boardRows, boardCols);
    return Math.max(0, Math.floor((smallestSide - winLength) / 2));
}

function updateZoomControls() {
    if (!zoomControls) return;

    if (mode !== 'dynamic') {
        zoomControls.style.display = 'none';
        return;
    }

    zoomControls.style.display = 'grid';
    if (zoomInBtn) zoomInBtn.disabled = !canZoomIn();
    if (zoomOutBtn) zoomOutBtn.disabled = !canZoomOut();
}

function adjustZoom(direction) {
    if (mode !== 'dynamic') return;

    const nextHidden = hiddenLayers + direction;
    if (direction > 0 && !canZoomIn()) return;
    if (direction < 0 && !canZoomOut()) return;
    const maxHidden = getMaxHiddenLayers();
    hiddenLayers = Math.min(Math.max(0, nextHidden), maxHidden);

    renderBoard();
    repaintBoardFromState();
    updateZoomControls();
}

function expandBoard(direction) {
    if (mode !== 'dynamic') return;

    let addTop = 0;
    let addBottom = 0;
    let addLeft = 0;
    let addRight = 0;

    switch (direction) {
        case 'up':
            addTop = 1;
            break;
        case 'down':
            addBottom = 1;
            break;
        case 'left':
            addLeft = 1;
            break;
        case 'right':
            addRight = 1;
            break;
        case 'ring':
            addTop = 1;
            addBottom = 1;
            addLeft = 1;
            addRight = 1;
            break;
        default:
            return;
    }

    const newRows = boardRows + addTop + addBottom;
    const newCols = boardCols + addLeft + addRight;
    const newBoard = createEmptyBoard(newRows, newCols);

    for (let r = 0; r < boardRows; r += 1) {
        for (let c = 0; c < boardCols; c += 1) {
            const value = board[coordToIndex(r, c)];
            const newR = r + addTop;
            const newC = c + addLeft;
            newBoard[newR * newCols + newC] = value;
        }
    }

    boardRows = newRows;
    boardCols = newCols;
    board = newBoard;

    renderBoard();
    repaintBoardFromState();

    winLength = getWinLength();
    winningCombos = buildWinningCombos(boardRows, boardCols, winLength);
    updateZoomControls();
}

function coordToIndex(row, col) {
    return row * boardCols + col;
}

function indexToCoord(index, cols = boardCols) {
    const row = Math.floor(index / cols);
    const col = index % cols;
    return { row, col };
}

function isOuterRingIndex(index, rows = boardRows, cols = boardCols) {
    const { row, col } = indexToCoord(index, cols);
    return row === 0 || col === 0 || row === rows - 1 || col === cols - 1;
}

function getVisibleBounds() {
    const offset = hiddenLayers;
    const visibleRows = boardRows - offset * 2;
    const visibleCols = boardCols - offset * 2;
    return { offset, visibleRows, visibleCols };
}

function isIndexVisible(index) {
    const { offset, visibleRows, visibleCols } = getVisibleBounds();
    const { row, col } = indexToCoord(index);
    return (
        row >= offset &&
        col >= offset &&
        row < offset + visibleRows &&
        col < offset + visibleCols
    );
}

function isVisibleOuterRingIndex(index, visibleRows, visibleCols, offset) {
    const bounds = getVisibleBounds();
    const effectiveOffset = offset !== undefined ? offset : bounds.offset;
    const rows = visibleRows !== undefined ? visibleRows : bounds.visibleRows;
    const cols = visibleCols !== undefined ? visibleCols : bounds.visibleCols;
    const { row, col } = indexToCoord(index);
    const top = effectiveOffset;
    const left = effectiveOffset;
    const bottom = effectiveOffset + rows - 1;
    const right = effectiveOffset + cols - 1;
    return row === top || row === bottom || col === left || col === right;
}

function getVisibleIndices() {
    const { offset, visibleRows, visibleCols } = getVisibleBounds();
    const indices = [];
    for (let r = 0; r < visibleRows; r += 1) {
        for (let c = 0; c < visibleCols; c += 1) {
            const realRow = r + offset;
            const realCol = c + offset;
            indices.push(coordToIndex(realRow, realCol));
        }
    }
    return indices;
}

function buildWinningCombos(rows, cols, length) {
    const combos = [];
    const directions = [
        [0, 1],  // horizontal
        [1, 0],  // vertical
        [1, 1],  // diagonal down-right
        [1, -1]  // diagonal down-left
    ];

    for (let r = 0; r < rows; r += 1) {
        for (let c = 0; c < cols; c += 1) {
            for (const [dr, dc] of directions) {
                const endRow = r + (length - 1) * dr;
                const endCol = c + (length - 1) * dc;

                if (endRow < 0 || endRow >= rows || endCol < 0 || endCol >= cols) {
                    continue;
                }

                const combo = [];
                for (let i = 0; i < length; i += 1) {
                    const row = r + dr * i;
                    const col = c + dc * i;
                    combo.push(row * cols + col);
                }
                combos.push(combo);
            }
        }
    }

    return combos;
}
