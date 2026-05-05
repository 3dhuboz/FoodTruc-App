/**
 * POST /api/v1/admin/fleet/:id — Send command to a ChowBox device
 * Super-admin endpoint. Commands are queued and delivered via next heartbeat.
 * Requires ADMIN_API_KEY.
 */
import { getDB } from '../../_lib/db';
import { requireAdminKey } from '../../_lib/auth';

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

  const denied = requireAdminKey(request, env);
  if (denied) return denied;

  try {
    const db = getDB(env);
    const data = await request.json();
    const { command } = data as { command?: string };

    // `update` (no version) does a `git pull origin main` on the Pi which
    // is exactly the fleet-bricking risk we want to avoid. Force an explicit
    // version pin: e.g. `update:v1.4.2`. The Pi resolves this to a signed
    // git tag checkout. Other commands stay as-is.
    const staticCommands = ['pause_qr_orders', 'resume_qr_orders', 'reload_menu', 'restart'];
    const versionedUpdate = /^update:v\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?$/;
    const isValid = !!command && (staticCommands.includes(command) || versionedUpdate.test(command));
    if (!isValid) {
      return json({
        error: 'Invalid command',
        accepted: [...staticCommands, 'update:vMAJOR.MINOR.PATCH'],
        note: 'Bare `update` is rejected — pin a tag.',
      }, 400);
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
