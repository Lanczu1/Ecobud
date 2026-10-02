DELETE FROM "UserBadge"
WHERE "badgeId" IN (
  SELECT "id" FROM "Badge" WHERE "name" IN (
    'Waste Warrior', 'Energy Saver', 'Water Wise', 'Carbon Champion',
    'Tree Hugger', 'Recycle Pro', 'Sustainability Star', 'Green Plate',
    'Challenge Champion'
  )
);

DELETE FROM "Badge" WHERE "name" IN (
  'Waste Warrior', 'Energy Saver', 'Water Wise', 'Carbon Champion',
  'Tree Hugger', 'Recycle Pro', 'Sustainability Star', 'Green Plate',
  'Challenge Champion'
);
