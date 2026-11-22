# Séances — appli de suivi de muscu / cardio

**Problème réglé** : plus besoin de chercher sa séance dans ses notes ni de se demander combien on a soulevé la dernière fois.

## V1
- **Aujourd'hui** : la séance prévue pour le jour s'affiche directement (bande Lun→Dim pour voir les autres jours), avec, pour chaque exercice, ce qui a été fait la dernière fois.
- **Séance en cours** : valeurs pré-remplies avec la dernière séance, case ✓ par série, minuteur de repos automatique (vibration + bip), suggestion « +2,5 kg » quand l'objectif a été atteint, écran maintenu allumé.
- **Programmes** : séances = exercices (muscu, poids du corps en reps ou secondes, cardio) + jours de la semaine.
- **Historique** : séances terminées, nouveaux records 🏆.
- **Progrès** : records, 1RM estimé, graphique par exercice.
- **Réglages** : repos par défaut, export / import de sauvegarde.

Les données restent sur le téléphone (localStorage). Penser à exporter régulièrement.

## Technique
HTML + CSS + JavaScript sans framework, appli web installable (manifest + service worker, fonctionne hors ligne).

| Fichier | Rôle |
|---|---|
| `index.html` | Squelette de la page |
| `style.css` | Style (simple, à retravailler) |
| `app.js` | Toute la logique (données, écrans, actions) |
| `sw.js` | Cache hors ligne |
| `manifest.webmanifest` | Installation sur l'écran d'accueil |
| `tools/serve.ps1` | Serveur local de test (`http://localhost:8080`) |

Tester sur le PC :
```powershell
powershell -ExecutionPolicy Bypass -File tools\serve.ps1
```

Pour l'installer sur un téléphone, il faut l'héberger en HTTPS (ex. GitHub Pages, gratuit).
