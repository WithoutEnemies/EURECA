CREATE INDEX "Comment_postId_parentCommentId_createdAt_idx" ON "Comment"("postId", "parentCommentId", "createdAt");
