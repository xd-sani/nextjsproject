import { NextResponse } from "next/server";

const DOGRAH_API_BASE = "https://app.dograh.com/api/v1";

export async function GET() {
  const workflowId = process.env.NEXT_PUBLIC_DOGRAH_WORKFLOW_ID || "11722";
  const apiKey = process.env.DOGRAH_API_KEY;
  const configuredToken = process.env.NEXT_PUBLIC_DOGRAH_EMBED_TOKEN;

  if (configuredToken) {
    return NextResponse.json({
      token: configuredToken,
      scriptUrl: `https://app.dograh.com/embed/dograh-widget.js?token=${encodeURIComponent(configuredToken)}`,
    });
  }
  if (!apiKey) {
    return NextResponse.json(
      { error: "DOGRAH_API_KEY is not configured" },
      { status: 503 },
    );
  }

  const headers = { "X-API-Key": apiKey };
  let response = await fetch(
    `${DOGRAH_API_BASE}/workflow/${workflowId}/embed-token`,
    {
      headers,
      cache: "no-store",
    },
  );

  let payload = response.ok ? await response.json() : null;
  if (response.status === 404 || !payload?.token) {
    response = await fetch(
      `${DOGRAH_API_BASE}/workflow/${workflowId}/embed-token`,
      {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({
          allowed_domains: null,
          settings: { widgetType: "voice", embedMode: "headless" },
        }),
        cache: "no-store",
      },
    );
    payload = response.ok ? await response.json() : null;
  }

  if (!response.ok) {
    console.error(
      "Dograh embed token error",
      response.status,
      await response.text(),
    );
    return NextResponse.json(
      { error: "Dograh rejected the embed token request" },
      { status: 502 },
    );
  }

  const token = payload?.token;
  if (!token)
    return NextResponse.json(
      { error: "Dograh returned no embed token" },
      { status: 502 },
    );
  const scriptUrl =
    typeof payload.embed_script === "string"
      ? payload.embed_script.match(
          /(?:src|js\.src)\s*=\s*["']([^"']+)["']/,
        )?.[1]
      : undefined;
  return NextResponse.json({
    token,
    scriptUrl:
      scriptUrl ||
      `https://app.dograh.com/embed/dograh-widget.js?token=${encodeURIComponent(token)}`,
  });
}
