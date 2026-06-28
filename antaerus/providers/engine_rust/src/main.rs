use engine_rust::bootstrap;

#[tokio::main]
async fn main() {
    bootstrap::run().await;
}
