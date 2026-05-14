import CommentsPanel from "../components/CommentsPanel";
import ComposerCard from "../components/ComposerCard";
import PostCard from "../components/PostCard";
import { COMMENT_MAX_LENGTH } from "../features/app/appConstants";
import { getPostFeedContext } from "../features/app/appHelpers";
import { formatCount, truncateText } from "../utils/formatters";

function HomeView({
  userInitial,
  content,
  composerImage,
  composerHasContent,
  composerHasImage,
  composerCanPost,
  imageUploadLoading,
  createLoading,
  composerError,
  composerNotice,
  composerInputRef,
  composerImageInputRef,
  feedError,
  feedOverview,
  feedMode,
  posts,
  postsLoading,
  commentsByPost,
  activeCommentsPostId,
  currentUserId,
  onComposerContentChange,
  onComposerKeyDown,
  onUseComposerPrompt,
  onChooseComposerImage,
  onRemoveComposerImage,
  onComposerImageChange,
  onCreatePost,
  onToggleLike,
  onToggleComments,
  onDeletePost,
  onReportPost,
  onPostViewed,
  onAuthorClick,
  onUpdateCommentDraft,
  onCreateComment,
  onLoadCommentsForPost,
  onLoadRepliesForComment,
  onReplyToComment,
  onCancelReply,
  onDeleteComment,
  onFeedModeChange,
}) {
  const isFollowingFeed = feedMode === "following";

  return (
    <>
      <div className="feed-head">
        <h1>Início</h1>
        <div className="feed-tabs">
          <button
            type="button"
            className={`feed-tab${!isFollowingFeed ? " is-active" : ""}`}
            aria-pressed={!isFollowingFeed}
            onClick={() => onFeedModeChange?.("for-you")}
          >
            Pra você
          </button>
          <button
            type="button"
            className={`feed-tab${isFollowingFeed ? " is-active" : ""}`}
            aria-pressed={isFollowingFeed}
            onClick={() => onFeedModeChange?.("following")}
          >
            Seguindo
          </button>
        </div>
      </div>

      <ComposerCard
        userInitial={userInitial}
        content={content}
        composerImage={composerImage}
        composerHasContent={composerHasContent}
        composerHasImage={composerHasImage}
        composerCanPost={composerCanPost}
        imageUploadLoading={imageUploadLoading}
        createLoading={createLoading}
        composerError={composerError}
        composerNotice={composerNotice}
        composerInputRef={composerInputRef}
        composerImageInputRef={composerImageInputRef}
        onContentChange={onComposerContentChange}
        onKeyDown={onComposerKeyDown}
        onUsePrompt={onUseComposerPrompt}
        onChooseImage={onChooseComposerImage}
        onRemoveImage={onRemoveComposerImage}
        onImageChange={onComposerImageChange}
        onCreatePost={onCreatePost}
      />

      {feedError ? <p className="feed-feedback is-error">{feedError}</p> : null}

      <section className="panel feed-context-card">
        <div className="feed-context-main">
          <span className="feed-context-kicker">Feed contextual</span>
          <h2>
            {isFollowingFeed
              ? "Posts das contas que você segue"
              : feedOverview.activeDiscussions > 0
                ? "Há discussões para entrar agora"
                : "Novas publicações para descobrir"}
          </h2>
          <p>
            {isFollowingFeed && !feedOverview.topPost
              ? "Siga pessoas para montar um feed mais focado."
              : feedOverview.topPost
              ? `Em destaque: ${truncateText(feedOverview.topPost.text, 92)}`
              : "Quando houver mais atividade, este bloco destaca conversas e temas relevantes."}
          </p>
        </div>
        <div className="feed-context-metrics">
          <div>
            <strong>{formatCount(posts.length)}</strong>
            <span>posts</span>
          </div>
          <div>
            <strong>{formatCount(feedOverview.activeDiscussions)}</strong>
            <span>discussões</span>
          </div>
          <div>
            <strong>{formatCount(feedOverview.views)}</strong>
            <span>views</span>
          </div>
        </div>
      </section>

      <div className="post-list">
        {postsLoading ? (
          <div className="panel post-card empty-state">Carregando posts...</div>
        ) : null}

        {!postsLoading && posts.length === 0 ? (
          <div className="panel post-card empty-state">
            {isFollowingFeed
              ? "Nenhum post das contas que você segue ainda."
              : "Nenhum post ainda. Seja o primeiro a publicar."}
          </div>
        ) : null}

        {posts.map((post, index) => (
          <div
            key={post.id ?? `${post.handle}-${post.time}`}
            className="feed-item-block"
          >
            {index === 0 ? (
              <div className="feed-separator">
                <span>Mais recentes</span>
                <strong>
                  {isFollowingFeed
                    ? "Atualizado pelas contas que você segue"
                    : "Atualizado pelo feed da comunidade"}
                </strong>
              </div>
            ) : null}

            {index === feedOverview.firstDiscussionIndex &&
            feedOverview.firstDiscussionIndex > 0 ? (
              <div className="feed-separator is-accent">
                <span>Discussões em andamento</span>
                <strong>Posts com comentários para participar</strong>
              </div>
            ) : null}

            {index === feedOverview.continueIndex &&
            index !== feedOverview.firstDiscussionIndex ? (
              <div className="feed-separator">
                <span>Continue explorando</span>
                <strong>Mais publicações da rede</strong>
              </div>
            ) : null}

            <PostCard
              post={post}
              interactive
              feedContext={getPostFeedContext(post, index)}
              onToggleLike={onToggleLike}
              onToggleComments={onToggleComments}
              onDeletePost={onDeletePost}
              onReportPost={onReportPost}
              onViewed={onPostViewed}
              onAuthorClick={onAuthorClick}
              currentUserId={currentUserId}
              commentsOpen={activeCommentsPostId === post.id}
              commentPreviewLoading={Boolean(
                commentsByPost[post.id]?.previewLoading,
              )}
              commentPreview={(commentsByPost[post.id]?.items ?? [])
                .filter((comment) => !comment.parentCommentId)
                .slice(0, 2)}
            >
              {activeCommentsPostId === post.id ? (
                <CommentsPanel
                  post={post}
                  state={commentsByPost[post.id]}
                  draft={commentsByPost[post.id]?.draft ?? ""}
                  userInitial={userInitial}
                  maxLength={COMMENT_MAX_LENGTH}
                  currentUserId={currentUserId}
                  onDraftChange={(draft) => onUpdateCommentDraft(post.id, draft)}
                  onSubmit={() => onCreateComment(post.id)}
                  onRefresh={() => onLoadCommentsForPost(post.id)}
                  onLoadMore={() =>
                    onLoadCommentsForPost(post.id, { append: true })
                  }
                  onLoadReplies={(commentId) =>
                    onLoadRepliesForComment(post.id, commentId)
                  }
                  onAuthorClick={onAuthorClick}
                  onReply={(commentId) => onReplyToComment(post.id, commentId)}
                  onCancelReply={() => onCancelReply(post.id)}
                  onDelete={(commentId) => onDeleteComment(post.id, commentId)}
                />
              ) : null}
            </PostCard>
          </div>
        ))}
      </div>
    </>
  );
}

export default HomeView;
