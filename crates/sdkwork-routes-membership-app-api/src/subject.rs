use sdkwork_utils_rust::number::parse_int;
use sdkwork_web_core::WebRequestContext;

/// Platform public tenant that owns the seeded storefront catalogue.
const DEFAULT_PUBLIC_TENANT_ID: i64 = 100001;

/// Tenant id owning the shared storefront catalogue, used when an
/// optional-credential catalog read arrives without a signed-in principal
/// (override via `MEMBERSHIP_PUBLIC_TENANT_ID`).
pub(crate) fn public_tenant_id() -> i64 {
    std::env::var("MEMBERSHIP_PUBLIC_TENANT_ID")
        .ok()
        .and_then(|value| parse_int(value.trim()))
        .filter(|value| *value > 0)
        .unwrap_or(DEFAULT_PUBLIC_TENANT_ID)
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(crate) struct NumericRuntimeSubject {
    pub tenant_id: i64,
    pub organization_id: i64,
    pub user_id: i64,
}

/// Resolve the authenticated runtime subject from the canonical `WebRequestContext`
/// injected by the `sdkwork-web-framework` interceptor chain.
///
/// `tenant_id` and `user_id` are positive integers; `organization_id` is non-negative
/// with 0 meaning tenant-level scope (per `SUBJECT_ID_SPEC.md`).
pub(crate) fn numeric_runtime_subject_from_context(
    context: &WebRequestContext,
) -> Result<NumericRuntimeSubject, String> {
    let principal = context
        .principal()
        .ok_or_else(|| "authenticated runtime context is required".to_owned())?;
    let organization_id = match principal.organization_id() {
        None | Some("") | Some("0") => 0,
        Some(value) => parse_non_negative_context_i64(value, "organization_id")?,
    };
    Ok(NumericRuntimeSubject {
        tenant_id: parse_positive_context_i64(principal.tenant_id(), "tenant_id")?,
        organization_id,
        user_id: parse_positive_context_i64(principal.user_id(), "user_id")?,
    })
}

fn parse_non_negative_context_i64(value: &str, field_name: &'static str) -> Result<i64, String> {
    let parsed = parse_int(value).ok_or_else(|| {
        format!("authenticated runtime context {field_name} must be a non-negative integer")
    })?;
    if parsed < 0 {
        return Err(format!(
            "authenticated runtime context {field_name} must be a non-negative integer"
        ));
    }
    Ok(parsed)
}

fn parse_positive_context_i64(value: &str, field_name: &'static str) -> Result<i64, String> {
    let parsed = parse_int(value).ok_or_else(|| {
        format!("authenticated runtime context {field_name} must be a positive integer")
    })?;
    if parsed <= 0 {
        return Err(format!(
            "authenticated runtime context {field_name} must be a positive integer"
        ));
    }
    Ok(parsed)
}
