import {
  Car,
  Gift,
  HeartPulse,
  Home,
  Laptop,
  MoreHorizontal,
  Plane,
  Repeat,
  Shirt,
  ShoppingCart,
  Tag,
  Target,
  TrendingUp,
  Utensils,
  Wallet,
  Wifi,
  PartyPopper,
  type LucideIcon,
} from "lucide-react";

/**
 * Сопоставление строкового имени иконки (хранится в БД в поле categories.icon,
 * см. backend/app/services/seed.py) с реальным React-компонентом иконки.
 * Строка в БД — стабильный идентификатор, не зависящий от конкретной
 * библиотеки иконок на фронтенде, поэтому иконки можно поменять без миграций.
 */
const ICONS: Record<string, LucideIcon> = {
  home: Home,
  "shopping-cart": ShoppingCart,
  car: Car,
  "heart-pulse": HeartPulse,
  wifi: Wifi,
  utensils: Utensils,
  "party-popper": PartyPopper,
  shirt: Shirt,
  repeat: Repeat,
  plane: Plane,
  gift: Gift,
  "more-horizontal": MoreHorizontal,
  wallet: Wallet,
  laptop: Laptop,
  "trending-up": TrendingUp,
  target: Target,
  tag: Tag,
};

export function CategoryIcon({
  name,
  size = 18,
  className = "",
}: {
  name: string;
  size?: number;
  className?: string;
}) {
  const IconComponent = ICONS[name] ?? Tag;
  return <IconComponent size={size} className={className} />;
}
