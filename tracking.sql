-- ===== TRACKING.SQL =====
-- À exécuter en plus du SQL déjà livré (users / referral_links / sales).
-- Ajoute : suivi des visites via lien de parrainage + lien inscription -> parrain.

-- 1. Colonne pour savoir qui a parrainé un utilisateur
ALTER TABLE users ADD COLUMN IF NOT EXISTS referred_by uuid REFERENCES users(id);

-- 2. Table des visites (une ligne par chargement de page via un lien ?ref=CODE)
CREATE TABLE IF NOT EXISTS visits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  referral_code text NOT NULL,
  referrer_id uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_visits_referrer_id ON visits(referrer_id);
CREATE INDEX IF NOT EXISTS idx_visits_created_at ON visits(created_at);

-- 3. RLS sur visits
ALTER TABLE visits ENABLE ROW LEVEL SECURITY;

-- Un visiteur anonyme (pas encore inscrit) doit pouvoir CRÉER une ligne de visite
-- quand il arrive sur index.html avec un ?ref=CODE. Insert ouvert, mais AUCUNE lecture publique.
CREATE POLICY "Anyone can log a visit"
  ON visits FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

-- Un utilisateur connecté ne peut lire QUE les visites qui lui sont attribuées
CREATE POLICY "Users can view their own visits"
  ON visits FOR SELECT
  TO authenticated
  USING (referrer_id = auth.uid());

-- 4. Politique complémentaire : un utilisateur doit pouvoir mettre à jour
-- son propre champ referred_by une seule fois, à l'inscription
-- (si la policy "update own profile" existe déjà, vérifier qu'elle couvre ce cas ;
-- sinon décommenter ci-dessous)

-- CREATE POLICY "Users can update their own profile"
--   ON users FOR UPDATE
--   TO authenticated
--   USING (id = auth.uid())
--   WITH CHECK (id = auth.uid());
