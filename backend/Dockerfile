FROM node:22-slim
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev
COPY server ./server
EXPOSE 8000
ENV NODE_ENV=production
CMD ["sh", "-c", "npx tsx server/index.ts"]
