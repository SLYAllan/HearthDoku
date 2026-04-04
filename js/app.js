/**
 * HearthDoku — Main app orchestration
 */
const App = (() => {
    let allCards = [];
    let allowedSets = [];
    let allSets = [];

    async function init() {
        UI.init();
        UI.showLoading();

        try {
            allCards = await HearthstoneAPI.fetchCards();
            allSets = HearthstoneAPI.getAllSets();

            // Default: all sets allowed
            allowedSets = [...allSets];

            // Render extension filter
            UI.renderFilterList(allSets);

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
                generateNewPuzzle();
            });
            document.getElementById('victoryExport').addEventListener('click', () => {
                UI.closeVictoryModal();
                UI.showExportModal();
            });

            // Preset buttons
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

            // Check/uncheck all
            document.getElementById('btnCheckAll').addEventListener('click', () => {
                UI.setAllChecked(true);
                onSetFilterChange();
            });
            document.getElementById('btnUncheckAll').addEventListener('click', () => {
                UI.setAllChecked(false);
                onSetFilterChange();
            });

            UI.hideLoading();
            generateNewPuzzle();
        } catch (err) {
            console.error('Init error:', err);
            UI.hideLoading();
            alert('Erreur lors du chargement des cartes. Veuillez rafraîchir la page.');
        }
    }

    function generateNewPuzzle() {
        UI.showLoading();

        // Use setTimeout to let the loading overlay render
        setTimeout(() => {
            allowedSets = UI.getCheckedSets();
            const puzzle = PuzzleEngine.generatePuzzle(allCards, allowedSets.length > 0 ? allowedSets : null);

            if (!puzzle) {
                UI.hideLoading();
                alert('Impossible de générer un puzzle avec ces filtres. Essayez d\'activer plus d\'extensions.');
                return;
            }

            UI.renderPuzzle(puzzle);
            UI.hideLoading();
        }, 50);
    }

    function getFilteredCards() {
        if (!allowedSets || allowedSets.length === 0) return allCards;
        return allCards.filter(c => allowedSets.includes(c.set));
    }

    function getAllowedSets() {
        return allowedSets;
    }

    function onSetFilterChange() {
        allowedSets = UI.getCheckedSets();
    }

    // Start
    document.addEventListener('DOMContentLoaded', init);

    return {
        getFilteredCards,
        getAllowedSets,
        onSetFilterChange,
    };
})();
