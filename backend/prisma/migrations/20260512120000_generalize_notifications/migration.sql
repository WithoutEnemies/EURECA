ALTER TABLE "Notification"
  ADD COLUMN "title" TEXT,
  ADD COLUMN "body" TEXT,
  ADD COLUMN "conversationId" TEXT,
  ADD COLUMN "messageId" TEXT;

ALTER TABLE "Notification"
  ALTER COLUMN "actorId" DROP NOT NULL,
  ALTER COLUMN "postId" DROP NOT NULL,
  ALTER COLUMN "commentId" DROP NOT NULL;

CREATE INDEX "Notification_conversationId_idx" ON "Notification"("conversationId");

CREATE INDEX "Notification_messageId_idx" ON "Notification"("messageId");

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "Notification" ADD CONSTRAINT "Notification_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message"("id") ON DELETE CASCADE ON UPDATE CASCADE;
