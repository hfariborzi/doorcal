use serde::{Deserialize, Serialize};

/// What the widgets need to call /api/v1 themselves: the device token (None when signed out) and the server.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub token: Option<String>,
    pub base_url: String,
}
