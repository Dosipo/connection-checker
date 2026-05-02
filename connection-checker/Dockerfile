# Next.js 15 + standalone: см. https://nextjs.org/docs/app/building-your-application/deploying#docker-image
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

# NEXT_PUBLIC_* вшиваются на этапе `next build` — передайте из CI/локально при необходимости:
# docker build --build-arg NEXT_PUBLIC_YANDEX_RTB_BLOCK_HEADER=R-A-... -t connection-checker:prod .
ARG NEXT_PUBLIC_YANDEX_RTB_BLOCK_HEADER
ARG NEXT_PUBLIC_YANDEX_RTB_BLOCK_CONTENT
ARG NEXT_PUBLIC_YANDEX_RTB_BLOCK_FOOTER
ARG NEXT_PUBLIC_YANDEX_RSYA_ENABLED
ARG NEXT_PUBLIC_YANDEX_RSYA_CONTEXT_URL
ENV NEXT_PUBLIC_YANDEX_RTB_BLOCK_HEADER=$NEXT_PUBLIC_YANDEX_RTB_BLOCK_HEADER
ENV NEXT_PUBLIC_YANDEX_RTB_BLOCK_CONTENT=$NEXT_PUBLIC_YANDEX_RTB_BLOCK_CONTENT
ENV NEXT_PUBLIC_YANDEX_RTB_BLOCK_FOOTER=$NEXT_PUBLIC_YANDEX_RTB_BLOCK_FOOTER
ENV NEXT_PUBLIC_YANDEX_RSYA_ENABLED=$NEXT_PUBLIC_YANDEX_RSYA_ENABLED
ENV NEXT_PUBLIC_YANDEX_RSYA_CONTEXT_URL=$NEXT_PUBLIC_YANDEX_RSYA_CONTEXT_URL

COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Next ожидает каталог `public` при копировании в runtime; если его нет в репозитории — создаём пустой.
RUN mkdir -p public
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
RUN addgroup --system --gid 1001 nodejs && adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
