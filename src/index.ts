export const AWS_CONTENT_SHA256_HEADER = "x-amz-content-sha256";

export function generateBoundary(): string {
	return `------------------------${Math.random().toString(36).substring(2, 15)}`;
}

type Body = BodyInit | null | undefined | string | Record<string, unknown>;

export async function sha256(data: string): Promise<string> {
	if (typeof data === "string") {
		const encoder = new TextEncoder();
		const dataBuffer = encoder.encode(data);
		const hashBuffer = await crypto.subtle.digest("SHA-256", dataBuffer);
		const hashArray = Array.from(new Uint8Array(hashBuffer));
		return hashArray
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("")
			.replace(/\n/g, "");
	}
	throw new Error("Unsupported data type for SHA-256 hashing");
}

export async function mutateBody(
	body: Body,
	boundary: string,
): Promise<string | Body> {
	if (
		body instanceof FormData &&
		body.has("file") &&
		body.get("file") instanceof File
	) {
		const file = body.get("file") as File;
		const multipart = await buildMultipartBodyForFile(file, boundary);
		return convertArrayBufferToString(multipart);
	}

	return body;
}

function normalize(str: string) {
	return str.replace(/\r\n/g, "\n").trim();
}

export async function convertArrayBufferToString(
	buffer: ArrayBuffer,
): Promise<string> {
	if (typeof buffer === "string") {
		throw new Error("test");
	}

	const decoder = new TextDecoder();
	return normalize(decoder.decode(buffer));
}

export async function createAwsHashForHeader(body: Body): Promise<string> {
	if (typeof body === "string") {
		return sha256(body);
	}

	if (body instanceof ArrayBuffer) {
		const convertedBuffer = await convertArrayBufferToString(body);
		return sha256(convertedBuffer);
	}

	const bodyAsString = JSON.stringify(body).replace(/\/\n/g, "\n");
	return sha256(bodyAsString);
}

export async function mutateHeaders(
	headers: Record<string, unknown>,
	body: Body,
) {
	return {
		...headers,
		[AWS_CONTENT_SHA256_HEADER]: await createAwsHashForHeader(body),
	};
}

export async function buildMultipartBodyForFile(
	file: File,
	boundary: string,
): Promise<ArrayBuffer> {
	const preamble = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="${file.name}"\r\nContent-Type: application/octet-stream\r\n\r\n`;

	const postamble = `\r\n--${boundary}--\r\n`;

	const encoder = new TextEncoder();
	const preambleBytes = encoder.encode(preamble);
	const postambleBytes = encoder.encode(postamble);

	return Promise.all([file.arrayBuffer()]).then(([fileBuffer]) => {
		const totalLength =
			preambleBytes.length + fileBuffer.byteLength + postambleBytes.length;
		const body = new Uint8Array(totalLength);

		body.set(preambleBytes, 0);
		body.set(new Uint8Array(fileBuffer), preambleBytes.length);
		body.set(postambleBytes, preambleBytes.length + fileBuffer.byteLength);

		return body.buffer;
	});
}

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
	const hashBuffer = await crypto.subtle.digest("SHA-256", buffer);
	const hashArray = Array.from(new Uint8Array(hashBuffer));
	return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function fetchSha256(
	url: string,
	options: RequestInit = {},
	boundary = generateBoundary(),
) {
	if (options.body === undefined) {
		return fetch(url, options);
	}

	const headers = options.headers as Record<string, unknown> | undefined;

	const body = await mutateBody(options.body, boundary);

	const optionsWithHashedHeader = {
		...options,
		headers: await mutateHeaders(headers ?? {}, body),
		body: body,
	} as RequestInit;

	return fetch(url, optionsWithHashedHeader);
}
