FROM node:22-alpine AS build

WORKDIR /opt/luxdex/web
RUN corepack enable

COPY web/package.json web/pnpm-lock.yaml ./
RUN pnpm install --frozen-lockfile

COPY web/ ./
RUN pnpm build

FROM nginx:1.29-alpine

COPY docker/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /opt/luxdex/web/dist /usr/share/nginx/html

EXPOSE 80

