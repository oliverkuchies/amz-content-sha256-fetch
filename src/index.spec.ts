import { describe, it, expect, beforeEach, vi } from 'vitest'
import { AWS_CONTENT_SHA256_HEADER, fetchSha256, hashBody, mutateHeaders } from './index'
import createFetchMock from 'vitest-fetch-mock';

beforeEach(() => {
  const fetchMocker = createFetchMock(vi);

  fetchMocker.mockOnce((req) => {
    if (!req.headers.get(AWS_CONTENT_SHA256_HEADER)) {
        return new Response('Missing required header', {
            status: 400,
            headers: {
            'Content-Type': 'text/plain',
            },
        });
    }

    return new Response(JSON.stringify(req), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  });

  fetchMocker.enableMocks()
});

describe('hashBody', () => {
    it('should hash the body correctly', async () => {
        const body = { key: 'value' }
        const expectedHash = 'e43abcf3375244839c012f9633f95862d232a95b00d5bc7348b3098b9fed7f32'
                
        const result = await hashBody(body)
        
        expect(result).toBe(expectedHash)
    })
})

describe('fetch without sha256 headers', () => {
    it('should return a 400 error', async () => {
        const url = 'https://example.mangos'
        const body = { key: 'bobs-bananas', 'mango': 'fruit' }
    
        const options = {
            method: 'POST',
            url: url,
            body: JSON.stringify(body),
            headers: {
                'Content-Type': 'application/json'
            }
        }
        
        const response = await fetch(url, options)
        const result = await response.text()
        
        expect(response.status).toBe(400)
        expect(result).toBe('Missing required header')
    })
});

describe('fetchWithSha256Headers', () => {
    it('should add the hashed body to the headers', async () => {
        const url = 'https://example.com'
        const body = { key: 'bobs-bananas', 'mango': 'fruit' }
    
        const options = {
            method: 'POST',
            url: url,
            body: JSON.stringify(body),
            headers: {
                'Content-Type': 'application/json'
            }
        }
        
        const response = await fetchSha256(url, options)
        expect(response.status).toBe(200)
    })

    it('should add hashed body to the headers for form data', async () => {
        const url = 'https://example.com'
        const body = new URLSearchParams({ key: 'bobs-bananas', mango: 'fruit' })
    
        const options = {
            method: 'POST',
            url: url,
            body: body.toString(),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }
        
        const response = await fetchSha256(url, options)
        expect(response.status).toBe(200)
    });

    it('should add hashed body to the headers for form data', async () => {
        const url = 'https://example.com'
        const body = new URLSearchParams({ key: 'bobs-bananas', mango: 'fruit' })

        const options = {
            method: 'POST',
            url: url,
            body: body.toString(),
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
        }

        const response = await fetchSha256(url, options)
        expect(response.status).toBe(200)
    });

    it('should add hashed body to the headers for multipart/form-data', async () => {
        const url = 'https://example.com'
        const body = new FormData()
        body.append('file', new Blob(['file content'], { type: 'text/plain' }), 'file.txt')
        body.append('key', 'bobs-bananas')
        body.append('mango', 'fruit')

        const options = {
            method: 'POST',
            url: url,
            body: body,
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        }

        const response = await fetchSha256(url, options)
        expect(response.status).toBe(200)
    });
});

describe('mutateHeaders', () => {
    it('should add the hashed body to the headers', async () => {
        const headers = {
            'Content-Type': 'application/json'
        }
        const body = { key: 'bobs-bananas', 'mango': 'fruit' }
        const expectedHash = '8a573ca735c107f6545e687ef82913a9f3b50310b7f4c6b013fc4bacf63f11d4'
        
        const result = await mutateHeaders(headers, body)
        
        expect(result[AWS_CONTENT_SHA256_HEADER]).toBe(expectedHash)
    })

    it('should support form data', async () => {
        const headers = {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
        const body = new URLSearchParams({ key: 'bobs-bananas', mango: 'fruit' })
        const expectedHash = '44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a'
        
        const result = await mutateHeaders(headers, body)
        
        expect(result[AWS_CONTENT_SHA256_HEADER]).toBe(expectedHash)
    });

    it('should support file via form data', async () => {
        const headers = {
            'Content-Type': 'multipart/form-data'
        }
        const body = new FormData()
        body.append('file', new Blob(['file content'], { type: 'text/plain' }), 'file.txt')
        body.append('key', 'bobs-bananas')
        body.append('mango', 'fruit')

        const expectedHash = '86454b7d7fbb172e7d335aa65d59f3e44b481e219e76c547f3da3d1fd70be9e4'
        
        const result = await mutateHeaders(headers, body)
        
        expect(result[AWS_CONTENT_SHA256_HEADER]).toBe(expectedHash)
    });
});