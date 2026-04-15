-- AddForeignKey
ALTER TABLE "media_files" ADD CONSTRAINT "media_files_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
