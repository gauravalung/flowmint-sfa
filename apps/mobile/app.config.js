const { expo: baseConfig } = require("./app.json");

// Inside a GitHub Codespace, "localhost" in a browser tab means the
// developer's own laptop, not the cloud container — so the static
// apiBaseUrl in app.json (production, or a LAN IP for phone testing)
// isn't reachable there. Codespaces sets CODESPACE_NAME and forwards each
// port to https://<codespace-name>-<port>.<forwarding-domain>, so when
// that env var is present, point the app at the forwarded API port
// instead. No effect outside Codespaces (EAS/gradle builds, `expo start`
// on a normal machine) — those don't have CODESPACE_NAME set, so
// app.json's own apiBaseUrl is used unchanged.
function resolveApiBaseUrl() {
  if (process.env.CODESPACES === "true" && process.env.CODESPACE_NAME) {
    const domain = process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN ?? "app.github.dev";
    return `https://${process.env.CODESPACE_NAME}-4000.${domain}/api/v1`;
  }
  return baseConfig.extra.apiBaseUrl;
}

module.exports = {
  expo: {
    ...baseConfig,
    extra: {
      ...baseConfig.extra,
      apiBaseUrl: resolveApiBaseUrl(),
    },
  },
};
