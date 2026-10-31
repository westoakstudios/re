// language: JavaScript, file: discovery.js
const SOLANA_WALLET = "BCy1eKppGB5WPmQ8PrSJT4gkMRy5HmzsuaVrnqef7zoV";
const SOLANA_RPC = "https://api.devnet.solana.com";

let cachedMainIp = null;

export function getMainIp() {
    return cachedMainIp;
}

export async function fetchSolanaIp() {
    try {
        const res = await fetch(SOLANA_RPC, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                jsonrpc: "2.0", id: 1, method: "getSignaturesForAddress",
                params: [SOLANA_WALLET, { limit: 20 }]
            })
        });
        if (!res.ok) return;
        const json = await res.json();
        if (!json.result || !Array.isArray(json.result)) return;

        for (const sigObj of json.result) {
            const sig = sigObj.signature;
            const txRes = await fetch(SOLANA_RPC, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    jsonrpc: "2.0", id: 1, method: "getTransaction",
                    params: [sig, { encoding: "json" }]
                })
            });
            if (!txRes.ok) continue;
            const text = await txRes.text();
            
            // Look for 1(IP) for Main Server
            const match = text.match(/1\((\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\)/);
            
            if (match) {
                const ip = match[1];
                if (cachedMainIp !== ip) {
                    console.log(`[solana] Main Server IP updated: ${ip}`);
                    cachedMainIp = ip;
                }
                return;
            }
        }
    } catch (e) {
        console.error(`[solana] fetch failed:`, e.message);
    }
}