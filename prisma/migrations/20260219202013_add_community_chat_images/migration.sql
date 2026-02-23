-- CreateEnum
CREATE TYPE "ChatRoomType" AS ENUM ('COMMUNITY', 'COURSE');

-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "imageUrl" TEXT,
ALTER COLUMN "body" SET DEFAULT '';

-- AlterTable
ALTER TABLE "ChatRoom" ADD COLUMN     "name" TEXT,
ADD COLUMN     "type" "ChatRoomType" NOT NULL DEFAULT 'COURSE',
ALTER COLUMN "courseId" DROP NOT NULL;
