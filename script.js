const boardElement = document.getElementById('board');
const statusText = document.getElementById('status');
const difficultySelect = document.getElementById('difficulty');
const boardSizeSelect = document.getElementById('board-size');
const expandControls = document.getElementById('expand-controls');
const playerScoreEl = document.getElementById('player-score');
const aiScoreEl = document.getElementById('ai-score');
const drawScoreEl = document.getElementById('draw-score');
const resetGameBtn = document.getElementById('reset-game');
const resetScoresBtn = document.getElementById('reset-scores');

let mode = boardSizeSelect.value === 'dynamic' ? 'dynamic' : 'static';
let boardRows = mode === 'dynamic' ? 3 : Number(boardSizeSelect.value) || 3;
let boardCols = boardRows;
let winLength = getWinLength();
let board = createEmptyBoard(boardRows, boardCols);
let winningCombos = buildWinningCombos(boardRows, boardCols, winLength);
let isGameActive = true;
let currentPlayer = 'X';
const scores = { player: 0, ai: 0, draw: 0 };
let currentDifficulty = difficultySelect.value || 'easy';
let cells = [];

initGame();

function initGame() {
    renderBoard();
    resetGame();

    difficultySelect.addEventListener('change', handleDifficultyChange);
    boardSizeSelect.addEventListener('change', handleBoardSizeChange);
    resetGameBtn.addEventListener('click', () => resetGame());
    resetScoresBtn.addEventListener('click', resetScores);

    expandControls.querySelectorAll('.expand-btn').forEach(btn => {
        btn.addEventListener('click', () => expandBoard(btn.dataset.dir));
    });

    toggleExpandControls();
    updateScoreboard();
    updateStatus('Luot cua ban (X)');
}

function createEmptyBoard(rows, cols) {
    return Array(rows * cols).fill('');
}

function getWinLength() {
    return mode === 'dynamic' ? 3 : boardRows;
}

function renderBoard() {
    boardElement.innerHTML = '';
    boardElement.style.gridTemplateColumns = `repeat(${boardCols}, 1fr)`;

    cells = [];
    for (let i = 0; i < board.length; i += 1) {
        const cell = document.createElement('button');
        cell.className = 'cell';
        cell.dataset.index = i;
        cell.addEventListener('click', handleCellClick);
        boardElement.appendChild(cell);
        cells.push(cell);
    }
}

function repaintBoardFromState() {
    board.forEach((value, index) => {
        if (value) {
            paintCell(index, value);
        }
    });
}

function handleCellClick(event) {
    const index = Number(event.currentTarget.dataset.index);

    if (!isGameActive || currentPlayer !== 'X' || board[index]) {
        return;
    }

    makeMove(index, 'X');

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
    updateStatus('May dang suy nghi...');

    setTimeout(aiMove, 450);
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
        updateStatus('Ban thang!');
    } else if (winner === 'O') {
        scores.ai += 1;
        updateStatus('May thang!');
    } else {
        scores.draw += 1;
        updateStatus('Hoa!');
    }

    highlightWinners(combo);
    updateScoreboard();
}

function highlightWinners(combo) {
    cells.forEach(cell => cell.classList.remove('winner'));
    combo.forEach(index => {
        if (cells[index]) cells[index].classList.add('winner');
    });
}

function aiMove() {
    if (!isGameActive) return;

    const availableCells = getAvailableCells(board);
    if (availableCells.length === 0) return;

    let aiIndex;

    switch (currentDifficulty) {
        case 'easy':
            aiIndex = getEasyMove(availableCells);
            break;
        case 'medium':
            aiIndex = getMediumMove();
            break;
        case 'hard':
            aiIndex = getHardMove();
            break;
        case 'impossible':
            aiIndex = getBestMoveMinimax();
            break;
        default:
            aiIndex = getEasyMove(availableCells);
    }

    makeMove(aiIndex, 'O');

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
    updateStatus('Luot cua ban (X)');
}

function getAvailableCells(boardToCheck) {
    const indices = [];
    boardToCheck.forEach((cell, index) => {
        if (!cell) indices.push(index);
    });
    return indices;
}

function getEasyMove(availableCells) {
    const randomIndex = Math.floor(Math.random() * availableCells.length);
    return availableCells[randomIndex];
}

function getCriticalMoveFor(player) {
    for (const combo of winningCombos) {
        const empties = combo.filter(i => !board[i]);
        const playerCount = combo.filter(i => board[i] === player).length;

        if (playerCount === winLength - 1 && empties.length === 1) {
            return empties[0];
        }
    }
    return null;
}

function getMediumMove() {
    const blockMove = getCriticalMoveFor('X');
    if (blockMove !== null) return blockMove;

    return getEasyMove(getAvailableCells(board));
}

function getHardMove() {
    const winMove = getCriticalMoveFor('O');
    if (winMove !== null) return winMove;

    const blockMove = getCriticalMoveFor('X');
    if (blockMove !== null) return blockMove;

    const centerRow = Math.floor(boardRows / 2);
    const centerCol = Math.floor(boardCols / 2);
    const centerIndex = coordToIndex(centerRow, centerCol);
    if (!board[centerIndex]) return centerIndex;

    const corners = getCornerIndices().filter(i => !board[i]);
    if (corners.length) return getEasyMove(corners);

    return getEasyMove(getAvailableCells(board));
}

function getCornerIndices() {
    const lastRow = boardRows - 1;
    const lastCol = boardCols - 1;
    return [
        coordToIndex(0, 0),
        coordToIndex(0, lastCol),
        coordToIndex(lastRow, 0),
        coordToIndex(lastRow, lastCol)
    ];
}

function getBestMoveMinimax() {
    if (boardRows !== 3 || boardCols !== 3 || winLength !== 3) {
        return getHardMove();
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
    statusText.textContent = message;
}

function updateScoreboard() {
    playerScoreEl.textContent = scores.player;
    aiScoreEl.textContent = scores.ai;
    drawScoreEl.textContent = scores.draw;
}

function resetGame(options = {}) {
    const shouldRedraw = options.redraw || false;
    board = createEmptyBoard(boardRows, boardCols);
    isGameActive = true;
    currentPlayer = 'X';
    winLength = getWinLength();
    winningCombos = buildWinningCombos(boardRows, boardCols, winLength);
    updateStatus('Luot cua ban (X)');

    if (shouldRedraw) {
        renderBoard();
    }

    cells.forEach(cell => {
        cell.innerHTML = '';
        cell.classList.remove('filled', 'winner', 'filled-x', 'filled-o');
    });
}

function resetScores() {
    scores.player = 0;
    scores.ai = 0;
    scores.draw = 0;
    updateScoreboard();
    resetGame();
}

function handleDifficultyChange(event) {
    currentDifficulty = event.target.value;
    resetGame();
}

function handleBoardSizeChange(event) {
    const value = event.target.value;
    mode = value === 'dynamic' ? 'dynamic' : 'static';

    if (mode === 'dynamic') {
        boardRows = 3;
        boardCols = 3;
    } else {
        boardRows = Number(value) || 3;
        boardCols = boardRows;
    }

    winLength = getWinLength();
    winningCombos = buildWinningCombos(boardRows, boardCols, winLength);
    toggleExpandControls();
    resetGame({ redraw: true });
}

function toggleExpandControls() {
    expandControls.style.display = mode === 'dynamic' ? 'grid' : 'none';
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
}

function coordToIndex(row, col) {
    return row * boardCols + col;
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
