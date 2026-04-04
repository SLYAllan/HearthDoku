/**
 * HearthDoku — Puzzle generation, validation, and backtracking solver
 */
const PuzzleEngine = (() => {
    // All criterion categories
    const CATEGORIES = ['mana', 'health', 'attack', 'keyword', 'type', 'race', 'class', 'set', 'rarity'];

    // Possible values per category
    const CATEGORY_VALUES = {
        mana: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10+'],
        health: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12+'],
        attack: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '12+'],
        keyword: Object.keys(HearthstoneAPI.KEYWORD_FIELD_MAP),
        type: Object.keys(HearthstoneAPI.TYPE_MAP),
        race: Object.keys(HearthstoneAPI.RACE_MAP),
        class: Object.keys(HearthstoneAPI.CLASS_MAP),
        rarity: Object.keys(HearthstoneAPI.RARITY_MAP),
        set: [], // Populated dynamically
    };

    // Incompatibility rules: pairs of (category, value) that cannot coexist
    const INCOMPATIBILITIES = [
        { cat1: 'type', val1: 'SPELL', cat2: 'attack' },
        { cat1: 'type', val1: 'SPELL', cat2: 'health' },
        { cat1: 'type', val1: 'SPELL', cat2: 'race' },
        { cat1: 'type', val1: 'LOCATION', cat2: 'attack' },
        { cat1: 'type', val1: 'LOCATION', cat2: 'race' },
        { cat1: 'type', val1: 'HERO', cat2: 'attack' },
        { cat1: 'type', val1: 'HERO', cat2: 'health' },
        { cat1: 'type', val1: 'HERO', cat2: 'race' },
        { cat1: 'type', val1: 'WEAPON', cat2: 'race' },
    ];

    function shuffle(arr) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function areCriteriaCompatible(cat1, val1, cat2, val2) {
        for (const rule of INCOMPATIBILITIES) {
            // Check both directions
            if (rule.cat1 === cat1 && rule.val1 === val1 && rule.cat2 === cat2) return false;
            if (rule.cat1 === cat2 && rule.val1 === val2 && rule.cat2 === cat1) return false;
            if (rule.cat1 === cat1 && rule.val1 === val1 && rule.cat2 === cat2 && (rule.val2 === undefined || rule.val2 === val2)) return false;
            if (rule.cat1 === cat2 && rule.val1 === val2 && rule.cat2 === cat1 && (rule.val2 === undefined || rule.val2 === val1)) return false;
        }
        return true;
    }

    function getCardsForCell(cards, rowCriterion, colCriterion) {
        return cards.filter(card =>
            HearthstoneAPI.cardMatchesCriterion(card, rowCriterion.category, rowCriterion.value) &&
            HearthstoneAPI.cardMatchesCriterion(card, colCriterion.category, colCriterion.value)
        );
    }

    // Backtracking solver: find at least one assignment of 9 distinct cards
    function hasSolution(cellCards) {
        const usedIds = new Set();
        return backtrack(cellCards, 0, usedIds);
    }

    function backtrack(cellCards, cellIndex, usedIds) {
        if (cellIndex === 9) return true;
        const candidates = cellCards[cellIndex];
        // Shuffle to avoid bias
        const shuffled = shuffle(candidates);
        for (const card of shuffled) {
            const id = card.dbfId || card.id;
            if (usedIds.has(id)) continue;
            usedIds.add(id);
            if (backtrack(cellCards, cellIndex + 1, usedIds)) return true;
            usedIds.delete(id);
        }
        return false;
    }

    function generatePuzzle(cards, allowedSets = null) {
        // Filter by allowed sets
        let pool = cards;
        if (allowedSets && allowedSets.length > 0) {
            pool = cards.filter(c => allowedSets.includes(c.set));
        }

        // Update dynamic set values
        const setsInPool = [...new Set(pool.map(c => c.set).filter(Boolean))];
        CATEGORY_VALUES.set = setsInPool;

        const MAX_ATTEMPTS = 200;

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            const result = tryGeneratePuzzle(pool);
            if (result) return result;
        }

        return null; // Failed to generate
    }

    function tryGeneratePuzzle(pool) {
        // Pick 6 distinct categories: 3 for rows, 3 for columns
        const shuffledCats = shuffle(CATEGORIES.filter(c => CATEGORY_VALUES[c].length > 0));
        if (shuffledCats.length < 6) return null;

        const rowCategories = shuffledCats.slice(0, 3);
        const colCategories = shuffledCats.slice(3, 6);

        // Pick specific values for each
        const rowCriteria = [];
        const colCriteria = [];

        for (const cat of rowCategories) {
            const vals = shuffle(CATEGORY_VALUES[cat]);
            if (vals.length === 0) return null;
            rowCriteria.push({ category: cat, value: vals[0] });
        }

        for (const cat of colCategories) {
            const vals = shuffle(CATEGORY_VALUES[cat]);
            if (vals.length === 0) return null;
            colCriteria.push({ category: cat, value: vals[0] });
        }

        // Check compatibility for all 9 intersections
        const cellCards = [];
        for (let r = 0; r < 3; r++) {
            for (let c = 0; c < 3; c++) {
                if (!areCriteriaCompatible(
                    rowCriteria[r].category, rowCriteria[r].value,
                    colCriteria[c].category, colCriteria[c].value
                )) {
                    return null;
                }

                const matching = getCardsForCell(pool, rowCriteria[r], colCriteria[c]);
                if (matching.length < 10) return null;
                cellCards.push(matching);
            }
        }

        // Check solvability with 9 distinct cards
        if (!hasSolution(cellCards)) return null;

        // Count unique cards across all cells
        const uniqueIds = new Set();
        cellCards.forEach(cards => cards.forEach(card => uniqueIds.add(card.dbfId || card.id)));

        return {
            rowCriteria,
            colCriteria,
            cellCards,
            uniqueCount: uniqueIds.size,
        };
    }

    function calculateScore(card, cellCards) {
        const totalInCell = cellCards.length;
        const percentage = (1 / totalInCell) * 100;
        let multiplier = 1;

        switch (card.rarity) {
            case 'RARE': multiplier = 1.5; break;
            case 'EPIC': multiplier = 2; break;
            case 'LEGENDARY': multiplier = 3; break;
        }

        return Math.max(1, Math.round((100 / Math.max(1, totalInCell)) * multiplier));
    }

    function getBestSolutionCard(cellCards) {
        // Priority: Legendary > Epic > Rare > Common > Free
        const rarityOrder = { 'LEGENDARY': 5, 'EPIC': 4, 'RARE': 3, 'COMMON': 2, 'FREE': 1 };
        const sorted = [...cellCards].sort((a, b) => {
            return (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0);
        });
        return sorted[0];
    }

    // Helper: build an <img> tag for an icon, with emoji fallback
    function imgIcon(src, fallbackEmoji, alt) {
        if (src) {
            return `<img class="badge-icon-img" src="${src}" alt="${alt || ''}" onerror="this.outerHTML='${fallbackEmoji}'">`;
        }
        return fallbackEmoji;
    }

    // Build display info for a criterion
    function getCriterionDisplay(criterion) {
        const { category, value } = criterion;
        switch (category) {
            case 'mana':
                return {
                    icon: imgIcon(HearthstoneAPI.getStatIcon('mana'), '💎', 'Mana'),
                    label: value, bgClass: 'badge--mana',
                    tooltip: `Coût en mana : ${value}`
                };
            case 'health':
                return {
                    icon: imgIcon(HearthstoneAPI.getStatIcon('health'), '❤️', 'PV'),
                    label: value, bgClass: 'badge--health',
                    tooltip: `Points de vie : ${value}`
                };
            case 'attack':
                return {
                    icon: imgIcon(HearthstoneAPI.getStatIcon('attack'), '⚔️', 'ATK'),
                    label: value, bgClass: 'badge--attack',
                    tooltip: `Attaque : ${value}`
                };
            case 'keyword':
                return {
                    icon: getKeywordIcon(value),
                    label: HearthstoneAPI.KEYWORD_FIELD_MAP[value] || value,
                    bgClass: 'badge--keyword',
                    tooltip: HearthstoneAPI.KEYWORD_FIELD_MAP[value] || value
                };
            case 'type':
                return {
                    icon: getTypeIcon(value),
                    label: HearthstoneAPI.TYPE_MAP[value] || value,
                    bgClass: 'badge--type',
                    tooltip: `Type : ${HearthstoneAPI.TYPE_MAP[value] || value}`
                };
            case 'race':
                return {
                    icon: getRaceIcon(value),
                    label: HearthstoneAPI.RACE_MAP[value] || value,
                    bgClass: 'badge--race',
                    tooltip: `Race : ${HearthstoneAPI.RACE_MAP[value] || value}`
                };
            case 'class': {
                const iconPath = HearthstoneAPI.getClassIcon(value);
                const fallback = getClassFallback(value);
                return {
                    icon: imgIcon(iconPath, fallback, HearthstoneAPI.CLASS_MAP[value]),
                    label: HearthstoneAPI.CLASS_MAP[value] || value,
                    bgClass: `badge--class badge--class-${value.toLowerCase()}`,
                    tooltip: `Classe : ${HearthstoneAPI.CLASS_MAP[value] || value}`
                };
            }
            case 'set': {
                const iconPath = HearthstoneAPI.getSetIcon(value);
                return {
                    icon: imgIcon(iconPath, '📦', HearthstoneAPI.getSetDisplayName(value)),
                    label: HearthstoneAPI.getSetDisplayName(value),
                    bgClass: 'badge--set',
                    tooltip: `Extension : ${HearthstoneAPI.getSetDisplayName(value)}`
                };
            }
            case 'rarity': {
                const iconPath = HearthstoneAPI.getRarityIcon(value);
                const fallback = getRarityFallback(value);
                return {
                    icon: imgIcon(iconPath, fallback, HearthstoneAPI.RARITY_MAP[value]),
                    label: HearthstoneAPI.RARITY_MAP[value] || value,
                    bgClass: `badge--rarity badge--rarity-${value.toLowerCase()}`,
                    tooltip: `Rareté : ${HearthstoneAPI.RARITY_MAP[value] || value}`
                };
            }
            default:
                return { icon: '?', label: value, bgClass: '', tooltip: '' };
        }
    }

    // Keyword icons (keep emojis — no logo files for these)
    function getKeywordIcon(kw) {
        const map = {
            'TAUNT': '🛡️', 'DIVINE_SHIELD': '✨', 'BATTLECRY': '📢', 'DEATHRATTLE': '💀',
            'RUSH': '💨', 'CHARGE': '⚡', 'LIFESTEAL': '🩸', 'WINDFURY': '🌪️',
            'POISONOUS': '☠️', 'STEALTH': '👁️', 'SPELL_DAMAGE': '🔮', 'DISCOVER': '🔍',
            'MAGNETIC': '🧲', 'REBORN': '🔄', 'OUTCAST': '👤', 'TRADEABLE': '🔀',
            'FREEZE': '❄️', 'SILENCE': '🔇', 'CHOOSE_ONE': '⚖️', 'COMBO': '🃏',
            'OVERLOAD': '⛓️', 'SECRET': '❓',
        };
        return map[kw] || '🔑';
    }

    // Type icons (keep emojis — no logo files for these)
    function getTypeIcon(type) {
        const map = { 'MINION': '🗡️', 'SPELL': '📖', 'WEAPON': '⚒️', 'HERO': '🪖', 'LOCATION': '🏰' };
        return map[type] || '📄';
    }

    // Race icons (keep emojis — no logo files for these)
    function getRaceIcon(race) {
        const map = {
            'BEAST': '🐾', 'DRAGON': '🐉', 'MURLOC': '🐸', 'DEMON': '😈',
            'MECHANICAL': '⚙️', 'PIRATE': '🏴‍☠️', 'ELEMENTAL': '🔥', 'TOTEM': '🗿',
            'UNDEAD': '🦴', 'NAGA': '🐍', 'ALL': '🌀',
        };
        return map[race] || '🔘';
    }

    // Fallback emojis for classes without icon files
    function getClassFallback(cls) {
        const map = {
            'MAGE': '🟣', 'WARRIOR': '🔴', 'PALADIN': '🟡', 'HUNTER': '🟢',
            'ROGUE': '⚫', 'PRIEST': '⚪', 'SHAMAN': '🔵', 'WARLOCK': '🟤',
            'DRUID': '🟠', 'DEATHKNIGHT': '🩵', 'DEMONHUNTER': '🌑', 'NEUTRAL': '🔘',
        };
        return map[cls] || '🔘';
    }

    // Fallback emojis for rarities without icon files
    function getRarityFallback(rarity) {
        const map = {
            'FREE': '⬜', 'COMMON': '⬜', 'RARE': '🔷', 'EPIC': '🟪', 'LEGENDARY': '🟧',
        };
        return map[rarity] || '⬜';
    }

    return {
        generatePuzzle,
        calculateScore,
        getBestSolutionCard,
        getCriterionDisplay,
        getCardsForCell,
        CATEGORIES,
        CATEGORY_VALUES,
    };
})();
