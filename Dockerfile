# Alpine is safe here: no production dependency has native code (pg is pure JS).
FROM node:26-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build && npm prune --omit=dev

# Runtime image: only the compiled app and production dependencies.
FROM node:26-alpine
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
# Files stay owned by root, so the app process can't modify its own code.
USER node
EXPOSE 3000
CMD ["node", "dist/main.js"]
