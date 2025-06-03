import {
    sha256
} from 'js-sha256'


export const AWS_CONTENT_SHA256_HEADER = 'x-amz-content-sha256'

export async function hashBody(body : unknown) {
    if (typeof body === 'string') {
        return sha256(body).replace(/\n/g, '')
    }

    if (body instanceof FormData && body.has('file') && body.get('file') instanceof File) {
        return transformFileToSHA256(body.get('file') as File)
    }
    
    
    const bodyAsString = JSON.stringify(body).replace(/\/\n/g, '\n');
    return sha256(bodyAsString);
}

export async function mutateHeaders(headers: HeadersInit, body: unknown) {
    return {
        ...headers,
        [AWS_CONTENT_SHA256_HEADER]: await hashBody(body)
    }
}

async function transformFileToSHA256(file : File): Promise<string> {
    const arrayBuffer = await file.arrayBuffer();
    const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
    const hashArray = Array.from(new Uint8Array(hashBuffer)); 
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    return hashHex;
  }

export async function fetchSha256(url: string, options: RequestInit = {}) {
    if (options.body === undefined) {
        return fetch(url, options)
    }

    const optionsWithHashedHeader = {
        ...options,
        headers: await mutateHeaders(options.headers ?? {}, options.body)
    }

    return fetch(url, optionsWithHashedHeader)
}
