export interface Character {
  id: string;
  name: string;
  description: string;
  thumbnail: string;
  category: string;
  images: string[];
}

export interface FilterOption {
  label: string;
  value: string;
}
