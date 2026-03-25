FROM golang:1.24-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN apk add --no-cache wget
RUN go build -o main cmd/api/main.go
RUN go build -o migrate cmd/migrate/main.go

FROM alpine:latest
RUN apk add --no-cache wget
WORKDIR /app
COPY --from=builder /app/main .
COPY --from=builder /app/migrate .
COPY --from=builder /app/internal/infrastructure/database/migrations ./internal/infrastructure/database/migrations
EXPOSE 8080
CMD ["./main"]
