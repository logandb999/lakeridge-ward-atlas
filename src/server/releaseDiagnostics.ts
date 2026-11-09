export function vercelEnvironmentSaved(exitCode: number | null, output: string): boolean {
  return exitCode === 0 && /(?:Added|Overrode|Updated) Environment Variable\s+CRON_SECRET\b/i.test(output);
}

export function redactReleaseOutput(output: string, secrets: string[]): string {
  let text = output.replace(/\u001b\[[0-9;]*m/g, '');
  for (const secret of secrets.filter(s => s.length >= 8).sort((a, b) => b.length - a.length)) {
    text = text.replaceAll(secret, '[redacted]').replaceAll(encodeURIComponent(secret), '[redacted]');
  }
  text = text.replace(/(https?:\/\/)[^\s/@]+:[^\s/@]+@/g, '$1[redacted]@');
  text = text.replace(/Bearer\s+[A-Za-z0-9._~-]+/gi, 'Bearer [redacted]');
  return text.trim().slice(0, 2500);
}
