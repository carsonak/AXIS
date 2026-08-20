FROM node:22-alpine AS frontend
WORKDIR /src/frontend
COPY frontend/package*.json ./
RUN npm ci
COPY frontend/ ./
RUN npm run build

FROM golang:1.23-alpine AS backend
WORKDIR /src
COPY go.mod ./
COPY embedded.go ./
COPY backend ./backend
COPY crops.json climatology.json ./
COPY fixtures ./fixtures
COPY --from=frontend /src/backend/web/dist ./backend/web/dist
RUN CGO_ENABLED=0 go build -o /axis ./backend/cmd/server

FROM alpine:3.21
RUN adduser -D -u 10001 axis
USER axis
COPY --from=backend /axis /axis
ENV PORT=8080
EXPOSE 8080
ENTRYPOINT ["/axis"]
