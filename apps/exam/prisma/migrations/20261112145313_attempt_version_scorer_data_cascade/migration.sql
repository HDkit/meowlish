-- DropForeignKey
ALTER TABLE "scorer_data" DROP CONSTRAINT "scorer_data_response_id_fkey";

-- AlterTable
ALTER TABLE "attempts" ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "scorer_data" ADD CONSTRAINT "scorer_data_response_id_fkey" FOREIGN KEY ("response_id") REFERENCES "attempt_responses"("id") ON DELETE CASCADE ON UPDATE CASCADE;
