# Android

Retour au [README](../README.md).

La même application, empaquetée dans un APK par Capacitor : les fichiers sont
dans l'application, rien ne dépend du site en ligne.

```bash
npm run android        # build Android + icônes + projet natif
```

Puis, avec le SDK Android : `cd android && ./gradlew assembleDebug`. En
pratique on ne le fait pas à la main —
[`.github/workflows/android.yml`](../.github/workflows/android.yml) le construit
sur demande (onglet Actions → « Application Android » → Run workflow) et dépose
l'APK en artefact téléchargeable.

**Ce qui diffère du site, et rien d'autre.** Les fichiers sont servis depuis la
racine de la WebView et non depuis `/game-library/`, et le service worker est
retiré : il n'a rien à mettre en cache puisque tout est déjà dans l'APK, et la
bannière « Nouvelle version » qu'il déclenche n'aurait rien à annoncer — les
mises à jour arrivent par un nouvel APK. C'est tout le contenu de
`--mode android`, et c'est ce qui garantit que le site ne peut pas dériver de
l'application.

**Six comportements qu'une WebView ne partage pas avec un navigateur**, tous
regroupés dans [`src/lib/natif.js`](../src/lib/natif.js) plutôt que dispersés :

- **L'export.** Une WebView Android ignore purement et simplement l'attribut
  `download` : le bouton ne faisait rien, et rien ne le disait. C'était le
  défaut le plus grave du passage en application — l'export est la seule copie
  de la bibliothèque qui sorte de l'appareil, et il aurait échoué en silence.
  Le fichier est donc vraiment écrit, puis le panneau de partage du système
  s'ouvre. L'export de secours de l'écran d'erreur passe par le même chemin,
  et c'est là que ça compte le plus : cet écran ne s'affiche que lorsque
  l'application est déjà tombée.
- **Le bouton Retour.** Il ne faisait **rien** — ni refermer, ni quitter. Sans
  écouteur enregistré, Capacitor remonte l'historique de la WebView et, s'il
  n'y en a pas, ne fait rien : l'activité ne se termine pas. Or une application
  à une seule page n'a pas d'historique, et l'écouteur n'existait que pendant
  qu'un panneau était ouvert. Le reste du temps, le bouton était mort. Il y en
  a maintenant un seul, posé avant le premier rendu comme celui des liens, qui
  tranche : s'il y a quelque chose au premier plan il le referme — la même
  chose qu'Échap —, sinon il quitte. La pile de ce qui est au premier plan vit
  dans [`src/lib/retour.js`](../src/lib/retour.js), qui ne connaît ni Android ni
  Capacitor : la décision se teste sans téléphone.
- **Les liens sortants.** Un lien externe se chargerait *dans* la WebView, qui
  devient un navigateur sans barre d'adresse dont on ne ressort pas. Un seul
  écouteur, posé avant le premier rendu, les envoie au navigateur du système —
  y compris ceux qu'on ajoutera plus tard, ce qu'une retouche des huit liens
  existants n'aurait pas garanti. Les schémas qui ne sont pas du web, comme le
  `sms:` de relance d'un emprunteur, continuent d'aller au système.
- **La barre d'état.** Sur le site, une balise `<meta name="theme-color">`
  suffit ; dans une WebView elle ne veut rien dire, la barre appartient au
  système. Ce n'est pas qu'esthétique : l'application a son propre réglage
  clair/sombre, qui peut contredire celui du téléphone — téléphone en sombre et
  application en clair, le système dessinait des icônes claires sur un en-tête
  clair. Seul le style est réglé, pas la couleur : depuis qu'Android impose le
  bord à bord, c'est l'en-tête de l'application qu'on voit derrière la barre.
- **La version affichée.** Le site se met à jour tout seul, l'application
  s'installe à la main, et ni l'un ni l'autre ne disait ce qu'il était.
  ⚙️ l'affiche : le numéro de construction qu'Android connaît côté application,
  le commit côté site.
- **Les icônes.** Android veut une icône adaptative à deux couches, que le
  système recadre selon le téléphone. Elles ne sont pas dessinées mais
  dérivées : l'avant-plan est le `maskable` de la PWA, dont les marges de
  sécurité existent précisément pour ça, et le fond est le noir de
  l'application. [`scripts/icones-android.mjs`](../scripts/icones-android.mjs) les
  fabrique depuis `public/`, et
  [`scripts/elaguer-android.mjs`](../scripts/elaguer-android.mjs) retire ensuite
  les douze dossiers d'écran de démarrage sombres, doubles exacts de leurs
  jumeaux de jour — 350 Ko. Chaque fichier est comparé avant d'être retiré :
  le jour où le sombre différera du clair, il survivra.

**Le relais a une origine de plus.** Capacitor sert les fichiers depuis une
origine locale et non depuis le site : sans `https://localhost` dans la liste
du Worker, l'application installée perdrait d'un coup les jaquettes
SteamGridDB, l'import Xbox, les notes Steam et la synchronisation — quatre
pannes sans rapport apparent. Cette liste n'est pas une barrière de sécurité,
et mieux vaut l'écrire que le sous-entendre : un appel hors navigateur
l'ignore complètement. Elle empêche un site tiers d'utiliser le relais depuis
le navigateur d'un visiteur ; ce qui protège la sauvegarde, c'est le code de
synchronisation.

**Ni `android/` ni `assets/` ne sont dans le dépôt.** Les deux sont engendrés
par `npm run android` depuis `public/` et `capacitor.config.json`. Le projet
n'accueille aucun fichier produit — c'est la règle qui avait déjà fait écarter
un dossier `docs/` commité pour GitHub Pages — et cinquante fichiers de Gradle
que personne ne relit ne feraient pas exception.

**Les jaquettes sont gardées sur l'appareil.** Une jaquette est une URL —
SteamGridDB, RAWG, Microsoft. Sur le site, le service worker les met en cache
soixante jours ; dans l'application il n'existe pas, si bien qu'elle les
retéléchargeait à chaque lancement et n'affichait que des cadres vides sans
réseau. Le site était devenu meilleur que l'application sur le seul point où
l'application devait gagner. ⚙️ → Outils → **« Enregistrer les jaquettes sur
l'appareil »** les descend une fois dans son stockage privé.

Le champ `cover` de la fiche n'est pas touché, et c'est le choix qui compte :
l'URL reste la référence — c'est elle qui part dans l'export et la
synchronisation, c'est elle que lit le site, c'est elle qu'un autre appareil
saura redescendre. Un chemin de fichier local ne veut rien dire ailleurs que
sur ce téléphone-ci. L'index qui associe une URL à son fichier vit donc à part,
dans `gl_jaquettes`, comme les clés et le code de synchronisation. L'opération
s'interrompt sans rien perdre : chaque image descendue est notée aussitôt, et
la reprise repart où elle s'était arrêtée. Un ménage suit, qui retire les
fichiers dont plus aucune fiche ne veut.

**Les polices sont embarquées.** Inter et Press Start 2P venaient de Google
Fonts, par le réseau, et ne figuraient dans aucun build : hors ligne, le titre
perdait sa police pixel et le reste retombait sur celle du système — des deux
côtés, le site compris. Seul le sous-ensemble `latin` est pris, vérifié plutôt
que supposé : il contient œ, les guillemets français, le tiret cadratin et
l'apostrophe typographique. Quatre fichiers, 88 Ko, et les règles `@font-face`
sont écrites à la main parce que celles du paquet traînent un repli `.woff` que
personne ne demandera jamais.

**Le site et l'application sont deux bibliothèques distinctes.** Même code,
mais chacune son stockage : un jeu ajouté dans l'application n'apparaît pas sur
le site tant qu'on n'a pas fait ⚙️ → Envoyer d'un côté et Récupérer de l'autre.
La synchronisation passe d'optionnelle à nécessaire dès qu'on utilise les deux.

**Deux variantes d'APK.** « Publication » (le défaut) est réduite par R8 et non
`debuggable` ; « Débogage » reste à un choix de distance, parce que c'est la
seule dont on peut inspecter la WebView depuis un PC. Les deux sont signées par
la clé fixe ci-dessous, qui est une clé de débogage : pour le Play Store, il
faudra encore une clé de publication, fabriquée sur la machine de son
propriétaire et qui ne traverse aucune conversation.

**La clé de signature est fixe, et c'est ce qui permet les mises à jour.**
Android n'identifie pas une application par son nom mais par la clé qui l'a
signée : deux APK signés différemment sont deux applications étrangères, et la
seconde ne s'installe pas par-dessus la première. Laissée à elle-même, la CI
fabrique une clé neuve à chaque exécution — chaque APK aurait alors exigé une
désinstallation, donc la perte de la bibliothèque locale. La clé vit dans le
secret `ANDROID_DEBUG_KEYSTORE` (le magasin encodé en base64) ; le workflow
l'écrit sur le disque de la machine et **la déclare explicitement** dans le
projet engendré par Capacitor. Le dépôt dans `~/.android/debug.keystore`, où
Gradle est censé la chercher, a été essayé et n'a pas fonctionné : cet
emplacement se résout à partir de variables d'environnement propres à la
machine, un chemin écrit noir sur blanc ne dépend de rien.

Trois vérifications plutôt que trois suppositions : si le secret manque la
construction s'arrête, le magasin est relu dès qu'il est écrit — un
copier-coller tronqué se voit là et non sur le téléphone — et l'empreinte de
l'APK produit est comparée à celle attendue.

En recréer une, si le secret est perdu — au prix d'une dernière désinstallation,
et en remplaçant l'empreinte inscrite dans le workflow par celle qu'affiche
`keytool -list -v` :

```sh
keytool -genkeypair -v -keystore debug.keystore -storetype PKCS12 \
  -alias androiddebugkey -keyalg RSA -keysize 2048 -validity 10950 \
  -storepass android -keypass android -dname "CN=Android Debug,O=Android,C=US"
base64 -w0 debug.keystore   # à coller dans le secret
```

Les mots de passe sont ceux, publics, de la clé de débogage d'Android : le
secret n'ajoute pas de confidentialité, il empêche seulement un inconnu de
signer un APK au nom de cette application.
