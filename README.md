# FOILRACE

Application web installable (PWA) pour consulter le classement FOILRACE de South Wake Park.

## Version actuelle

- classement selon le meilleur temps de chaque rider ;
- recherche par pseudo ;
- ajout manuel d'un chrono pour les essais ;
- fonctionnement hors ligne et installation sur l'écran d'accueil ;
- stockage local temporaire en attendant la connexion Supabase.

## Suite prévue

1. Créer le projet Supabase et exécuter `supabase/schema.sql`.
2. Renseigner l'URL du projet et la clé publique `anon` dans `config.js`.
3. Créer l'API d'entrée sécurisée des chronos ESP32/LoRa.
4. Publier sur GitHub Pages.

La création de compte, la connexion, le classement partagé et les photos de profil sont maintenant préparés. Sans configuration Supabase, l'application reste automatiquement en mode démonstration local.

Les temps sont stockés sous forme de centièmes entiers afin d'éviter les erreurs d'arrondi.
