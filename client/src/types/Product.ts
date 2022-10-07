export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  quantity: number;
  isMadeToOrder: boolean;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  images: ProductImage[];
}

export interface ProductImage {
  id: string;
  url: string;
  title?: string;
  description?: string;
  primary: boolean;
  createdAt: Date;
  updatedAt: Date;
}
