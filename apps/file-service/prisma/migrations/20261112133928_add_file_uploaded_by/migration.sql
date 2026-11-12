-- AlterTable
ALTER TABLE "files" ADD COLUMN     "uploaded_by" TEXT;

-- CreateIndex
CREATE INDEX "files_uploaded_by_idx" ON "files"("uploaded_by");
