import { ProxyAgent } from 'undici';

// Corporate network proxy support
console.log('🔍 DEBUG: Checking proxy environment variables:');
console.log('  http_proxy:', process.env.http_proxy);
console.log('  https_proxy:', process.env.https_proxy);
console.log('  HTTP_PROXY:', process.env.HTTP_PROXY);
console.log('  HTTPS_PROXY:', process.env.HTTPS_PROXY);

const proxyUrl = process.env.https_proxy || process.env.HTTPS_PROXY || process.env.http_proxy || process.env.HTTP_PROXY;

let proxyAgent: ProxyAgent | undefined;

if (proxyUrl) {
  try {
    // ProxyAgent v6 API: first param is proxy URL string, second is options
    proxyAgent = new ProxyAgent(proxyUrl);
    console.log(`✅ HTTP client configured with proxy: ${proxyUrl}`);
  } catch (error: any) {
    console.error(`❌ Failed to create ProxyAgent:`, error.message);
    console.log('   Continuing without proxy (will likely fail in corporate network)');
  }
} else {
  console.log('⚠️  NO PROXY DETECTED - fetch will fail in corporate network!');
  console.log('   Set http_proxy or https_proxy environment variable');
}

// Custom fetch that respects proxy
export async function fetchWithProxy(url: string | URL, init?: RequestInit): Promise<Response> {
  const options = { ...init };

  if (proxyAgent) {
    console.log(`🔌 Fetching via proxy (${proxyUrl}): ${url}`);
    (options as any).dispatcher = proxyAgent;
  } else {
    console.log(`🌐 Fetching directly (no proxy): ${url}`);
  }

  try {
    const response = await fetch(url, options);
    console.log(`✅ Fetch OK: ${url} → ${response.status}`);
    return response;
  } catch (error: any) {
    console.error(`❌ Fetch FAILED: ${url}`);
    console.error(`   Error: ${error.message}`);
    console.error(`   Code: ${error.code || 'N/A'}`);
    if (error.cause) {
      console.error(`   Cause: ${error.cause.code || error.cause.message}`);
    }
    throw error;
  }
}
