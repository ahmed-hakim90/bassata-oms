-- Ensure every org has an active loyalty rule so POS can redeem points.
INSERT INTO loyalty_rules (org_id, points_per_currency, redemption_rate, minimum_redeem_points, is_active)
SELECT o.id, 1, 0.01, 0, true
FROM organizations o
WHERE NOT EXISTS (
  SELECT 1 FROM loyalty_rules lr WHERE lr.org_id = o.id
);
