import { REGISTER_ROLE_OPTIONS } from "../../constants/uiData";

export const VIEWED_POSTS_STORAGE_KEY = "eureca_viewed_posts";
export const THEME_STORAGE_KEY = "eureca_theme_preference";

export const COMMENT_MAX_LENGTH = 280;
export const COMMENT_ROOT_PAGE_SIZE = 10;
export const COMMENT_REPLY_PAGE_SIZE = 5;
export const COMMENT_PREVIEW_PAGE_SIZE = 2;
export const COMMENT_PREVIEW_POST_LIMIT = 6;

export const POST_IMAGE_MAX_SIZE_BYTES = 5 * 1024 * 1024;
export const POST_IMAGE_ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

export const THEME_OPTIONS = [
  { value: "system", label: "Sistema" },
  { value: "dark", label: "Escuro" },
  { value: "light", label: "Claro" },
];

export const COMPOSER_PROMPTS = [
  { label: "Pedir feedback", text: "O que vocês acham desta ideia? " },
  { label: "Mostrar progresso", text: "Atualização rápida: " },
  { label: "Fazer pergunta", text: "Alguém já passou por isso? " },
];

export const COMPOSER_TOOLS = [
  { icon: "image", label: "Imagem" },
  { icon: "smile", label: "Humor" },
  { icon: "calendar", label: "Evento" },
];

export const EXPLORE_FILTERS = [
  { value: "all", label: "Tudo" },
  { value: "discussions", label: "Discussões" },
  { value: "popular", label: "Populares" },
  { value: "recent", label: "Recentes" },
  { value: "people", label: "Pessoas" },
];

export const COMMUNITY_LEVELS = [
  { min: 0, label: "Explorador" },
  { min: 80, label: "Participante" },
  { min: 220, label: "Colaborador" },
  { min: 520, label: "Referência" },
  { min: 1000, label: "Mentor" },
];

export const REGISTER_PROFILE_INITIAL = {
  name: "",
  username: "",
  role: REGISTER_ROLE_OPTIONS[0],
  bio: "",
  interests: [],
  acceptedTerms: false,
};
