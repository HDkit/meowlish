-- Data-only: the login streak used to run one day late. A user's first login day was never
-- added to `total`, and `longest_streak` stored the day difference (last - start) instead of
-- the streak length. Rows only ever come from a recorded login, so each one is short by
-- exactly one day on both counters. The code now counts the first login as day 1.
UPDATE "login_criteria"
SET "total" = "total" + 1,
    "longest_streak" = "longest_streak" + 1;
