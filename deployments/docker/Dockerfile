FROM rust:1-bookworm AS builder
WORKDIR /src
COPY . .
RUN cargo build --release -p sdkwork-api-membership-standalone-gateway

FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /app
COPY --from=builder /src/target/release/sdkwork-api-membership-standalone-gateway /usr/local/bin/sdkwork-api-membership-standalone-gateway
ENV SDKWORK_MEMBERSHIP_APPLICATION_PUBLIC_INGRESS_BIND=0.0.0.0:18096
EXPOSE 18096
CMD ["sdkwork-api-membership-standalone-gateway"]
