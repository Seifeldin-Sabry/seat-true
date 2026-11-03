# MCP server (read-only)

SeatTrue is a remote MCP server at `https://<domain>/api/mcp`. Claude, Cursor and other MCP clients can read the signed-in member's workspace. It is read-only: no tool writes anything. It is included on every plan.

## Connect

Add `https://<domain>/api/mcp` as a remote MCP server.

1. The client discovers OAuth through `/.well-known/oauth-protected-resource/api/mcp`.
2. It registers itself with a Client ID Metadata Document (`@better-auth/cimd`, MCP 2026-07-28 profile).
3. It sends you to sign in (`/login`) and to approve access (`/mcp/consent`).

Access tokens are JWTs bound to the `/api/mcp` resource, and `requireMcpAuth` checks every request. Without a token, the server answers 401 with an RFC 9728 challenge.

## Tools

| Tool | What it returns |
| --- | --- |
| `get_leakage_overview` | The latest run, plus leakage, recovered and overbilled totals, open exceptions by kind, and per-client leakage |
| `list_exceptions` | Exceptions with the largest monthly impact first. Optional `clientId`, `kind`, `status` and `limit` |
| `explain_exception` | One exception: vendor versus billed quantity and price, its impact and status, and the comment thread |
| `get_client` | One client: markup, seats, leakage, mapped distributor customers, agreement lines and exceptions |
| `list_unmapped` | Distributor customers and billed client names that aren't mapped to a client yet |

## Rules

- The token's user acts in their newest workspace and sees only that workspace's data. Anything in another workspace answers "not found".
- Every tool call is written to the audit log as `mcp.tool_called`, with its arguments. That includes refused calls.
- The retention job deletes expired access and refresh tokens. Deleting a user also removes their tokens and consents.
