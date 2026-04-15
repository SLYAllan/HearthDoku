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
        keyword: Object.keys(I18n.getMap('KEYWORD_FIELD_MAP')),
        type: Object.keys(I18n.getMap('TYPE_MAP')),
        race: Object.keys(I18n.getMap('RACE_MAP')),
        class: Object.keys(I18n.getMap('CLASS_MAP')),
        rarity: Object.keys(I18n.getMap('RARITY_MAP')),
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

    // Seeded PRNG (mulberry32) — used for the daily puzzle
    function mulberry32(seed) {
        let s = seed >>> 0;
        return function () {
            s = (s + 0x6D2B79F5) | 0;
            let t = Math.imul(s ^ (s >>> 15), s | 1);
            t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
            return ((t ^ (t >>> 14)) >>> 0) / 0x100000000;
        };
    }

    function shuffleWithRng(arr, rng) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function shuffleWithRng(arr, rng) {
        const a = [...arr];
        for (let i = a.length - 1; i > 0; i--) {
            const j = Math.floor(rng() * (i + 1));
            [a[i], a[j]] = [a[j], a[i]];
        }
        return a;
    }

    function areCriteriaCompatible(cat1, val1, cat2, val2) {
        for (const rule of INCOMPATIBILITIES) {
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

    function hasSolution(cellCards) {
        const usedIds = new Set();
        const solution = [];
        const found = backtrack(cellCards, 0, usedIds, solution);
        return found;
    }

    function findSolution(cellCards, alreadyUsedIds) {
        const rarityOrder = { 'LEGENDARY': 5, 'EPIC': 4, 'RARE': 3, 'COMMON': 2, 'FREE': 1 };
        const usedIds = new Set(alreadyUsedIds || []);
        const solution = new Array(9).fill(null);

        function solve(cellIndex) {
            if (cellIndex === 9) return true;
            const candidates = [...cellCards[cellIndex]].sort((a, b) => {
                return (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0);
            });
            for (const card of candidates) {
                const id = card.dbfId || card.id;
                if (usedIds.has(id)) continue;
                usedIds.add(id);
                solution[cellIndex] = card;
                if (solve(cellIndex + 1)) return true;
                usedIds.delete(id);
                solution[cellIndex] = null;
            }
            return false;
        }

        solve(0);
        return solution;
    }

    function backtrack(cellCards, cellIndex, usedIds, solution) {
        if (cellIndex === 9) return true;
        const candidates = cellCards[cellIndex];
        const shuffled = shuffle(candidates);
        for (const card of shuffled) {
            const id = card.dbfId || card.id;
            if (usedIds.has(id)) continue;
            usedIds.add(id);
            if (backtrack(cellCards, cellIndex + 1, usedIds, solution)) return true;
            usedIds.delete(id);
        }
        return false;
    }

    function computeMinCards(poolSize) {
        if (poolSize < 150) return 1;
        if (poolSize < 300) return 2;
        if (poolSize < 500) return 3;
        if (poolSize < 800) return 5;
        return 10;
    }

    function generatePuzzle(cards, allowedSets = null, seed = null) {
        let pool = cards;
        if (allowedSets && allowedSets.length > 0) {
            pool = cards.filter(c => allowedSets.includes(c.set));
        }

        if (pool.length < 9) return null;

        const setsInPool = [...new Set(pool.map(c => c.set).filter(Boolean))];
        CATEGORY_VALUES.set = setsInPool;

        // Adaptive threshold based on pool size.
        // For single-extension pools, cap at 2: cell intersections within one set
        // are much smaller than across multiple sets, making a higher threshold impossible.
        const minCards = setsInPool.length <= 1
            ? Math.min(computeMinCards(pool.length), 2)
            : computeMinCards(pool.length);

        const viableValues = {};
        for (const cat of CATEGORIES) {
            viableValues[cat] = CATEGORY_VALUES[cat].filter(val => {
                const count = pool.filter(c => HearthstoneAPI.cardMatchesCriterion(c, cat, val)).length;
                return count >= minCards;
            });
        }

        // Each used category only needs >= 1 viable value (one criterion per row/col).
        // Exclude 'set' when only one set is in pool (would be a trivial no-op constraint).
        const viableCategories = CATEGORIES.filter(c => {
            if (viableValues[c].length < 1) return false;
            if (c === 'set' && setsInPool.length < 2) return false;
            return true;
        });

        if (viableCategories.length < 6) return null;

        const MAX_ATTEMPTS = 2000;
        const rng = seed != null ? mulberry32(seed) : null;

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            const result = tryGeneratePuzzle(pool, viableCategories, viableValues, minCards, rng);
            if (result) return result;
        }

        return null;
    }

    function tryGeneratePuzzle(pool, availableCategories, viableValues, minCards, rng = null) {
        const sf = rng ? (a) => shuffleWithRng(a, rng) : shuffle;
        const cats = availableCategories || CATEGORIES.filter(c => CATEGORY_VALUES[c].length > 0);
        const vals = viableValues || CATEGORY_VALUES;
        const threshold = minCards || 10;

        const shuffledCats = sf(cats);
        if (shuffledCats.length < 6) return null;

        const rowCategories = shuffledCats.slice(0, 3);
        const colCategories = shuffledCats.slice(3, 6);

        const rowCriteria = [];
        const colCriteria = [];

        for (const cat of rowCategories) {
            const catVals = sf(vals[cat] || CATEGORY_VALUES[cat]);
            if (catVals.length === 0) return null;
            rowCriteria.push({ category: cat, value: catVals[0] });
        }

        for (const cat of colCategories) {
            const catVals = sf(vals[cat] || CATEGORY_VALUES[cat]);
            if (catVals.length === 0) return null;
            colCriteria.push({ category: cat, value: catVals[0] });
        }

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
                if (matching.length < threshold) return null;
                cellCards.push(matching);
            }
        }

        if (!hasSolution(cellCards)) return null;

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
        let multiplier = 1;

        switch (card.rarity) {
            case 'RARE': multiplier = 1.5; break;
            case 'EPIC': multiplier = 2; break;
            case 'LEGENDARY': multiplier = 3; break;
        }

        return Math.max(1, Math.round((100 / Math.max(1, totalInCell)) * multiplier));
    }

    function getBestSolutionCard(cellCards) {
        const rarityOrder = { 'LEGENDARY': 5, 'EPIC': 4, 'RARE': 3, 'COMMON': 2, 'FREE': 1 };
        const sorted = [...cellCards].sort((a, b) => {
            return (rarityOrder[b.rarity] || 0) - (rarityOrder[a.rarity] || 0);
        });
        return sorted[0];
    }

    function imgIcon(src, fallbackEmoji, alt) {
        if (src) {
            return `<img class="badge-icon-img" src="${src}" alt="${alt || ''}" onerror="this.outerHTML='${fallbackEmoji}'">`;
        }
        return fallbackEmoji;
    }

    function getCriterionDisplay(criterion) {
        const { category, value } = criterion;
        const kwMap = HearthstoneAPI.getKeywordMap();
        const typeMap = HearthstoneAPI.getTypeMap();
        const raceMap = HearthstoneAPI.getRaceMap();
        const classMap = HearthstoneAPI.getClassMap();
        const rarityMap = HearthstoneAPI.getRarityMap();

        switch (category) {
            case 'mana':
                return {
                    icon: imgIcon(HearthstoneAPI.getStatIcon('mana'), '💎', I18n.t('altMana')),
                    label: value, bgClass: 'badge--mana',
                    tooltip: `${I18n.t('tooltipMana')} : ${value}`
                };
            case 'health':
                return {
                    icon: imgIcon(HearthstoneAPI.getStatIcon('health'), '❤️', I18n.t('altHealth')),
                    label: value, bgClass: 'badge--health',
                    tooltip: `${I18n.t('tooltipHealth')} : ${value}`
                };
            case 'attack':
                return {
                    icon: imgIcon(HearthstoneAPI.getStatIcon('attack'), '⚔️', I18n.t('altAttack')),
                    label: value, bgClass: 'badge--attack',
                    tooltip: `${I18n.t('tooltipAttack')} : ${value}`
                };
            case 'keyword':
                return {
                    icon: getKeywordIcon(value),
                    label: kwMap[value] || value,
                    bgClass: 'badge--keyword',
                    tooltip: kwMap[value] || value
                };
            case 'type':
                return {
                    icon: getTypeIcon(value),
                    label: typeMap[value] || value,
                    bgClass: 'badge--type',
                    tooltip: `${I18n.t('tooltipType')} : ${typeMap[value] || value}`
                };
            case 'race':
                return {
                    icon: getRaceIcon(value),
                    label: raceMap[value] || value,
                    bgClass: 'badge--race',
                    tooltip: `${I18n.t('tooltipRace')} : ${raceMap[value] || value}`
                };
            case 'class': {
                const iconPath = HearthstoneAPI.getClassIcon(value);
                const fallback = getClassFallback(value);
                return {
                    icon: imgIcon(iconPath, fallback, classMap[value]),
                    label: classMap[value] || value,
                    bgClass: `badge--class badge--class-${value.toLowerCase()}`,
                    tooltip: `${I18n.t('tooltipClass')} : ${classMap[value] || value}`
                };
            }
            case 'set': {
                const iconPath = HearthstoneAPI.getSetIcon(value);
                return {
                    icon: imgIcon(iconPath, '📦', HearthstoneAPI.getSetDisplayName(value)),
                    label: HearthstoneAPI.getSetDisplayName(value),
                    bgClass: 'badge--set',
                    tooltip: `${I18n.t('tooltipSet')} : ${HearthstoneAPI.getSetDisplayName(value)}`
                };
            }
            case 'rarity': {
                const iconPath = HearthstoneAPI.getRarityIcon(value);
                const fallback = getRarityFallback(value);
                return {
                    icon: imgIcon(iconPath, fallback, rarityMap[value]),
                    label: rarityMap[value] || value,
                    bgClass: `badge--rarity badge--rarity-${value.toLowerCase()}`,
                    tooltip: `${I18n.t('tooltipRarity')} : ${rarityMap[value] || value}`
                };
            }
            default:
                return { icon: '?', label: value, bgClass: '', tooltip: '' };
        }
    }

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

    function getTypeIcon(type) {
        const map = { 'MINION': '🗡️', 'SPELL': '📖', 'WEAPON': '⚒️', 'HERO': '🪖', 'LOCATION': '🏰' };
        return map[type] || '📄';
    }

    function getRaceIcon(race) {
        const map = {
            'BEAST': '🐾', 'DRAGON': '🐉', 'MURLOC': '🐸', 'DEMON': '😈',
            'MECHANICAL': '⚙️', 'PIRATE': '🏴‍☠️', 'ELEMENTAL': '🔥', 'TOTEM': '🗿',
            'UNDEAD': '🦴', 'NAGA': '🐍', 'ALL': '🌀',
        };
        return map[race] || '🔘';
    }

    function getClassFallback(cls) {
        const map = {
            'MAGE': '🟣', 'WARRIOR': '🔴', 'PALADIN': '🟡', 'HUNTER': '🟢',
            'ROGUE': '⚫', 'PRIEST': '⚪', 'SHAMAN': '🔵', 'WARLOCK': '🟤',
            'DRUID': '🟠', 'DEATHKNIGHT': '🩵', 'DEMONHUNTER': '🌑', 'NEUTRAL': '🔘',
        };
        return map[cls] || '🔘';
    }

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
        findSolution,
        getCriterionDisplay,
        getCardsForCell,
        CATEGORIES,
        CATEGORY_VALUES,
    };
})();
