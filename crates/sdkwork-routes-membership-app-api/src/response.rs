//! HTTP response envelope adapters aligned with `sdkwork-specs/API_SPEC.md` §4.5, §14–§16.
//!
//! Replaces the legacy `*MembershipApiResult` wire envelopes with the canonical
//! `SdkWorkApiResponse` (`code: 0`, `data`, `traceId`) and RFC 9457
//! `application/problem+json` (`ProblemDetail` with numeric `code` and `traceId`).
//!
//! Success and error responses are produced through `sdkwork-web-core` helpers
//! so handlers never hand-build envelopes. See `WEB_FRAMEWORK_SPEC.md` §7.

use axum::http::{HeaderName, HeaderValue, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use sdkwork_contract_service::CommerceServiceError;
use sdkwork_utils_rust::SdkWorkApiResponse;

pub use sdkwork_utils_rust::SdkWorkCommandData;
use sdkwork_web_core::{
    problem_response, WebFrameworkError, WebFrameworkErrorKind, WebRequestContext,
};
use serde::Serialize;

/// Single-resource payload wrapper (`data.item`).
#[derive(Serialize)]
pub struct ItemEnvelope<T> {
    pub item: T,
}

/// Wrap a single resource for handlers that return `SdkWorkResourceData`.
pub fn item_envelope<T>(item: T) -> ItemEnvelope<T> {
    ItemEnvelope { item }
}

/// Standard command acknowledgement (`data.accepted`).
#[allow(dead_code)]
pub fn command_accepted() -> SdkWorkCommandData {
    SdkWorkCommandData::accepted()
}

#[allow(dead_code)]
pub fn command_accepted_with_resource(resource_id: impl Into<String>) -> SdkWorkCommandData {
    SdkWorkCommandData {
        accepted: true,
        resource_id: Some(resource_id.into()),
        status: None,
    }
}

/// Canonical success result: handler returns typed payload, framework wraps it.
pub type ApiResult<T> = Result<T, ApiProblem>;

/// Finish a typed `ApiResult<T>` with request-scoped correlation.
///
/// Success bodies are wrapped in `SdkWorkApiResponse { code: 0, data, traceId }`.
/// Errors are emitted as `application/problem+json` with numeric `code` and `traceId`.
pub fn finish_api_json<T: Serialize>(ctx: &WebRequestContext, result: ApiResult<T>) -> Response {
    match result {
        Ok(data) => success_json(ctx, data),
        Err(problem) => problem.into_response_for(ctx),
    }
}

/// Finish a typed create result with HTTP 201 and canonical JSON envelope.
pub fn finish_api_created<T: Serialize>(ctx: &WebRequestContext, result: ApiResult<T>) -> Response {
    match result {
        Ok(data) => success_json_with_status(ctx, StatusCode::CREATED, data),
        Err(problem) => problem.into_response_for(ctx),
    }
}

/// Finish a delete command with HTTP 204 and no JSON success body.
#[allow(dead_code)]
pub fn finish_api_no_content(ctx: &WebRequestContext, result: ApiResult<()>) -> Response {
    match result {
        Ok(()) => {
            let trace_id = ctx.resolved_trace_id();
            let mut response = StatusCode::NO_CONTENT.into_response();
            attach_trace_header(&mut response, &trace_id);
            response
        }
        Err(problem) => problem.into_response_for(ctx),
    }
}

/// Wrap a typed payload into a canonical `SdkWorkApiResponse` (HTTP 200).
pub fn success_json<T: Serialize>(ctx: &WebRequestContext, data: T) -> Response {
    success_json_with_status(ctx, StatusCode::OK, data)
}

/// Wrap a typed payload into a canonical `SdkWorkApiResponse`.
pub fn success_json_with_status<T: Serialize>(
    ctx: &WebRequestContext,
    status: StatusCode,
    data: T,
) -> Response {
    let trace_id = ctx.resolved_trace_id();
    let envelope = SdkWorkApiResponse::success(data, trace_id.clone());
    let mut response = (status, Json(envelope)).into_response();
    attach_trace_header(&mut response, &trace_id);
    response
}

/// Platform-aligned Problem detail. Converts to RFC 9457 `application/problem+json`.
///
/// The HTTP status and numeric `code` are derived by `sdkwork-web-core`'s
/// `problem_response` from `WebFrameworkErrorKind`, so handlers only need to
/// pick the semantic kind that matches the failure.
#[derive(Debug)]
pub struct ApiProblem {
    message: String,
    kind: WebFrameworkErrorKind,
    reason: Option<String>,
}

impl ApiProblem {
    fn new(message: impl Into<String>, kind: WebFrameworkErrorKind) -> Self {
        Self {
            message: message.into(),
            kind,
            reason: None,
        }
    }

    pub fn bad_request(message: impl Into<String>) -> Self {
        Self::new(message, WebFrameworkErrorKind::BadRequest)
    }

    pub fn unauthorized(message: impl Into<String>) -> Self {
        Self::new(message, WebFrameworkErrorKind::MissingCredentials)
    }

    pub fn forbidden(message: impl Into<String>) -> Self {
        Self::new(message, WebFrameworkErrorKind::Forbidden)
    }

    pub fn not_found(message: impl Into<String>) -> Self {
        Self::new(message, WebFrameworkErrorKind::NotFound)
    }

    pub fn conflict(message: impl Into<String>) -> Self {
        Self::new(message, WebFrameworkErrorKind::Conflict)
    }

    pub fn internal(message: impl Into<String>) -> Self {
        Self::new(message, WebFrameworkErrorKind::InternalServerError)
    }

    pub fn dependency_unavailable(message: impl Into<String>) -> Self {
        Self::new(message, WebFrameworkErrorKind::DependencyUnavailable)
    }

    /// Attaches a stable, machine-readable reason to the problem detail.
    ///
    /// `ProblemDetail.code` stays the numeric platform code per `API_SPEC.md`
    /// §15.3; the reason names the specific business rejection (for example
    /// `seat_capacity_exceeded`) so clients never have to parse prose.
    #[must_use]
    pub fn with_reason(mut self, reason: impl Into<String>) -> Self {
        self.reason = Some(reason.into());
        self
    }

    /// Map a domain `CommerceServiceError` into a client-safe Problem.
    ///
    /// `conflict` -> 40901 CONFLICT, `validation` -> 40001 VALIDATION_ERROR,
    /// storage/transport failures -> 50301 SERVICE_UNAVAILABLE, otherwise 50000 INTERNAL_ERROR.
    pub fn from_service(context: &str, error: CommerceServiceError) -> Self {
        let message = format!("{context}: {}", error.message());
        match error.code() {
            "conflict" => Self::conflict(error.message()),
            "validation" => Self::bad_request(error.message()),
            "not_found" => Self::not_found(error.message()),
            "storage" | "transport" => Self::dependency_unavailable(message),
            _ => Self::internal(message),
        }
    }

    fn framework_error(&self) -> WebFrameworkError {
        WebFrameworkError {
            kind: self.kind.clone(),
            message: self.message.clone(),
            retry_after_seconds: None,
            auth_profile: None,
            failed_stage: None,
            reason: self.reason.clone(),
        }
    }

    pub fn into_response_for(self, ctx: &WebRequestContext) -> Response {
        problem_response(&self.framework_error(), ctx.problem_correlation())
    }
}

/// Map an `AppMembershipResult<T>` into an `ApiResult<T>` using `from_service`.
#[allow(dead_code)]
pub fn map_service_result<T>(
    context: &str,
    result: Result<T, CommerceServiceError>,
) -> ApiResult<T> {
    result.map_err(|error| ApiProblem::from_service(context, error))
}

fn attach_trace_header(response: &mut Response, trace_id: &str) {
    if let Ok(value) = HeaderValue::from_str(trace_id) {
        response
            .headers_mut()
            .insert(HeaderName::from_static("x-sdkwork-trace-id"), value);
    }
}
