FROM node:24-alpine AS base
# Pin pnpm to the version in package.json "packageManager"; pnpm@latest (12+)
# refuses to install when dependency build scripts aren't explicitly approved.
RUN corepack enable && corepack prepare pnpm@10.32.1 --activate
WORKDIR /app

FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    pnpm install --frozen-lockfile

FROM deps AS build
ARG APP
COPY . .
RUN if [ -d apps/${APP}/prisma ]; then pnpm exec nx run ${APP}:prisma:generate; fi
# The build emits dist/apps/${APP}/{main.js,package.json,pnpm-lock.yaml}
# (generatePackageJson in each app's webpack config), so no separate prune step.
RUN pnpm exec nx run ${APP}:build
# Own workspace file makes dist/apps/${APP} its own pnpm root (otherwise pnpm
# installs into /app) while keeping the onlyBuiltDependencies allowlist (bcrypt, prisma).
RUN cp pnpm-workspace.yaml .npmrc dist/apps/${APP}/
RUN --mount=type=cache,target=/root/.local/share/pnpm/store \
    cd dist/apps/${APP} && pnpm install --frozen-lockfile --prod
# The Prisma client JS is bundled into main.js, but its native query engine is
# loaded from node_modules/.prisma at runtime, so ship it with the app.
RUN if [ -d node_modules/.prisma ]; then cp -r node_modules/.prisma dist/apps/${APP}/node_modules/.prisma; fi

FROM base AS final
ARG APP
ENV NODE_ENV=production
USER node
COPY --from=build --chown=node:node /app/dist/apps/${APP} ./
CMD ["node", "main.js"]
