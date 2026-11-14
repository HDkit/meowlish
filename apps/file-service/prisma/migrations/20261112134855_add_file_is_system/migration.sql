-- AlterTable
ALTER TABLE "files" ADD COLUMN     "is_system" BOOLEAN NOT NULL DEFAULT false;

-- Preserve behaviour for rows that orphan cleanup already protected through the old
-- `SYSTEM_` name prefix; from now on only this column exempts a file.
UPDATE "files" SET "is_system" = true WHERE "name" ILIKE 'SYSTEM\_%';
