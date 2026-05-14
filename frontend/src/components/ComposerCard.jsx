import { COMPOSER_PROMPTS, COMPOSER_TOOLS } from "../features/app/appConstants";
import { Icon } from "./Icons";

function ComposerCard({
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
  onContentChange,
  onKeyDown,
  onUsePrompt,
  onChooseImage,
  onRemoveImage,
  onImageChange,
  onCreatePost,
}) {
  return (
    <section
      className={`panel composer-card ${
        composerHasContent || composerHasImage ? "has-content" : ""
      }`}
    >
      <div className="composer-head">
        <div>
          <span className="composer-kicker">Novo post</span>
          <h2>Compartilhe com a comunidade</h2>
        </div>
        <span className="composer-shortcut">Ctrl + Enter</span>
      </div>

      <div className="composer-top">
        <div className="composer-avatar">{userInitial}</div>
        <div className="composer-main">
          <textarea
            ref={composerInputRef}
            className="composer-input"
            placeholder="Escreva uma ideia, pergunta ou progresso..."
            value={content}
            onChange={(event) => onContentChange(event.target.value)}
            onKeyDown={onKeyDown}
            maxLength={280}
          />
          <div className="composer-prompts" aria-label="Sugestões rápidas">
            {COMPOSER_PROMPTS.map((prompt) => (
              <button
                key={prompt.label}
                type="button"
                onClick={() => onUsePrompt(prompt.text)}
              >
                {prompt.label}
              </button>
            ))}
          </div>

          {composerImage ? (
            <div
              className={`composer-image-preview ${
                imageUploadLoading ? "is-loading" : ""
              }`}
            >
              <img src={composerImage.previewUrl} alt="" />
              <div className="composer-image-meta">
                <strong>{composerImage.fileName}</strong>
                <span>{imageUploadLoading ? "Enviando..." : "Imagem pronta"}</span>
              </div>
              <button
                type="button"
                className="composer-image-remove"
                onClick={onRemoveImage}
                aria-label="Remover imagem"
                data-tooltip="Remover imagem"
              >
                <Icon name="trash" />
              </button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="composer-bottom">
        <div className="composer-tools">
          <input
            ref={composerImageInputRef}
            className="composer-image-input"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={onImageChange}
          />
          {COMPOSER_TOOLS.map((tool) => (
            <button
              key={tool.label}
              type="button"
              className={
                tool.label === "Imagem" && composerHasImage ? "is-active" : ""
              }
              title={
                tool.label === "Imagem"
                  ? composerHasImage
                    ? "Trocar imagem"
                    : "Anexar imagem"
                  : `${tool.label} em breve`
              }
              onClick={tool.label === "Imagem" ? onChooseImage : undefined}
              disabled={
                tool.label === "Imagem"
                  ? imageUploadLoading || createLoading
                  : true
              }
              aria-pressed={
                tool.label === "Imagem" ? composerHasImage : undefined
              }
            >
              <Icon name={tool.icon} />
              <span>{tool.label}</span>
            </button>
          ))}
        </div>

        <div className="composer-actions">
          <span
            className={`composer-counter ${
              content.length >= 260
                ? "is-max"
                : content.length >= 230
                  ? "is-warn"
                  : ""
            }`}
          >
            {content.length}/280
          </span>
          <button
            type="button"
            className={`post-btn ${composerCanPost ? "is-ready" : ""}`}
            onClick={onCreatePost}
            disabled={createLoading || !composerCanPost}
          >
            {createLoading ? "Postando..." : "Postar agora"}
          </button>
        </div>
      </div>

      {composerError ? (
        <p className="composer-feedback is-error">{composerError}</p>
      ) : null}
      {composerNotice ? (
        <p className="composer-feedback is-success">{composerNotice}</p>
      ) : null}
    </section>
  );
}

export default ComposerCard;
