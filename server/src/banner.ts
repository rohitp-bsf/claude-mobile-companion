import { networkInterfaces } from 'os';

export function printStartupBanner(port: number): void {
    const localUrl = `http://localhost:${port}`;
    const lanIp = getLanIp();
    const lanUrl = lanIp ? `http://${lanIp}:${port}` : null;

    console.log('\n┌─────────────────────────────────────────┐');
    console.log('│     Claude Mobile Companion             │');
    console.log('├─────────────────────────────────────────┤');
    console.log(`│  Local:  ${localUrl.padEnd(30)}│`);
    if (lanUrl) {
        console.log(`│  LAN:    ${lanUrl.padEnd(30)}│`);
    }
    console.log('├─────────────────────────────────────────┤');
    console.log('│  Open the LAN URL on your mobile        │');
    console.log('│  (same WiFi network required)           │');
    console.log('│                                         │');
    console.log('│  For remote access, set up a            │');
    console.log('│  Cloudflare Tunnel (see README)         │');
    console.log('└─────────────────────────────────────────┘\n');

    // Print QR code for LAN URL if available
    if (lanUrl) {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const qrcode = require('qrcode-terminal');
            qrcode.generate(lanUrl, { small: true }, (qr: string) => {
                console.log('  Scan to open on mobile:\n');
                console.log(qr);
            });
        } catch {
            // qrcode-terminal is optional
        }
    }
}

function getLanIp(): string | null {
    const nets = networkInterfaces();
    for (const name of Object.keys(nets)) {
        for (const net of nets[name] || []) {
            if (net.family === 'IPv4' && !net.internal) {
                return net.address;
            }
        }
    }
    return null;
}
