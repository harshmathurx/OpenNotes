import { describe, expect, it, vi, beforeEach } from "vitest"
import { GitHubConnectionError, GitHubProvider } from "@/core/storage/github"

const mocks = vi.hoisted(() => ({
  reposGet: vi.fn(),
  reposCreateForAuthenticatedUser: vi.fn(),
}))

vi.mock("@octokit/rest", () => ({
  Octokit: vi.fn().mockImplementation(function () {
    return {
      rest: {
        repos: {
          get: mocks.reposGet,
          createForAuthenticatedUser: mocks.reposCreateForAuthenticatedUser,
        },
      },
    }
  }),
}))

describe("GitHubProvider connection", () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it("verifies access to an existing repo without trying to create one", async () => {
    mocks.reposGet.mockResolvedValueOnce({ data: { permissions: { pull: true, push: true } } })

    const provider = new GitHubProvider("token", "harshmathurx", "opennotes-vault")
    await provider.connect()

    expect(mocks.reposGet).toHaveBeenCalledWith({
      owner: "harshmathurx",
      repo: "opennotes-vault",
    })
    expect(mocks.reposCreateForAuthenticatedUser).not.toHaveBeenCalled()
    expect(provider.isConnected()).toBe(true)
  })

  it("rejects tokens that can read but cannot write repository contents", async () => {
    mocks.reposGet.mockResolvedValueOnce({ data: { permissions: { pull: true, push: false } } })

    const provider = new GitHubProvider("token", "harshmathurx", "opennotes-vault")

    await expect(provider.connect()).rejects.toMatchObject({
      code: "missing-write-permission",
      message: "GitHub token can read the repo but cannot write contents.",
    })
    expect(provider.isConnected()).toBe(false)
    expect(mocks.reposCreateForAuthenticatedUser).not.toHaveBeenCalled()
  })

  it("surfaces a clear error when the repo is missing or not granted to the token", async () => {
    mocks.reposGet.mockRejectedValueOnce({ status: 404 })

    const provider = new GitHubProvider("token", "harshmathurx", "opennotes-vault")

    await expect(provider.connect()).rejects.toMatchObject({
      code: "repo-not-found-or-not-granted",
      message: "Repository not found, or this fine-grained token was not granted access to it.",
    })
    expect(mocks.reposCreateForAuthenticatedUser).not.toHaveBeenCalled()
  })

  it("maps GitHub auth failures to useful connection errors", async () => {
    mocks.reposGet.mockRejectedValueOnce({ status: 401 })

    const provider = new GitHubProvider("bad-token", "harshmathurx", "opennotes-vault")

    await expect(provider.connect()).rejects.toMatchObject({
      code: "bad-token",
    })
    expect(new GitHubConnectionError("bad-token", "x")).toBeInstanceOf(Error)
  })
})
