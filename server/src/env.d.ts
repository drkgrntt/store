declare module "sanitize";

declare namespace NodeJS {
  export interface ProcessEnv {
    NODE_ENV: string;
    DATABASE_URL: string;
    PORT: string;
    JWT_SECRET: string;
    CLOUDINARY_CLOUD_NAME: string;
    CLOUDINARY_API_KEY: string;
    CLOUDINARY_API_SECRET: string;
    // APP_BASE_URL: string;
    // API_BASE_URL: string;
    // STRIPE_SECRET_KEY: string;
  }
}

declare namespace Express {
  export interface Response {
    setToken: (value: string) => void;
    removeToken: () => void;
  }
}
