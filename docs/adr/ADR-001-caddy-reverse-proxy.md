# ADR-001: Caddy as a Reverse Proxy with Automatic TLS

**Status:** Accepted

**Date:** 2026-05-06

**Author:** [Stanislav Hohulia](https://github.com/Hradivnyk)

## Context

The service is deployed on a single EC2 instance via Docker Compose. For the production environment it is necessary to:

- accept external HTTPS traffic on ports 80/443,
- terminate TLS at the proxy; unencrypted traffic is forwarded to Node,
- automatically obtain and renew TLS certificates without manual intervention,
- minimise operational overhead for a solo-maintained project.

## Considered Options

### 1. Caddy 2

A modern HTTP server with built-in automatic TLS via Let's Encrypt/ZeroSSL.

**Pros:**

- Automatic certificate issuance and renewal with no external tools.
- Minimal configuration — the entire reverse proxy fits in three lines of a `Caddyfile`.
- HTTP → HTTPS redirect and HTTP/2 enabled by default.
- Certificate state is stored in a Docker volume — survives image rebuilds.

**Cons:**

- Smaller module ecosystem compared to nginx.
- Scaling to multiple instances requires a centralised certificate store.

---

### 2. Traefik

A reverse proxy designed for dynamic container environments (Swarm, Kubernetes). Also has built-in automatic TLS.

**Pros:**

- Automatic service discovery via Docker labels — convenient when services appear and disappear dynamically.
- Built-in dashboard for route monitoring.

**Cons:**

- Configuration is split between a static `traefik.yml` and labels in `docker-compose.yml` — harder to read and maintain.
- Designed for orchestrated environments; for a static Compose stack with a single service this is an unnecessary abstraction.

---

### 3. nginx + certbot

A widely used reverse proxy with a separate tool for certificate management.

**Pros:**

- Vast ecosystem, documentation, and community.
- Flexible configuration for complex routing scenarios.

**Cons:**

- Certificates are not part of nginx — requires a separate certbot or acme.sh.
- Certificate rotation requires a cron job and an nginx process restart.
- Significantly more configuration files compared to Caddy.

---

### 4. AWS ALB + ACM

A managed load balancer with certificates from AWS Certificate Manager.

**Pros:**

- Native integration with AWS infrastructure; the natural choice when scaling horizontally.
- ACM issues and renews certificates automatically with no server-side configuration.
- High reliability with an AWS SLA.

**Cons:**

- ACM does not export the private key — the certificate can only be used via ALB (or CloudFront/API Gateway). For an EC2 deployment ALB becomes a required component.
- ALB costs ~$20/month fixed regardless of traffic.
- Requires configuring IAM roles, target groups, listeners, and security groups.

---

### 5. Node.js directly on port 443

Running the Node.js process without a separate reverse proxy.

**Pros:**

- No additional component in the stack.

**Cons:**

- Requires running the process as root (ports < 1024) or configuring `CAP_NET_BIND_SERVICE`.
- Certificate management becomes complex inside the application.
- No HTTP → HTTPS redirect or HTTP/2 without extra code.

## Decision

Use **Caddy 2** (`caddy:2-alpine`) as the reverse proxy in the production Docker Compose profile.

Caddy was chosen because it is the only option among those considered that fully satisfies all requirements without additional tools: automatic TLS, HTTP → HTTPS redirect, and certificate storage are all handled by Caddy itself with no cron jobs, certbot, IAM roles, or privileged processes. Compared to Traefik — the only other option with built-in TLS — Caddy has a significantly simpler configuration for a static Docker Compose stack: the entire reverse proxy is reduced to a single file with three lines, whereas Traefik requires two configuration files and labels on every service. For a solo-maintained MVP this is critical — less configuration means fewer places where something can break.

Configuration in `Caddyfile`:

```
{$DOMAIN} {
    reverse_proxy app:3000
}
```

Caddy automatically:

- obtains and renews a Let's Encrypt certificate for the domain specified in the `DOMAIN` variable,
- redirects HTTP → HTTPS,
- stores certificates in the named volume `caddy_data`.

In `docker-compose.yml` the `caddy` service is placed under the `production` profile, so local development runs without it.

## Consequences

**Positive:**

- Zero operational cost for TLS: certificates are renewed automatically with no cron jobs or restarts.
- Minimal configuration — a single Caddyfile with three lines instead of nginx.conf + certbot.
- Caddy stores certificate state in a Docker volume, so certificates survive image rebuilds.
- Built-in HTTP/2 and HTTPS redirect support.

**Negative / trade-offs:**

- Smaller module ecosystem compared to nginx (not critical for current goals).
- When changing the domain the `caddy_data` volume must be cleared manually, otherwise stale certificates will remain.
- `caddy_data` is the single storage location for certificates, but losing it is not catastrophic: Caddy will automatically obtain a new certificate on the next start (~1 min downtime). However, frequently deleting the volume (`docker volume rm caddy_data`) exhausts the Let's Encrypt rate limit — 5 duplicate certificates per week. Exceeding this limit blocks issuance for 7 days. Backing up the volume is not necessary, but the volume should not be deleted carelessly.
- If the project scales to multiple instances, either a centralised certificate store (e.g. Caddy with Consul) or a migration to AWS ALB will be required.

**Prerequisites for a successful first start:**

Before running `docker compose --profile production up` ensure that:

1. The DNS A record for the domain points to the public IP of this EC2 instance and has already propagated (verify with `dig` or `nslookup`).
2. Port 80 is open in the instance's Security Group — Caddy uses it for the HTTP-01 challenge.
3. Port 443 is open in the Security Group to accept HTTPS traffic after the certificate is obtained.

If all three conditions are met, Caddy will obtain the certificate on first start with no additional steps.
