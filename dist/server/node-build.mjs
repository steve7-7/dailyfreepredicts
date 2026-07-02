import path from "node:path";
import "dotenv/config";
import * as express$1 from "express";
import express from "express";
import cors from "cors";
import { createHmac, timingSafeEqual } from "node:crypto";
import * as fs from "fs";
import * as path$1 from "path";
//#region server/routes/demo.ts
var handleDemo = (req, res) => {
	res.status(200).json({ message: "Hello from Express server" });
};
//#endregion
//#region server/routes/auth.ts
var TOKEN_VERSION = 1;
var TOKEN_TTL_MS = Number(process.env.SUBSCRIPTION_TOKEN_TTL_MS || 720 * 60 * 60 * 1e3);
function getSubscriptionToken(req) {
	const authorization = req.headers.authorization;
	if (!authorization?.startsWith("Bearer ")) return;
	return authorization.slice(7).trim() || void 0;
}
function getTokenSecret() {
	return process.env.SUBSCRIPTION_TOKEN_SECRET || process.env.PAYSTACK_SECRET_KEY;
}
function base64UrlEncode(value) {
	return Buffer.from(value, "utf8").toString("base64url");
}
function base64UrlDecode(value) {
	return Buffer.from(value, "base64url").toString("utf8");
}
function signPayload(encodedPayload, secret) {
	return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}
function createSubscriptionToken(payload) {
	const secret = getTokenSecret();
	if (!secret) throw new Error("SUBSCRIPTION_TOKEN_SECRET or PAYSTACK_SECRET_KEY is required to issue access tokens");
	const encodedPayload = base64UrlEncode(JSON.stringify(payload));
	return `${encodedPayload}.${signPayload(encodedPayload, secret)}`;
}
function verifySubscriptionToken(token) {
	const secret = getTokenSecret();
	if (!secret) return;
	const [encodedPayload, signature, ...extraParts] = token.split(".");
	if (!encodedPayload || !signature || extraParts.length > 0) return;
	const expectedSignature = signPayload(encodedPayload, secret);
	const signatureBuffer = Buffer.from(signature, "base64url");
	const expectedSignatureBuffer = Buffer.from(expectedSignature, "base64url");
	if (signatureBuffer.length !== expectedSignatureBuffer.length || !timingSafeEqual(signatureBuffer, expectedSignatureBuffer)) return;
	try {
		const payload = JSON.parse(base64UrlDecode(encodedPayload));
		if (payload.version !== TOKEN_VERSION || !payload.userId || !payload.paystackReference || typeof payload.expiresAt !== "number" || payload.expiresAt <= Date.now()) return;
		return payload;
	} catch {
		return;
	}
}
function getActiveSubscription(req) {
	const token = getSubscriptionToken(req);
	return token ? verifySubscriptionToken(token) : void 0;
}
function hasActiveSubscription(req) {
	return !!getActiveSubscription(req);
}
async function verifyPaystackReference(reference) {
	const paystackSecretKey = process.env.PAYSTACK_SECRET_KEY;
	if (!paystackSecretKey) throw new Error("PAYSTACK_SECRET_KEY is required to verify subscription payments");
	const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, { headers: { Authorization: `Bearer ${paystackSecretKey}` } });
	const result = await response.json();
	if (!response.ok || !result.status || result.data?.status !== "success") throw new Error(result.message || "Payment verification failed");
	const expectedCurrency = process.env.PAYSTACK_CURRENCY;
	if (expectedCurrency && result.data.currency !== expectedCurrency) throw new Error("Payment currency does not match the configured subscription currency");
	const expectedAmount = Number(process.env.PAYSTACK_EXPECTED_AMOUNT_KOBO || 0);
	if (expectedAmount > 0 && result.data.amount !== expectedAmount) throw new Error("Payment amount does not match the configured subscription price");
	const now = Date.now();
	const customerCode = result.data.customer?.customer_code;
	const email = result.data.customer?.email;
	return {
		version: TOKEN_VERSION,
		userId: customerCode || email || result.data.reference || reference,
		email,
		paystackReference: result.data.reference || reference,
		issuedAt: now,
		expiresAt: now + TOKEN_TTL_MS
	};
}
var handleCheckAuth = (req, res) => {
	const subscription = getActiveSubscription(req);
	const response = {
		isSubscribed: !!subscription,
		userId: subscription?.userId,
		email: subscription?.email
	};
	res.json(response);
};
var handleVerifySubscription = async (req, res) => {
	const reference = typeof req.body?.reference === "string" ? req.body.reference.trim() : "";
	if (!reference) {
		res.status(400).json({ error: "Payment reference is required" });
		return;
	}
	try {
		const subscription = await verifyPaystackReference(reference);
		const response = {
			token: createSubscriptionToken(subscription),
			isSubscribed: true,
			userId: subscription.userId,
			email: subscription.email,
			expiresAt: new Date(subscription.expiresAt).toISOString()
		};
		res.json(response);
	} catch (error) {
		console.error("Error verifying Paystack subscription:", error);
		res.status(401).json({ error: error instanceof Error ? error.message : "Unable to verify subscription payment" });
	}
};
//#endregion
//#region shared/api.ts
/**
* Error codes for API responses
*/
var ApiErrorCode = /* @__PURE__ */ function(ApiErrorCode) {
	ApiErrorCode["API_KEY_MISSING"] = "API_KEY_MISSING";
	ApiErrorCode["API_AUTH_FAILED"] = "API_AUTH_FAILED";
	ApiErrorCode["RATE_LIMITED"] = "RATE_LIMITED";
	ApiErrorCode["INVALID_RESPONSE"] = "INVALID_RESPONSE";
	ApiErrorCode["NETWORK_ERROR"] = "NETWORK_ERROR";
	ApiErrorCode["FETCH_FAILED"] = "FETCH_FAILED";
	ApiErrorCode["JSON_PARSE_ERROR"] = "JSON_PARSE_ERROR";
	return ApiErrorCode;
}({});
//#endregion
//#region server/routes/predictions.ts
var cache$2 = /* @__PURE__ */ new Map();
var pendingRequests$2 = /* @__PURE__ */ new Map();
var CACHE_TTL$2 = 300 * 1e3;
function redactPredictionForVisitor(match) {
	return {
		id: match.id,
		home_team: match.home_team,
		away_team: match.away_team
	};
}
var sleep$3 = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function fetchWithRetry$3(url, options, maxRetries = 5) {
	for (let attempt = 0; attempt < maxRetries; attempt++) try {
		const response = await fetch(url, options);
		if (response.status === 429) {
			const retryAfter = response.headers.get("retry-after");
			const waitTime = retryAfter ? parseInt(retryAfter) * 1e3 : Math.pow(2, attempt + 1) * 1e3;
			console.warn(`Rate limited. Waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
			if (attempt < maxRetries - 1) {
				await sleep$3(waitTime);
				continue;
			}
		}
		return response;
	} catch (error) {
		if (attempt < maxRetries - 1) {
			const waitTime = Math.pow(2, attempt + 1) * 1e3;
			console.warn(`Fetch failed, retrying in ${waitTime}ms:`, error);
			await sleep$3(waitTime);
			continue;
		}
		throw error;
	}
	throw new Error("Max retries exceeded");
}
var handlePredictions = async (req, res) => {
	const isSubscribed = hasActiveSubscription(req);
	const cacheKey = `predictions:${isSubscribed}`;
	const cached = cache$2.get(cacheKey);
	if (cached && Date.now() - cached.timestamp < cached.ttl) {
		console.log("Returning cached predictions");
		return res.json(cached.data);
	}
	const pending = pendingRequests$2.get(cacheKey);
	if (pending) {
		console.log("[Predictions] Waiting for in-flight prediction request");
		try {
			const data = await pending.promise;
			return res.json(data);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			console.error("[Predictions] Pending request failed:", errorMessage);
			const errorResponse = {
				error: "Failed to fetch predictions",
				code: ApiErrorCode.FETCH_FAILED,
				details: errorMessage,
				retryable: true
			};
			return res.status(500).json(errorResponse);
		}
	}
	const url = "https://football-prediction-api.p.rapidapi.com/api/v2/predictions?market=classic";
	const apiKey = process.env.RAPIDAPI_KEY || process.env.PREDICTIONS_KEY;
	if (!apiKey) {
		console.error("[Predictions] API key not configured - RAPIDAPI_KEY or PREDICTIONS_KEY missing");
		const errorResponse = {
			error: "API configuration error",
			code: ApiErrorCode.API_KEY_MISSING,
			details: "Server is missing required API credentials. Please contact support.",
			retryable: false
		};
		return res.status(500).json(errorResponse);
	}
	const options = {
		method: "GET",
		headers: {
			"x-rapidapi-key": apiKey,
			"x-rapidapi-host": "football-prediction-api.p.rapidapi.com",
			"Content-Type": "application/json"
		}
	};
	const requestPromise = (async () => {
		try {
			console.log("[Predictions] Fetching predictions from RapidAPI...");
			const response = await fetchWithRetry$3(url, options);
			if (!response.ok) {
				const errorText = await response.text();
				console.error(`[Predictions] API Error: ${response.status} ${response.statusText}`, errorText);
				if (response.status === 403) {
					const error = /* @__PURE__ */ new Error("API_AUTH_FAILED");
					error.code = ApiErrorCode.API_AUTH_FAILED;
					error.retryable = false;
					throw error;
				}
				if (response.status === 429) {
					const retryAfter = response.headers.get("retry-after");
					const error = /* @__PURE__ */ new Error("RATE_LIMITED");
					error.code = ApiErrorCode.RATE_LIMITED;
					error.retryable = true;
					error.retryAfter = retryAfter ? parseInt(retryAfter) : 60;
					throw error;
				}
				const error = /* @__PURE__ */ new Error(`API Error: ${response.statusText}`);
				error.code = ApiErrorCode.FETCH_FAILED;
				error.retryable = true;
				throw error;
			}
			let data;
			try {
				data = await response.json();
			} catch (parseError) {
				console.error("[Predictions] Failed to parse API response as JSON:", parseError);
				const error = /* @__PURE__ */ new Error("INVALID_RESPONSE");
				error.code = ApiErrorCode.INVALID_RESPONSE;
				error.retryable = false;
				throw error;
			}
			console.log("[Predictions] Fetched successfully, processing data");
			let responseData;
			if (!isSubscribed && Array.isArray(data.data)) responseData = {
				...data,
				data: data.data.map(redactPredictionForVisitor),
				isSubscribed: false
			};
			else responseData = {
				...data,
				isSubscribed
			};
			cache$2.set(cacheKey, {
				data: responseData,
				timestamp: Date.now(),
				ttl: CACHE_TTL$2
			});
			return responseData;
		} catch (error) {
			const errorCode = error?.code || ApiErrorCode.FETCH_FAILED;
			const retryable = error?.retryable ?? true;
			const retryAfter = error?.retryAfter;
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			console.error(`[Predictions] Request failed with code ${errorCode}:`, errorMessage);
			const enrichedError = new Error(errorMessage);
			enrichedError.code = errorCode;
			enrichedError.retryable = retryable;
			if (retryAfter) enrichedError.retryAfter = retryAfter;
			throw enrichedError;
		} finally {
			pendingRequests$2.delete(cacheKey);
		}
	})();
	pendingRequests$2.set(cacheKey, { promise: requestPromise });
	try {
		const data = await requestPromise;
		res.json(data);
	} catch (error) {
		const errorCode = error?.code || ApiErrorCode.FETCH_FAILED;
		const retryable = error?.retryable ?? true;
		const retryAfter = error?.retryAfter;
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		console.error(`[Predictions] Request failed:`, {
			code: errorCode,
			retryable,
			message: errorMessage
		});
		let statusCode = 500;
		if (errorCode === ApiErrorCode.API_AUTH_FAILED) statusCode = 403;
		if (errorCode === ApiErrorCode.RATE_LIMITED) statusCode = 429;
		const errorResponse = {
			error: getErrorMessage$1(errorCode),
			code: errorCode,
			details: errorMessage,
			retryable,
			...retryAfter && { retryAfter }
		};
		res.status(statusCode).json(errorResponse);
	}
};
/**
* Get user-friendly error message based on error code
*/
function getErrorMessage$1(code) {
	switch (code) {
		case ApiErrorCode.API_KEY_MISSING: return "API configuration error";
		case ApiErrorCode.API_AUTH_FAILED: return "API authentication failed";
		case ApiErrorCode.RATE_LIMITED: return "Too many requests";
		case ApiErrorCode.INVALID_RESPONSE: return "Invalid API response format";
		case ApiErrorCode.NETWORK_ERROR: return "Network error";
		case ApiErrorCode.FETCH_FAILED: return "Failed to fetch predictions";
		case ApiErrorCode.JSON_PARSE_ERROR: return "Failed to parse response";
		default: return "An error occurred";
	}
}
//#endregion
//#region server/routes/performance-stats.ts
var sleep$2 = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function fetchWithRetry$2(url, options, maxRetries = 3) {
	for (let attempt = 0; attempt < maxRetries; attempt++) try {
		const response = await fetch(url, options);
		if (response.status === 429) {
			const retryAfter = response.headers.get("retry-after");
			const waitTime = retryAfter ? parseInt(retryAfter) * 1e3 : Math.pow(2, attempt) * 1e3;
			console.warn(`Rate limited. Waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
			if (attempt < maxRetries - 1) {
				await sleep$2(waitTime);
				continue;
			}
		}
		return response;
	} catch (error) {
		if (attempt < maxRetries - 1) {
			const waitTime = Math.pow(2, attempt) * 1e3;
			console.warn(`Fetch failed, retrying in ${waitTime}ms:`, error);
			await sleep$2(waitTime);
			continue;
		}
		throw error;
	}
	throw new Error("Max retries exceeded");
}
var handlePerformanceStats = async (req, res) => {
	const market = req.query.market || "classic";
	const apiKey = process.env.RAPIDAPI_KEY || process.env.PREDICTIONS_KEY;
	if (!apiKey) {
		console.error("API key not configured");
		return res.status(500).json({
			error: "API key not configured",
			details: "RAPIDAPI_KEY or PREDICTIONS_KEY environment variable is missing"
		});
	}
	const url = `https://football-prediction-api.p.rapidapi.com/api/v2/performance-stats?market=${market}`;
	const options = {
		method: "GET",
		headers: {
			"x-rapidapi-key": apiKey,
			"x-rapidapi-host": "football-prediction-api.p.rapidapi.com",
			"Content-Type": "application/json"
		}
	};
	try {
		console.log(`Fetching performance stats from: ${url}`);
		const response = await fetchWithRetry$2(url, options);
		if (!response.ok) {
			const errorText = await response.text();
			console.error(`API Error: ${response.status} ${response.statusText}`, errorText);
			if (response.status === 403) return res.status(403).json({
				error: "API authentication failed",
				details: "Invalid or expired API key"
			});
			return res.status(response.status).json({
				error: `Failed to fetch performance stats: ${response.statusText}`,
				status: response.status
			});
		}
		const data = await response.json();
		console.log("Performance stats fetched successfully");
		res.json(data);
	} catch (error) {
		console.error("Error fetching performance stats:", error);
		res.status(500).json({
			error: "Failed to fetch performance stats",
			details: error instanceof Error ? error.message : "Unknown error"
		});
	}
};
//#endregion
//#region server/routes/fixture-ids.ts
var handleFixtureIds = async (req, res) => {
	const url = "https://football-prediction-api.p.rapidapi.com/api/v2/get-list-of-fixture-ids";
	const options = {
		method: "GET",
		headers: {
			"x-rapidapi-key": process.env.RAPIDAPI_KEY || "",
			"x-rapidapi-host": "football-prediction-api.p.rapidapi.com",
			"Content-Type": "application/json"
		}
	};
	try {
		const data = await (await fetch(url, options)).json();
		res.json(data);
	} catch (error) {
		console.error("Error fetching fixture IDs:", error);
		res.status(500).json({ error: "Failed to fetch fixture IDs" });
	}
};
//#endregion
//#region server/routes/past-predictions.ts
var cache$1 = /* @__PURE__ */ new Map();
var pendingRequests$1 = /* @__PURE__ */ new Map();
var CACHE_TTL$1 = 600 * 1e3;
var sleep$1 = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function fetchWithRetry$1(url, options, maxRetries = 5) {
	for (let attempt = 0; attempt < maxRetries; attempt++) try {
		const response = await fetch(url, options);
		if (response.status === 429) {
			const retryAfter = response.headers.get("retry-after");
			const waitTime = retryAfter ? parseInt(retryAfter) * 1e3 : Math.pow(2, attempt + 1) * 1e3;
			console.warn(`Rate limited. Waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
			if (attempt < maxRetries - 1) {
				await sleep$1(waitTime);
				continue;
			}
		}
		return response;
	} catch (error) {
		if (attempt < maxRetries - 1) {
			const waitTime = Math.pow(2, attempt + 1) * 1e3;
			console.warn(`Fetch failed, retrying in ${waitTime}ms:`, error);
			await sleep$1(waitTime);
			continue;
		}
		throw error;
	}
	throw new Error("Max retries exceeded");
}
var handlePastPredictions = async (req, res) => {
	const status = req.query.status || "finished";
	const limit = req.query.limit || "50";
	const cacheKey = `past-predictions:${status}:${limit}`;
	const cached = cache$1.get(cacheKey);
	if (cached && Date.now() - cached.timestamp < cached.ttl) {
		console.log("Returning cached past predictions");
		return res.json(cached.data);
	}
	const pending = pendingRequests$1.get(cacheKey);
	if (pending) {
		console.log("[PastPredictions] Waiting for in-flight request");
		try {
			const data = await pending.promise;
			return res.json(data);
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			console.error("[PastPredictions] Pending request failed:", errorMessage);
			const errorResponse = {
				error: "Failed to fetch past predictions",
				code: ApiErrorCode.FETCH_FAILED,
				details: errorMessage,
				retryable: true
			};
			return res.status(500).json(errorResponse);
		}
	}
	const url = `https://football-prediction-api.p.rapidapi.com/api/v2/predictions?status=${status}&limit=${limit}&market=classic`;
	const apiKey = process.env.RAPIDAPI_KEY || process.env.PREDICTIONS_KEY;
	if (!apiKey) {
		console.error("[PastPredictions] API key not configured - RAPIDAPI_KEY or PREDICTIONS_KEY missing");
		const errorResponse = {
			error: "API configuration error",
			code: ApiErrorCode.API_KEY_MISSING,
			details: "Server is missing required API credentials. Please contact support.",
			retryable: false
		};
		return res.status(500).json(errorResponse);
	}
	const options = {
		method: "GET",
		headers: {
			"x-rapidapi-key": apiKey,
			"x-rapidapi-host": "football-prediction-api.p.rapidapi.com",
			"Content-Type": "application/json"
		}
	};
	const requestPromise = (async () => {
		try {
			console.log(`[PastPredictions] Fetching from: ${url}`);
			const response = await fetchWithRetry$1(url, options);
			if (!response.ok) {
				const errorText = await response.text();
				console.error(`[PastPredictions] API Error: ${response.status} ${response.statusText}`, errorText);
				if (response.status === 403) {
					const error = /* @__PURE__ */ new Error("API_AUTH_FAILED");
					error.code = ApiErrorCode.API_AUTH_FAILED;
					error.retryable = false;
					throw error;
				}
				if (response.status === 429) {
					const retryAfter = response.headers.get("retry-after");
					const error = /* @__PURE__ */ new Error("RATE_LIMITED");
					error.code = ApiErrorCode.RATE_LIMITED;
					error.retryable = true;
					error.retryAfter = retryAfter ? parseInt(retryAfter) : 60;
					throw error;
				}
				const error = /* @__PURE__ */ new Error(`API Error: ${response.statusText}`);
				error.code = ApiErrorCode.FETCH_FAILED;
				error.retryable = true;
				throw error;
			}
			let data;
			try {
				data = await response.json();
			} catch (parseError) {
				console.error("[PastPredictions] Failed to parse API response as JSON:", parseError);
				const error = /* @__PURE__ */ new Error("INVALID_RESPONSE");
				error.code = ApiErrorCode.INVALID_RESPONSE;
				error.retryable = false;
				throw error;
			}
			console.log("[PastPredictions] Fetched successfully, caching data");
			cache$1.set(cacheKey, {
				data,
				timestamp: Date.now(),
				ttl: CACHE_TTL$1
			});
			return data;
		} catch (error) {
			const errorCode = error?.code || ApiErrorCode.FETCH_FAILED;
			const retryable = error?.retryable ?? true;
			const retryAfter = error?.retryAfter;
			const errorMessage = error instanceof Error ? error.message : "Unknown error";
			console.error(`[PastPredictions] Request failed with code ${errorCode}:`, errorMessage);
			const enrichedError = new Error(errorMessage);
			enrichedError.code = errorCode;
			enrichedError.retryable = retryable;
			if (retryAfter) enrichedError.retryAfter = retryAfter;
			throw enrichedError;
		} finally {
			pendingRequests$1.delete(cacheKey);
		}
	})();
	pendingRequests$1.set(cacheKey, { promise: requestPromise });
	try {
		const data = await requestPromise;
		res.json(data);
	} catch (error) {
		const errorCode = error?.code || ApiErrorCode.FETCH_FAILED;
		const retryable = error?.retryable ?? true;
		const retryAfter = error?.retryAfter;
		const errorMessage = error instanceof Error ? error.message : "Unknown error";
		console.error(`[PastPredictions] Request failed:`, {
			code: errorCode,
			retryable,
			message: errorMessage
		});
		let statusCode = 500;
		if (errorCode === ApiErrorCode.API_AUTH_FAILED) statusCode = 403;
		if (errorCode === ApiErrorCode.RATE_LIMITED) statusCode = 429;
		const errorResponse = {
			error: getErrorMessage(errorCode),
			code: errorCode,
			details: errorMessage,
			retryable,
			...retryAfter && { retryAfter }
		};
		res.status(statusCode).json(errorResponse);
	}
};
/**
* Get user-friendly error message based on error code
*/
function getErrorMessage(code) {
	switch (code) {
		case ApiErrorCode.API_KEY_MISSING: return "API configuration error";
		case ApiErrorCode.API_AUTH_FAILED: return "API authentication failed";
		case ApiErrorCode.RATE_LIMITED: return "Too many requests";
		case ApiErrorCode.INVALID_RESPONSE: return "Invalid API response format";
		case ApiErrorCode.NETWORK_ERROR: return "Network error";
		case ApiErrorCode.FETCH_FAILED: return "Failed to fetch past predictions";
		case ApiErrorCode.JSON_PARSE_ERROR: return "Failed to parse response";
		default: return "An error occurred";
	}
}
//#endregion
//#region server/routes/betigolo-history.ts
var cache = /* @__PURE__ */ new Map();
var pendingRequests = /* @__PURE__ */ new Map();
var CACHE_TTL = 600 * 1e3;
var sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
async function fetchWithRetry(url, options, maxRetries = 5) {
	for (let attempt = 0; attempt < maxRetries; attempt++) try {
		const response = await fetch(url, options);
		if (response.status === 429) {
			const retryAfter = response.headers.get("retry-after");
			const waitTime = retryAfter ? parseInt(retryAfter) * 1e3 : Math.pow(2, attempt + 1) * 1e3;
			console.warn(`Rate limited. Waiting ${waitTime}ms before retry ${attempt + 1}/${maxRetries}`);
			if (attempt < maxRetries - 1) {
				await sleep(waitTime);
				continue;
			}
		}
		return response;
	} catch (error) {
		if (attempt < maxRetries - 1) {
			const waitTime = Math.pow(2, attempt + 1) * 1e3;
			console.warn(`Fetch failed, retrying in ${waitTime}ms:`, error);
			await sleep(waitTime);
			continue;
		}
		throw error;
	}
	throw new Error("Max retries exceeded");
}
var handleBetigoloHistory = async (req, res) => {
	const cacheKey = "betigolo-history";
	const cached = cache.get(cacheKey);
	if (cached && Date.now() - cached.timestamp < cached.ttl) {
		console.log("Returning cached betigolo history");
		return res.json(cached.data);
	}
	const pending = pendingRequests.get(cacheKey);
	if (pending) {
		console.log("Waiting for in-flight betigolo history request");
		try {
			const data = await pending.promise;
			return res.json(data);
		} catch (error) {
			return res.status(500).json({
				error: "Failed to fetch betigolo history",
				details: error instanceof Error ? error.message : "Unknown error"
			});
		}
	}
	const url = "https://betigolo-tips.p.rapidapi.com/premium/history";
	const apiKey = process.env.RAPIDAPI_KEY || process.env.PREDICTIONS_KEY;
	if (!apiKey) {
		console.error("API key not configured");
		return res.status(500).json({
			error: "API key not configured",
			details: "RAPIDAPI_KEY or PREDICTIONS_KEY environment variable is missing"
		});
	}
	const options = {
		method: "GET",
		headers: {
			"x-rapidapi-key": apiKey,
			"x-rapidapi-host": "betigolo-tips.p.rapidapi.com",
			"Content-Type": "application/json"
		}
	};
	const requestPromise = (async () => {
		try {
			console.log(`Fetching betigolo history from: ${url}`);
			const response = await fetchWithRetry(url, options);
			if (!response.ok) {
				const errorText = await response.text();
				console.error(`API Error: ${response.status} ${response.statusText}`, errorText);
				if (response.status === 403) throw new Error("API authentication failed: Invalid or expired API key");
				throw new Error(`Failed to fetch betigolo history: ${response.statusText}`);
			}
			const data = await response.json();
			console.log("Betigolo history fetched successfully");
			cache.set(cacheKey, {
				data,
				timestamp: Date.now(),
				ttl: CACHE_TTL
			});
			return data;
		} finally {
			pendingRequests.delete(cacheKey);
		}
	})();
	pendingRequests.set(cacheKey, { promise: requestPromise });
	try {
		const data = await requestPromise;
		res.json(data);
	} catch (error) {
		console.error("Error fetching betigolo history:", error);
		res.status(500).json({
			error: "Failed to fetch betigolo history",
			details: error instanceof Error ? error.message : "Unknown error"
		});
	}
};
//#endregion
//#region server/routes/betminer-accumulators.ts
var CACHE_DIR = path$1.join(process.cwd(), ".cache");
var CACHE_FILE = path$1.join(CACHE_DIR, "betminer-accumulators.json");
var CACHE_DURATION_MS = 1440 * 60 * 1e3 / 5;
function ensureCacheDir() {
	if (!fs.existsSync(CACHE_DIR)) fs.mkdirSync(CACHE_DIR, { recursive: true });
}
function getCachedData() {
	try {
		if (fs.existsSync(CACHE_FILE)) {
			const content = fs.readFileSync(CACHE_FILE, "utf-8");
			const cache = JSON.parse(content);
			const age = Date.now() - cache.timestamp;
			if (age < CACHE_DURATION_MS) {
				console.log(`Using cached data (${Math.round(age / 1e3 / 60)} minutes old)`);
				return cache.data;
			}
		}
	} catch (error) {
		console.error("Error reading cache:", error);
	}
	return null;
}
function saveCacheData(data) {
	try {
		ensureCacheDir();
		const cache = {
			timestamp: Date.now(),
			data
		};
		fs.writeFileSync(CACHE_FILE, JSON.stringify(cache, null, 2));
		console.log("Cache saved successfully");
	} catch (error) {
		console.error("Error saving cache:", error);
	}
}
async function fetchFromBetminer() {
	const apiKey = process.env.RAPIDAPI_KEY;
	if (!apiKey) throw new Error("RAPIDAPI_KEY environment variable is not set");
	const date = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
	const url = `https://betminer.p.rapidapi.com/bm/v3/accumulators/${date}`;
	const options = {
		method: "GET",
		headers: {
			"x-rapidapi-key": apiKey,
			"x-rapidapi-host": "betminer.p.rapidapi.com",
			"Content-Type": "application/json"
		}
	};
	console.log(`Fetching betminer accumulators for ${date}`);
	const response = await fetch(url, options);
	if (!response.ok) {
		await response.text();
		throw new Error(`Betminer API error ${response.status}: ${response.statusText}`);
	}
	return await response.json();
}
var handleBetminerAccumulators = async (req, res) => {
	try {
		let data = getCachedData();
		if (!data) {
			console.log("Cache expired or not found, fetching new data...");
			data = await fetchFromBetminer();
			saveCacheData(data);
		}
		res.json({
			data,
			cached: data ? true : false,
			cacheExpiry: new Date(Date.now() + CACHE_DURATION_MS).toISOString()
		});
	} catch (error) {
		console.error("Error fetching betminer accumulators:", error);
		res.status(500).json({
			error: "Failed to fetch betminer accumulators",
			details: error instanceof Error ? error.message : "Unknown error"
		});
	}
};
var handleClearBetminerCache = async (req, res) => {
	try {
		if (fs.existsSync(CACHE_FILE)) {
			fs.unlinkSync(CACHE_FILE);
			console.log("Cache cleared");
		}
		res.json({ message: "Cache cleared successfully" });
	} catch (error) {
		console.error("Error clearing cache:", error);
		res.status(500).json({
			error: "Failed to clear cache",
			details: error instanceof Error ? error.message : "Unknown error"
		});
	}
};
//#endregion
//#region server/index.ts
function createServer() {
	const app = express();
	app.use(cors());
	app.use(express.json());
	app.use(express.urlencoded({ extended: true }));
	app.get("/api/ping", (_req, res) => {
		const ping = process.env.PING_MESSAGE ?? "ping";
		res.json({ message: ping });
	});
	app.get("/api/debug/env", (_req, res) => {
		res.json({
			hasApiKey: !!process.env.RAPIDAPI_KEY,
			nodeEnv: "production",
			timestamp: (/* @__PURE__ */ new Date()).toISOString()
		});
	});
	app.get("/api/auth", handleCheckAuth);
	app.post("/api/auth/verify", handleVerifySubscription);
	app.get("/api/demo", handleDemo);
	app.get("/api/predictions", handlePredictions);
	app.get("/api/performance-stats", handlePerformanceStats);
	app.get("/api/fixture-ids", handleFixtureIds);
	app.get("/api/past-predictions", handlePastPredictions);
	app.get("/api/betigolo-history", handleBetigoloHistory);
	app.get("/api/betminer-accumulators", handleBetminerAccumulators);
	app.post("/api/cache/clear", handleClearBetminerCache);
	return app;
}
//#endregion
//#region server/node-build.ts
var app = createServer();
var port = process.env.PORT || 3e3;
var __dirname = import.meta.dirname;
var distPath = path.join(__dirname, "../spa");
app.use(express$1.static(distPath));
app.get("*", (req, res) => {
	if (req.path.startsWith("/api/") || req.path.startsWith("/health")) return res.status(404).json({ error: "API endpoint not found" });
	res.sendFile(path.join(distPath, "index.html"));
});
app.listen(port, () => {
	console.log(`🚀 Fusion Starter server running on port ${port}`);
	console.log(`📱 Frontend: http://localhost:${port}`);
	console.log(`🔧 API: http://localhost:${port}/api`);
});
process.on("SIGTERM", () => {
	console.log("🛑 Received SIGTERM, shutting down gracefully");
	process.exit(0);
});
process.on("SIGINT", () => {
	console.log("🛑 Received SIGINT, shutting down gracefully");
	process.exit(0);
});
//#endregion
export {};

//# sourceMappingURL=node-build.mjs.map