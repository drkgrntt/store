export type Paginated<T> = {
  nextPage: number;
  hasMore: boolean;
  edges: T[];
};
