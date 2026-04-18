const EXCLUDED_SET_PREFIXES = [
    'PLACEHOLDER', 'HERO_SKINS', 'LETTUCE', 'LETL', 'PET', 'TUT',
    'TUTORIAL', 'CREDITS', 'MISSIONS', 'DEBUG', 'TEMP', 'TAVERN',
    'TB', 'MERCENARIES', 'BATTLEGROUNDS', 'SLUSH', 'CHEAT', 'BLANK',
    'DEMO', 'NONE', 'INVALID', 'TEST', 'WILD_EVENT',
];

const STANDARD_SETS = [
    'CORE', 'EVENT',
    'EMERALD_DREAM', 'EDR',
    'THE_LOST_CITY', 'TLC',
    'TIME_TRAVEL', 'TIME',
    'CATACLYSM', 'CATA',
];

const CLASSIC_SETS = ['EXPERT1', 'CORE', 'BASIC', 'VANILLA', 'LEGACY'];

function isExcludedSet(setCode) {
    if (!setCode) return true;
    const upper = setCode.toUpperCase();
    return EXCLUDED_SET_PREFIXES.some(prefix => upper.startsWith(prefix));
}

let collectibleCards = null;

async function fetchCards() {
    if (collectibleCards) return collectibleCards;

    const url = 'https://api.hearthstonejson.com/v1/latest/enUS/cards.json';
    const resp = await fetch(url);
    if (!resp.ok) throw new Error(`Failed to fetch cards: ${resp.status}`);

    const allCards = await resp.json();
    collectibleCards = allCards.filter(c => c.collectible === true && c.set && !isExcludedSet(c.set));
    console.log(`[card-fetcher] Loaded ${collectibleCards.length} collectible cards`);
    return collectibleCards;
}

function getCards() {
    return collectibleCards;
}

module.exports = { fetchCards, getCards, isExcludedSet, STANDARD_SETS, CLASSIC_SETS };
