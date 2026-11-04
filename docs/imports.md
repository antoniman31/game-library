# Imports : Xbox et Playnite

Retour au [README](../README.md).

## Import de la bibliothèque Xbox Live

Bouton **« 🎮 Importer Xbox »** → récupère l'historique de jeux du compte associé
à la clé xbl.io.

- **Filtrage** : sur ~164 titres renvoyés, seuls les vrais jeux console sont
  gardés (~150). Les entrées PC-only / Win32 et les applications (Xbox App,
  Minecraft Launcher, Solitaire…) sont écartées.
- **Écran de prévisualisation obligatoire** : chaque titre est marqué
  **« Nouveau »** ou **« Déjà présent »** (comparaison de titre normalisée), avec
  compteurs, « tout cocher / décocher » et cases individuelles — indispensable
  pour écarter les doublons FR/EN que la normalisation ne rattrape pas.
- **À l'import** : `format: "démat"`, jaquette xbl.io immédiate, **date d'ajout =
  date de sortie officielle** récupérée via RAWG (repli : dernière session, puis
  date du jour), plateforme Xbox One / Series X déduite, `backCompat` cohérent.
  Progression affichée et **arrêt possible**.
- **Enrichissement post-import** proposé en bannière (RAWG + Wikipédia),
  best-effort et annulable.

> ⚠️ L'API expose l'**historique joué**, pas la liste des achats : un jeu acheté
> mais jamais lancé n'apparaît pas, un jeu Game Pass lancé une fois apparaît.
> Aucun temps de jeu n'est importé (absent de l'endpoint).

## Import des jeux PC (Playnite)

**Le problème.** Steam demande une clé d'API ; Epic, GOG et Amazon n'ont pas
d'API publique du tout. Les mails de confirmation ne portent les titres que
dans leur corps HTML, et il n'existe aucun mail Amazon Gaming. Écrire quatre
intégrations ici aurait donc coûté cher pour un résultat partiel.

[Playnite](https://github.com/JosefNemec/Playnite) (Windows, MIT) lit ces
quatre boutiques depuis les clients installés et télécharge les métadonnées
d'IGDB. Il fait ce travail sur le PC ; l'application lit son export.

**Deux façons d'obtenir le fichier**, l'application lit les deux.

La plus simple : installer l'extension [Json Library Import
Export](https://github.com/sokolinthesky/JsonLibraryImportExport) depuis
l'annuaire d'add-ons de Playnite, puis Extensions → Json Library Import Export
→ Export. Elle écrit un dossier de fichiers ; seul `games.json` sert ici. Son
format est celui des objets Playnite bruts, en anglais et imbriqué.

L'autre, sans extension tierce : le script ci-dessous, qui écrit directement un
fichier plat. Créer un dossier `ExportLudotheque` dans
`%AppData%\Playnite\Extensions\` (ou dans le dossier `Extensions` de
l'installation portable) avec ces deux fichiers, en UTF-8, puis relancer
Playnite : l'entrée apparaît dans le menu principal.

`extension.yaml` :

```yaml
Id: ExportLudotheque_Script
Name: Export ludothèque
Author: Antoni
Version: 1.0
Module: export.psm1
Type: Script
```

`export.psm1` :

```powershell
function GetMainMenuItems()
{
    param($menuArgs)
    $item = New-Object Playnite.SDK.Plugins.ScriptMainMenuItem
    $item.Description = "Exporter la ludothèque (JSON)"
    $item.FunctionName = "ExportLudotheque"
    $item.MenuSection = "@Export ludothèque"
    return $item
}

function ExportLudotheque()
{
    # Playnite passe un argument à la fonction du menu : sans ce `param`,
    # le clic échoue sur « Impossible de trouver un paramètre positionnel ».
    param($menuArgs)

    $chemin = $PlayniteApi.Dialogs.SaveFile("JSON|*.json")
    if (!$chemin) { return }

    $jeux = @()
    foreach ($j in $PlayniteApi.Database.Games)
    {
        $boutique = ""
        if ($j.Source) { $boutique = $j.Source.Name }

        $sortie = ""
        if ($j.ReleaseDate -ne $null) { $sortie = $j.ReleaseDate.Serialize() }

        $jeux += [PSCustomObject]@{
            titre           = $j.Name
            boutique        = $boutique
            idBoutique      = $j.GameId
            plateformes     = @($j.Platforms  | ForEach-Object { $_.Name })
            sortie          = $sortie
            genres          = @($j.Genres     | ForEach-Object { $_.Name })
            developpeurs    = @($j.Developers | ForEach-Object { $_.Name })
            editeurs        = @($j.Publishers | ForEach-Object { $_.Name })
            series          = @($j.Series     | ForEach-Object { $_.Name })
            fonctionnalites = @($j.Features   | ForEach-Object { $_.Name })
            description     = $j.Description
            installe        = $j.IsInstalled
        }
    }

    $jeux | ConvertTo-Json -Depth 4 | Out-File -FilePath $chemin -Encoding utf8
    $PlayniteApi.Dialogs.ShowMessage("$($jeux.Count) jeux exportés.")
}
```

**Dans l'application** : ⚙️ → Sauvegarde → **« 🖥️ Importer un export Playnite »**.

- **Écran de prévisualisation obligatoire**, comme pour l'import Xbox : chaque
  ligne est marquée **Nouveau**, **Déjà présent**, **Écarté** ou **Ignoré**, et
  seules les nouvelles sont cochables. Rien n'est écrit avant validation.
- **Ce qui entre** : une fiche PC, démat, avec sa boutique, sa référence
  boutique, ses genres (ramenés au vocabulaire du projet), sa description
  (nettoyée de son HTML, résumée au-delà de 900 caractères) et une infobox
  signée « IGDB (via Playnite) ». La date d'ajout reprend la date de sortie
  quand elle est complète.
- **Deux langues dans le même fichier** : Playnite répond dans la langue de son
  interface, mais ses sources ne sont pas toutes traduites. Un export réel de
  181 jeux porte « Solo » 130 fois et « Single Player » 17, « Indépendant » et
  « Indie », « Course automobile » et « Racing ». Les tables de genres et de
  modes couvrent donc les deux formes, sans quoi les filtres couperaient la
  bibliothèque en deux moitiés arbitraires.
- **Ce qui est ignoré** : une ligne sans titre, une ligne en double, et toute
  plateforme qui n'est pas celle d'un PC — les importateurs PSN et Xbox de
  Playnite et ses jeux émulés partagent la même base que Steam.
- **La série est choisie, pas prise au hasard.** Les sources de Playnite ne
  s'accordent pas sur ce qu'est une série : un export réel donne « ''Half-Life'' »
  avec son balisage wiki, « AmplitudeStudios » qui est le studio, et pour Age of
  Mythology deux réponses à la fois. Le balisage est retiré, ce qui porte le nom d'un
  studio du jeu est écarté, et entre plusieurs candidates on garde la plus longue que
  le titre contient — « Age of Mythology » plutôt qu'« Age of Empires », « Plague Inc. »
  plutôt qu'« Inc. ». Les deux premières règles vivent dans le modèle et sont rejouées
  à chaque chargement : les fiches déjà importées se nettoient seules.

  Deux formes de nom de studio échappaient à la comparaison caractère à caractère et
  ont été ajoutées. **Une forme juridique seule** — « Inc. », « Ltd », « GmbH » — est
  la fin d'un nom d'entreprise dont le début s'est perdu : elle ne désigne rien et
  n'a besoin d'aucun studio à qui se comparer. **Un sigle** — « WB Games » pour
  « Warner Bros. Games » — demande deux conditions à la fois : le même dernier mot,
  qui doit être un suffixe de studio, et des initiales qui correspondent. Les deux
  ensemble, parce que le suffixe seul écarterait « Hunger Games » chez un éditeur
  nommé « X Games », et les initiales seules n'importe quel sigle.
- **Ce qui n'est pas repris** : les jaquettes (des fichiers sur le disque du PC,
  pas des URL — elles continuent de venir de RAWG), le temps de jeu (retiré du
  modèle) et le statut de complétion de Playnite.

**La liste des écartés.** Un jeu importé puis supprimé est retenu par sa
référence de boutique dans `gl_exclusions`, et ne revient pas au prochain
import. Sans elle, chaque import ramène ce qu'on vient d'écarter et l'on cesse
d'importer. La liste voyage avec la sauvegarde en ligne (elle ne contient aucun
secret) et se vide depuis ⚙️ → Sauvegarde. Annuler une suppression retire
l'exclusion.
