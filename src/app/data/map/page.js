'use client';
import MapVisualisation from "@/components/mapVisualisation";

export default function Page() {
  return (
    <div className="flex flex-col flex-1 items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <MapVisualisation />
    </div>
  );
}