FROM node:20-alpine

RUN apk add --no-cache python3 make g++

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm install --production=false

COPY . .
RUN npm run build
RUN npm prune --production

RUN mkdir -p /app/data

VOLUME ["/app/data"]

CMD ["node", "dist/index.js"]
