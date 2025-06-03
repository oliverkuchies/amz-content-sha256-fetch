import {
    sha256
} from 'js-sha256'


export const AWS_CONTENT_SHA256_HEADER = 'x-amz-content-sha256'

export function getBoundaryFromHeaders(headers: Record<string, unknown>): string | undefined {
    const contentType = headers['Content-Type'] || headers['content-type'];
    if (typeof contentType === 'string') {
        const match = contentType.match(/boundary=(.+)/);
        return match ? match[1] : undefined;
    }
    return undefined;
}

export async function hashBody(body : unknown, headers: Record<string, unknown>) {
    if (typeof body === 'string') {
        return sha256(body).replace(/\n/g, '')
    }

    if (body instanceof FormData && body.has('file') && body.get('file') instanceof File) {
        const file = body.get('file') as File;
        const boundary = getBoundaryFromHeaders(headers);
        if (!boundary) {
            throw new Error('Boundary not found in Content-Type header');
        }
        const bodyBuffer = await buildMultipartBody(file, boundary);
        return sha256Hex(bodyBuffer)
    }
    
    
    const bodyAsString = JSON.stringify(body).replace(/\/\n/g, '\n');
    return sha256(bodyAsString);
}

export async function mutateHeaders(headers: Record<string, unknown>, body: unknown) {
    return {
        ...headers,
        [AWS_CONTENT_SHA256_HEADER]: await hashBody(body, headers)
    }
}

export async function buildMultipartBody(file: File, boundary: string) {
    const preamble =
      `--${boundary}\r\n` +
      `Content-Disposition: form-data; name="file"; filename="${file.name}"\r\n` +
      `Content-Type: application/octet-stream\r\n\r\n`;
  
    const postamble = `\r\n--${boundary}--\r\n`;
  
    const encoder = new TextEncoder();
    const preambleBytes = encoder.encode(preamble);
    const postambleBytes = encoder.encode(postamble);
  
    return Promise.all([file.arrayBuffer()]).then(([fileBuffer]) => {
      const totalLength = preambleBytes.length + fileBuffer.byteLength + postambleBytes.length;
      const body = new Uint8Array(totalLength);
  
      body.set(preambleBytes, 0);
      body.set(new Uint8Array(fileBuffer), preambleBytes.length);
      body.set(postambleBytes, preambleBytes.length + fileBuffer.byteLength);
  
      return body.buffer;
    });
  }

  async function sha256Hex(buffer : ArrayBuffer): Promise<string> {
    const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }

export async function fetchSha256(url: string, options: RequestInit = {}) {
    if (options.body === undefined) {
        return fetch(url, options)
    }

    const headers = options.headers as Record<string, unknown> | undefined;

    const optionsWithHashedHeader = {
        ...options,
        headers: await mutateHeaders(headers ?? {}, options.body)
    }

    return fetch(url, optionsWithHashedHeader)
}
