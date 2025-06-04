import { beforeEach, describe, expect, it, vi } from "vitest";
import createFetchMock from "vitest-fetch-mock";
import sample from "../test/sample";
import sampleWithoutBoundary from "../test/sample-without-boundary";

import {
	AWS_CONTENT_SHA256_HEADER,
	convertArrayBufferToString,
	createAwsHashForHeader,
	fetchSha256,
	mutateBody,
	mutateHeaders,
	sha256,
} from "./index";

beforeEach(() => {
	const fetchMocker = createFetchMock(vi);

	fetchMocker.mockOnce((req) => {
		if (!req.headers.get(AWS_CONTENT_SHA256_HEADER)) {
			return new Response("Missing required header", {
				status: 400,
				headers: {
					"Content-Type": "text/plain",
				},
			});
		}

		return new Response(JSON.stringify(req), {
			status: 200,
			headers: {
				"Content-Type": "application/json",
			},
		});
	});

	fetchMocker.enableMocks();
});

describe("createAwsHashForHeader", () => {
	it("should hash the body correctly", async () => {
		const body = { key: "value" };
		const expectedHash =
			"e43abcf3375244839c012f9633f95862d232a95b00d5bc7348b3098b9fed7f32";

		const result = await createAwsHashForHeader(body);

		expect(result).toBe(expectedHash);
	});
});

describe("fetch without sha256 headers", () => {
	it("should return a 400 error", async () => {
		const url = "https://example.mangos";
		const body = { key: "bobs-bananas", mango: "fruit" };

		const options = {
			method: "POST",
			url: url,
			body: JSON.stringify(body),
			headers: {
				"Content-Type": "application/json",
			},
		};

		const response = await fetch(url, options);
		const result = await response.text();

		expect(response.status).toBe(400);
		expect(result).toBe("Missing required header");
	});
});

describe("fetchWithSha256Headers", () => {
	it("should add the hashed body to the headers", async () => {
		const url = "https://example.com";
		const body = { key: "bobs-bananas", mango: "fruit" };

		const options = {
			method: "POST",
			url: url,
			body: JSON.stringify(body),
			headers: {
				"Content-Type": "application/json",
			},
		};

		const response = await fetchSha256(url, options);
		expect(response.status).toBe(200);
	});

	it("should add hashed body to the headers for form data", async () => {
		const url = "https://example.com";
		const body = new URLSearchParams({ key: "bobs-bananas", mango: "fruit" });

		const options = {
			method: "POST",
			url: url,
			body: body.toString(),
			headers: {
				"Content-Type":
					"multipart/form-data; boundary=------------------------boundary",
			},
		};

		const response = await fetchSha256(url, options);
		expect(response.status).toBe(200);
	});

	it("should add hashed body to the headers for form data", async () => {
		const url = "https://example.com";
		const body = new URLSearchParams({ key: "bobs-bananas", mango: "fruit" });

		const options = {
			method: "POST",
			url: url,
			body: body.toString(),
			headers: {
				"Content-Type": "application/x-www-form-urlencoded",
			},
		};

		const response = await fetchSha256(url, options);
		expect(response.status).toBe(200);
	});

	it("should add hashed body to the headers for multipart/form-data", async () => {
		const url = "https://example.com";
		const body = new FormData();
		body.append(
			"file",
			new Blob(["file content"], { type: "text/plain" }),
			"file.txt",
		);
		body.append("key", "bobs-bananas");
		body.append("mango", "fruit");

		const options = {
			method: "POST",
			url: url,
			body: body,
			headers: {
				"Content-Type":
					"multipart/form-data; boundary=------------------------bananas",
			},
		};

		const response = await fetchSha256(url, options);
		expect(response.status).toBe(200);
	});
});

describe("mutateHeaders", () => {
	it("should add the hashed body to the headers", async () => {
		const headers = {
			"Content-Type": "application/json",
		};
		const body = { key: "bobs-bananas", mango: "fruit" };
		const expectedHash =
			"8a573ca735c107f6545e687ef82913a9f3b50310b7f4c6b013fc4bacf63f11d4";

		const result = await mutateHeaders(headers, body);

		expect(result[AWS_CONTENT_SHA256_HEADER]).toBe(expectedHash);
	});

	it("should support form data", async () => {
		const headers = {
			"Content-Type": "application/x-www-form-urlencoded",
		};
		const body = new URLSearchParams({ key: "bobs-bananas", mango: "fruit" });
		const expectedHash =
			"44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a";

		const result = await mutateHeaders(headers, body);

		expect(result[AWS_CONTENT_SHA256_HEADER]).toBe(expectedHash);
	});

	it("should support file via form data", async () => {
		const headers = {
			"Content-Type":
				"multipart/form-data; boundary=------------------------boundary",
		};
		const body = new FormData();
		body.append(
			"file",
			new Blob(["file content"], { type: "text/plain" }),
			"file.txt",
		);
		body.append("key", "bobs-bananas");
		body.append("mango", "fruit");

		const expectedHash =
			"44136fa355b3678a1146ad16f7e8649e94fb4fc21fe77e8310c060f61caaff8a";

		const result = await mutateHeaders(headers, body);

		expect(result[AWS_CONTENT_SHA256_HEADER]).toBe(expectedHash);
	});

	it("should should transform arraybuffer to string", async () => {
		const buffer = new ArrayBuffer(8);
		const view = new Uint8Array(buffer);
		view.set([72, 101, 108, 108, 111, 44, 32, 87]); // "Hello, W"

		const result = await convertArrayBufferToString(buffer);
		expect(result).toBe("Hello, W");
	});
});

describe("Payloads should be hashed correctly", () => {
	it("should correctly hash a payload to aws requirements", async () => {
		const body = sample;
		expect(await sha256(body)).toBe(
			"db5d58137e631867470d5207be064242ccd7aa6b319cff388ac8679751480372",
		);
	});

	it("should correctly hash an arraybuffer to aws requirements", async () => {
		const body = new TextEncoder().encode(sample).buffer as ArrayBuffer;
		const arrayBufferAsString = await convertArrayBufferToString(body);
		expect(arrayBufferAsString).toBe(sample);
	});

	it("should correctly attach sample data to form data", async () => {
		const formData = new FormData();
		formData.append(
			"file",
			new Blob([sampleWithoutBoundary], { type: "text/csv" }),
			"UGC Onboarding Checklist - Variant Mapping.csv",
		);

		const body = await mutateBody(
			formData,
			"------------------------mwfel5ep4pf",
		);

		expect(body).toBe(sample);
	});

	it("should correctly perform the fetchSha256 operation with form data", async () => {
		// Mock fetchSha256 to simulate the server response
		globalThis.fetch = vi.fn();

		const url = "https://example.com";
		const formData = new FormData();
		formData.append(
			"file",
			new Blob([sampleWithoutBoundary], { type: "text/csv" }),
			"UGC Onboarding Checklist - Variant Mapping.csv",
		);

		const options = {
			method: "POST",
			body: formData,
			credentials: "include",
		} as RequestInit;

		await fetchSha256(url, options, "------------------------mwfel5ep4pf");

		// @ts-expect-error mocking.
		const call = globalThis.fetch.mock.calls[0];
		const headers = call[1].headers as Record<string, string>;
		expect(headers[AWS_CONTENT_SHA256_HEADER]).toBe(
			"db5d58137e631867470d5207be064242ccd7aa6b319cff388ac8679751480372",
		);
	});

	it("should correctly perform the fetchSha256 operation with form data (2)", async () => {
		// Mock fetchSha256 to simulate the server response
		globalThis.fetch = vi.fn();

		const url = "https://example.com";
		const formData = new FormData();
		formData.append(
			"file",
			new Blob([sampleWithoutBoundary], { type: "text/csv" }),
			"UGC Onboarding Checklist - Variant Mapping.csv",
		);

		const options = {
			method: "POST",
			body: formData,
			credentials: "include",
		} as RequestInit;

		await fetchSha256(url, options, "------------------------2rrc673544i");

		// @ts-expect-error mocking.
		const call = globalThis.fetch.mock.calls[0];
		const headers = call[1].headers as Record<string, string>;
		expect(headers[AWS_CONTENT_SHA256_HEADER]).toBe(
			"4d6f611dbbc84e3ae34644ba8fc38efc6a5c3882203ae4eb90ac309c89f232d3",
		);
	});
});
