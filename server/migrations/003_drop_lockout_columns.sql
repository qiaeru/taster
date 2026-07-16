-- SPDX-License-Identifier: MIT
-- Login lockout moved from per-account columns to an in-memory per-IP map;
-- the account-level counters are gone.

ALTER TABLE users DROP COLUMN failed_attempts;
ALTER TABLE users DROP COLUMN locked_until;
