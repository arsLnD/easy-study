import type { Category } from "@/types";
import { CategoryIcon } from "@/components/common/CategoryIcon";
import { currencySymbol } from "@/utils/format";

interface Props {
  category: Category;
  value: string;
  currency: string;
  onChange: (value: string) => void;
}

export function CategoryAllocationRow({ category, value, currency, onChange }: Props) {
  return (
    <div className="flex items-center gap-3 py-2.5">
      <div
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ backgroundColor: `${category.color}22`, color: category.color }}
      >
        <CategoryIcon name={category.icon} />
      </div>
      <div className="flex-1">
        <p className="text-sm font-medium">{category.name}</p>
        {category.is_essential && <p className="text-xs text-textSecondary">Обязательная</p>}
      </div>
      <div className="flex items-center gap-1.5">
        <input
          type="number"
          min={0}
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="0"
          className="w-24 rounded-lg border border-border bg-surfaceMuted px-2.5 py-2 text-right text-sm
            outline-none focus:border-primary focus:ring-1 focus:ring-primary"
        />
        <span className="text-xs text-textSecondary">{currencySymbol(currency)}</span>
      </div>
    </div>
  );
}
