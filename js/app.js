/**
 * HearthDoku — Main app orchestration
 */
const App = (() => {
    let allCards = [];
    let allowedSets = [];
    let allowedRarities = [];
    let allowedClasses = [];
    let allSets = [];
    let isDailyMode = false;

    const ALL_RARITIES = ['LEGENDARY', 'EPIC', 'RARE', 'COMMON', 'FREE'];
    const ALL_CLASSES = [
        'DEATHKNIGHT', 'DEMONHUNTER', 'DRUID', 'HUNTER', 'MAGE',
        'PALADIN', 'PRIEST', 'ROGUE', 'SHAMAN', 'WARLOCK',
        'WARRIOR', 'NEUTRAL',
    ];

    // ---------- Daily mode helpers ----------

    function getDailyDateStr() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${y}-${m}-${day}`;
    }

    function getDailySeed() {
        // djb2 hash of YYYYMMDD string (local time)
        const str = getDailyDateStr().replace(/-/g, '');
        let hash = 5381;
        for (let i = 0; i < str.length; i++) {
            hash = ((hash << 5) + hash) + str.charCodeAt(i);
            hash |= 0;
        }
        return hash;
    }

    function getDailyNumber() {
        const epoch = new Date('2025-01-01T00:00:00');
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return Math.max(1, Math.floor((today - epoch) / (1000 * 60 * 60 * 24)) + 1);
    }

    function getDailyStorageKey() {
        return `hearthdoku_daily_${getDailyDateStr()}`;
    }

    function saveDailyResult(score, time, errors) {
        try {
            localStorage.setItem(getDailyStorageKey(), JSON.stringify({ completed: true, score, time, errors }));
        } catch { /* localStorage unavailable */ }
    }

    function getDailyResult() {
        try {
            const raw = localStorage.getItem(getDailyStorageKey());
            return raw ? JSON.parse(raw) : null;
        } catch { return null; }
    }

    // ---------- Mode switching ----------

    function enterDailyMode() {
        isDailyMode = true;
        document.getElementById('btnModeDaily').classList.add('btn--mode--active');
        document.getElementById('btnModeUnlimited').classList.remove('btn--mode--active');
        document.getElementById('btnNewPuzzle').style.display = 'none';
        document.querySelectorAll('.filter-section').forEach(el => { el.style.display = 'none'; });
        generateDailyPuzzle();
    }

    function enterUnlimitedMode() {
        isDailyMode = false;
        document.getElementById('btnModeUnlimited').classList.add('btn--mode--active');
        document.getElementById('btnModeDaily').classList.remove('btn--mode--active');
        document.getElementById('btnNewPuzzle').style.display = '';
        document.querySelectorAll('.filter-section').forEach(el => { el.style.display = ''; });
        UI.hideDailyBadge();
        generateNewPuzzle();
    }

    function generateDailyPuzzle() {
        UI.showLoading();

        setTimeout(() => {
            const seed = getDailySeed();
            PuzzleEngine.setRng(PuzzleEngine.mulberry32(seed));

            const puzzle = PuzzleEngine.generatePuzzle(allCards, null);
            PuzzleEngine.resetRng();

            if (!puzzle) {
                UI.hideLoading();
                alert(I18n.t('errorGenerate'));
                return;
            }

            const dayNum = getDailyNumber();
            const dateStr = getDailyDateStr().split('-').reverse().join('/');
            UI.showDailyBadge(`${I18n.t('dailyTitle')}${dayNum} — ${dateStr}`);
            UI.renderPuzzle(puzzle, { daily: true, dayNum, dateStr, saveFn: saveDailyResult });
            UI.hideLoading();

            const prev = getDailyResult();
            if (prev) {
                UI.markDailyAlreadyPlayed();
            }
        }, 50);
    }

    async function init() {
        UI.init();
        UI.showLoading();
        UI.updateUIText();

        // Language switcher
        const langSelect = document.getElementById('langSelect');
        if (langSelect) {
            langSelect.value = I18n.getLang();
            langSelect.addEventListener('change', async () => {
                const newLang = langSelect.value;
                I18n.setLang(newLang);
                UI.updateUIText();
                UI.showLoading();

                // Reload cards in the new language
                allCards = await HearthstoneAPI.fetchCards();
                allSets = HearthstoneAPI.getAllSets();
                allowedSets = [...allSets];
                allowedRarities = [...ALL_RARITIES];
                allowedClasses = [...ALL_CLASSES];

                UI.renderFilterList(allSets);
                UI.renderRarityFilterList();
                UI.renderClassFilterList();

                if (isDailyMode) {
                    generateDailyPuzzle();
                } else {
                    generateNewPuzzle();
                }
            });
        }

        try {
            allCards = await HearthstoneAPI.fetchCards();
            allSets = HearthstoneAPI.getAllSets();

            // Default: all allowed
            allowedSets = [...allSets];
            allowedRarities = [...ALL_RARITIES];
            allowedClasses = [...ALL_CLASSES];

            // Render filters
            UI.renderFilterList(allSets);
            UI.renderRarityFilterList();
            UI.renderClassFilterList();

            // Mode buttons
            document.getElementById('btnModeUnlimited').addEventListener('click', () => {
                if (!isDailyMode) return;
                enterUnlimitedMode();
            });
            document.getElementById('btnModeDaily').addEventListener('click', () => {
                if (isDailyMode) return;
                enterDailyMode();
            });

            // Bind buttons
            document.getElementById('btnNewPuzzle').addEventListener('click', generateNewPuzzle);
            document.getElementById('btnShowSolution').addEventListener('click', () => UI.showSolution());
            document.getElementById('btnExport').addEventListener('click', () => UI.showExportModal());
            document.getElementById('btnShare').addEventListener('click', () => ExportManager.shareToClipboard());

            // Export modal buttons
            document.getElementById('exportEmpty').addEventListener('click', () => {
                ExportManager.exportPNG(false);
                UI.closeExportModal();
            });
            document.getElementById('exportSolutions').addEventListener('click', () => {
                ExportManager.exportPNG(true);
                UI.closeExportModal();
            });
            document.getElementById('exportClose').addEventListener('click', () => UI.closeExportModal());

            // Victory modal buttons
            document.getElementById('victoryShare').addEventListener('click', () => ExportManager.shareToClipboard());
            document.getElementById('victoryNewPuzzle').addEventListener('click', () => {
                UI.closeVictoryModal();
                if (isDailyMode) {
                    generateDailyPuzzle();
                } else {
                    generateNewPuzzle();
                }
            });
            document.getElementById('victoryExport').addEventListener('click', () => {
                UI.closeVictoryModal();
                UI.showExportModal();
            });

            // Preset buttons (extensions)
            document.querySelectorAll('[data-preset]').forEach(btn => {
                btn.addEventListener('click', () => {
                    const preset = btn.dataset.preset;
                    switch (preset) {
                        case 'standard':
                            UI.setPresetChecked(HearthstoneAPI.STANDARD_SETS);
                            break;
                        case 'wild':
                            UI.setAllChecked(true);
                            break;
                        case 'classic':
                            UI.setPresetChecked(HearthstoneAPI.CLASSIC_SETS);
                            break;
                    }
                    onSetFilterChange();
                });
            });

            // Check/uncheck all (extensions)
            document.getElementById('btnCheckAll').addEventListener('click', () => {
                UI.setAllChecked(true);
                onSetFilterChange();
            });
            document.getElementById('btnUncheckAll').addEventListener('click', () => {
                UI.setAllChecked(false);
                onSetFilterChange();
            });

            // Check/uncheck all (rarities)
            document.getElementById('btnCheckAllRarity').addEventListener('click', () => {
                UI.setAllRarityChecked(true);
                onRarityFilterChange();
            });
            document.getElementById('btnUncheckAllRarity').addEventListener('click', () => {
                UI.setAllRarityChecked(false);
                onRarityFilterChange();
            });

            // Check/uncheck all (classes)
            document.getElementById('btnCheckAllClass').addEventListener('click', () => {
                UI.setAllClassChecked(true);
                onClassFilterChange();
            });
            document.getElementById('btnUncheckAllClass').addEventListener('click', () => {
                UI.setAllClassChecked(false);
                onClassFilterChange();
            });

            UI.hideLoading();
            generateNewPuzzle();
        } catch (err) {
            console.error('Init error:', err);
            UI.hideLoading();
            alert(I18n.t('errorLoadCards'));
        }
    }

    function cardMatchesClass(card, allowedCls) {
        if (allowedCls.length === 0) return true;
        if (allowedCls.includes('NEUTRAL')) {
            if (card.cardClass === 'NEUTRAL' || (!card.cardClass && !card.classes)) return true;
        }
        if (card.cardClass && allowedCls.includes(card.cardClass)) return true;
        if (Array.isArray(card.classes) && card.classes.some(c => allowedCls.includes(c))) return true;
        return false;
    }

    function buildPool() {
        let pool = allCards;
        if (allowedSets.length > 0 && allowedSets.length !== allSets.length) {
            pool = pool.filter(c => allowedSets.includes(c.set));
        }
        if (allowedRarities.length > 0 && allowedRarities.length !== ALL_RARITIES.length) {
            pool = pool.filter(c => allowedRarities.includes(c.rarity));
        }
        if (allowedClasses.length > 0 && allowedClasses.length !== ALL_CLASSES.length) {
            pool = pool.filter(c => cardMatchesClass(c, allowedClasses));
        }
        return pool;
    }

    function generateNewPuzzle() {
        UI.showLoading();

        setTimeout(() => {
            allowedSets = UI.getCheckedSets();
            allowedRarities = UI.getCheckedRarities();
            allowedClasses = UI.getCheckedClasses();

            const pool = buildPool();
            const puzzle = PuzzleEngine.generatePuzzle(pool, null);

            if (!puzzle) {
                UI.hideLoading();
                alert(I18n.t('errorGenerate'));
                return;
            }

            UI.renderPuzzle(puzzle);
            UI.hideLoading();
        }, 50);
    }

    function getFilteredCards() {
        return buildPool();
    }

    function getAllowedSets() {
        return allowedSets;
    }

    function getAllowedRarities() {
        return allowedRarities;
    }

    function getAllowedClasses() {
        return allowedClasses;
    }

    function getIsDailyMode() {
        return isDailyMode;
    }

    function onSetFilterChange() {
        allowedSets = UI.getCheckedSets();
    }

    function onRarityFilterChange() {
        allowedRarities = UI.getCheckedRarities();
    }

    function onClassFilterChange() {
        allowedClasses = UI.getCheckedClasses();
    }

    // Start
    document.addEventListener('DOMContentLoaded', init);

    return {
        getFilteredCards,
        getAllowedSets,
        getAllowedRarities,
        getAllowedClasses,
        getIsDailyMode,
        onSetFilterChange,
        onRarityFilterChange,
        onClassFilterChange,
    };
})();
