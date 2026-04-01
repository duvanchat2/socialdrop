#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';

const API_URL = process.env.SOCIALDROP_API_URL ?? 'https://solokids.shop/api';
const USER_ID = process.env.SOCIALDROP_USER_ID ?? 'demo-user';

// ─── HTTP helpers ────────────────────────────────────────────────────────────

async function apiGet<T>(path: string): Promise<T> {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${API_URL}${path}${sep}userId=${USER_ID}`);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function apiPost<T>(path: string, body?: unknown): Promise<T> {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${API_URL}${path}${sep}userId=${USER_ID}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) throw new Error(`POST ${path} → ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function apiPatch<T>(path: string, body: unknown): Promise<T> {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${API_URL}${path}${sep}userId=${USER_ID}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status} ${await res.text()}`);
  return res.json() as Promise<T>;
}

async function apiDelete(path: string): Promise<void> {
  const sep = path.includes('?') ? '&' : '?';
  const res = await fetch(`${API_URL}${path}${sep}userId=${USER_ID}`, { method: 'DELETE' });
  if (!res.ok) throw new Error(`DELETE ${path} → ${res.status} ${await res.text()}`);
}

// ─── Tool definitions ────────────────────────────────────────────────────────

const TOOLS: Tool[] = [
  {
    name: 'get_posts',
    description: 'List all scheduled posts for the user',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_calendar',
    description: 'Get posts in calendar format (grouped by date)',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_stats',
    description: 'Get overall stats overview (total posts, published, failed, etc.)',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_stats_by_platform',
    description: 'Get post statistics broken down by platform',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_integrations',
    description: 'List all connected social media integrations (Instagram, TikTok, etc.)',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'schedule_post',
    description: 'Schedule a new post to be published on one or more platforms',
    inputSchema: {
      type: 'object',
      properties: {
        content: { type: 'string', description: 'Post caption/text content' },
        platforms: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of platform names e.g. ["INSTAGRAM","TIKTOK"]',
        },
        scheduledAt: {
          type: 'string',
          description: 'ISO 8601 datetime e.g. 2026-04-01T10:00:00-05:00',
        },
        mediaUrls: {
          type: 'array',
          items: { type: 'string' },
          description: 'Optional list of media file URLs',
        },
      },
      required: ['content', 'platforms', 'scheduledAt'],
    },
  },
  {
    name: 'delete_post',
    description: 'Delete a scheduled or published post by ID',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Post ID to delete' },
      },
      required: ['id'],
    },
  },
  {
    name: 'retry_post',
    description: 'Retry a post that previously failed to publish',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Post ID to retry' },
      },
      required: ['id'],
    },
  },
  {
    name: 'update_post',
    description: 'Update content or scheduled time of an existing post',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'Post ID to update' },
        content: { type: 'string', description: 'New post content' },
        scheduledAt: { type: 'string', description: 'New ISO 8601 scheduled datetime' },
      },
      required: ['id'],
    },
  },
  {
    name: 'upload_media',
    description: 'Upload a media file from a public URL to the SocialDrop media library',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Public URL of the media file to upload' },
        filename: { type: 'string', description: 'Optional filename override' },
      },
      required: ['url'],
    },
  },
  {
    name: 'get_content',
    description: 'List content library items (imported from Drive or uploaded)',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_platform_analytics',
    description: 'Get analytics data per platform (alias for get_stats_by_platform)',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'get_drive_status',
    description: 'Get Google Drive sync connection status',
    inputSchema: { type: 'object', properties: {}, required: [] },
  },
  {
    name: 'sync_drive',
    description: 'Trigger a Google Drive sync for a specific config',
    inputSchema: {
      type: 'object',
      properties: {
        configId: { type: 'string', description: 'Drive config ID to sync' },
      },
      required: ['configId'],
    },
  },
];

// ─── Server ──────────────────────────────────────────────────────────────────

const server = new Server(
  { name: 'socialdrop', version: '1.0.0' },
  { capabilities: { tools: {} } },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOLS }));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args = {} } = request.params;

  try {
    let result: unknown;

    switch (name) {
      case 'get_posts':
        result = await apiGet('/posts');
        break;

      case 'get_calendar':
        result = await apiGet('/posts/calendar');
        break;

      case 'get_stats':
        result = await apiGet('/stats/overview');
        break;

      case 'get_stats_by_platform':
      case 'get_platform_analytics':
        result = await apiGet('/stats/by-platform');
        break;

      case 'get_integrations':
        result = await apiGet('/integrations');
        break;

      case 'schedule_post': {
        const { content, platforms, scheduledAt, mediaUrls } = args as {
          content: string;
          platforms: string[];
          scheduledAt: string;
          mediaUrls?: string[];
        };
        result = await apiPost('/posts', { content, platforms, scheduledAt, mediaUrls });
        break;
      }

      case 'delete_post': {
        const { id } = args as { id: string };
        await apiDelete(`/posts/${id}`);
        result = { success: true, message: `Post ${id} deleted` };
        break;
      }

      case 'retry_post': {
        const { id } = args as { id: string };
        result = await apiPost(`/posts/${id}/retry`);
        break;
      }

      case 'update_post': {
        const { id, ...patch } = args as { id: string; content?: string; scheduledAt?: string };
        result = await apiPatch(`/posts/${id}`, patch);
        break;
      }

      case 'upload_media': {
        const { url, filename } = args as { url: string; filename?: string };
        result = await apiPost('/media/upload-standalone', { url, filename });
        break;
      }

      case 'get_content':
        result = await apiGet('/content');
        break;

      case 'get_drive_status':
        result = await apiGet('/drive/status');
        break;

      case 'sync_drive': {
        const { configId } = args as { configId: string };
        result = await apiPost(`/drive/sync/${configId}`);
        break;
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      content: [{ type: 'text', text: `Error: ${message}` }],
      isError: true,
    };
  }
});

// ─── Start ───────────────────────────────────────────────────────────────────

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  process.stderr.write('SocialDrop MCP server running (stdio)\n');
}

main().catch((err) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
