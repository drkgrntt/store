# ---- build stage ----
FROM node:18-alpine AS build
WORKDIR /src

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .

# Next.js inlines NEXT_PUBLIC_* vars into the client bundle at build time,
# not at runtime, so they have to come in as build args (see
# docker-compose.yml) rather than env_file like every other service here.
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_STRIPE_KEY
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL \
    NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL \
    NEXT_PUBLIC_STRIPE_KEY=$NEXT_PUBLIC_STRIPE_KEY

RUN yarn build

# ---- runtime stage ----
FROM node:18-alpine
WORKDIR /app

COPY --from=build /src/node_modules ./node_modules
COPY --from=build /src/.next ./.next
COPY --from=build /src/public ./public
COPY --from=build /src/package.json ./package.json
COPY --from=build /src/next.config.js ./next.config.js

USER node

CMD ["yarn", "start", "-p", "3000"]
