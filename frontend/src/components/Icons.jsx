import {
  BarChart3,
  Bell,
  CalendarDays,
  Compass,
  Flag,
  Heart,
  Home,
  Image,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  Repeat2,
  Reply,
  Settings,
  Share2,
  Smile,
  Trash2,
  UserRound,
} from 'lucide-react'

const iconMap = {
  home: Home,
  compass: Compass,
  bell: Bell,
  chat: MessageSquare,
  message: MessageCircle,
  user: UserRound,
  settings: Settings,
  image: Image,
  smile: Smile,
  calendar: CalendarDays,
  reply: Reply,
  repost: Repeat2,
  heart: Heart,
  chart: BarChart3,
  flag: Flag,
  share: Share2,
  trash: Trash2,
  more: MoreHorizontal,
}

// Componente generico de icone com desenhos consistentes em toda a interface.
export function Icon({ name }) {
  const IconComponent = iconMap[name] ?? CircleFallback

  return (
    <IconComponent
      aria-hidden="true"
      focusable="false"
      vectorEffect="non-scaling-stroke"
    />
  )
}

function CircleFallback(props) {
  return (
    <svg viewBox="0 0 24 24" {...props}>
      <circle cx="12" cy="12" r="8" />
    </svg>
  )
}

// Simbolo principal da marca Eureca usado no topo e na tela de login.
export function WaveMark() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M3 8c2 2 4 2 6 0s4-2 6 0 4 2 6 0" />
      <path d="M3 12c2 2 4 2 6 0s4-2 6 0 4 2 6 0" />
      <path d="M3 16c2 2 4 2 6 0s4-2 6 0 4 2 6 0" />
    </svg>
  )
}
