/**
 * HearthDoku — UI rendering: grid, badges, modals, animations
 */
const UI = (() => {
    // State
    let currentPuzzle = null;
    let cellState = Array(9).fill(null);
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
        els.rarityFilterList = document.getElementById('rarityFilterList');
        els.classFilterList = document.getElementById('classFilterList');
    }

    function init() {
        cacheElements();
        bindEvents();
    }

    function bindEvents() {
        document.querySelectorAll('.grid-cell').forEach(cell => {
            cell.addEventListener('click', () => {
                if (gameFinished) return;
                const row = parseInt(cell.dataset.row);
                const col = parseInt(cell.dataset.col);
                const idx = row * 3 + col;
                if (cellState[idx]) return;
                openSearchModal(idx);
            });
        });

        els.searchClose.addEventListener('click', closeSearchModal);
        els.searchModal.addEventListener('click', (e) => {
            if (e.target === els.searchModal) closeSearchModal();
        });
        els.searchInput.addEventListener('input', onSearchInput);
        els.exportModal.addEventListener('click', (e) => {
            if (e.target === els.exportModal) closeExportModal();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeSearchModal();
                closeExportModal();
                closeSolutionModal();
            }
        });

        els.controlsToggle.addEventListener('click', () => {
            els.controlsContent.classList.toggle('controls-content--open');
        });

        els.filterSearch.addEventListener('input', onFilterSearch);

        window.addEventListener('resize', () => {
            if (els.victoryModal && els.victoryModal.classList.contains('modal-overlay--visible')) {
                centerModalOnPuzzle(els.victoryModal);
            }
        });
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

        for (let c = 0; c < 3; c++) {
            const el = document.getElementById(`colHeader${c}`);
            el.innerHTML = renderBadge(puzzle.colCriteria[c]);
        }

        for (let r = 0; r < 3; r++) {
            const el = document.getElementById(`rowHeader${r}`);
            el.innerHTML = renderBadge(puzzle.rowCriteria[r]);
        }

        els.statUniq.textContent = puzzle.uniqueCount;
        startTimer();
    }

    function renderBadge(criterion) {
        const display = PuzzleEngine.getCriterionDisplay(criterion);
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

    function openSearchModal(cellIndex) {
        activeCellIndex = cellIndex;
        const row = Math.floor(cellIndex / 3);
        const col = cellIndex % 3;
        const rowDisplay = PuzzleEngine.getCriterionDisplay(currentPuzzle.rowCriteria[row]);
        const colDisplay = PuzzleEngine.getCriterionDisplay(currentPuzzle.colCriteria[col]);
        els.searchTitle.innerHTML = `${rowDisplay.icon} ${rowDisplay.label} <span style="margin:0 0.3rem">×</span> ${colDisplay.icon} ${colDisplay.label}`;
        els.searchInput.value = '';
        els.searchInput.placeholder = I18n.t('searchPlaceholder');
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
        const pool = App.getFilteredCards ? App.getFilteredCards() : allCards;

        CardSearch.debouncedSearch(query, pool, (results) => {
            renderSearchResults(results);
        });
    }

    function renderSearchResults(results) {
        if (results.length === 0) {
            els.searchResults.innerHTML = `<div class="search-empty">${I18n.t('noCardFound')}</div>`;
            return;
        }

        // Sets that share identical card names across versions — always show their set badge
        const AMBIGUOUS_SETS = new Set(['CORE', 'LEGACY', 'EXPERT1', 'VANILLA']);

        els.searchResults.innerHTML = results.map(card => {
            const used = usedCardIds.has(card.dbfId || card.id);
            const setCode = card.set || '';
            const showSetBadge = AMBIGUOUS_SETS.has(setCode);
            const setIcon = showSetBadge ? HearthstoneAPI.getSetIcon(setCode) : null;
            const setName = showSetBadge ? HearthstoneAPI.getSetDisplayName(setCode) : '';
            const setIconHtml = setIcon
                ? `<img class="search-result__set-icon" src="${setIcon}" alt="" onerror="this.style.display='none'">`
                : '';

            return `<div class="search-result ${used ? 'search-result--used' : ''}" data-card-id="${card.id}" data-dbf-id="${card.dbfId}">
                <div class="search-result__info">
                    <div class="search-result__name">${card.name}</div>
                    ${showSetBadge ? `<div class="search-result__set">${setIconHtml}<span>${setName}</span></div>` : ''}
                </div>
                ${used ? `<div class="search-result__used-tag">${I18n.t('alreadyUsed')}</div>` : ''}
            </div>`;
        }).join('');

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
        if (els.puzzleContainer) {
            els.puzzleContainer.scrollIntoView({ block: 'center', behavior: 'auto' });
        }
        els.victoryModal.classList.add('modal-overlay--visible');
        centerModalOnPuzzle(els.victoryModal);
        spawnConfetti();
    }

    function closeVictoryModal() {
        els.victoryModal.classList.remove('modal-overlay--visible');
        els.victoryModal.style.removeProperty('--anchor-x');
        els.victoryModal.style.removeProperty('--anchor-y');
    }

    function centerModalOnPuzzle(overlay) {
        if (!els.puzzleContainer) return;
        const rect = els.puzzleContainer.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        overlay.style.setProperty('--anchor-x', `${cx}px`);
        overlay.style.setProperty('--anchor-y', `${cy}px`);
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

        const alreadyUsedIds = [];
        for (let i = 0; i < 9; i++) {
            if (cellState[i] && cellState[i].correct) {
                const id = cellState[i].card.dbfId || cellState[i].card.id;
                alreadyUsedIds.push(id);
            }
        }

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
                <div class="cell-card__solution-tag">${I18n.t('solution')}</div>
            </div>`;
            cellEl.classList.add('grid-cell--solution');
        }

        showSolutionPopup();
    }

    function showSolutionPopup() {
        if (!currentPuzzle) return;

        const modal = document.getElementById('solutionModal');
        const grid = document.getElementById('solutionModalGrid');
        const title = document.getElementById('solutionModalTitle');
        const closeBtn = document.getElementById('solutionModalClose');

        title.textContent = I18n.t('allSolutions');

        let html = '';
        for (let i = 0; i < 9; i++) {
            const row = Math.floor(i / 3);
            const col = i % 3;
            const rowDisplay = PuzzleEngine.getCriterionDisplay(currentPuzzle.rowCriteria[row]);
            const colDisplay = PuzzleEngine.getCriterionDisplay(currentPuzzle.colCriteria[col]);
            const cards = currentPuzzle.cellCards[i];

            html += `<div class="solution-cell">
                <div class="solution-cell__header">
                    <span class="solution-cell__criteria">${rowDisplay.icon} ${rowDisplay.label} × ${colDisplay.icon} ${colDisplay.label}</span>
                    <span class="solution-cell__count">${cards.length} ${I18n.t('cardsAvailable')}</span>
                </div>
                <div class="solution-cell__cards">
                    ${cards.map(card => {
                        const renderUrl = HearthstoneAPI.getCardRenderUrl(card.id);
                        return `<div class="solution-card" title="${card.name}">
                            <img src="${renderUrl}" alt="${card.name}" onerror="this.parentElement.innerHTML='<span class=\\'solution-card__name\\'>${card.name}</span>'">
                            <div class="solution-card__label">${card.name}</div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        }

        grid.innerHTML = html;
        modal.classList.add('modal-overlay--visible');

        const onClose = () => {
            modal.classList.remove('modal-overlay--visible');
            closeBtn.removeEventListener('click', onClose);
            modal.removeEventListener('click', onModalClick);
        };
        const onModalClick = (e) => {
            if (e.target === modal) onClose();
        };

        closeBtn.addEventListener('click', onClose);
        modal.addEventListener('click', onModalClick);
    }

    function closeSolutionModal() {
        const modal = document.getElementById('solutionModal');
        if (modal) modal.classList.remove('modal-overlay--visible');
    }

    function getShareText() {
        const today = new Date();
        const dateStr = today.toLocaleDateString(I18n.t('shareDate'));
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

    function renderFilterList(sets) {
        const allowedSets = App.getAllowedSets ? App.getAllowedSets() : sets;
        els.filterList.innerHTML = sets.map(s => {
            const name = HearthstoneAPI.getSetDisplayName(s);
            const checked = allowedSets.includes(s) ? 'checked' : '';
            const iconPath = HearthstoneAPI.getSetIcon(s);
            const iconHtml = iconPath
                ? `<img class="filter-item__icon" src="${iconPath}" alt="" onerror="this.style.display='none'">`
                : '';
            return `<label class="filter-item" data-set="${s}" data-name="${name.toLowerCase()}">
                <input type="checkbox" value="${s}" ${checked}>
                ${iconHtml}
                <span class="filter-item__label">${name}</span>
            </label>`;
        }).join('');

        els.filterList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                if (App.onSetFilterChange) App.onSetFilterChange();
            });
        });
    }

    function renderRarityFilterList() {
        const rarityMap = HearthstoneAPI.getRarityMap();
        // Display order: Legendary, Epic, Rare, Common, Free
        const order = ['LEGENDARY', 'EPIC', 'RARE', 'COMMON', 'FREE'];
        const rarities = order.filter(r => rarityMap[r]);
        const allowed = App.getAllowedRarities ? App.getAllowedRarities() : rarities;

        els.rarityFilterList.innerHTML = rarities.map(r => {
            const name = rarityMap[r] || r;
            const checked = allowed.includes(r) ? 'checked' : '';
            const iconPath = HearthstoneAPI.getRarityIcon(r);
            const iconHtml = iconPath
                ? `<img class="filter-item__icon" src="${iconPath}" alt="" onerror="this.style.display='none'">`
                : '';
            return `<label class="filter-item filter-item--rarity filter-item--rarity-${r.toLowerCase()}">
                <input type="checkbox" value="${r}" ${checked}>
                ${iconHtml}
                <span class="filter-item__label">${name}</span>
            </label>`;
        }).join('');

        els.rarityFilterList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                if (App.onRarityFilterChange) App.onRarityFilterChange();
            });
        });
    }

    function renderClassFilterList() {
        const classMap = HearthstoneAPI.getClassMap();
        const order = [
            'DEATHKNIGHT', 'DEMONHUNTER', 'DRUID', 'HUNTER', 'MAGE',
            'PALADIN', 'PRIEST', 'ROGUE', 'SHAMAN', 'WARLOCK',
            'WARRIOR', 'NEUTRAL',
        ];
        const classes = order.filter(c => classMap[c]);
        const allowed = App.getAllowedClasses ? App.getAllowedClasses() : classes;

        els.classFilterList.innerHTML = classes.map(cls => {
            const name = classMap[cls] || cls;
            const checked = allowed.includes(cls) ? 'checked' : '';
            const iconPath = HearthstoneAPI.getClassIcon(cls);
            const iconHtml = iconPath
                ? `<img class="filter-item__icon" src="${iconPath}" alt="" onerror="this.style.display='none'">`
                : '';
            return `<label class="filter-item filter-item--class filter-item--class-${cls.toLowerCase()}">
                <input type="checkbox" value="${cls}" ${checked}>
                ${iconHtml}
                <span class="filter-item__label">${name}</span>
            </label>`;
        }).join('');

        els.classFilterList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.addEventListener('change', () => {
                if (App.onClassFilterChange) App.onClassFilterChange();
            });
        });
    }

    function getCheckedSets() {
        const checkboxes = els.filterList.querySelectorAll('input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    function getCheckedRarities() {
        if (!els.rarityFilterList) return [];
        const checkboxes = els.rarityFilterList.querySelectorAll('input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    function getCheckedClasses() {
        if (!els.classFilterList) return [];
        const checkboxes = els.classFilterList.querySelectorAll('input[type="checkbox"]:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    function setAllChecked(checked) {
        els.filterList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            if (cb.closest('.filter-item').style.display !== 'none') {
                cb.checked = checked;
            }
        });
    }

    function setAllRarityChecked(checked) {
        if (!els.rarityFilterList) return;
        els.rarityFilterList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = checked;
        });
    }

    function setAllClassChecked(checked) {
        if (!els.classFilterList) return;
        els.classFilterList.querySelectorAll('input[type="checkbox"]').forEach(cb => {
            cb.checked = checked;
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

    // Update all static UI text based on current language
    function updateUIText() {
        document.documentElement.lang = I18n.getLang();

        // Title bar
        const subtitle = document.querySelector('.title-bar__subtitle');
        if (subtitle) subtitle.textContent = I18n.t('subtitle');

        // Controls
        const controlsTitle = document.querySelector('.controls-title');
        if (controlsTitle) controlsTitle.textContent = I18n.t('controls');

        const toggle = document.getElementById('controlsToggle');
        if (toggle) toggle.setAttribute('aria-label', I18n.t('toggleControls'));

        // Action buttons
        document.getElementById('btnNewPuzzle').textContent = I18n.t('newPuzzle');
        document.getElementById('btnShowSolution').textContent = I18n.t('showSolution');
        document.getElementById('btnExport').textContent = I18n.t('exportPng');
        document.getElementById('btnShare').textContent = I18n.t('share');

        // Filter section
        const filterTitles = document.querySelectorAll('.filter-title');
        if (filterTitles[0]) filterTitles[0].textContent = I18n.t('filterByExtensions');

        const filterRarityTitle = document.getElementById('filterRarityTitle');
        if (filterRarityTitle) filterRarityTitle.textContent = I18n.t('filterByRarities');
        const filterClassTitle = document.getElementById('filterClassTitle');
        if (filterClassTitle) filterClassTitle.textContent = I18n.t('filterByClasses');

        document.querySelector('[data-preset="standard"]').textContent = I18n.t('standard');
        document.querySelector('[data-preset="wild"]').textContent = I18n.t('wild');
        document.querySelector('[data-preset="classic"]').textContent = I18n.t('classic');

        document.getElementById('btnCheckAll').textContent = I18n.t('checkAll');
        document.getElementById('btnUncheckAll').textContent = I18n.t('uncheckAll');
        const btnCheckAllRarity = document.getElementById('btnCheckAllRarity');
        if (btnCheckAllRarity) btnCheckAllRarity.textContent = I18n.t('checkAll');
        const btnUncheckAllRarity = document.getElementById('btnUncheckAllRarity');
        if (btnUncheckAllRarity) btnUncheckAllRarity.textContent = I18n.t('uncheckAll');
        const btnCheckAllClass = document.getElementById('btnCheckAllClass');
        if (btnCheckAllClass) btnCheckAllClass.textContent = I18n.t('checkAll');
        const btnUncheckAllClass = document.getElementById('btnUncheckAllClass');
        if (btnUncheckAllClass) btnUncheckAllClass.textContent = I18n.t('uncheckAll');

        const filterSearch = document.getElementById('filterSearch');
        if (filterSearch) filterSearch.placeholder = I18n.t('searchExtension');

        // Search modal
        const searchInput = document.getElementById('searchInput');
        if (searchInput) searchInput.placeholder = I18n.t('searchPlaceholder');

        // Loading
        const loadingText = document.querySelector('.loading-text');
        if (loadingText) loadingText.textContent = I18n.t('loading');

        // Victory modal
        const victoryTitle = document.querySelector('.victory-title');
        if (victoryTitle) victoryTitle.textContent = I18n.t('victory');

        const victoryLabels = document.querySelectorAll('.victory-stat__label');
        if (victoryLabels.length >= 3) {
            victoryLabels[0].textContent = I18n.t('score');
            victoryLabels[1].textContent = I18n.t('time');
            victoryLabels[2].textContent = I18n.t('ppRemaining');
        }

        document.getElementById('victoryShare').textContent = I18n.t('share');
        document.getElementById('victoryNewPuzzle').textContent = I18n.t('newPuzzle');
        document.getElementById('victoryExport').textContent = I18n.t('exportPng');

        // Export modal
        const exportTitle = document.querySelector('.export-title');
        if (exportTitle) exportTitle.textContent = I18n.t('exportTitle');

        document.getElementById('exportEmpty').textContent = I18n.t('emptyPuzzle');
        document.getElementById('exportSolutions').textContent = I18n.t('puzzleWithSolutions');
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
        renderRarityFilterList,
        renderClassFilterList,
        getCheckedSets,
        getCheckedRarities,
        getCheckedClasses,
        setAllChecked,
        setAllRarityChecked,
        setAllClassChecked,
        setPresetChecked,
        updateStats,
        updateUIText,
        get currentPuzzle() { return currentPuzzle; },
        get score() { return score; },
        get pp() { return pp; },
        get timerSeconds() { return timerSeconds; },
        get gameFinished() { return gameFinished; },
        formatTime,
    };
})();
