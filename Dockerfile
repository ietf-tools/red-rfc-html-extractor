FROM node:24
LABEL maintainer="IETF Tools Team <tools-discuss@ietf.org>"

RUN mkdir -p /app
WORKDIR /app

COPY . .

RUN npm ci
