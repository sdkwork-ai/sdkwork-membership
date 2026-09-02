use sdkwork_api_membership_assembly::assemble_api_router_from_env;
use sdkwork_web_bootstrap::ApiModuleRegistry;

#[tokio::main]
async fn main() {
    sdkwork_database_sqlx::enable_process_shared_database_pool();
    tracing_subscriber::fmt::init();
    if let Err(error) = run().await {
        eprintln!("membership gateway failed: {error}");
        std::process::exit(1);
    }
}

async fn run() -> Result<(), String> {
    let assembly = assemble_api_router_from_env().await?;
    let manifest = assembly.route_manifest.clone();
    let resolver = sdkwork_iam_web_adapter::iam_web_request_context_resolver_from_env().await;
    let framework =
        sdkwork_iam_web_adapter::build_web_framework_builder(resolver, manifest, Vec::new());
    let mut module_registry = ApiModuleRegistry::new();
    module_registry.add_modules(vec![assembly]);
    let app = module_registry
        .try_compose("SDKWork Membership API")?
        .into_hosted(framework)
        .router;
    let addr = std::env::var("SDKWORK_MEMBERSHIP_APPLICATION_PUBLIC_INGRESS_BIND")
        .unwrap_or_else(|_| "127.0.0.1:18096".to_owned());
    let listener = tokio::net::TcpListener::bind(&addr)
        .await
        .map_err(|error| format!("failed to bind membership gateway on {addr}: {error}"))?;

    tracing::info!("membership gateway listening on {addr}");

    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .map_err(|error| format!("membership gateway serve failed: {error}"))?;

    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = async {
        if let Err(error) = tokio::signal::ctrl_c().await {
            tracing::warn!("failed to listen for ctrl-c: {error}");
        }
    };

    #[cfg(unix)]
    let terminate = async {
        // `Signal::recv()` resolves to `Option<()>`; `None` means the signal
        // stream is closed, which is a valid termination for the select below.
        let mut signal =
            match tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate()) {
                Ok(signal) => signal,
                Err(error) => {
                    tracing::warn!("failed to install SIGTERM handler: {error}");
                    return;
                }
            };
        signal.recv().await;
    };

    #[cfg(not(unix))]
    let terminate = std::future::pending::<()>();

    tokio::select! {
        () = ctrl_c => {},
        () = terminate => {},
    }

    tracing::info!("membership gateway shutdown signal received");
}
