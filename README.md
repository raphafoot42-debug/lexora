# lexora-server — Vercel + Supabase

Remplace `affinix-postback-server` (Render). Mêmes routes que le front `index.html` attend déjà :
`GET/POST /api/db`, `POST /api/signup`, `GET /api/vapid-public-key`, `POST /api/push-subscribe`, `POST /api/broadcast-push`.

## 1. Supabase
1. Crée un projet sur supabase.com (si ce n'est pas déjà fait).
2. SQL Editor → colle le contenu de `supabase-schema.sql` → Run.
3. Récupère dans Project Settings → API :
   - `Project URL` → sera `SUPABASE_URL`
   - `service_role` key (secrète, PAS la `anon`) → sera `SUPABASE_SERVICE_ROLE_KEY`

## 2. Clé API partagée
Génère une clé longue et aléatoire une seule fois, ex :
```
openssl rand -hex 32
```
Ce sera `API_KEY` côté Vercel, et la même valeur à coller dans le site (Paramètres → Synchronisation → Clé API).

## 3. Clés VAPID (notifications push)
```
npx web-push generate-vapid-keys
```
Donne une clé publique et une clé privée.

## 4. Déploiement Vercel
1. Pousse ce dossier (`lexora-server`) sur un repo GitHub séparé (ou dans le même repo, dans un sous-dossier, à toi de voir).
2. Sur vercel.com → New Project → importe le repo.
3. Vercel → Project → Settings → Environment Variables → ajoute les 6 variables ci-dessous.
4. Deploy. Ton URL sera `https://<ton-projet>.vercel.app`.

## 5. Site (index.html)
Dans Paramètres → Synchronisation :
- URL API : `https://<ton-projet>.vercel.app`
- Clé API : la même valeur que `API_KEY`

Rien d'autre à changer dans `index.html`.

---

## Tableau des noms et clés à mettre en place

| Où | Nom de la variable | Ce que c'est |
|---|---|---|
| Vercel → Environment Variables | `SUPABASE_URL` | URL du projet Supabase |
| Vercel → Environment Variables | `SUPABASE_SERVICE_ROLE_KEY` | Clé `service_role` Supabase (jamais exposée au front) |
| Vercel → Environment Variables | `API_KEY` | Ta clé longue aléatoire, générée une fois |
| Vercel → Environment Variables | `VAPID_PUBLIC_KEY` | Clé publique push (générée avec `web-push generate-vapid-keys`) |
| Vercel → Environment Variables | `VAPID_PRIVATE_KEY` | Clé privée push (idem) |
| Vercel → Environment Variables | `VAPID_SUBJECT` | `mailto:tonadresse@example.com` |
| Site → Paramètres → Synchronisation | URL API | `https://<ton-projet>.vercel.app` |
| Site → Paramètres → Synchronisation | Clé API | **même valeur** que `API_KEY` |

`SUPABASE_SERVICE_ROLE_KEY` et `API_KEY` ne doivent jamais apparaître dans `index.html` ni dans le navigateur : ils ne vivent que côté Vercel (variables serveur) — c'est déjà le comportement du front actuel (`pushRemoteDB` vide la clé avant tout envoi).
