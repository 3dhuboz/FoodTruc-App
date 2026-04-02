/**
 * POST /api/v1/print/order
 * Cloud stub — printing only works on the Pi server.
 * Returns gracefully so the BOH doesn't error when running in cloud mode.
 */
export const onRequest = async (context: any) => {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'POST,OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type' },
    });
  }

  // Cloud mode — no physical printer available
  return new Response(JSON.stringify({
    printed: false,
    reason: 'Printing is only available on the ChowBox (Pi server). Connect a USB thermal printer to your ChowBox to enable order labels.',
  }), {
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
};
