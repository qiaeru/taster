-- SPDX-License-Identifier: MIT
-- Status names become unique case-insensitively, matching how the JSON
-- import/export already resolves them.

-- Merge statuses that differ only by case: repoint tastes to the surviving
-- (lowest-id) status of each case-insensitive group, then drop the others.
UPDATE tastes SET status_id = (
  SELECT MIN(s2.id) FROM statuses s2
  WHERE s2.category_id = (SELECT category_id FROM statuses WHERE id = tastes.status_id)
    AND lower(s2.name) = (SELECT lower(name) FROM statuses WHERE id = tastes.status_id)
) WHERE status_id IS NOT NULL;

DELETE FROM statuses WHERE id NOT IN (
  SELECT MIN(id) FROM statuses GROUP BY category_id, lower(name)
);

-- The original BINARY UNIQUE (category_id, name) constraint stays in place;
-- this stricter index is what now rejects case-insensitive duplicates.
CREATE UNIQUE INDEX idx_statuses_name_nocase
  ON statuses(category_id, name COLLATE NOCASE);
