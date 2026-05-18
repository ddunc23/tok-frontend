import Image from "next/image";

export default function Home() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex flex-1 w-full flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <h1 className="text-xl font-bold tracking-tight text-zinc-800 sm:text-7xl">
          Tools of Knowledge
        </h1>
        <p className="my-6 text-xl text-zinc-600 dark:text-zinc-400">
          Explore the SIMON Database of Scientific Instrument Makers
        </p>
        <p className="text-md text-zinc-600 dark:text-zinc-400">
          SIMON provides detailed information about the lives, work and relationships of scientific instrument makers between 1550 and 1914 (and, in some cases, beyond). First developed as a card catalogue, its first digital incarnation was a Microsoft Access database which could only be accessed locally at Greenwich and is not available online. This new online version of the SIMON database provides a user-friendly interface to explore the rich data contained within SIMON, including maker biographies, instrument details, and social connections between makers.
        </p>
      </main>
    </div>
  );
}
