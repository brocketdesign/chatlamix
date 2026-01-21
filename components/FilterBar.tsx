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
    <div className="fixed top-0 left-0 right-0 z-10 bg-black/90 backdrop-blur-sm border-b border-gray-800">
      <div className="overflow-x-auto scrollbar-hide">
        <div className="flex gap-2 p-3 min-w-max">
          {categories.map((category) => (
            <button
              key={category}
              onClick={() => onCategoryChange(category)}
              className={`px-4 py-2 rounded-full font-medium transition-all whitespace-nowrap ${
                selectedCategory === category
                  ? "bg-blue-600 text-white"
                  : "bg-gray-800 text-gray-300 hover:bg-gray-700"
              }`}
            >
              {category}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
