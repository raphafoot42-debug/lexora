-- ===== SALES-DEDUP.SQL =====
-- À exécuter en plus de tracking.sql.
-- Empêche qu'un même paiement Stripe soit enregistré deux fois si le webhook
-- est appelé plusieurs fois pour le même événement (cas fréquent avec Stripe).

ALTER TABLE sales ADD COLUMN IF NOT EXISTS stripe_session_id text UNIQUE;
