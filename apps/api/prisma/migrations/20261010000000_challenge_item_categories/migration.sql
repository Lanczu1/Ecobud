-- Challenge categories now name the item a challenge collects, taken from its AI detection targets.
UPDATE "Challenge"
SET category = CASE
  WHEN cardinality("aiDetectionTargets") = 1 THEN "aiDetectionTargets"[1]
  WHEN cardinality("aiDetectionTargets") > 1 THEN 'Mixed Items'
  ELSE 'General'
END;
