"use client";

interface FilterBarProps {
  categories: string[];
  selectedCategory: string;
  onCategoryChange: (category: string) => void;
}

export default function FilterBar({
  categories,
  selectedCategory,
  onCategoryChange,
}: FilterBarProps) {
  return (
    <div className="fixed top-14 left-0 right-0 z-10 glass border-b border-border">
      <div className="max-w-7xl mx-auto">
        <div className="overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 p-3 min-w-max justify-center">
            {categories.map((category) => (
              <button
                key={category}
                onClick={() => onCategoryChange(category)}
                className={`px-5 py-2 rounded-full font-medium text-sm transition-all whitespace-nowrap ${
                  selectedCategory === category
                    ? "gradient-primary text-white shadow-lg glow-primary-sm"
                    : "bg-surface-light text-gray-300 hover:bg-surface hover:text-white border border-border hover:border-primary/50"
                }`}
              >
                {category}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
