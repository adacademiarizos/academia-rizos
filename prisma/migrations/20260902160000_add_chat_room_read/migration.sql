-- Tracks how far each user has read in each chat room.
CREATE TABLE "ChatRoomRead" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "lastReadAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChatRoomRead_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ChatRoomRead_userId_roomId_key" ON "ChatRoomRead"("userId", "roomId");
CREATE INDEX "ChatRoomRead_userId_idx" ON "ChatRoomRead"("userId");

ALTER TABLE "ChatRoomRead" ADD CONSTRAINT "ChatRoomRead_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ChatRoomRead" ADD CONSTRAINT "ChatRoomRead_roomId_fkey"
    FOREIGN KEY ("roomId") REFERENCES "ChatRoom"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Existing rooms start fully read: nobody should log in to a badge counting
-- every message ever posted before this feature existed.
INSERT INTO "ChatRoomRead" ("id", "userId", "roomId", "lastReadAt")
SELECT
    md5(random()::text || clock_timestamp()::text),
    "User"."id",
    "ChatRoom"."id",
    CURRENT_TIMESTAMP
FROM "User"
CROSS JOIN "ChatRoom";
