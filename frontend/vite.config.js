import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  root: ".",
  server: { port: 5173 },
  build: {
    rollupOptions: {
      input: {
        login: resolve(__dirname, "login.html"),
        location: resolve(__dirname, "location.html"),
        follow: resolve(__dirname, "follow.html"),
        home: resolve(__dirname, "home.html"),
        discovery: resolve(__dirname, "discovery.html"),
        place: resolve(__dirname, "place.html"),
        rate: resolve(__dirname, "rate.html"),
        influencers: resolve(__dirname, "influencers.html"),
        influencer: resolve(__dirname, "influencer.html"),
        me: resolve(__dirname, "me.html"),
        index: resolve(__dirname, "index.html"),
      },
    },
  },
});
