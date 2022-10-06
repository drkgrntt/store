declare module "sanitize";

declare namespace NodeJS {
  export interface ProcessEnv {
    DATABASE_URL: string;
    PORT: string;
    JWT_SECRET: string;
    CLOUDINARY_CLOUD_NAME: string;
    CLOUDINARY_API_KEY: string;
    CLOUDINARY_API_SECRET: string;
    // GMAIL: string;
    // GMAIL_CLIENT_ID: string;
    // GMAIL_CLIENT_SECRET: string;
    // GMAIL_REFRESH_TOKEN: string;
    // APP_BASE_URL: string;
    // API_BASE_URL: string;
    // STRIPE_SECRET_KEY: string;
    // STRIPE_MONTHLY_PRICE_ID: string;
    // STRIPE_YEARLY_PRICE_ID: string;
    // STRIPE_WEBHOOK_SECRET: string;
  }
}

declare namespace Express {
  export interface Response {
    setToken: (value: string) => void;
    removeToken: () => void;
  }
}
