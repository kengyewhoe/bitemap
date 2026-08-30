const TABS = [
  { id: "map", href: "./home.html", icon: "map", label: "Map" },
  { id: "influencers", href: "./influencers.html", icon: "group", label: "Influencers" },
  { id: "saved", href: "./saved.html", icon: "bookmark", label: "Saved" },
  { id: "me", href: "./me.html", icon: "person", label: "Me" },
];

export function mountNav(active) {
  const host = document.getElementById("app-nav");
  if (!host) return;
  host.innerHTML = `
    <nav class="fixed bottom-0 w-full z-50 rounded-t-xl bg-sheet-surface border-t border-sheet-outline shadow-[0_-8px_24px_rgba(0,0,0,0.08)] flex justify-around items-center h-20 px-4 pb-safe md:hidden">
      ${TABS.map((tab) => {
        const on = tab.id === active;
        return `
          <a href="${tab.href}" class="flex flex-col items-center justify-center w-16 h-16 rounded-xl transition-transform ${
            on ? "text-primary font-bold scale-105" : "text-on-surface-variant"
          }">
            <span class="material-symbols-outlined mb-1" style="font-variation-settings: 'FILL' ${on ? 1 : 0};">${tab.icon}</span>
            <span class="font-label-caps text-label-caps">${tab.label}</span>
          </a>`;
      }).join("")}
    </nav>`;
}
