import { NextResponse } from "next/server"

export async function GET() {
  if (process.env.NEXT_PUBLIC_ENABLE_REMOTE_STORAGE !== "true") {
    return NextResponse.json(
      { error: "Remote storage is disabled in this build." },
      { status: 404 }
    )
  }

  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID
  if (!clientId) {
    return NextResponse.json(
      { error: "GitHub OAuth is not configured." },
      { status: 503 }
    )
  }

  const state = crypto.randomUUID()
  const redirectUri =
    process.env.GITHUB_OAUTH_REDIRECT_URI ??
    "http://localhost:3000/api/auth/github/callback"
  const url = new URL("https://github.com/login/oauth/authorize")
  url.searchParams.set("client_id", clientId)
  url.searchParams.set("redirect_uri", redirectUri)
  url.searchParams.set("scope", "repo")
  url.searchParams.set("state", state)

  const response = NextResponse.redirect(url)
  response.cookies.set("opennotes_github_oauth_state", state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 10 * 60,
    path: "/",
  })
  return response
}
