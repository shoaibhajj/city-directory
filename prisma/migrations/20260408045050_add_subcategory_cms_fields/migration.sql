-- AlterTable
ALTER TABLE "subcategories" ADD COLUMN     "descriptionAr" TEXT,
ADD COLUMN     "descriptionEn" TEXT,
ADD COLUMN     "icon" TEXT;

-- CreateIndex
CREATE INDEX "subcategories_isVisible_displayOrder_idx" ON "subcategories"("isVisible", "displayOrder");
