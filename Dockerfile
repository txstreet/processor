FROM node:21-alpine AS node-base

##
# Build image
#
FROM node-base AS builder

RUN apk --update --no-cache add yarn git

WORKDIR /home/node/app
COPY package.json yarn.lock ./
RUN chown -R node:node /home/node/app

USER node

RUN test -f yarn.lock
RUN yarn install

COPY ./ ./
RUN yarn build

##
# Runtime image
#
FROM node-base

USER node

WORKDIR /home/node/app

COPY --chown=node:node --from=builder /home/node/app/dist ./dist
COPY --chown=node:node --from=builder /home/node/app/node_modules ./node_modules

ENV NODE_ENV=production
ENV NODE_OPTIONS="--enable-source-maps"

COPY --chown=root:root --chmod=0555 docker/healthcheck /docker-healthcheck

HEALTHCHECK \
  --interval=10s \
  --timeout=10s \
  --retries=2 \
  --start-period=20s \
  CMD /docker-healthcheck
