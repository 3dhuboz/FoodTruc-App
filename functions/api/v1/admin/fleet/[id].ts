/**
 * POST /api/v1/admin/fleet/:id — Send command to a ChowBox device
 * Super-admin endpoint. Commands are queued and delivered via next heartbeat.
 */
import { getDB } from '../../_lib/db';

const json = (d: any, s = 200) => new Response(JSON.stringify(d), {
  status: s,
  headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
});

export const onRequest = async (context: any) => {
  const { request, env, params } = context;
  const deviceId = params.id;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    });
  }

  if (request.method !== 'POST') return json({ error: 'Method not allowed' }, 405);

  try {
    const db = getDB(env);
    const data = await request.json();
    const { command } = data;

    const validCommands = ['pause_qr_orders', 'resume_qr_orders', 'reload_menu', 'restart', 'update'];
    if (!command || !validCommands.includes(command)) {
      return json({ error: `Invalid command. Valid: ${validCommands.join(', ')}` }, 400);
    }

    // Get existing pending commands
    const device = await db.prepare('SELECT pending_commands FROM chowbox_devices WHERE id = ?').bind(deviceId).first<{ pending_commands: string | null }>();
    if (!device) return json({ error: 'Device not found' }, 404);

    let commands: string[] = [];
    try { commands = JSON.parse(device.pending_commands || '[]'); } catch {}
    if (!commands.includes(command)) commands.push(command);

    await db.prepare('UPDATE chowbox_devices SET pending_commands = ? WHERE id = ?')
      .bind(JSON.stringify(commands), deviceId).run();

    return json({ queued: true, command, deviceId });
  } catch (err: any) {
    return json({ error: err.message || 'Internal Server Error' }, 500);
  }
};
