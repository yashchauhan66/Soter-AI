import { generateBrokerToken, BrokerServer } from "./apps/local-ai-broker/src/BrokerServer";
import { scanBrokerRequest, isValidImageWithNoTrailingText } from "./packages/guard-core/src/BrokerScanner";
import * as http from "node:http";
import * as zlib from "node:zlib";

// Create a real valid 300KB PNG
function createRealPng(targetSizeBytes = 300 * 1024) {
    const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

    const width = 500;
    const height = 200;
    const ihdrData = Buffer.alloc(13);
    ihdrData.writeUInt32BE(width, 0);
    ihdrData.writeUInt32BE(height, 4);
    ihdrData[8] = 8; // 8-bit
    ihdrData[9] = 2; // RGB
    ihdrData[10] = 0;
    ihdrData[11] = 0;
    ihdrData[12] = 0;

    function makeChunk(type, data) {
        const len = Buffer.alloc(4);
        len.writeUInt32BE(data.length, 0);
        const typeBuf = Buffer.from(type, "ascii");
        let c = 0xffffffff;
        const toCrc = Buffer.concat([typeBuf, data]);
        for (let i = 0; i < toCrc.length; i++) {
            c ^= toCrc[i];
            for (let k = 0; k < 8; k++) {
                c = (c >>> 1) ^ (c & 1 ? 0xedb88320 : 0);
            }
        }
        const crc = Buffer.alloc(4);
        crc.writeUInt32BE((c ^ 0xffffffff) >>> 0, 0);
        return Buffer.concat([len, typeBuf, data, crc]);
    }

    const ihdrChunk = makeChunk("IHDR", ihdrData);

    const rawScanlines = Buffer.alloc((width * 3 + 1) * height, 0x7a);
    for (let y = 0; y < height; y++) {
        rawScanlines[y * (width * 3 + 1)] = 0;
    }

    const idatData = zlib.deflateSync(rawScanlines, { level: 0 });
    const idatChunk = makeChunk("IDAT", idatData);
    const iendChunk = makeChunk("IEND", Buffer.alloc(0));

    return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const png = createRealPng(300 * 1024);
console.log("Real PNG created, byte length:", png.length);
const dataUrl = `data:image/png;base64,${png.toString("base64")}`;
console.log("Data URL length:", dataUrl.length);
console.log("isValidImageWithNoTrailingText:", isValidImageWithNoTrailingText(png));

async function main() {
    // 1. Direct scanner level
    const body = {
        model: "gpt-4o",
        messages: [
            {
                role: "user",
                content: [
                    { type: "text", text: "Please describe this image." },
                    { type: "image_url", image_url: { url: dataUrl } }
                ]
            }
        ]
    };

    console.log("--- Scanning request with 300KB PNG data-URL ---");
    const t0 = performance.now();
    const scan = await scanBrokerRequest(body);
    const elapsed = performance.now() - t0;
    console.log("Scan decision:", scan.decision);
    console.log("Scan riskScore:", scan.riskScore);
    console.log("Scan categories:", scan.categories);
    console.log(`Scan duration: ${elapsed.toFixed(2)}ms`);

    // 2. Broker-level e2e HTTP test
    console.log("--- Broker-level HTTP test ---");
    let upstreamReceived = false;
    let upstreamBodyLength = 0;
    const upstream = http.createServer((req, res) => {
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => {
            upstreamReceived = true;
            const full = Buffer.concat(chunks).toString("utf8");
            upstreamBodyLength = full.length;
            res.setHeader("Content-Type", "application/json");
            res.end(JSON.stringify({
                id: "chatcmpl-mock",
                choices: [{ message: { role: "assistant", content: "I see a solid gray image." } }]
            }));
        });
    });

    await new Promise((res) => upstream.listen(0, "127.0.0.1", res));
    const upstreamPort = upstream.address().port;

    const dataToken = generateBrokerToken();
    const adminToken = generateBrokerToken();
    const broker = new BrokerServer({
        port: 0,
        token: dataToken,
        adminToken,
        openAIProviderUrl: `http://127.0.0.1:${upstreamPort}/v1/chat/completions`,
        providerApiKey: "mock-key",
    });
    const addr = await broker.start();

    try {
        const res = await fetch(`${addr.url}/v1/chat/completions`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${dataToken}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        console.log("HTTP response status:", res.status);
        console.log("x-soterai-request-decision:", res.headers.get("x-soterai-request-decision"));
        const resJson = await res.json();
        console.log("HTTP response json:", JSON.stringify(resJson).slice(0, 200));
        console.log("Upstream received:", upstreamReceived, "bytes:", upstreamBodyLength);
    } finally {
        await broker.stop();
        upstream.close();
    }
}

main().catch(console.error);
