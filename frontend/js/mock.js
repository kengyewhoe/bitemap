export const KL_CENTER = { lat: 3.139, lng: 101.6869 };

export const places = [
  {
    id: "kin-kin",
    name: "Kin Kin Chili Pan Mee",
    area: "Chow Kit",
    category: "Malaysian Noodles",
    km: 2.1,
    walkMin: 12,
    price: "$$",
    halal: false,
    goodPct: 88,
    ratingCount: 128,
    stars: 4.8,
    hours: "Open now · Closes 6:00 PM",
    address: "40 Jalan Dewan Sultan Sulaiman",
    lat: 3.162,
    lng: 101.698,
    heat: "chili",
    blurb:
      "Legendary spot known for inventing the dry chili pan mee. Springy noodles, minced pork, fried anchovies, poached egg, and fiery chili paste.",
    thumb:
      "https://images.unsplash.com/photo-1569718212165-3a8278d5f624?w=400&q=80",
    mentionedAt: "2026-08-20T12:00:00+08:00",
    mentionedBy: { handle: "@klfoodie", quote: "The best dry chili pan mee in town, that egg pop is legendary." },
  },
  {
    id: "wanjo",
    name: "Nasi Lemak Wanjo",
    area: "Kampung Baru",
    category: "Malay",
    km: 2.4,
    walkMin: 18,
    price: "$",
    halal: true,
    goodPct: 91,
    ratingCount: 86,
    stars: 4.5,
    hours: "Open now · Closes 11:00 PM",
    address: "Jalan Raja Alang, Kampung Baru",
    lat: 3.165,
    lng: 101.705,
    heat: "lime",
    blurb: "The benchmark for KL nasi lemak. Crispy chicken is a must.",
    thumb:
      "https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=400&q=80",
    mentionedAt: "2026-08-27T19:00:00+08:00",
    mentionedBy: { handle: "@makan_mana", quote: "Confirm sedap. Go early." },
  },
  {
    id: "alor",
    name: "Jalan Alor Seafood",
    area: "Bukit Bintang",
    category: "Seafood",
    km: 1.2,
    walkMin: 14,
    price: "$$",
    halal: false,
    goodPct: 81,
    ratingCount: 64,
    stars: 4.2,
    hours: "Opens 6:00 PM",
    address: "Jalan Alor, Bukit Bintang",
    lat: 3.146,
    lng: 101.71,
    heat: "mango",
    blurb: "Queue from 8pm, still worth. Grilled stingray with sambal.",
    thumb:
      "https://images.unsplash.com/photo-1559339352-11d035aa65de?w=400&q=80",
    mentionedAt: "2026-08-29T21:00:00+08:00",
    mentionedBy: { handle: "@eatswithaina", quote: "Queue from 8pm, still worth." },
  },
];

export const creators = [
  {
    id: "klfoodie",
    handle: "@klfoodie",
    name: "KL Foodie",
    bio: "The classic KL guide. Street food hunter.",
    tags: "Hidden Gems · Street Food",
    influence: 98,
    spots: 42,
    trusted: true,
    following: false,
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80",
    cover:
      "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=800&q=80",
    picks: ["kin-kin", "wanjo"],
  },
  {
    id: "makan-mana",
    handle: "@makan_mana",
    name: "Makan Mana",
    bio: "Late night specialist",
    tags: "Late Night Specialist",
    influence: 88,
    spots: 31,
    trusted: true,
    following: true,
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80",
    picks: ["wanjo", "alor"],
  },
  {
    id: "chef-lim",
    handle: "@chef.lim",
    name: "Chef Lim",
    bio: "Fine dining · Omakase",
    tags: "Fine Dining · Omakase",
    influence: 84,
    spots: 19,
    trusted: false,
    following: false,
    avatar:
      "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=200&q=80",
    picks: [],
  },
  {
    id: "bites-sarah",
    handle: "@bites_by_sarah",
    name: "Bites by Sarah",
    bio: "Cafe hopping · pastries",
    tags: "Cafe Hopping · Pastries",
    influence: 79,
    spots: 24,
    trusted: false,
    following: false,
    avatar:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=200&q=80",
    picks: ["alor"],
  },
  {
    id: "eatswithaina",
    handle: "@eatswithaina",
    name: "Eats with Aina",
    bio: "Queues and night markets",
    tags: "Street Food · Night Market",
    influence: 86,
    spots: 28,
    trusted: true,
    following: false,
    avatar:
      "https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=200&q=80",
    picks: ["alor"],
  },
];

export const currentUser = {
  id: "u1",
  name: "Ahmad Zakaria",
  email: "ahmad.z@email.com",
  pro: true,
  avatar:
    "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80",
};

export function getPlace(id) {
  return places.find((p) => p.id === id) || places[0];
}

export function getCreator(id) {
  return creators.find((c) => c.id === id) || creators[0];
}

export function placesFromFollows(followingIds) {
  const ids = new Set(followingIds || []);
  const followed = creators.filter((c) => ids.has(c.id));
  const pickIds = new Set(followed.flatMap((c) => c.picks || []));
  const handles = new Set(followed.map((c) => c.handle.toLowerCase()));
  return places.filter((p) => pickIds.has(p.id) || handles.has(String(p.mentionedBy?.handle || "").toLowerCase()));
}

export function getCreatorByHandle(handle) {
  const key = String(handle || "")
    .trim()
    .toLowerCase()
    .replace(/^@/, "");
  return creators.find((c) => c.handle.toLowerCase().replace(/^@/, "") === key) || null;
}
