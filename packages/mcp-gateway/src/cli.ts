#!/usr/bin/env node
/**
 * MCP Gateway — CLI
 *
 * Command-line interface for starting the MCP enforcement gateway.
 *
 * Usage:
 *   npx soterai-mcp-gateway --upstream http://localhost:3001/mcp
 *   npx soterai-mcp-gateway --upstream-command "npx" --upstream-args "-y @modelcontextprotocol/server-filesystem ./"
 *   npx soterai-mcp-gateway --help
 */
import { MCPServer } from "./MCPServer";
import type { MCPGatewayConfig } from "./MCPGatewayConfig";

function parseArgs(): MCPGatewayConfig {
  const args = process.argv.slice(2);
  const config: MCPGatewayConfig = {
    upstreamEndpoint: { transport: "http", address: "http://localhost:3001/mcp" },
  };

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case "--upstream":
      case "-u":
        config.upstreamEndpoint = { transport: "http", address: args[++i] };
        break;
      case "--upstream-command":
      case "-c":
        config.upstreamEndpoint = {
          transport: "stdio",
          address: args[++i],
          args: [],
        };
        break;
      case "--upstream-args":
        if (config.upstreamEndpoint.args) {
          config.upstreamEndpoint.args.push(args[++i]);
        }
        break;
      case "--port":
      case "-p":
        config.listenEndpoint = { transport: "http", address: `127.0.0.1:${args[++i]}` };
        break;
      case "--auth-token":
      case "-t":
        config.authToken = args[++i];
        break;
      case "--tenant":
        config.tenant = args[++i];
        break;
      case "--project":
        config.project = args[++i];
        break;
      case "--protection-mode":
      case "-m":
        config.protectionMode = args[++i] as "observe" | "standard" | "strict" | "enterprise_locked" | "air_gapped";
        break;
      case "--debug":
      case "-d":
        config.debug = true;
        break;
      case "--help":
      case "-h":
        printHelp();
        process.exit(0);
      case "--generate-config":
        generateClientConfig();
        process.exit(0);
      default:
        console.error(`Unknown option: ${args[i]}`);
        printHelp();
        process.exit(1);
    }
  }

  return config;
}

function printHelp(): void {
  console.log(`
SoterAI MCP Gateway — Inline MCP Enforcement Proxy

Usage:
  soterai-mcp-gateway [options]

Options:
  -u, --upstream <url>          Upstream MCP server URL (HTTP/SSE transport)
  -c, --upstream-command <cmd>  Upstream MCP server command (stdio transport)
  --upstream-args <arg>         Arguments for stdio transport command
  -p, --port <port>             Gateway listen port (default: 47322)
  -t, --auth-token <token>      Authentication token for clients
  --tenant <id>                 Default tenant identifier
  --project <id>                Default project identifier
  -m, --protection-mode <mode>  Protection mode (observe|standard|strict|enterprise_locked|air_gapped)
  -d, --debug                   Enable debug logging
  --generate-config             Generate a safe MCP client configuration
  -h, --help                    Show this help message

Examples:
  # HTTP upstream
  soterai-mcp-gateway --upstream http://localhost:3001/mcp --port 47322

  # stdio upstream (e.g., filesystem server)
  soterai-mcp-gateway --upstream-command npx --upstream-args "-y" --upstream-args "@modelcontextprotocol/server-filesystem" --upstream-args "./"

  # With authentication
  soterai-mcp-gateway --upstream http://localhost:3001/mcp --auth-token sk-soterai-xxx
`);
}

function generateClientConfig(): void {
  console.log(`
# SoterAI MCP Gateway — Client Configuration
#
# Add this to your MCP client configuration to route through the gateway.
# The gateway must be running on the specified host:port.

# For Claude Desktop (claude_desktop_config.json):
{
  "mcpServers": {
    "soterai-gateway": {
      "command": "npx",
      "args": ["-y", "@soterai/mcp-gateway", "--upstream", "http://localhost:3001/mcp"],
      "env": {
        "SOTERAI_AUTH_TOKEN": "your-auth-token"
      }
    }
  }
}

# For VS Code extension (settings.json):
{
  "soterai.mcpGateway.enabled": true,
  "soterai.mcpGateway.url": "http://127.0.0.1:47322",
  "soterai.mcpGateway.authToken": "your-auth-token"
}

# Rollback instructions:
# To bypass the gateway, remove the above configuration and connect
# directly to your MCP server. The gateway does not modify your
# MCP server configuration.
`);
}

async function main(): Promise<void> {
  const config = parseArgs();

  console.log("SoterAI MCP Gateway v0.1.0");
  console.log("Upstream:", JSON.stringify(config.upstreamEndpoint));
  console.log("Protection mode:", config.protectionMode ?? "standard");

  const server = new MCPServer({
    config,
    authToken: config.authToken,
  });

  // Handle graceful shutdown
  process.on("SIGINT", async () => {
    console.log("\nShutting down...");
    await server.stop();
    process.exit(0);
  });

  process.on("SIGTERM", async () => {
    console.log("\nShutting down...");
    await server.stop();
    process.exit(0);
  });

  await server.start();
}

if (require.main === module) {
  main().catch((error) => {
    console.error("Fatal error:", error);
    process.exit(1);
  });
}
