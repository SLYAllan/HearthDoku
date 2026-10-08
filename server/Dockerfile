# Node 20 est en fin de vie depuis avril 2026 : plus de correctif de sécurité.
FROM node:24-alpine
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev
COPY . .
EXPOSE 8080
CMD ["node", "index.js"]
