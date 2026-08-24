# SDKWork Membership Source Configuration

`sdkwork.deployment.config.json` is the source-controlled deployment profile index for the
Membership application. It selects one typed server profile from `topology/`; each profile owns
the lifecycle environment, deployment profile, profile id, runtime target, public ingress, CORS
origin set, and PostgreSQL engine selection.

## Supported Profiles

| Profile | Purpose |
| --- | --- |
| `standalone.development` | Local Membership standalone gateway and PC development. |
| `cloud.development` | Deployed development API surface; local clients do not start remote services. |
| `standalone.production` | Standalone production server template. |
| `cloud.production` | SDKWork managed cloud production service. |

Test and staging profiles are intentionally not declared by the current pre-launch release matrix.
Selecting an undeclared profile fails closed; they must be added here and to release evidence before
those lifecycle tiers are used.

## Runtime And Secrets

The standalone gateway reads `SDKWORK_MEMBERSHIP_APPLICATION_PUBLIC_INGRESS_BIND`. Database
connection identity and lifecycle settings use only the shared `SDKWORK_DATABASE_*` contract.
Development credentials come from ignored `.env.postgres`, initialized from
`.env.postgres.example`; production credentials are injected by the deployment platform or a
protected secret file. No tracked profile contains a token, password, private key, or API key.

Installed runtime configuration is materialized under the platform path governed by
`RUNTIME_DIRECTORY_SPEC.md`. Source `etc/` remains the reviewed input and is not a runtime-state
directory.

## Verification

```powershell
node ../sdkwork-specs/tools/check-source-config-standard.mjs --root . --enforce-profile-identity
node ../sdkwork-specs/tools/check-app-manifest-standard.mjs --root . --json
cargo check -p sdkwork-api-membership-standalone-gateway
```

<!-- SDKWORK-DEPLOY-LAYOUT: v1 -->
## Installed Runtime Paths

Authority: `APPLICATION_DEPLOY_LAYOUT_SPEC.md` (`../sdkwork-specs/`).

| Item | Value |
| --- | --- |
| `appId` | `sdkwork-membership` |
| `runtimeCode` | `membership` |
| Config root | `/etc/sdkwork/membership/` |
| Runtime TOML | `/etc/sdkwork/membership/config.toml` |
| Secrets | `/etc/sdkwork/membership/secrets/` |
| Override | `SDKWORK_MEMBERSHIP_CONFIG_FILE` |

Source profiles live under `etc/` (`sdkwork.deployment.config.json` index). Deploy manifest: `deployments/deploy.yaml`. Web data-plane source: `deployments/webserver/` (`SDKWORK_WEBSERVER_SPEC.md` layout v3).

```bash
node ../sdkwork-specs/tools/check-source-config-standard.mjs --root .
node ../sdkwork-specs/tools/check-application-deploy-layout.mjs --root .
node ../sdkwork-specs/tools/check-webserver-toml-standard.mjs --root deployments/webserver
```
<!-- /SDKWORK-DEPLOY-LAYOUT -->


