import {
    sha256
} from 'js-sha256'

export const AWS_CONTENT_SHA256_HEADER = 'x-amz-content-sha256'

export function hashBody(body : unknown) {
    if (typeof body === 'string') {
        return sha256(body).replace(/\n/g, '')
    }
    
    const bodyAsString = JSON.stringify(body).replace(/\/\n/g, '\n');
    return sha256(bodyAsString)
}

export function mutateHeaders(headers: HeadersInit, body: unknown) {
    return {
        ...headers,
        [AWS_CONTENT_SHA256_HEADER]: hashBody(body)
    }
}

export async function fetchSha256(url: string, options: RequestInit = {}) {
    if (options.body === undefined) {
        return fetch(url, options)
    }

    const optionsWithHashedHeader = {
        ...options,
        headers: mutateHeaders(options.headers ?? {}, options.body)
    }

    return fetch(url, optionsWithHashedHeader)
}
