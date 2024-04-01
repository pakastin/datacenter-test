FROM node:20

ENV NODE_ENV=production
ENV NODE_PORT=8080

WORKDIR /app

COPY package*.json /app/
RUN npm install --omit=dev

COPY server.js /app/server.js
EXPOSE 8080
CMD node server.js
