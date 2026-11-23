'use client';

import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface JoinQrCodeProps {
  gameCode: string;
}

function buildJoinUrl(gameCode: string): string {
  const base =
    process.env.NEXT_PUBLIC_PUBLIC_URL?.replace(/\/$/, '') ?? window.location.origin;
  return `${base}/play/${encodeURIComponent(gameCode)}`;
}

export default function JoinQrCode({ gameCode }: JoinQrCodeProps) {
  const [joinUrl, setJoinUrl] = useState<string | null>(null);

  useEffect(() => {
    setJoinUrl(gameCode ? buildJoinUrl(gameCode) : null);
  }, [gameCode]);

  if (!joinUrl) {
    return null;
  }

  const isLocalhost = /\/\/(localhost|127\.0\.0\.1)(:|\/|$)/.test(joinUrl);

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50 p-5 dark:border-zinc-700 dark:bg-zinc-800/60">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        Rejoindre en scannant
      </h3>
      <div className="rounded-lg bg-white p-3 shadow-sm">
        <QRCodeSVG
          value={joinUrl}
          size={176}
          level="M"
          title={`QR code pour rejoindre le salon ${gameCode}`}
        />
      </div>
      <p className="max-w-[16rem] break-all text-center text-xs text-zinc-500 dark:text-zinc-400">
        {joinUrl}
      </p>
      {isLocalhost && (
        <p className="max-w-[16rem] text-center text-xs text-amber-600 dark:text-amber-400">
          Cette adresse est locale : ouvre le site via l&apos;IP du réseau (ou définis
          NEXT_PUBLIC_PUBLIC_URL) pour que les téléphones puissent la joindre.
        </p>
      )}
    </div>
  );
}
