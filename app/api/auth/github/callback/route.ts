import { NextRequest, NextResponse } from "next/server"

function htmlResponse(body: string, status = 200) {
  return new NextResponse(body, {
    status,
    headers: { "content-type": "text/html; charset=utf-8" },
  })
}

export async function GET(request: NextRequest) {
  if (process.env.NEXT_PUBLIC_ENABLE_REMOTE_STORAGE !== "true") {
    return htmlResponse("<p>Remote storage is disabled in this build.</p>", 404)
  }

  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET
  if (!clientId || !clientSecret) {
    return htmlResponse("<p>GitHub OAuth is not configured.</p>", 503)
  }

  const url = new URL(request.url)
  const code = url.searchParams.get("code")
  const state = url.searchParams.get("state")
  const expectedState = request.cookies.get("opennotes_github_oauth_state")?.value

  if (!code || !state || state !== expectedState) {
    return htmlResponse("<p>GitHub OAuth state validation failed.</p>", 400)
  }

  const tokenResponse = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
    }),
  })
  const payload = (await tokenResponse.json()) as {
    access_token?: string
    error?: string
    error_description?: string
  }

  if (!tokenResponse.ok || !payload.access_token) {
    return htmlResponse(
      `<p>GitHub OAuth failed: ${payload.error_description ?? payload.error ?? "unknown error"}</p>`,
      400
    )
  }

  const token = JSON.stringify(payload.access_token)
  return htmlResponse(`<!doctype html>
<html><body>
<p>GitHub connected. You can close this window.</p>
<script>
  if (window.opener) {
    window.opener.postMessage({ type: "opennotes:github-token", token: ${token} }, window.location.origin);
    window.close();
  } else {
    sessionStorage.setItem("opennotes-github-token", ${token});
  }
</script>
</body></html>`)
}
