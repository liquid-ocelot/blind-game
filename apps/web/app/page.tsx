'use client';

import Image from "next/image";
import Link from "next/link";
import { ClientEvents } from "@blindtest/shared";
import { useSocketStore } from "./store/socketStore";
import { clearSocketSession } from "@/lib/socket-session";

const STEPS = [
  {
    icon: "🎛️",
    title: "Crée un salon",
    text: "Choisis le mode (solo ou par équipe), le nombre de manches et le bonus artiste.",
  },
  {
    icon: "📱",
    title: "Invite tes amis",
    text: "Partage le code du salon ou fais scanner le QR code pour les faire entrer.",
  },
  {
    icon: "🎧",
    title: "Devine les morceaux",
    text: "Trouve le titre avant les autres : plus tu réponds vite, plus tu marques de points.",
  },
];

const FEATURES = ["Solo ou par équipe", "Bonus artiste", "Temps réel", "Rejoindre depuis un téléphone"];

export default function Home() {
  const { socket, isConnected } = useSocketStore();

  function createGame() {
    if (socket && isConnected) {
      clearSocketSession();
      socket.emit(ClientEvents.CREATE_GAME);
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-indigo-50 via-white to-white px-6 py-16 font-sans dark:from-indigo-950 dark:via-zinc-950 dark:to-black">
      <main className="flex w-full max-w-3xl flex-col items-center gap-14">
        <section className="flex flex-col items-center gap-6 text-center">
          <Image
            src="/icon.svg"
            alt="The Blind Game"
            width={120}
            height={120}
            priority
            unoptimized
            className="h-28 w-28 rounded-3xl shadow-xl shadow-indigo-500/30 sm:h-32 sm:w-32"
          />

          <div className="flex flex-col gap-3">
            <h1 className="bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-5xl font-extrabold tracking-tight text-transparent sm:text-6xl dark:from-indigo-300 dark:to-violet-300">
              The Blind Game
            </h1>
            <p className="mx-auto max-w-md text-lg text-zinc-600 dark:text-zinc-300">
              Le blind test musical à jouer entre amis. Écoute, devine, et prends la tête du classement.
            </p>
          </div>

          <div className="flex w-full flex-col items-center gap-3 sm:w-auto sm:flex-row">
            <button
              onClick={createGame}
              disabled={!isConnected}
              className="w-full cursor-pointer rounded-full bg-indigo-600 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-indigo-500/30 transition hover:bg-indigo-700 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              {isConnected ? "Créer un salon" : "Connexion au serveur…"}
            </button>
            <Link
              href="/join"
              className="w-full rounded-full border border-zinc-300 bg-white px-8 py-3.5 text-center text-base font-semibold text-zinc-900 shadow-sm transition hover:bg-zinc-100 focus:outline-none focus-visible:ring-4 focus-visible:ring-indigo-300 sm:w-auto dark:border-zinc-700 dark:bg-zinc-900 dark:text-white dark:hover:bg-zinc-800"
            >
              Rejoindre un salon
            </Link>
          </div>

          <ul className="flex flex-wrap items-center justify-center gap-2">
            {FEATURES.map((feature) => (
              <li
                key={feature}
                className="rounded-full bg-indigo-100 px-3 py-1 text-xs font-medium text-indigo-800 dark:bg-indigo-950 dark:text-indigo-300"
              >
                {feature}
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="how-it-works" className="w-full">
          <h2
            id="how-it-works"
            className="mb-6 text-center text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400"
          >
            Comment ça marche
          </h2>
          <ol className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {STEPS.map((step, index) => (
              <li
                key={step.title}
                className="flex flex-col gap-2 rounded-2xl border border-zinc-200 bg-white/80 p-5 shadow-sm backdrop-blur dark:border-zinc-800 dark:bg-zinc-900/70"
              >
                <div className="flex items-center gap-3">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-lg text-white shadow-md shadow-indigo-500/20">
                    {step.icon}
                  </span>
                  <span className="text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    ÉTAPE {index + 1}
                  </span>
                </div>
                <h3 className="text-base font-bold text-zinc-900 dark:text-white">{step.title}</h3>
                <p className="text-sm leading-relaxed text-zinc-600 dark:text-zinc-400">{step.text}</p>
              </li>
            ))}
          </ol>
        </section>
      </main>
    </div>
  );
}
