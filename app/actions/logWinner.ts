'use server';

import { promises as fsp } from 'fs';
import path from 'path';

export async function logWinnerAction(_prevState: any, formData: FormData) {
  const roundId = (formData.get('roundId') as string) || '-';
  const winner  = (formData.get('winner')  as string) || '';
  const seed    = (formData.get('seed')    as string) || '';

  if (!winner) {
    return { ok: false, error: 'missing winner' };
  }

  try {
    const logDir = path.join(process.cwd(), 'logs');
    const filePath = path.join(logDir, 'winners.txt');
    const line = `${new Date().toISOString()} | Round ${roundId} | SimWinner: ${winner} | seed=${seed}\n`;

    await fsp.mkdir(logDir, { recursive: true });
    await fsp.appendFile(filePath, line, 'utf-8');

    return { ok: true, file: filePath };
  } catch (e: any) {
    return { ok: false, error: e?.message || 'write_failed' };
  }
}
