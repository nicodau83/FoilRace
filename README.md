# FOILRACE

Application web installable (PWA) pour consulter le classement FOILRACE de South Wake Park.

## Version actuelle

- classement selon le meilleur temps de chaque rider ;
- recherche par pseudo ;
- ajout manuel d'un chrono pour les essais ;
- fonctionnement hors ligne et installation sur l'écran d'accueil ;
- stockage local temporaire en attendant la connexion Supabase.

## Suite prévue

1. Connecter Supabase pour partager riders et chronos entre tous les téléphones.
2. Ajouter l'authentification et les comptes riders.
3. Créer l'API d'entrée des chronos ESP32/LoRa.
4. Publier sur GitHub Pages.

Les temps sont stockés sous forme de centièmes entiers afin d'éviter les erreurs d'arrondi.
