# Build stage
FROM node:lts-bookworm AS builder
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --legacy-peer-deps
COPY . .
# Talk to our own origin instead of the upstream API directly: nginx forwards the
# device library and blocks every account/upload path (docker/nginx.conf).
ARG VITE_TEMPLATE_API_URL=/api
ENV VITE_TEMPLATE_API_URL=${VITE_TEMPLATE_API_URL}
RUN npm run build

# Production stage
FROM nginx:bookworm
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
