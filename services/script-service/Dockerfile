FROM golang:1.25-alpine AS builder
WORKDIR /app
COPY go.mod go.sum ./
RUN go mod download
COPY . .
RUN go build -o main cmd/script/main.go

FROM alpine:latest
RUN apk add --no-cache wget
WORKDIR /app
RUN apk add --no-cache python3 py3-pip
COPY --from=builder /app/main .
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt --break-system-packages
COPY scripts/ ./scripts/
EXPOSE 8083
CMD ["./main"]
