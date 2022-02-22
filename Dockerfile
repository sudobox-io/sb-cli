FROM node:16-alpine

LABEL maintainer="Brandon Flick - https://bflick.dev"

RUN apk add --update --no-cache ca-certificates bash 
RUN mkdir -p /app
RUN mkdir -p /configs

WORKDIR /app

COPY package.json .

RUN npm install

COPY . .

ENV MONGO_URL_STRING=mongodb://sb-database/sb-backend
ENV SB_BACKEND=http://sb_backend:5830

ENTRYPOINT [ "node", "index.js" ]
CMD ["\$@\""]