/**
 * HearthDoku — Card search with fuzzy autocomplete
 */
const CardSearch = (() => {
    let debounceTimer = null;
    const DEBOUNCE_MS = 200;
    const MAX_RESULTS = 8;

    // Remove accents for fuzzy matching
    function normalizeString(str) {
        return str
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim();
    }

    function fuzzyMatch(query, text) {
        const normQuery = normalizeString(query);
        const normText = normalizeString(text);

        // Exact substring match first
        if (normText.includes(normQuery)) return 2;

        // Word-start matching
        const words = normText.split(/\s+/);
        const queryWords = normQuery.split(/\s+/);
        let allMatch = true;
        for (const qw of queryWords) {
            if (!words.some(w => w.startsWith(qw))) {
                allMatch = false;
                break;
            }
        }
        if (allMatch) return 1;

        return 0;
    }

    function searchCards(query, pool) {
        if (!query || query.length < 2) return [];

        const results = [];
        for (const card of pool) {
            const name = card.name || '';
            const score = fuzzyMatch(query, name);
            if (score > 0) {
                results.push({ card, score });
            }
        }

        // Sort by relevance (higher score first), then alphabetically
        results.sort((a, b) => {
            if (b.score !== a.score) return b.score - a.score;
            return (a.card.name || '').localeCompare(b.card.name || '');
        });

        return results.slice(0, MAX_RESULTS).map(r => r.card);
    }

    function debouncedSearch(query, pool, callback) {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            const results = searchCards(query, pool);
            callback(results);
        }, DEBOUNCE_MS);
    }

    function cancelSearch() {
        clearTimeout(debounceTimer);
    }

    function getCardImageUrl(cardId) {
        return `https://art.hearthstonejson.com/v1/tiles/${cardId}.png`;
    }

    return {
        searchCards,
        debouncedSearch,
        cancelSearch,
        getCardImageUrl,
        normalizeString,
    };
})();
