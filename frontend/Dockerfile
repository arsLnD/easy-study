# Многоступенчатая сборка: сначала собираем статические файлы через Vite,
# затем отдаём их лёгким nginx-сервером (продакшн-образ получается маленьким).

FROM node:20-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
