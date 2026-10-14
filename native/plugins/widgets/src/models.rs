use serde::{Deserialize, Serialize};

/// What the widgets need to call /api/v1 themselves: the device token (None when signed out) and the server.
#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Session {
    pub token: Option<String>,
    pub base_url: String,
}

/// Sign-in in an in-app browser sheet (iOS: ASWebAuthenticationSession; Android: a Custom Tab).
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthRequest {
    pub url: String,
    pub scheme: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct AuthReply {
    /// iOS hands back the `midore://` link that ended the sheet. Android returns None: the link arrives as a
    /// normal deep link.
    pub url: Option<String>,
}
