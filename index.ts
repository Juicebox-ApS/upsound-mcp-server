#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  McpError,
  ErrorCode,
} from "@modelcontextprotocol/sdk/types.js";
import fetch from "node-fetch";
import robotsParser from "robots-parser";

// Tool definitions
const UPSOUND_SEARCH_STUDIOS_TOOL: Tool = {
  name: "upsound_search_studios",
  description:
    "Search for Upsound studios with various filters and pagination. Provide direct links to the user",
  inputSchema: {
    type: "object",
    properties: {
      country: {
        type: "string",
        description: "Country to search for (e.g. 'United States')",
      },
      location: {
        type: "string",
        description: "Location to search for (e.g. 'New York')",
      },
      studioType: {
        type: "string",
        description:
          "Type of studio to search for (e.g. 'Recording Studio')",
      },
      ignoreRobotsText: {
        type: "boolean",
        description: "Ignore robots.txt rules for this request",
      },
    },
    required: ["country"],
  },
};

const UPSOUND_STUDIO_DETAILS_TOOL: Tool = {
  name: "upsound_studio_details",
  description:
    "Get detailed information about a specific Upsound studio. Provide direct links to the user",
  inputSchema: {
    type: "object",
    properties: {
      id: {
        type: "string",
        description: "The Upsound studio ID",
      },
      ignoreRobotsText: {
        type: "boolean",
        description: "Ignore robots.txt rules for this request",
      },
    },
    required: ["id"],
  },
};

const UPSOUND_TOOLS = [
  UPSOUND_SEARCH_STUDIOS_TOOL,
  UPSOUND_STUDIO_DETAILS_TOOL,
] as const;

// Utility functions
const USER_AGENT =
  "ModelContextProtocol/1.0 (Autonomous; +https://github.com/modelcontextprotocol/servers)";
const BASE_URL = "https://api.upsound.com/api";

const args = process.argv.slice(2);
const IGNORE_ROBOTS_TXT = args.includes("--ignore-robots-txt");

const robotsErrorMessage =
  "This path is disallowed by Upsound's robots.txt to this User-agent. You may or may not want to run the server with '--ignore-robots-txt' args";
let robotsTxtContent = "";

// Simple robots.txt fetch
async function fetchRobotsTxt() {
  if (IGNORE_ROBOTS_TXT) {
    return;
  }

  try {
    const response = await fetchWithUserAgent(
      `${BASE_URL}/robots.txt`
    );
    robotsTxtContent = await response.text();
  } catch (error) {
    console.error("Error fetching robots.txt:", error);
    robotsTxtContent = ""; // Empty robots.txt means everything is allowed
  }
}

function isPathAllowed(path: string) {
  if (!robotsTxtContent) {
    return true; // If we couldn't fetch robots.txt, assume allowed
  }

  const robots = robotsParser(path, robotsTxtContent);
  if (!robots.isAllowed(path, USER_AGENT)) {
    console.error(robotsErrorMessage);
    return false;
  }

  return true;
}

async function fetchWithUserAgent(url: string) {
  return fetch(url, {
    headers: {
      "User-Agent": USER_AGENT,
      "Accept-Language": "en-US,en;q=0.9",
    },
  });
}

// API handlers
async function handleUpsoundSearch(params: any) {
  const {
    country,
    location,
    checkin,
    maxPrice,
    ignoreRobotsText = false,
  } = params;

  // Build search URL
  const searchUrl = new URL(`${BASE_URL}/studios`);

  searchUrl.searchParams.append("country", country);
  if (location) searchUrl.searchParams.append("term", location);

  // Add query parameters
  if (checkin)
    searchUrl.searchParams.append("available_date", checkin);

  // Add price range
  if (maxPrice)
    searchUrl.searchParams.append("max_price", maxPrice.toString());

  // Check if path is allowed by robots.txt
  const path = searchUrl.pathname + searchUrl.search;
  if (!ignoreRobotsText && !isPathAllowed(path)) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: robotsErrorMessage,
              url: searchUrl.toString(),
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  const allowSearchResultSchema: Record<string, any> = {
    demandStayListing: {
      id: true,
      description: true,
      location: true,
    },
    badges: {
      text: true,
    },
    structuredContent: {
      mapCategoryInfo: {
        body: true,
      },
      mapSecondaryLine: {
        body: true,
      },
      primaryLine: {
        body: true,
      },
      secondaryLine: {
        body: true,
      },
    },
    avgRatingA11yLabel: true,
    listingParamOverrides: true,
    structuredDisplayPrice: {
      primaryLine: {
        accessibilityLabel: true,
      },
      secondaryLine: {
        accessibilityLabel: true,
      },
      explanationData: {
        title: true,
        priceDetails: {
          items: {
            description: true,
            priceString: true,
          },
        },
      },
    },
    // contextualPictures: {
    //   picture: true
    // }
  };

  try {
    const response = await fetchWithUserAgent(searchUrl.toString());
    const data = await response.json();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              searchUrl: searchUrl.toString(),
              data: data,
            },
            null,
            2
          ),
        },
      ],
      isError: false,
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error:
                error instanceof Error
                  ? error.message
                  : String(error),
              searchUrl: searchUrl.toString(),
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}

async function handleUpsoundStudioDetails(params: any) {
  const { id, ignoreRobotsText = false } = params;

  // Build listing URL
  const listingUrl = new URL(`${BASE_URL}/studios/${id}`);

  // Check if path is allowed by robots.txt
  const path = listingUrl.pathname + listingUrl.search;
  if (!ignoreRobotsText && !isPathAllowed(path)) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error: robotsErrorMessage,
              url: listingUrl.toString(),
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }

  try {
    const response = await fetchWithUserAgent(listingUrl.toString());
    const data = await response.json();

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              listingUrl: listingUrl.toString(),
              details: data,
            },
            null,
            2
          ),
        },
      ],
      isError: false,
    };
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: JSON.stringify(
            {
              error:
                error instanceof Error
                  ? error.message
                  : String(error),
              listingUrl: listingUrl.toString(),
            },
            null,
            2
          ),
        },
      ],
      isError: true,
    };
  }
}

// Server setup
const server = new Server(
  {
    name: "upsound",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

console.error(
  `Server started with options: ${
    IGNORE_ROBOTS_TXT ? "ignore-robots-txt" : "respect-robots-txt"
  }`
);

// Set up request handlers
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: UPSOUND_TOOLS,
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  try {
    // Ensure robots.txt is loaded
    if (!robotsTxtContent) {
      await fetchRobotsTxt();
    }

    switch (request.params.name) {
      case "upsound_search_studios": {
        return await handleUpsoundSearch(request.params.arguments);
      }

      case "upsound_studio_details": {
        return await handleUpsoundStudioDetails(
          request.params.arguments
        );
      }

      default:
        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${request.params.name}`
        );
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
      isError: true,
    };
  }
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Upsound MCP Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
