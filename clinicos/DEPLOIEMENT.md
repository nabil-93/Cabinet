# Guide Déploiement ClinicOS
# GitHub → Supabase → Vercel

---

## ÉTAPE 1 — GitHub

1. Va sur https://github.com/new
2. Nom du repo : `clinicos`
3. Visibility : **Private** (recommandé)
4. Clique **Create repository**

Puis dans ton terminal (dans le dossier clinicos) :

```bash
git init
git add .
git commit -m "Initial commit — ClinicOS"
git branch -M main
git remote add origin https://github.com/TON_USERNAME/clinicos.git
git push -u origin main
```

---

## ÉTAPE 2 — Supabase

1. Va sur https://supabase.com → **New project**
2. Nom : `clinicos`
3. Mot de passe DB : choisis un mot de passe fort (note-le !)
4. Région : **Europe (Frankfurt)** ou la plus proche
5. Attends ~2 minutes que le projet se crée

### Exécuter le schéma SQL

1. Dans Supabase → **SQL Editor** → **New Query**
2. Copie-colle tout le contenu du fichier `supabase/schema.sql`
3. Clique **Run** (bouton vert)
4. Tu devrais voir "Success" pour chaque table

### Créer les utilisateurs de démo

1. Supabase → **Authentication** → **Users** → **Add user**
2. Crée ces 2 utilisateurs :
   - Email: `doctor@clinicos.ma` | Password: `Doctor123!`
   - Email: `admin@clinicos.ma` | Password: `Admin123!`

### Récupérer les clés API

1. Supabase → **Settings** → **API**
2. Copie ces 3 valeurs :
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` → `SUPABASE_SERVICE_ROLE_KEY`

---

## ÉTAPE 3 — Vercel

1. Va sur https://vercel.com → **Add New Project**
2. Clique **Import** sur ton repo GitHub `clinicos`
3. Framework : **Next.js** (détecté automatiquement)
4. Root Directory : `clinicos` (si le repo contient les 2 dossiers)

### Ajouter les variables d'environnement

Dans Vercel → Settings → Environment Variables → ajoute :

| Variable | Valeur |
|----------|--------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://xxxx.supabase.co` |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | `eyJ...` |
| `OPENAI_API_KEY` | `sk-...` (optionnel) |

5. Clique **Deploy** 🚀

---

## RÉSULTAT FINAL

Ton app sera disponible sur :
`https://clinicos-xxxx.vercel.app`

Login :
- `doctor@clinicos.ma` / `Doctor123!`
- `admin@clinicos.ma` / `Admin123!`

---

## Mises à jour futures

Après chaque modification :
```bash
git add .
git commit -m "Ma mise à jour"
git push
```
→ Vercel redéploie automatiquement en ~1 minute !
