// === State and DOM references ===
const cells = document.querySelectorAll('.cell');
const statusText = document.getElementById('status');
const difficultySelect = document.getElementById('difficulty');
const playerScoreEl = document.getElementById('player-score');
const aiScoreEl = document.getElementById('ai-score');
const drawScoreEl = document.getElementById('draw-score');
const resetGameBtn = document.getElementById('reset-game');
const resetScoresBtn = document.getElementById('reset-scores');

// Game state variables (kept simple for teaching purposes)
let board = Array(9).fill('');
let isGameActive = true;
let currentPlayer = 'X'; // Player always starts
const scores = { player: 0, ai: 0, draw: 0 };
let currentDifficulty = 'easy';

// All possible winning lines on a 3x3 board
const winningCombos = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6]
];

// === Initialization ===
function initGame() {
    cells.forEach(cell => cell.addEventListener('click', handleCellClick));
    resetGameBtn.addEventListener('click', resetGame);
    resetScoresBtn.addEventListener('click', resetScores);
    difficultySelect.addEventListener('change', handleDifficultyChange);
    updateScoreboard();
    updateStatus('Your turn (X)');
}

// === Core gameplay ===
function handleCellClick(event) {
    const index = Number(event.target.dataset.index);

    // Ignore clicks if the game ended, AI is up next, or the cell is taken
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

    // Switch to AI turn
    currentPlayer = 'O';
    updateStatus('AI is thinking...');

    // Small delay to make the AI feel more natural
    setTimeout(aiMove, 450);
}

function makeMove(index, player) {
    board[index] = player;
    const cell = cells[index];
    cell.textContent = player;
    cell.classList.add('filled');
}

function checkWinner(boardToCheck) {
    for (const combo of winningCombos) {
        const [a, b, c] = combo;
        if (
            boardToCheck[a] &&
            boardToCheck[a] === boardToCheck[b] &&
            boardToCheck[a] === boardToCheck[c]
        ) {
            return { winner: boardToCheck[a], combo, isDraw: false };
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
}

function highlightWinners(combo) {
    cells.forEach(cell => cell.classList.remove('winner'));
    combo.forEach(index => cells[index].classList.add('winner'));
}

// === AI logic ===
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
    updateStatus('Your turn (X)');
}

function getAvailableCells(boardToCheck) {
    const indices = [];
    boardToCheck.forEach((cell, index) => {
        if (!cell) indices.push(index);
    });
    return indices;
}

// Easy: pick any empty cell randomly
function getEasyMove(availableCells) {
    const randomIndex = Math.floor(Math.random() * availableCells.length);
    return availableCells[randomIndex];
}

// Medium: block the player if they are about to win, otherwise random
function getMediumMove() {
    // Check every line: if player has 2 and an empty spot, take the empty spot
    for (const combo of winningCombos) {
        const [a, b, c] = combo.map(i => board[i]);
        const empties = combo.filter(i => !board[i]);
        const playerCount = [a, b, c].filter(v => v === 'X').length;
        if (playerCount === 2 && empties.length === 1) {
            return empties[0]; // Block the winning move
        }
    }

    return getEasyMove(getAvailableCells(board));
}

// Hard: win if possible, else block, center, corner, then edge
function getHardMove() {
    // 1. If AI can win now, do it
    for (const combo of winningCombos) {
        const empties = combo.filter(i => !board[i]);
        const aiCount = combo.filter(i => board[i] === 'O').length;
        if (aiCount === 2 && empties.length === 1) {
            return empties[0];
        }
    }

    // 2. Block player win
    for (const combo of winningCombos) {
        const empties = combo.filter(i => !board[i]);
        const playerCount = combo.filter(i => board[i] === 'X').length;
        if (playerCount === 2 && empties.length === 1) {
            return empties[0];
        }
    }

    // 3. Take center if open
    if (!board[4]) return 4;

    // 4. Take a corner
    const corners = [0, 2, 6, 8].filter(i => !board[i]);
    if (corners.length) return getEasyMove(corners);

    // 5. Take an edge
    const edges = [1, 3, 5, 7].filter(i => !board[i]);
    if (edges.length) return getEasyMove(edges);

    // Fallback (should rarely hit) in case no preferred cells exist
    return getEasyMove(getAvailableCells(board));
}

// Impossible: full minimax search, AI never loses
function getBestMoveMinimax() {
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

    return move;
}

/**
 * Minimax recursion explores every possible game state and assigns a score:
 *  - AI win => +10 (reduced by depth so quicker wins are preferred)
 *  - Player win => -10 (increased by depth so slower losses are preferred)
 *  - Draw => 0
 * The algorithm maximizes the AI score on its turn and minimizes it on the player's turn.
 */
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
    } else {
        let best = Infinity;
        for (const index of getAvailableCells(boardState)) {
            boardState[index] = 'X';
            const score = minimax(boardState, depth + 1, true);
            boardState[index] = '';
            best = Math.min(best, score);
        }
        return best;
    }
}

// === Helpers ===
function updateStatus(message) {
    statusText.textContent = message;
}

function updateScoreboard() {
    playerScoreEl.textContent = scores.player;
    aiScoreEl.textContent = scores.ai;
    drawScoreEl.textContent = scores.draw;
}

function resetGame() {
    board = Array(9).fill('');
    isGameActive = true;
    currentPlayer = 'X';
    updateStatus('Your turn (X)');

    cells.forEach(cell => {
        cell.textContent = '';
        cell.classList.remove('filled', 'winner');
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

// Start the game loop
initGame();
