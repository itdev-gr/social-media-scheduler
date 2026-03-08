const BASE_URL = 'https://api.post-bridge.com';
const MAX_CONCURRENT = 10;
const REQUEST_SPACING_MS = 100;
const REQUEST_TIMEOUT_MS = 30000;
const MAX_RETRIES = 3;

let activeRequests = 0;
let lastRequestTime = 0;

function getToken(): string {
  return import.meta.env.POST_BRIDGE_API_TOKEN || '';
}

async function waitForSlot(): Promise<void> {
  while (activeRequests >= MAX_CONCURRENT) {
    await new Promise((r) => setTimeout(r, 50));
  }
  const now = Date.now();
  const timeSinceLast = now - lastRequestTime;
  if (timeSinceLast < REQUEST_SPACING_MS) {
    await new Promise((r) => setTimeout(r, REQUEST_SPACING_MS - timeSinceLast));
  }
  lastRequestTime = Date.now();
  activeRequests++;
}

function releaseSlot(): void {
  activeRequests--;
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
  retryCount = 0
): Promise<T> {
  await waitForSlot();
  const startTime = Date.now();
  const url = `${BASE_URL}${path}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    const options: RequestInit = {
      method,
      headers: {
        Authorization: `Bearer ${getToken()}`,
        'Content-Type': 'application/json',
      },
      signal: controller.signal,
    };

    if (body && method !== 'GET') {
      options.body = JSON.stringify(body);
    }

    const res = await fetch(url, options);
    clearTimeout(timeout);
    const duration = Date.now() - startTime;

    if (!res.ok) {
      const errorBody = await res.text();
      console.error(`[PostBridge] FAILED ${method} ${path} — ${res.status} ${res.statusText} — ${errorBody}`);

      // Retry on 429 or 5xx
      if ((res.status === 429 || res.status >= 500) && retryCount < MAX_RETRIES) {
        const delay = Math.pow(4, retryCount) * 1000; // 1s, 4s, 16s
        console.log(`[PostBridge] Retrying ${method} ${path} — retry ${retryCount + 1}/${MAX_RETRIES} in ${delay}ms`);
        releaseSlot();
        await new Promise((r) => setTimeout(r, delay));
        return request<T>(method, path, body, retryCount + 1);
      }

      throw new Error(`Post Bridge API error: ${res.status} ${res.statusText} — ${errorBody}`);
    }

    const data = await res.json();
    console.log(`[PostBridge] ${method} ${path} — ${res.status} in ${duration}ms`);
    return data as T;
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      console.error(`[PostBridge] TIMEOUT ${method} ${path} after ${REQUEST_TIMEOUT_MS}ms`);
      throw new Error(`Post Bridge API timeout: ${method} ${path}`);
    }
    throw error;
  } finally {
    releaseSlot();
  }
}

export interface PostBridgeSocialAccount {
  id: number;
  platform: string;
  name: string;
  username?: string;
}

export interface CreateUploadUrlResponse {
  media_id: string;
  upload_url: string;
}

export interface PostBridgePost {
  id: string;
  status: string;
}

export interface PostBridgePostResult {
  social_account_id: number;
  platform: string;
  success: boolean;
  error?: string;
}

export async function getSocialAccounts(): Promise<PostBridgeSocialAccount[]> {
  const allAccounts: PostBridgeSocialAccount[] = [];
  let offset = 0;
  const limit = 100;

  while (true) {
    const data = await request<{ data: PostBridgeSocialAccount[]; metadata: { total: number; next: string | null } }>(
      'GET',
      `/v1/social-accounts?limit=${limit}&offset=${offset}`
    );
    allAccounts.push(...(data.data || []));
    if (!data.metadata?.next || (data.data || []).length < limit) break;
    offset += limit;
  }

  return allAccounts;
}

export async function createUploadUrl(
  mimeType: string,
  sizeBytes: number,
  name: string
): Promise<CreateUploadUrlResponse> {
  console.log(`[PostBridge] Upload media — name=${name}, size=${(sizeBytes / 1024 / 1024).toFixed(1)}MB, mimeType=${mimeType}`);
  return request<CreateUploadUrlResponse>('POST', '/v1/media/create-upload-url', {
    mime_type: mimeType,
    size_bytes: sizeBytes,
    name,
  });
}

export async function createPost(params: {
  caption: string;
  socialAccountIds: number[];
  mediaIds?: string[];
  scheduledAt?: string; // ISO 8601
}): Promise<PostBridgePost> {
  const body: Record<string, unknown> = {
    caption: params.caption,
    social_account_ids: params.socialAccountIds,
  };
  if (params.mediaIds && params.mediaIds.length > 0) {
    body.media_ids = params.mediaIds;
  }
  if (params.scheduledAt) {
    body.scheduled_at = params.scheduledAt;
  }
  console.log(`[PostBridge] POST /v1/posts — socialAccounts=${JSON.stringify(params.socialAccountIds)}, mediaIds=${JSON.stringify(params.mediaIds || [])}`);
  return request<PostBridgePost>('POST', '/v1/posts', body);
}

export async function getPost(postId: string): Promise<PostBridgePost> {
  return request<PostBridgePost>('GET', `/v1/posts/${postId}`);
}

export async function getPostResults(postId: string): Promise<PostBridgePostResult[]> {
  const data = await request<{ data: PostBridgePostResult[] }>('GET', `/v1/post-results?post_id=${postId}`);
  return data.data || [];
}
