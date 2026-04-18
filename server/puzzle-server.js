const crypto = require('crypto');

const CATEGORIES = ['mana', 'health', 'attack', 'keyword', 'type', 'race', 'class', 'set', 'rarity'];

const KEYWORD_VALUES = [
    'TAUNT', 'DIVINE_SHIELD', 'BATTLECRY', 'DEATHRATTLE', 'RUSH', 'CHARGE',
    'LIFESTEAL', 'WINDFURY', 'POISONOUS', 'STEALTH', 'SPELL_DAMAGE', 'DISCOVER',
    'MAGNETIC', 'REBORN', 'OUTCAST', 'TRADEABLE', 'FREEZE', 'SILENCE',
    'CHOOSE_ONE', 'COMBO', 'OVERLOAD', 'SECRET',
];

const TYPE_VALUES = ['MINION', 'SPELL', 'WEAPON', 'HERO', 'LOCATION'];
const RACE_VALUES = ['BEAST', 'DRAGON', 'MURLOC', 'DEMON', 'MECHANICAL', 'PIRATE', 'ELEMENTAL', 'TOTEM', 'UNDEAD', 'NAGA', 'ALL'];
const CLASS_VALUES = ['MAGE', 'WARRIOR', 'PALADIN', 'HUNTER', 'ROGUE', 'PRIEST', 'SHAMAN', 'WARLOCK', 'DRUID', 'DEATHKNIGHT', 'DEMONHUNTER', 'NEUTRAL'];
const RARITY_VALUES = ['FREE', 'COMMON', 'RARE', 'EPIC', 'LEGENDARY'];

const CATEGORY_VALUES = {
    mana: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10+'],
    health: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12+'],
    attack: ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '12+'],
    keyword: KEYWORD_VALUES,
    type: TYPE_VALUES,
    race: RACE_VALUES,
    class: CLASS_VALUES,
    rarity: RARITY_VALUES,
    set: [],
};

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

function cardHasKeyword(card, keyword) {
    if (card.mechanics && card.mechanics.includes(keyword)) return true;
    if (card.referencedTags && card.referencedTags.includes(keyword)) return true;
    if (keyword === 'SECRET' && card.secret === true) return true;
    if (keyword === 'OVERLOAD' && card.overload && card.overload > 0) return true;
    if (keyword === 'SPELL_DAMAGE' && card.spellDamage && card.spellDamage > 0) return true;
    return false;
}

function cardMatchesCriterion(card, category, value) {
    switch (category) {
        case 'mana':
            if (value === '10+') return card.cost >= 10;
            return card.cost === parseInt(value);
        case 'health': {
            const hp = card.health ?? card.durability;
            if (hp === undefined || hp === null) return false;
            if (value === '12+') return hp >= 12;
            return hp === parseInt(value);
        }
        case 'attack':
            if (card.attack === undefined || card.attack === null) return false;
            if (value === '12+') return card.attack >= 12;
            return card.attack === parseInt(value);
        case 'keyword':
            return cardHasKeyword(card, value);
        case 'type':
            return card.type === value;
        case 'race':
            if (value === 'ALL') return card.race === 'ALL' || card.races?.includes('ALL');
            return card.race === value || card.races?.includes(value) ||
                   card.race === 'ALL' || card.races?.includes('ALL');
        case 'class':
            if (value === 'NEUTRAL') return card.cardClass === 'NEUTRAL' || (!card.cardClass && !card.classes);
            return card.cardClass === value || card.classes?.includes(value);
        case 'set':
            return card.set === value;
        case 'rarity':
            return card.rarity === value;
        default:
            return false;
    }
}

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
        if (rule.cat1 === cat1 && rule.val1 === val1 && rule.cat2 === cat2) return false;
        if (rule.cat1 === cat2 && rule.val1 === val2 && rule.cat2 === cat1) return false;
    }
    return true;
}

function getCardsForCell(cards, rowCriterion, colCriterion) {
    return cards.filter(card =>
        cardMatchesCriterion(card, rowCriterion.category, rowCriterion.value) &&
        cardMatchesCriterion(card, colCriterion.category, colCriterion.value)
    );
}

function hasSolution(cellCards) {
    const usedIds = new Set();
    return backtrack(cellCards, 0, usedIds);
}

function backtrack(cellCards, cellIndex, usedIds) {
    if (cellIndex === 9) return true;
    const candidates = shuffle(cellCards[cellIndex]);
    for (const card of candidates) {
        const id = card.dbfId || card.id;
        if (usedIds.has(id)) continue;
        usedIds.add(id);
        if (backtrack(cellCards, cellIndex + 1, usedIds)) return true;
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

function generatePuzzle(cards, config) {
    let pool = cards;

    if (config?.sets?.length > 0) {
        pool = cards.filter(c => config.sets.includes(c.set));
    }
    if (config?.rarities?.length > 0) {
        pool = pool.filter(c => config.rarities.includes(c.rarity));
    }
    if (config?.classes?.length > 0) {
        pool = pool.filter(c => {
            if (config.classes.includes('NEUTRAL')) {
                if (c.cardClass === 'NEUTRAL' || (!c.cardClass && !c.classes)) return true;
            }
            if (c.cardClass && config.classes.includes(c.cardClass)) return true;
            if (Array.isArray(c.classes) && c.classes.some(cl => config.classes.includes(cl))) return true;
            return false;
        });
    }

    if (pool.length < 9) return null;

    const setsInPool = [...new Set(pool.map(c => c.set).filter(Boolean))];
    const catValues = { ...CATEGORY_VALUES, set: setsInPool };

    const minCards = setsInPool.length <= 1
        ? Math.min(computeMinCards(pool.length), 2)
        : computeMinCards(pool.length);

    const viableValues = {};
    for (const cat of CATEGORIES) {
        viableValues[cat] = catValues[cat].filter(val => {
            const count = pool.filter(c => cardMatchesCriterion(c, cat, val)).length;
            return count >= minCards;
        });
    }

    const viableCategories = CATEGORIES.filter(c => {
        if (viableValues[c].length < 1) return false;
        if (c === 'set' && setsInPool.length < 2) return false;
        return true;
    });

    if (viableCategories.length < 6) return null;

    const MAX_ATTEMPTS = 2000;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
        const result = tryGeneratePuzzle(pool, viableCategories, viableValues, minCards);
        if (result) return result;
    }

    return null;
}

function tryGeneratePuzzle(pool, availableCategories, viableValues, minCards) {
    const shuffledCats = shuffle(availableCategories);
    if (shuffledCats.length < 6) return null;

    const rowCategories = shuffledCats.slice(0, 3);
    const colCategories = shuffledCats.slice(3, 6);

    const rowCriteria = [];
    const colCriteria = [];

    for (const cat of rowCategories) {
        const catVals = shuffle(viableValues[cat]);
        if (catVals.length === 0) return null;
        rowCriteria.push({ category: cat, value: catVals[0] });
    }

    for (const cat of colCategories) {
        const catVals = shuffle(viableValues[cat]);
        if (catVals.length === 0) return null;
        colCriteria.push({ category: cat, value: catVals[0] });
    }

    const cellCards = [];
    for (let r = 0; r < 3; r++) {
        for (let c = 0; c < 3; c++) {
            if (!areCriteriaCompatible(
                rowCriteria[r].category, rowCriteria[r].value,
                colCriteria[c].category, colCriteria[c].value
            )) return null;

            const matching = getCardsForCell(pool, rowCriteria[r], colCriteria[c]);
            if (matching.length < minCards) return null;
            cellCards.push(matching);
        }
    }

    if (!hasSolution(cellCards)) return null;

    return { rowCriteria, colCriteria, cellCards };
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

function validatePlacement(cellCards, cellIndex, cardDbfId) {
    const valid = cellCards[cellIndex];
    return valid.find(c => c.dbfId === cardDbfId) || null;
}

module.exports = { generatePuzzle, calculateScore, validatePlacement, cardMatchesCriterion };
