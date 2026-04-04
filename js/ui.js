/**
 * HearthDoku — UI rendering: grid, badges, modals, animations
 */
const UI = (() => {
    // State
    let currentPuzzle = null;
    let cellState = Array(9).fill(null); // null = empty, { card, correct } = answered
    let score = 0;
    let pp = 9;
    let timerInterval = null;
    let timerSeconds = 0;
    let usedCardIds = new Set();
    let activeCellIndex = null;
    let gameFinished = false;

    // DOM references
    const els = {};

    function cacheElements() {
        els.puzzleGrid = document.getElementById('puzzleGrid');
        els.puzzleContainer = document.getElementById('puzzleContainer');
        els.loadingOverlay = document.getElementById('loadingOverlay');
        els.searchModal = document.getElementById('searchModal');
        els.searchInput = document.getElementById('searchInput');
        els.searchResults = document.getElementById('searchResults');
        els.searchTitle = document.getElementById('searchTitle');
        els.searchClose = document.getElementById('searchClose');
        els.victoryModal = document.getElementById('victoryModal');
        els.exportModal = document.getElementById('exportModal');
        els.statUniq = document.getElementById('statUniq');
        els.statPts = document.getElementById('statPts');
        els.statPP = document.getElementById('statPP');
        els.statTimer = document.getElementById('statTimer');
        els.controlsToggle = document.getElementById('controlsToggle');
        els.controlsContent = document.getElementById('controlsContent');
        els.filterList = document.getElementById('filterList');
        els.filterSearch = document.getElementById('filterSearch');
    }

    function init() {
        cacheElements();
        bindEvents();
    }

    function bindEvents() {
        // Cell clicks
        document.querySelectorAll('.grid-cell').forEach(cell => {
            cell.addEventListener('click', () => {
                if (gameFinished) return;
                const row = parseInt(cell.dataset.row);
                const col = parseInt(cell.dataset.col);
                const idx = row * 3 + col;
                if (cellState[idx]) return; // Already answered
                openSearchModal(idx);
            });
        });

        // Search modal
        els.searchClose.addEventListener('click', closeSearchModal);
        els.searchModal.addEventListener('click', (e) => {
            if (e.target === els.searchModal) closeSearchModal();
        });
        els.searchInput.addEventListener('input', onSearchInput);
        // Export modal click outside
        els.exportModal.addEventListener('click', (e) => {
            if (e.target === els.exportModal) closeExportModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeSearchModal();
                closeExportModal();
            }
        });

        // Controls toggle
        els.controlsToggle.addEventListener('click', () => {
            els.controlsContent.classList.toggle('controls-content--open');
        });

        // Filter search
        els.filterSearch.addEventListener('input', onFilterSearch);
    }

    function showLoading() {
        els.loadingOverlay.style.display = 'flex';
    }

    function hideLoading() {
        els.loadingOverlay.style.display = 'none';
    }

    function resetGame() {
        cellState = Array(9).fill(null);
        score = 0;
        pp = 9;
        timerSeconds = 0;
        usedCardIds = new Set();
        activeCellIndex = null;
        gameFinished = false;
        clearInterval(timerInterval);
        updateStats();

        // Clear cell visuals
        document.querySelectorAll('.grid-cell').forEach(cell => {
            cell.innerHTML = '';
            cell.className = 'grid-cell';
        });
    }

    function startTimer() {
        clearInterval(timerInterval);
        timerSeconds = 0;
        timerInterval = setInterval(() => {
            timerSeconds++;
            els.statTimer.textContent = formatTime(timerSeconds);
        }, 1000);
    }

    function formatTime(seconds) {
        const m = Math.floor(seconds / 60);
        const s = seconds % 60;
        return `${m}:${s.toString().padStart(2, '0')}`;
    }

    function renderPuzzle(puzzle) {
        currentPuzzle = puzzle;
        resetGame();

        // Render column headers
        for (let c = 0; c < 3; c++) {
            const el = document.getElementById(`colHeader${c}`);
            el.innerHTML = renderBadge(puzzle.colCriteria[c]);
        }

        // Render row headers
        for (let r = 0; r < 3; r++) {
            const el = document.getElementById(`rowHeader${r}`);
            el.innerHTML = renderBadge(puzzle.rowCriteria[r]);
        }

        // Update unique count
        els.statUniq.textContent = puzzle.uniqueCount;

        startTimer();
    }

    function renderBadge(criterion) {
        const display = PuzzleEngine.getCriterionDisplay(criterion);
        // icon may contain <img> HTML or emoji text
        return `<div class="badge ${display.bgClass}" title="${display.tooltip}">
            <span class="badge__icon">${display.icon}</span>
            <span class="badge__label">${display.label}</span>
        </div>`;
    }

    function updateStats() {
        els.statPts.textContent = score;
        els.statPP.textContent = `${pp}/9`;
        els.statPP.classList.toggle('stat-value--danger', pp <= 3);
    }

    // Search modal
    function openSearchModal(cellIndex) {
        activeCellIndex = cellIndex;
        const row = Math.floor(cellIndex / 3);
        const col = cellIndex % 3;
        const rowDisplay = PuzzleEngine.getCriterionDisplay(currentPuzzle.rowCriteria[row]);
        const colDisplay = PuzzleEngine.getCriterionDisplay(currentPuzzle.colCriteria[col]);
        els.searchTitle.innerHTML = `${rowDisplay.icon} ${rowDisplay.label} <span style="margin:0 0.3rem">×</span> ${colDisplay.icon} ${colDisplay.label}`;
        els.searchInput.value = '';
        els.searchResults.innerHTML = '';
        els.searchModal.classList.add('modal-overlay--visible');
        setTimeout(() => els.searchInput.focus(), 100);
    }

    function closeSearchModal() {
        els.searchModal.classList.remove('modal-overlay--visible');
        activeCellIndex = null;
        CardSearch.cancelSearch();
    }

    function onSearchInput() {
        const query = els.searchInput.value.trim();
        if (query.length < 2) {
            els.searchResults.innerHTML = '';
            return;
        }

        const allCards = HearthstoneAPI.getCollectibleCards();
        // Filter by allowed sets if applicable
        const pool = App.getFilteredCards ? App.getFilteredCards() : allCards;

        CardSearch.debouncedSearch(query, pool, (results) => {
            renderSearchResults(results);
        });
    }

    function renderSearchResults(results) {
        if (results.length === 0) {
            els.searchResults.innerHTML = '<div class="search-empty">Aucune carte trouvée</div>';
            return;
        }

        // Only show card name — no stats, no set, no image (anti-spoil)
        els.searchResults.innerHTML = results.map(card => {
            const used = usedCardIds.has(card.dbfId || card.id);

            return `<div class="search-result ${used ? 'search-result--used' : ''}" data-card-id="${card.id}" data-dbf-id="${card.dbfId}">
                <div class="search-result__info">
                    <div class="search-result__name">${card.name}</div>
                </div>
                ${used ? '<div class="search-result__used-tag">Déjà utilisée</div>' : ''}
            </div>`;
        }).join('');

        // Bind click events
        els.searchResults.querySelectorAll('.search-result:not(.search-result--used)').forEach(el => {
            el.addEventListener('click', () => {
                const cardId = el.dataset.cardId;
                const dbfId = parseInt(el.dataset.dbfId);
                selectCard(cardId, dbfId);
            });
        });
    }

    function selectCard(cardId, dbfId) {
        if (activeCellIndex === null || !currentPuzzle) return;

        const row = Math.floor(activeCellIndex / 3);
        const col = activeCellIndex % 3;
        const validCards = currentPuzzle.cellCards[activeCellIndex];
        const card = validCards.find(c => (c.dbfId === dbfId) || (c.id === cardId));
        const allCards = HearthstoneAPI.getCollectibleCards();
        const selectedCard = allCards.find(c => c.id === cardId);

        const cellEl = document.querySelector(`.grid-cell[data-row="${row}"][data-col="${col}"]`);

        if (card) {
            // Correct answer
            const cardScore = PuzzleEngine.calculateScore(card, validCards);
            score += cardScore;
            cellState[activeCellIndex] = { card, correct: true };
            usedCardIds.add(dbfId || cardId);

            const renderUrl = HearthstoneAPI.getCardRenderUrl(cardId);
            cellEl.innerHTML = `<div class="cell-card cell-card--correct">
                <img src="${renderUrl}" alt="${card.name}" onerror="this.parentElement.innerHTML='<span class=\\'cell-card__name\\'>${card.name}</span>'">
                <div class="cell-card__name-overlay">${card.name}</div>
                <div class="cell-card__score">+${cardScore}</div>
            </div>`;
            cellEl.classList.add('grid-cell--correct');
            animateCorrect(cellEl);

            closeSearchModal();
            updateStats();
            checkVictory();
        } else {
            // Incorrect
            pp--;
            cellEl.classList.add('grid-cell--wrong');
            const name = selectedCard ? selectedCard.name : cardId;
            cellEl.innerHTML = `<div class="cell-card cell-card--wrong">
                <span class="cell-card__x">✗</span>
                <span class="cell-card__name">${name}</span>
            </div>`;
            cellState[activeCellIndex] = { card: selectedCard, correct: false };
            animateWrong(cellEl);

            closeSearchModal();
            updateStats();

            if (pp <= 0) {
                endGame(false);
            }
        }
    }

    function animateCorrect(el) {
        el.classList.add('anim-correct');
        setTimeout(() => el.classList.remove('anim-correct'), 600);
    }

    function animateWrong(el) {
        el.classList.add('anim-wrong');
        setTimeout(() => el.classList.remove('anim-wrong'), 600);
    }

    function checkVictory() {
        const correctCount = cellState.filter(s => s && s.correct).length;
        if (correctCount === 9) {
            endGame(true);
        }
    }

    function endGame(victory) {
        gameFinished = true;
        clearInterval(timerInterval);

        if (victory) {
            showVictoryModal();
        }
    }

    function showVictoryModal() {
        document.getElementById('victoryScore').textContent = score;
        document.getElementById('victoryTime').textContent = formatTime(timerSeconds);
        document.getElementById('victoryPP').textContent = `${pp}/9`;
        els.victoryModal.classList.add('modal-overlay--visible');
        spawnConfetti();
    }

    function closeVictoryModal() {
        els.victoryModal.classList.remove('modal-overlay--visible');
    }

    function showExportModal() {
        els.exportModal.classList.add('modal-overlay--visible');
    }

    function closeExportModal() {
        els.exportModal.classList.remove('modal-overlay--visible');
    }

    function showSolution() {
        if (!currentPuzzle) return;
        gameFinished = true;
        clearInterval(timerInterval);

        // Collect already used card IDs from correct answers
        const alreadyUsedIds = [];
        for (let i = 0; i < 9; i++) {
            if (cellState[i] && cellState[i].correct) {
                const id = cellState[i].card.dbfId || cellState[i].card.id;
                alreadyUsedIds.push(id);
            }
        }

        // Find a complete solution with 9 distinct cards
        const solution = PuzzleEngine.findSolution(currentPuzzle.cellCards, alreadyUsedIds);

        for (let i = 0; i < 9; i++) {
            if (cellState[i] && cellState[i].correct) continue;

            const card = solution[i];
            if (!card) continue;

            const row = Math.floor(i / 3);
            const col = i % 3;
            const renderUrl = HearthstoneAPI.getCardRenderUrl(card.id);
            const cellEl = document.querySelector(`.grid-cell[data-row="${row}"][data-col="${col}"]`);
            cellEl.innerHTML = `<div class="cell-card cell-card--solution">
                <img src="${renderUrl}" alt="${card.name}" onerror="this.parentElement.innerHTML='<span class=\\'cell-card__name\\'>${card.name}</span>'">
                <div class="cell-card__name-overlay">${card.name}</div>
                <div class="cell-card__solution-tag">Solution</div>
            </div>`;
            cellEl.classList.add('grid-cell--solution');
        }
    }

    function getShareText() {
        const today = new Date();
        const dateStr = today.toLocaleDateString('fr-FR');
        const grid = [];
        for (let r = 0; r < 3; r++) {
            let row = '';
            for (let c = 0; c < 3; c++) {
                const idx = r * 3 + c;
                const state = cellState[idx];
                if (state && state.correct) row += '🟩';
                else if (state) row += '🟥';
                else row += '⬛';
            }
            grid.push(row);
        }

        return `🎴 HearthDoku — ${dateStr}\n${grid.join('\n')}\nScore: ${score} | PP: ${pp}/9 | ⏱️ ${formatTime(timerSeconds)}`;
    }

    function spawnConfetti() {
        const canvas = document.getElementById('confettiCanvas');
        if (!canvas) return;
        const ctx = canvas.getContext('2d');

        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        canvas.style.display = 'block';

        const colors = [
            '#f39c12', '#e74c3c', '#2ecc71', '#3498db', '#9b59b6',
            '#1abc9c', '#f1c40f', '#e67e22', '#FF6B6B', '#4ECDC4',
            '#FFE66D', '#A8E6CF', '#FF8C94', '#C3A6FF'
        ];
        const shapes = ['square', 'circle', 'triangle', 'ribbon'];

        const TOTAL = 220;
        const particles = [];

        for (let i = 0; i < TOTAL; i++) {
            const size = 6 + Math.random() * 9;
            particles.push({
                x: Math.random() * canvas.width,
                y: -20 - Math.random() * canvas.height * 0.6,
                size,
                color: colors[Math.floor(Math.random() * colors.length)],
                shape: shapes[Math.floor(Math.random() * shapes.length)],
                speedY: 2.5 + Math.random() * 3.5,
                speedX: (Math.random() - 0.5) * 2,
                rotation: Math.random() * Math.PI * 2,
                rotationSpeed: (Math.random() - 0.5) * 0.18,
                opacity: 1,
                sway: Math.random() * Math.PI * 2,
                swaySpeed: 0.025 + Math.random() * 0.025,
                swayAmount: 1.5 + Math.random() * 2.5,
            });
        }

        let rafId;

        function drawParticle(p) {
            ctx.save();
            ctx.globalAlpha = p.opacity;
            ctx.fillStyle = p.color;
            ctx.translate(p.x, p.y);
            ctx.rotate(p.rotation);

            switch (p.shape) {
                case 'square':
                    ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size);
                    break;
                case 'circle':
                    ctx.beginPath();
                    ctx.arc(0, 0, p.size / 2, 0, Math.PI * 2);
                    ctx.fill();
                    break;
                case 'triangle':
                    ctx.beginPath();
                    ctx.moveTo(0, -p.size / 2);
                    ctx.lineTo(p.size / 2, p.size / 2);
                    ctx.lineTo(-p.size / 2, p.size / 2);
                    ctx.closePath();
                    ctx.fill();
                    break;
                case 'ribbon':
                    ctx.fillRect(-p.size / 5, -p.size, p.size / 2.5, p.size * 2);
                    break;
            }
            ctx.restore();
        }

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            let alive = false;

            for (const p of particles) {
                if (p.opacity <= 0) continue;
                alive = true;

                p.sway += p.swaySpeed;
                p.x += p.speedX + Math.sin(p.sway) * p.swayAmount;
                p.y += p.speedY;
                p.rotation += p.rotationSpeed;

                if (p.y > canvas.height * 0.72) {
                    p.opacity -= 0.025;
                    if (p.opacity < 0) p.opacity = 0;
                }

                drawParticle(p);
            }

            if (alive) {
                rafId = requestAnimationFrame(animate);
            } else {
                canvas.style.display = 'none';
            }
        }

        if (rafId) cancelAnimationFrame(rafId);
        animate();
    }

    // Extension filter
    function renderFilterList(sets) {
        const allowedSets = App.getAllowedSets ? App.getAllowedSets() : sets;
        els.filterList.innerHTML = sets.map(s => {
            const name = HearthstoneAPI.getSetDisplayName(s);
            const checked = allowedSets.includes(s) ? 'checked' : '';
            return `<label class="filter-item" data-set="${s}" data-name="${name.toLowerCase()}">
                <input type="checkbox" value="${s}" ${checked}> ${name}
            </label>`;
        }).join('');

        els.filterList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                if (App.onSetFilterChange) App.onSetFilterChange();
            });
        });
    }

    function getCheckedSets() {
        const checkboxes = els.filterList.querySelectorAll('input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    function setAllChecked(checked) {
        els.filterList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            if (cb.closest('.filter-item').style.display !== 'none') {
                cb.checked = checked;
            }
        });
    }

    function setPresetChecked(sets) {
        els.filterList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = sets.includes(cb.value);
        });
    }

    function onFilterSearch() {
        const query = CardSearch.normalizeString(els.filterSearch.value);
        els.filterList.querySelectorAll('.filter-item').forEach(item => {
            const name = item.dataset.name || '';
            item.style.display = name.includes(query) ? '' : 'none';
        });
    }

    return {
        init,
        showLoading,
        hideLoading,
        renderPuzzle,
        resetGame,
        showSolution,
        showExportModal,
        closeExportModal,
        closeVictoryModal,
        getShareText,
        renderFilterList,
        getCheckedSets,
        setAllChecked,
        setPresetChecked,
        updateStats,
        get currentPuzzle() { return currentPuzzle; },
        get score() { return score; },
        get pp() { return pp; },
        get timerSeconds() { return timerSeconds; },
        get gameFinished() { return gameFinished; },
        formatTime,
    };
})();
