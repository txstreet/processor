FROM node:21-alpine AS node-base

##
# Build image
#
FROM node-base AS builder

COPY . /home/node/app

RUN apk --update --no-cache add yarn git

RUN chown -R node:node /home/node/app

USER node

WORKDIR /home/node/app

RUN test -f yarn.lock
RUN yarn install
RUN yarn tsc

##
# Runtime image
#
FROM node-base

USER node

WORKDIR /home/node/app

COPY --chown=node:node --from=builder /home/node/app/dist ./dist
COPY --chown=node:node --from=builder /home/node/app/node_modules ./node_modules

COPY --chown=root:root --chmod=0555 docker/api-healthcheck /docker-healthcheck

ENV NODE_OPTIONS="--enable-source-maps"
