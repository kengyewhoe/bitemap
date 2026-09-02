export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 bg-map-background px-gutter text-center">
      <h1 className="font-display-map text-display-map text-map-mango">
        BiteMap
      </h1>
      <p className="font-body-md text-body-md text-map-on-surface">
        Scaffold is up. Screens land in later tasks.
      </p>
      <span className="rounded-full bg-map-surface px-4 py-2 font-label-caps text-label-caps uppercase text-map-on-surface">
        W0-1 scaffold
      </span>
    </main>
  );
}
