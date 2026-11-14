-- A user holds each badge once. Remove duplicate awards left by races before the constraint
-- existed, keeping the earliest row per (uid, badge) (ties broken by id), so the index can't fail.
DELETE FROM "user_badges" AS a
USING "user_badges" AS b
WHERE a."uid" = b."uid"
  AND a."badge" = b."badge"
  AND (a."updatedAt" > b."updatedAt" OR (a."updatedAt" = b."updatedAt" AND a."id" > b."id"));

-- CreateIndex
CREATE UNIQUE INDEX "user_badges_uid_badge_key" ON "user_badges"("uid", "badge");
