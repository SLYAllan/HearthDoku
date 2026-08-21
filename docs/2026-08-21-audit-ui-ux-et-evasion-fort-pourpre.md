# Audit UI/UX et ajout d’Évasion du fort Pourpre

Date : 21 août 2026  
Base : `origin/main` au commit `da657b2`

## Contexte

Le dépôt local avait 16 commits de retard et contenait une modification non validée de `index.html`. La copie locale a été remplacée par la dernière version de `origin/main` avant l’audit.

Le dernier set Hearthstone publié est **Évasion du fort Pourpre**. HearthstoneJSON, la source utilisée par le site, le livre sous le code `ESCAPEFROM_VIOLET_HOLD`.

## Audit

Les contrôles du parcours solo, du multijoueur, du responsive et de l’accessibilité ont relevé ces défauts :

- grille coupée sur certains écrans de 320 à 636 px ;
- en-tête trop large et cibles tactiles trop petites ;
- cellules et réponses de recherche inutilisables au clavier ;
- focus non piégé ou non rendu après la fermeture des fenêtres ;
- deux fenêtres superposées à la fin du puzzle quotidien ;
- filtres vides traités comme si tout était sélectionné ;
- messages multijoueur et champs sans nom accessible ;
- contraste trop faible pour le texte tertiaire ;
- cache permanent qui pouvait masquer un nouveau set ;
- absence du vrai code `ESCAPEFROM_VIOLET_HOLD` dans le preset Standard, les traductions et les icônes ;
- libellé « Classique » affiché deux fois pour les versions `EXPERT1` et `VANILLA` d'une même carte ;
- code technique visible quand un set n'avait pas de nom ;
- icône des extensions trop petite pour des emblèmes fins comme celui des Jeux de Rastakhan.

## Changements

### Données Hearthstone

- ajout de `ESCAPEFROM_VIOLET_HOLD` au preset Standard ;
- ajout des noms « Évasion du fort Pourpre » et « Escape from Violet Hold » ;
- ajout du logo fourni dans `logo/extensions/Escape_from_Violet_Hold_-_Icon.webp` ;
- exclusion du set technique `CORE_HIDDEN` ;
- passage du cache de cartes à la version 7 pour forcer un nouveau chargement.

### Réponses de recherche

Quand plusieurs cartes portent le même nom, chaque réponse affiche son extension. `VANILLA` s'affiche comme « Classique », `EXPERT1` comme « Héritage » et `LEGACY` comme « Héritage (cartes de base) ». Un Gnome lépreux en double ne porte donc plus deux fois le badge « Classique ».

### Filtres et logos

- chaque chemin déclaré dans `SET_ICONS` pointe vers un fichier présent ;
- le code actuel d'Évasion du fort Pourpre a un nom et un logo en français et en anglais ;
- l'icône des extensions passe de 18 à 22 px pour rester lisible ;
- les données techniques `CORE_HIDDEN` et `HERO_SKINS` ne polluent pas les filtres.

### UI et UX

- grille fluide sur mobile et tablette ;
- en-tête adaptable sous 900 px ;
- cibles tactiles de 44 px sur les principaux contrôles mobiles ;
- suppression des transitions trop larges ou trop longues ;
- contraste du texte tertiaire relevé ;
- filtres sans choix ramenés à un pool vide ;
- erreur de rechargement lors du changement de langue gérée.

### Accessibilité

- cellules et réponses changées en boutons natifs ;
- noms accessibles ajoutés aux cellules et aux actions multijoueur ;
- régions d’état multijoueur annoncées ;
- fond rendu inactif pendant l’ouverture d’une fenêtre ;
- focus placé dans la fenêtre, contenu dans celle-ci, puis rendu à un contrôle actif ;
- `aria-hidden` synchronisé dans le multijoueur ;
- rôle de la grille ramené à un groupe de boutons natifs.

## Vérifications

- `node --test --test-isolation=none tests/ui-regressions.test.js` : 7 tests réussis ;
- `node --check` : syntaxe valide pour les fichiers JavaScript du client et du serveur ;
- `git diff --check` : aucune erreur d’espace ;
- présence de chaque fichier cité par `SET_ICONS` contrôlée par test.

Le navigateur Playwright local n’a pas pu démarrer dans cette session. Les tailles 320, 375, 768 et 1280 px ont donc été vérifiées par le calcul des règles CSS et une double relecture du code, pas par comparaison de captures.

## Sources

- Blizzard, notes de la mise à jour 36.0 : https://hearthstone.blizzard.com/fr-fr/news/24287396
- Blizzard, annonce d’Évasion du fort Pourpre : https://hearthstone.blizzard.com/en-us/news/24276664
