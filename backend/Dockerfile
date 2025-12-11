FROM node:18-alpine

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY server.js .
RUN mkdir -p /app/data

ENV PORT=8080
ENV DAILY_LIMIT=10
ENV DATA_DIR=/app/data

EXPOSE 8080

CMD ["node", "server.js"]