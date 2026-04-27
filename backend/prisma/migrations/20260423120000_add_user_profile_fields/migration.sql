-- AlterTable
ALTER TABLE "User" ADD COLUMN     "name" TEXT,
ADD COLUMN     "username" TEXT,
ADD COLUMN     "role" TEXT,
ADD COLUMN     "bio" TEXT,
ADD COLUMN     "interests" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");
