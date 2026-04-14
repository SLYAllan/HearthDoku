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

    function getDailySeed() {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        return parseInt(`${y}${m}${d}`, 10);
    }

    function getDailyDateLabel() {
        return new Date().toLocaleDateString(I18n.t('shareDate'), {
            day: 'numeric', month: 'long', year: 'numeric',
        });
    }

    function generateDailyPuzzle() {
        isDailyMode = true;
        UI.showLoading();
        setTimeout(() => {
            const puzzle = PuzzleEngine.generatePuzzle(allCards, null, getDailySeed());
            if (!puzzle) {
                UI.hideLoading();
                alert(I18n.t('errorGenerate'));
                return;
            }
            UI.renderPuzzle(puzzle);
            UI.setModeBar(true, getDailyDateLabel());
            UI.hideLoading();
        }, 50);
    }

    const ALL_RARITIES = ['LEGENDARY', 'EPIC', 'RARE', 'COMMON', 'FREE'];
    const ALL_CLASSES = [
        'DEATHKNIGHT', 'DEMONHUNTER', 'DRUID', 'HUNTER', 'MAGE',
        'PALADIN', 'PRIEST', 'ROGUE', 'SHAMAN', 'WARLOCK',
        'WARRIOR', 'NEUTRAL',
    ];

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
                generateNewPuzzle();
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

            // Bind buttons
            document.getElementById('btnDailyPuzzle').addEventListener('click', generateDailyPuzzle);
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

            // Defeat modal buttons
            document.getElementById('defeatNewPuzzle').addEventListener('click', () => {
                UI.closeDefeatModal();
                generateNewPuzzle();
            });
            document.getElementById('defeatShowSolution').addEventListener('click', () => {
                UI.closeDefeatModal();
                UI.showSolution();
            });

            // Victory modal buttons
            document.getElementById('victoryShare').addEventListener('click', () => ExportManager.shareToClipboard());
            document.getElementById('victoryNewPuzzle').addEventListener('click', () => {
                UI.closeVictoryModal();
                generateNewPuzzle();
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
            generateDailyPuzzle();
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
        isDailyMode = false;
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
            UI.setModeBar(false, null);
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
        onSetFilterChange,
        onRarityFilterChange,
        onClassFilterChange,
    };
})();
