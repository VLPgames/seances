# Séances — appli de suivi de muscu / cardio

En ligne : https://vlpgames.github.io/seances/

**Problème réglé** : plus besoin de chercher sa séance dans ses notes ni de se demander combien on a soulevé la dernière fois.

## Fonctionnement (V2)
- **Accueil** : la séance prévue pour le jour, déjà remplie (« 4 × 8 · 42,5 kg ») avec ce qui a été fait la dernière fois, objectif de la semaine.
- **Séance en cours** : une ligne par exercice, un bouton ✓, minuteur de repos automatique. Après chaque exercice : « Comment c'était ? » (trop dur / parfait / trop facile) + note pour la prochaine fois. « Trop facile » → +2,5 kg (ou +1 rep) proposé automatiquement la fois suivante.
- **Séances** : nom, jours, exercices (muscu, poids du corps en reps ou secondes, cardio).
- **Historique**, **Progrès** (records, graphique par exercice), **Profil** (compte, réglages, sauvegarde).
- Barre d'onglets en verre, glissable ; swipe gauche/droite sur le contenu pour changer d'onglet.
- Semaine type par jour (salle / maison / extérieur / repos), catalogue de machines, reprise d'une séance sur plusieurs jours.
- Accueil : anneau de la semaine, série 🔥, carte de la séance du jour (durée estimée, muscles travaillés).
- Séance : chrono, minuteur de repos en cercle, confettis sur record ; résumé de fin (durée, volume vs dernière fois, records).
- Progrès : volume par semaine, poids du corps, records, graphique par exercice.
- Apparence : mode auto / clair / sombre + 6 palettes (Graphite, Océan, Forêt, Sunset, Feu, Néon), taille du texte, animations réduites.
- Profil sportif (questionnaire d'accueil facultatif) : objectif, niveau, lieu, salle (Basic-Fit, Fitness Park, L'Orange Bleue, Keepcool, On Air, Neoness ou autre), âge/taille/poids avec consentement dédié → valeurs proposées adaptées.
- Ma salle : liste de machines indicative par enseigne, ajustable ; le catalogue propose d'abord les machines de ta salle.
- Progrès : séries par muscle cette semaine (repère ACSM ~10/semaine).
- Recherche et sources : `docs/recherche-v2.md`.

## Comptes et synchro
- Hors ligne d'abord : tout est enregistré sur l'appareil, puis synchronisé avec le compte dès qu'il y a du réseau (fusion par élément, la modification la plus récente gagne).
- Serveur : Supabase (gratuit). Configuration dans `config.js` (URL + clé publique), table et règles de sécurité dans `supabase/schema.sql`.
- Sans configuration, l'appli fonctionne en mode local.

## Technique
HTML + CSS + JavaScript sans framework, appli web installable (manifest + service worker).

| Fichier | Rôle |
|---|---|
| `index.html` | Squelette de la page |
| `style.css` | Design |
| `app.js` | Logique (données, synchro, écrans, actions) |
| `config.js` | Paramètres Supabase |
| `supabase/schema.sql` | Table `user_data` + règles RLS |
| `sw.js` | Cache hors ligne |
| `tools/serve.ps1` | Serveur local de test (`http://localhost:8080`) |

```powershell
powershell -ExecutionPolicy Bypass -File tools\serve.ps1
```
