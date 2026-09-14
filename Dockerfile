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
# The FACE image ships German out of the box; the public build stays English.
# Users can still switch under File > Preferences > Display > Language — their
# choice is kept in localStorage and overrides this default.
ARG VITE_DEFAULT_LOCALE=de
ENV VITE_DEFAULT_LOCALE=${VITE_DEFAULT_LOCALE}
# The planning company printed in the legend's footer and offered to the plan head, so a
# fresh workstation produces a correct sheet without anyone filling a form first. Address
# lines are separated by "|". Anyone can still change it under Preferences > Company; a
# saved profile overrides these, exactly like the language.
ARG VITE_COMPANY_NAME="FACE Communication Equipment GmbH"
ARG VITE_COMPANY_ADDRESS="Am Bahnhof 5|48455 Bad Bentheim"
ARG VITE_COMPANY_PHONE="02572 93240"
ARG VITE_COMPANY_EMAIL="info@face-gmbh.com"
ARG VITE_COMPANY_WEB="face-gmbh.com"
# A file served by the image, e.g. /face-logo.png in public/; fetched once into the profile.
ARG VITE_COMPANY_LOGO=""
# Quoted: these values carry spaces, and an unquoted ENV would read the second word as the
# next variable name.
ENV VITE_COMPANY_NAME="${VITE_COMPANY_NAME}" \
    VITE_COMPANY_ADDRESS="${VITE_COMPANY_ADDRESS}" \
    VITE_COMPANY_PHONE="${VITE_COMPANY_PHONE}" \
    VITE_COMPANY_EMAIL="${VITE_COMPANY_EMAIL}" \
    VITE_COMPANY_WEB="${VITE_COMPANY_WEB}" \
    VITE_COMPANY_LOGO="${VITE_COMPANY_LOGO}"
RUN npm run build

# Production stage
FROM nginx:bookworm
COPY docker/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
