import type { Category } from "../../../src/contracts/product";

interface CategoryFilterProps {
  categories: Category[];
  selected?: Category;
  onSelect: (category?: Category) => void;
}

export function CategoryFilter({ categories, selected, onSelect }: CategoryFilterProps) {
  const chip = (label: string, value?: Category) => (
    <button
      key={label}
      type="button"
      className="chip"
      aria-pressed={selected === value}
      onClick={() => onSelect(value)}
    >
      {label}
    </button>
  );

  return (
    <div className="filters" role="group" aria-label="Filter by category">
      {chip("All")}
      {categories.map((c) => chip(c[0].toUpperCase() + c.slice(1), c))}
    </div>
  );
}
