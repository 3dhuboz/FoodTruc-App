/**
 * Health check endpoint — used by ChowBox Pi to detect cloud connectivity.
 * Returns a simple JSON response. Pi pings this every 30s.
 */
export const onRequest = async () => {
  return new Response(JSON.stringify({ ok: true, service: 'chownow-cloud', time: new Date().toISOString() }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
};
