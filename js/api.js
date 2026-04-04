/**
 * HearthDoku — API fetch & cache for HearthstoneJSON
 */
const HearthstoneAPI = (() => {
    const API_URL_FR = 'https://api.hearthstonejson.com/v1/latest/frFR/cards.json';
    const API_URL_EN = 'https://api.hearthstonejson.com/v1/latest/enUS/cards.json';
    const CACHE_KEY = 'hearthdoku_cards_cache';
    const CACHE_VERSION_KEY = 'hearthdoku_cache_version';
    const CACHE_VERSION = '4';

    let allCards = [];
    let collectibleCards = [];
    let setNames = {};

    function getCachedData() {
        try {
            const version = localStorage.getItem(CACHE_VERSION_KEY);
            if (version !== CACHE_VERSION) return null;
            const raw = localStorage.getItem(CACHE_KEY);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch {
            return null;
        }
    }

    function setCachedData(data) {
        try {
            localStorage.setItem(CACHE_VERSION_KEY, CACHE_VERSION);
            localStorage.setItem(CACHE_KEY, JSON.stringify(data));
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

        try {
            const resp = await fetch(API_URL_FR);
            if (!resp.ok) throw new Error('FR fetch failed');
            allCards = await resp.json();
        } catch {
            const resp = await fetch(API_URL_EN);
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

    // Full card render image (shows the complete card with frame, in French)
    function getCardRenderUrl(cardId) {
        return `https://art.hearthstonejson.com/v1/render/latest/frFR/256x/${cardId}.png`;
    }

    // Standard sets (2025-2026 rotation)
    const STANDARD_SETS = [
        'CORE',
        'PATH_OF_ARTHAS', 'PA',
        'BATTLE_OF_THE_BANDS', 'ETC',
        'TITANS', 'TTN',
        'WILD_WEST', 'WST',
        'WHIZBANGS_WORKSHOP', 'TOY',
        'ISLAND_VACATION', 'VAC',
        'GREAT_DARK_BEYOND', 'GDB',
        'EMERALD_DREAM', 'EDR',
    ];

    const CLASSIC_SETS = ['EXPERT1', 'CORE', 'BASIC', 'VANILLA'];

    // Sets to exclude from the game (non-real sets)
    const EXCLUDED_SET_PREFIXES = [
        'PLACEHOLDER', 'HERO_SKINS', 'LETTUCE', 'LETL', 'PET', 'TUT',
        'TUTORIAL', 'CREDITS', 'MISSIONS', 'DEBUG', 'TEMP', 'TAVERN',
        'TB', 'MERCENARIES', 'BATTLEGROUNDS', 'SLUSH', 'CHEAT', 'BLANK',
        'DEMO', 'NONE', 'INVALID', 'TEST', 'WILD_EVENT',
    ];

    // Official French set names from HearthSim/hsdata Strings/frFR/GLOBAL.txt
    // Covers ALL known API set codes (long + short)
    const SET_DISPLAY_NAMES = {
        // Ensembles de base
        'CORE': 'Fondamental',
        'BASIC': 'De base',
        'EXPERT1': 'Classique',
        'VANILLA': 'Classique',
        'LEGACY': 'Héritage',
        'HOF': 'Panthéon',
        'PROMO': 'Promo',

        // 2014
        'NAXX': 'Naxxramas',
        'FP1': 'Naxxramas',
        'GVG': 'Gobelins et Gnomes',
        'PE1': 'Gobelins et Gnomes',

        // 2015
        'BRM': 'Mont Rochenoire',
        'FP2': 'Mont Rochenoire',
        'TGT': 'Le Grand Tournoi',
        'PE2': 'Le Grand Tournoi',
        'LOE': 'La Ligue des explorateurs',

        // 2016
        'OG': 'Dieux très anciens',
        'OG_RESERVE': 'Dieux très anciens',
        'KARA': 'Une nuit à Karazhan',
        'KARA_RESERVE': 'Une nuit à Karazhan',
        'GANGS': 'Main basse sur Gadgetzan',
        'GANGS_RESERVE': 'Main basse sur Gadgetzan',

        // 2017
        'UNGORO': "Voyage au centre d'Un'Goro",
        'ICECROWN': 'Chevaliers du Trône de glace',
        'LOOTAPALOOZA': 'Kobolds et Catacombes',

        // 2018
        'GILNEAS': 'Le Bois Maudit',
        'BOOMSDAY': 'Projet Armageboum',
        'TROLL': 'Les Jeux de Rastakhan',

        // 2019
        'DALARAN': "L'Éveil des ombres",
        'ULDUM': "Les Aventuriers d'Uldum",
        'DRAGONS': "L'Envol des Dragons",
        'DRG': "L'Envol des Dragons",
        'YEAR_OF_THE_DRAGON': 'Le Réveil de Galakrond',
        'YOD': 'Le Réveil de Galakrond',

        // 2020
        'BLACK_TEMPLE': "Les Cendres de l'Outreterre",
        'BT': "Les Cendres de l'Outreterre",
        'DEMON_HUNTER_INITIATE': 'Initié chasseur de démons',
        'DHI': 'Initié chasseur de démons',
        'SCHOLOMANCE': "L'Académie Scholomance",
        'SCH': "L'Académie Scholomance",
        'DARKMOON_FAIRE': 'Folle journée à Sombrelune',
        'DMF': 'Folle journée à Sombrelune',

        // 2021
        'THE_BARRENS': 'Forgés dans les Tarides',
        'BAR': 'Forgés dans les Tarides',
        'WAILING_CAVERNS': 'Les Cavernes des lamentations',
        'STORMWIND': 'Unis à Hurlevent',
        'SW': 'Unis à Hurlevent',
        'ALTERAC_VALLEY': 'Divisés en Alterac',
        'AV': 'Divisés en Alterac',

        // 2022
        'THE_SUNKEN_CITY': 'Au cœur de la cité engloutie',
        'TSC': 'Au cœur de la cité engloutie',
        'REVENDRETH': 'Meurtre au château Nathria',
        'REVENDETH': 'Meurtre au château Nathria',
        'REV': 'Meurtre au château Nathria',
        'RETURN_OF_THE_LICH_KING': 'La marche du roi-liche',
        'RLK': 'La marche du roi-liche',
        'PATH_OF_ARTHAS': "Voie d'Arthas",
        'PA': "Voie d'Arthas",

        // 2023
        'BATTLE_OF_THE_BANDS': 'La fête des légendes',
        'ETC': 'La fête des légendes',
        'TITANS': 'TITANS',
        'TTN': 'TITANS',
        'WILD_WEST': 'Rixe en terres Ingrates',
        'WST': 'Rixe en terres Ingrates',
        'WONDERS': 'Grottes du Temps',
        'WON': 'Grottes du Temps',

        // 2024
        'WHIZBANGS_WORKSHOP': "L'Atelier de Mystifix",
        'TOY': "L'Atelier de Mystifix",
        'ISLAND_VACATION': 'Paradis en péril',
        'VAC': 'Paradis en péril',
        'GREAT_DARK_BEYOND': "La Ténèbre de l'Au-delà",
        'GDB': "La Ténèbre de l'Au-delà",
        'SPACE': "La Ténèbre de l'Au-delà",

        // 2025
        'EMERALD_DREAM': "Au cœur du Rêve d'émeraude",
        'EDR': "Au cœur du Rêve d'émeraude",
        'THE_LOST_CITY': "La cité perdue d'Un'Goro",
        'TLC': "La cité perdue d'Un'Goro",
        'CATACLYSM': 'CATACLYSME',
        'CATA': 'CATACLYSME',
        'TIME_TRAVEL': 'Par-delà les voies temporelles',
        'TIME': 'Par-delà les voies temporelles',
        'TAVERNS_OF_TIME': 'Par-delà les voies temporelles',

        // Divers
        'EVENT': 'Évènement',
        'EVE': 'Évènement',
    };

    // Icon paths for each set (relative to project root)
    const SET_ICONS = {
        'NAXX': 'logo/extensions/NaxxIcon.webp',
        'FP1': 'logo/extensions/NaxxIcon.webp',
        'GVG': 'logo/extensions/GvGIcon.webp',
        'PE1': 'logo/extensions/GvGIcon.webp',
        'BRM': 'logo/extensions/BRMIcon.webp',
        'FP2': 'logo/extensions/BRMIcon.webp',
        'TGT': 'logo/extensions/TGTIcon.webp',
        'LOE': 'logo/extensions/LOEIcon.webp',
        'OG': 'logo/extensions/OGIcon.webp',
        'OG_RESERVE': 'logo/extensions/OGIcon.webp',
        'KARA': 'logo/extensions/KaraIcon.webp',
        'KARA_RESERVE': 'logo/extensions/KaraIcon.webp',
        'GANGS': 'logo/extensions/GangsIcon.webp',
        'GANGS_RESERVE': 'logo/extensions/GangsIcon.webp',
        'UNGORO': 'logo/extensions/UNGIcon.webp',
        'ICECROWN': 'logo/extensions/ICCIcon.webp',
        'LOOTAPALOOZA': 'logo/extensions/LOOTIcon.webp',
        'GILNEAS': 'logo/extensions/GILIcon.webp',
        'BOOMSDAY': 'logo/extensions/BOTIcon.webp',
        'TROLL': 'logo/extensions/TRLIcon.webp',
        'DALARAN': 'logo/extensions/DALIcon.webp',
        'ULDUM': 'logo/extensions/UldumIcon.webp',
        'DRAGONS': 'logo/extensions/DRGIcon.webp',
        'DRG': 'logo/extensions/DRGIcon.webp',
        'YEAR_OF_THE_DRAGON': 'logo/extensions/YODIcon.webp',
        'YOD': 'logo/extensions/YODIcon.webp',
        'BLACK_TEMPLE': 'logo/extensions/BTIcon.webp',
        'BT': 'logo/extensions/BTIcon.webp',
        'DEMON_HUNTER_INITIATE': 'logo/extensions/DHIIcon.webp',
        'DHI': 'logo/extensions/DHIIcon.webp',
        'SCHOLOMANCE': 'logo/extensions/SCHIcon.webp',
        'SCH': 'logo/extensions/SCHIcon.webp',
        'DARKMOON_FAIRE': 'logo/extensions/DMFIcon.webp',
        'DMF': 'logo/extensions/DMFIcon.webp',
        'STORMWIND': 'logo/extensions/SWIcon.webp',
        'SW': 'logo/extensions/SWIcon.webp',
        'THE_SUNKEN_CITY': 'logo/extensions/Voyage_to_the_Sunken_City_-_SVG_logo.webp',
        'TSC': 'logo/extensions/Voyage_to_the_Sunken_City_-_SVG_logo.webp',
        'PATH_OF_ARTHAS': 'logo/extensions/PoAIcon.webp',
        'PA': 'logo/extensions/PoAIcon.webp',
        'TITANS': 'logo/extensions/TTNIcon.webp',
        'TTN': 'logo/extensions/TTNIcon.webp',
        'EXPERT1': 'logo/extensions/ClassicIcon.webp',
        'VANILLA': 'logo/extensions/ClassicIcon.webp',
        'HOF': 'logo/extensions/HallOfFameIcon.webp',
        'THE_SUNKEN_CITY': 'logo/extensions/SCIcon.webp',
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
        'DEATHKNIGHT': 'logo/Class/Death_Knight_icon.webp',
        'DEMONHUNTER': 'logo/Class/Demon_Hunter_icon.webp',
    };

    // Rarity icon paths
    const RARITY_ICONS = {
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

    // Map English keyword mechanics to their field representation
    const KEYWORD_FIELD_MAP = {
        'TAUNT': 'Provocation',
        'DIVINE_SHIELD': 'Bouclier divin',
        'BATTLECRY': 'Cri de guerre',
        'DEATHRATTLE': 'Râle d\'agonie',
        'RUSH': 'Ruée',
        'CHARGE': 'Charge',
        'LIFESTEAL': 'Vol de vie',
        'WINDFURY': 'Furie des vents',
        'POISONOUS': 'Toxicité',
        'STEALTH': 'Camouflage',
        'SPELL_DAMAGE': 'Dégâts des sorts',
        'DISCOVER': 'Découverte',
        'MAGNETIC': 'Magnétisme',
        'REBORN': 'Renaissance',
        'OUTCAST': 'Paria',
        'TRADEABLE': 'Échangeable',
        'FREEZE': 'Gel',
        'SILENCE': 'Silence',
        'CHOOSE_ONE': 'Choix des armes',
        'COMBO': 'Combo',
        'OVERLOAD': 'Surcharge',
        'SECRET': 'Secret',
    };

    // Card type mapping
    const TYPE_MAP = {
        'MINION': 'Serviteur',
        'SPELL': 'Sort',
        'WEAPON': 'Arme',
        'HERO': 'Héros',
        'LOCATION': 'Lieu',
    };

    // Race mapping
    const RACE_MAP = {
        'BEAST': 'Bête',
        'DRAGON': 'Dragon',
        'MURLOC': 'Murloc',
        'DEMON': 'Démon',
        'MECHANICAL': 'Méca',
        'PIRATE': 'Pirate',
        'ELEMENTAL': 'Élémentaire',
        'TOTEM': 'Totem',
        'UNDEAD': 'Mort-vivant',
        'NAGA': 'Naga',
        'ALL': 'Tout',
    };

    // Class mapping
    const CLASS_MAP = {
        'MAGE': 'Mage',
        'WARRIOR': 'Guerrier',
        'PALADIN': 'Paladin',
        'HUNTER': 'Chasseur',
        'ROGUE': 'Voleur',
        'PRIEST': 'Prêtre',
        'SHAMAN': 'Chaman',
        'WARLOCK': 'Démoniste',
        'DRUID': 'Druide',
        'DEATHKNIGHT': 'Chevalier de la mort',
        'DEMONHUNTER': 'Chasseur de démons',
        'NEUTRAL': 'Neutre',
    };

    // Rarity mapping
    const RARITY_MAP = {
        'FREE': 'Basique',
        'COMMON': 'Commune',
        'RARE': 'Rare',
        'EPIC': 'Épique',
        'LEGENDARY': 'Légendaire',
    };

    function getSetDisplayName(setCode) {
        return SET_DISPLAY_NAMES[setCode] || setCode;
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
        // Sort by French display name
        return Array.from(sets).sort((a, b) => {
            const nameA = getSetDisplayName(a);
            const nameB = getSetDisplayName(b);
            return nameA.localeCompare(nameB, 'fr');
        });
    }

    function cardHasKeyword(card, keyword) {
        // Check mechanics array
        if (card.mechanics && card.mechanics.includes(keyword)) return true;
        // For DISCOVER, FREEZE, CHOOSE_ONE, COMBO, OVERLOAD, SECRET — also check referencedTags
        if (card.referencedTags && card.referencedTags.includes(keyword)) return true;
        // Special: SECRET is also indicated by card.secret === true
        if (keyword === 'SECRET' && card.secret === true) return true;
        // OVERLOAD: check for overload field
        if (keyword === 'OVERLOAD' && card.overload && card.overload > 0) return true;
        // SPELL_DAMAGE: check spellDamage field
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
        STANDARD_SETS,
        CLASSIC_SETS,
        KEYWORD_FIELD_MAP,
        TYPE_MAP,
        RACE_MAP,
        CLASS_MAP,
        RARITY_MAP,
        SET_DISPLAY_NAMES,
        SET_ICONS,
        CLASS_ICONS,
        RARITY_ICONS,
        STAT_ICONS,
    };
})();
