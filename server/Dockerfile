# ---- build stage ----
FROM node:18-alpine AS build
WORKDIR /src

# bcrypt is a native addon (node-gyp); build tools needed to compile it
RUN apk add --no-cache python3 make g++

COPY package.json yarn.lock ./
RUN yarn install --frozen-lockfile

COPY . .
RUN yarn build

# ---- runtime stage ----
# Carry node_modules forward as-is instead of a separate `--production`
# install here: that would recompile bcrypt from source a second time,
# and since both stages are node:18-alpine the compiled binary is already
# ABI-compatible.
FROM node:18-alpine
WORKDIR /app

COPY --from=build /src/node_modules ./node_modules
COPY --from=build /src/dist ./dist
# dotenv-safe requires .env.example to exist at runtime (it validates
# process.env against it), even though the actual .env file is injected
# via docker-compose's env_file instead of living in the image.
COPY --from=build /src/.env.example ./.env.example

USER node

CMD ["node", "dist/index.js"]
