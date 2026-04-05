/**
 * HearthDoku — API fetch & cache for HearthstoneJSON
 */
const HearthstoneAPI = (() => {
    const API_URL_FR = 'https://api.hearthstonejson.com/v1/latest/frFR/cards.json';
    const API_URL_EN = 'https://api.hearthstonejson.com/v1/latest/enUS/cards.json';
    const CACHE_KEY = 'hearthdoku_cards_cache';
    const CACHE_VERSION_KEY = 'hearthdoku_cache_version';
    const CACHE_VERSION = '5'; // Bumped: lang-aware cache

    let allCards = [];
    let collectibleCards = [];
    let setNames = {};

    function getCacheKey() {
        return CACHE_KEY + '_' + I18n.getApiLocale();
    }

    function getCachedData() {
        try {
            const version = localStorage.getItem(CACHE_VERSION_KEY);
            if (version !== CACHE_VERSION) return null;
            const raw = localStorage.getItem(getCacheKey());
            if (!raw) return null;
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }

    function setCachedData(data) {
        try {
            localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION);
            localStorage.setItem(getCacheKey(), JSON.stringify(data));
        } catch {
            // localStorage full or unavailable
        }
    }

    async function fetchCards() {
        const cached = getCachedData();
        if (cached) {
            allCards = cached;
            processCards();
            return collectibleCards;
        }

        const locale = I18n.getApiLocale();
        const primaryUrl = `https://api.hearthstonejson.com/v1/latest/${locale}/cards.json`;
        const fallbackUrl = locale === 'frFR' ? API_URL_EN : API_URL_FR;

        try {
            const resp = await fetch(primaryUrl);
            if (!resp.ok) throw new Error('Primary fetch failed');
            allCards = await resp.json();
        } catch {
            const resp = await fetch(fallbackUrl);
            if (!resp.ok) throw new Error('Failed to fetch card data');
            allCards = await resp.json();
        }

        setCachedData(allCards);
        processCards();
        return collectibleCards;
    }

    function isExcludedSet(setCode) {
        if (!setCode) return true;
        const upper = setCode.toUpperCase();
        return EXCLUDED_SET_PREFIXES.some(prefix => upper.startsWith(prefix));
    }

    function processCards() {
        collectibleCards = allCards.filter(c =>
            c.collectible === true && c.set && !isExcludedSet(c.set)
        );

        // Build set name mapping
        setNames = {};
        collectibleCards.forEach(c => {
            if (c.set && !setNames[c.set]) {
                setNames[c.set] = c.set;
            }
        });
    }

    // Full card render image (shows the complete card with frame)
    function getCardRenderUrl(cardId) {
        const locale = I18n.getRenderLocale();
        return `https://art.hearthstonejson.com/v1/render/latest/${locale}/256x/${cardId}.png`;
    }

    // Standard sets (2026 rotation — Année du Scarabée)
    const STANDARD_SETS = [
        'CORE',
        'EVENT',
        'EMERALD_DREAM', 'EDR',
        'THE_LOST_CITY', 'TLC',
        'TIME_TRAVEL', 'TIME',
        'CATACLYSM', 'CATA',
    ];

    const CLASSIC_SETS = ['EXPERT1', 'CORE', 'BASIC', 'VANILLA', 'LEGACY'];

    // Sets to exclude from the game (non-real sets)
    const EXCLUDED_SET_PREFIXES = [
        'PLACEHOLDER', 'HERO_SKINS', 'LETTUCE', 'LETL', 'PET', 'TUT',
        'TUTORIAL', 'CREDITS', 'MISSIONS', 'DEBUG', 'TEMP', 'TAVERN',
        'TB', 'MERCENARIES', 'BATTLEGROUNDS', 'SLUSH', 'CHEAT', 'BLANK',
        'DEMO', 'NONE', 'INVALID', 'TEST', 'WILD_EVENT',
    ];

    // Icon paths for each set (relative to project root)
    const SET_ICONS = {
        // Base sets
        'CORE': 'logo/extensions/Core.svg',
        'BASIC': 'logo/extensions/Basic_-_SVG_logo.svg',
        'EXPERT1': 'logo/extensions/ClassicIcon.webp',
        'VANILLA': 'logo/extensions/Classic.webp',
        'LEGACY': 'logo/extensions/ClassicIcon.webp',
        'HOF': 'logo/extensions/HallOfFameIcon.webp',

        // 2014
        'NAXX': 'logo/extensions/NaxxIcon.webp',
        'FP1': 'logo/extensions/NaxxIcon.webp',
        'GVG': 'logo/extensions/GvGIcon.webp',
        'PE1': 'logo/extensions/GvGIcon.webp',

        // 2015
        'BRM': 'logo/extensions/BRMIcon.webp',
        'FP2': 'logo/extensions/BRMIcon.webp',
        'TGT': 'logo/extensions/TGTIcon.webp',
        'LOE': 'logo/extensions/LOEIcon.webp',

        // 2016
        'OG': 'logo/extensions/OGIcon.webp',
        'OG_RESERVE': 'logo/extensions/OGIcon.webp',
        'KARA': 'logo/extensions/KaraIcon.webp',
        'KARA_RESERVE': 'logo/extensions/KaraIcon.webp',
        'GANGS': 'logo/extensions/GangsIcon.webp',
        'GANGS_RESERVE': 'logo/extensions/GangsIcon.webp',

        // 2017
        'UNGORO': 'logo/extensions/UNGIcon.webp',
        'ICECROWN': 'logo/extensions/ICCIcon.webp',
        'LOOTAPALOOZA': 'logo/extensions/LOOTIcon.webp',

        // 2018
        'GILNEAS': 'logo/extensions/GILIcon.webp',
        'BOOMSDAY': 'logo/extensions/BOTIcon.webp',
        'TROLL': 'logo/extensions/TRLIcon.webp',

        // 2019
        'DALARAN': 'logo/extensions/DALIcon.webp',
        'ULDUM': 'logo/extensions/UldumIcon.webp',
        'DRAGONS': 'logo/extensions/DRGIcon.webp',
        'DRG': 'logo/extensions/DRGIcon.webp',
        'YEAR_OF_THE_DRAGON': 'logo/extensions/YODIcon.webp',
        'YOD': 'logo/extensions/YODIcon.webp',

        // 2020
        'BLACK_TEMPLE': 'logo/extensions/BTIcon.webp',
        'BT': 'logo/extensions/BTIcon.webp',
        'DEMON_HUNTER_INITIATE': 'logo/extensions/DHIIcon.webp',
        'DHI': 'logo/extensions/DHIIcon.webp',
        'SCHOLOMANCE': 'logo/extensions/SCHIcon.webp',
        'SCH': 'logo/extensions/SCHIcon.webp',
        'DARKMOON_FAIRE': 'logo/extensions/DMFIcon.webp',
        'DMF': 'logo/extensions/DMFIcon.webp',

        // 2021
        'THE_BARRENS': 'logo/extensions/Forged_in_the_Barrens_-_SVG_logo.svg',
        'BAR': 'logo/extensions/Forged_in_the_Barrens_-_SVG_logo.svg',
        'WAILING_CAVERNS': 'logo/extensions/BARIcon_MiniSet.webp',
        'STORMWIND': 'logo/extensions/SWIcon.webp',
        'SW': 'logo/extensions/SWIcon.webp',
        'ALTERAC_VALLEY': 'logo/extensions/Fractured_in_Alterac_Valley_-_SVG_logo.svg',
        'AV': 'logo/extensions/Fractured_in_Alterac_Valley_-_SVG_logo.svg',

        // 2022
        'THE_SUNKEN_CITY': 'logo/extensions/Voyage_to_the_Sunken_City_-_SVG_logo.webp',
        'TSC': 'logo/extensions/Voyage_to_the_Sunken_City_-_SVG_logo.webp',
        'REVENDRETH': 'logo/extensions/revendreth.svg',
        'REVENDETH': 'logo/extensions/revendreth.svg',
        'REV': 'logo/extensions/revendreth.svg',
        'RETURN_OF_THE_LICH_KING': 'logo/extensions/RETURN_OF_THE_LICH_KING.svg',
        'RLK': 'logo/extensions/RETURN_OF_THE_LICH_KING.svg',
        'PATH_OF_ARTHAS': 'logo/extensions/PoAIcon.webp',
        'PA': 'logo/extensions/PoAIcon.webp',

        // 2023
        'BATTLE_OF_THE_BANDS': 'logo/extensions/BATTLE_OF_THE_BANDS.svg',
        'ETC': 'logo/extensions/BATTLE_OF_THE_BANDS.svg',
        'TITANS': 'logo/extensions/TTNIcon.webp',
        'TTN': 'logo/extensions/TTNIcon.webp',
        'WILD_WEST': 'logo/extensions/Showdown_in_the_Badlands_-_SVG_logo.svg',
        'WST': 'logo/extensions/Showdown_in_the_Badlands_-_SVG_logo.svg',

        // 2024
        'WHIZBANGS_WORKSHOP': "logo/extensions/Whizbang's_Workshop_-_SVG_logo.svg",
        'TOY': "logo/extensions/Whizbang's_Workshop_-_SVG_logo.svg",
        'ISLAND_VACATION': 'logo/extensions/Perils_in_Paradise_-_SVG_logo.svg',
        'VAC': 'logo/extensions/Perils_in_Paradise_-_SVG_logo.svg',
        'GREAT_DARK_BEYOND': 'logo/extensions/The_Great_Dark_Beyond_-_SVG_logo.svg',
        'GDB': 'logo/extensions/The_Great_Dark_Beyond_-_SVG_logo.svg',
        'SPACE': 'logo/extensions/The_Great_Dark_Beyond_-_SVG_logo.svg',

        // 2025
        'EMERALD_DREAM': 'logo/extensions/Into_the_Emerald_Dream_-_SVG_logo.svg',
        'EDR': 'logo/extensions/Into_the_Emerald_Dream_-_SVG_logo.svg',
        'THE_LOST_CITY': "logo/extensions/The_Lost_City_of_Un'Goro_-_SVG_logo.svg",
        'TLC': "logo/extensions/The_Lost_City_of_Un'Goro_-_SVG_logo.svg",
        'CATACLYSM': 'logo/extensions/CATACLYSM_-_SVG_logo.svg',
        'CATA': 'logo/extensions/CATACLYSM_-_SVG_logo.svg',
        'TIME_TRAVEL': 'logo/extensions/Across_the_Timeways_-_SVG_logo.svg',
        'TIME': 'logo/extensions/Across_the_Timeways_-_SVG_logo.svg',
        'TAVERNS_OF_TIME': 'logo/extensions/Across_the_Timeways_-_SVG_logo.svg',

        // Misc
        'WONDERS': 'logo/extensions/TwistIcon.webp',
        'WON': 'logo/extensions/TwistIcon.webp',
        'EVENT': 'logo/extensions/Event_-_SVG_logo.svg',
        'EVE': 'logo/extensions/Event_-_SVG_logo.svg',
    };

    // Class icon paths
    const CLASS_ICONS = {
        'MAGE': 'logo/Class/Mage_icon.webp',
        'WARRIOR': 'logo/Class/Warrior_icon.webp',
        'PALADIN': 'logo/Class/Paladin_icon.webp',
        'HUNTER': 'logo/Class/Hunter_icon.webp',
        'ROGUE': 'logo/Class/Rogue_icon.webp',
        'PRIEST': 'logo/Class/Priest_icon.webp',
        'SHAMAN': 'logo/Class/Shaman_icon.webp',
        'WARLOCK': 'logo/Class/Warlock_icon.webp',
        'DRUID': 'logo/Class/Druid_icon.webp',
        'DEATHKNIGHT': 'logo/Class/Death_Knight_icon.webp',
        'DEMONHUNTER': 'logo/Class/Demon_Hunter_icon.webp',
        'NEUTRAL': 'logo/Icon_Logo.webp',
    };

    // Rarity icon paths
    const RARITY_ICONS = {
        'FREE': 'logo/Icon_Logo.webp',
        'COMMON': 'logo/rarity/Common.webp',
        'RARE': 'logo/rarity/Rare.webp',
        'EPIC': 'logo/rarity/Epic.webp',
        'LEGENDARY': 'logo/rarity/Legendary.webp',
    };

    // Stat icon paths
    const STAT_ICONS = {
        mana: 'logo/Mana.webp',
        attack: 'logo/Attack_icon_large.webp',
        health: 'logo/Health_icon_large.webp',
    };

    function getSetIcon(setCode) { return SET_ICONS[setCode] || null; }
    function getClassIcon(classCode) { return CLASS_ICONS[classCode] || null; }
    function getRarityIcon(rarityCode) { return RARITY_ICONS[rarityCode] || null; }
    function getStatIcon(statType) { return STAT_ICONS[statType] || null; }

    // Dynamic accessors that read from I18n
    function getKeywordMap() { return I18n.getMap('KEYWORD_FIELD_MAP'); }
    function getTypeMap() { return I18n.getMap('TYPE_MAP'); }
    function getRaceMap() { return I18n.getMap('RACE_MAP'); }
    function getClassMap() { return I18n.getMap('CLASS_MAP'); }
    function getRarityMap() { return I18n.getMap('RARITY_MAP'); }
    function getSetDisplayNames() { return I18n.getMap('SET_DISPLAY_NAMES'); }

    function getSetDisplayName(setCode) {
        const names = getSetDisplayNames();
        return names[setCode] || setCode;
    }

    function getCollectibleCards() {
        return collectibleCards;
    }

    function getCardsByFilter(filterFn) {
        return collectibleCards.filter(filterFn);
    }

    function getAllSets() {
        const sets = new Set();
        collectibleCards.forEach(c => {
            if (c.set && !isExcludedSet(c.set)) sets.add(c.set);
        });
        // Deduplicate sets that have the same display name
        // Keep the set code with the most cards
        const byName = {};
        for (const code of sets) {
            const name = getSetDisplayName(code);
            if (!byName[name]) {
                byName[name] = code;
            } else {
                const existingCount = collectibleCards.filter(c => c.set === byName[name]).length;
                const newCount = collectibleCards.filter(c => c.set === code).length;
                if (newCount > existingCount) {
                    byName[name] = code;
                }
            }
        }
        // Sort by display name
        const locale = I18n.getLang() === 'en' ? 'en' : 'fr';
        return Object.values(byName).sort((a, b) => {
            const nameA = getSetDisplayName(a);
            const nameB = getSetDisplayName(b);
            return nameA.localeCompare(nameB, locale);
        });
    }

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
            case 'mana': {
                if (value === '10+') return card.cost >= 10;
                return card.cost === parseInt(value);
            }
            case 'health': {
                const hp = card.health ?? card.durability;
                if (hp === undefined || hp === null) return false;
                if (value === '12+') return hp >= 12;
                return hp === parseInt(value);
            }
            case 'attack': {
                if (card.attack === undefined || card.attack === null) return false;
                if (value === '12+') return card.attack >= 12;
                return card.attack === parseInt(value);
            }
            case 'keyword': {
                return cardHasKeyword(card, value);
            }
            case 'type': {
                return card.type === value;
            }
            case 'race': {
                if (value === 'ALL') {
                    return card.race === 'ALL' || card.races?.includes('ALL');
                }
                return card.race === value || card.races?.includes(value) ||
                       card.race === 'ALL' || card.races?.includes('ALL');
            }
            case 'class': {
                if (value === 'NEUTRAL') {
                    return card.cardClass === 'NEUTRAL' || (!card.cardClass && !card.classes);
                }
                return card.cardClass === value || card.classes?.includes(value);
            }
            case 'set': {
                return card.set === value;
            }
            case 'rarity': {
                return card.rarity === value;
            }
            default:
                return false;
        }
    }

    return {
        fetchCards,
        getCollectibleCards,
        getCardsByFilter,
        getAllSets,
        cardMatchesCriterion,
        cardHasKeyword,
        getSetDisplayName,
        getCardRenderUrl,
        isExcludedSet,
        getSetIcon,
        getClassIcon,
        getRarityIcon,
        getStatIcon,
        getKeywordMap,
        getTypeMap,
        getRaceMap,
        getClassMap,
        getRarityMap,
        STANDARD_SETS,
        CLASSIC_SETS,
        SET_ICONS,
        CLASS_ICONS,
        RARITY_ICONS,
        STAT_ICONS,
    };
})();
