FROM node:24-alpine AS base
RUN corepack enable && corepack prepare pnpm@latest --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml .npmrc ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps AS build
ARG APP
COPY . .
RUN pnpm exec nx run ${APP}:prisma:generate
RUN pnpm exec nx run ${APP}:build
RUN pnpm exec nx run ${APP}:prune-lockfile
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    cd dist/apps/${APP} && pnpm install --frozen-lockfile --prod

FROM base AS final
ARG APP
ENV NODE_ENV=production
USER node
COPY --from=build --chown=node:node /app/dist/apps/${APP} ./
CMD ["node", "main.js"]
