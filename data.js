export const owner = "MengbierYzj";
export const repo = "MengbierYzj.github.io";
export const branch = "main";
export const draftKey = "academic-homepage-draft-v1";
export const contentUrl = new URL("./content.json", import.meta.url);
export const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/content.json`;
export const maxContentBytes = 900_000;

export const profileFields = [
  ["name", "Display name", "text", true, 100],
  ["role", "Position or title", "text", false, 120],
  ["institution", "Institution", "text", false, 160],
  ["email", "Public email address", "email", false, 254],
  ["github", "GitHub URL", "url", false, 500],
  ["scholar", "Google Scholar URL", "url", false, 500],
  ["orcid", "ORCID URL", "url", false, 500],
  ["avatar", "Profile photo URL", "url", false, 1000],
  ["interests", "Research interests (one per line)", "textarea", false, 800],
  ["bio", "Biography", "textarea", false, 5000]
];

export const entryFields = {
  news: [
    ["title", "Headline", "text", true, 500],
    ["period", "Date", "text", false, 80],
    ["details", "Details", "textarea", false, 1500]
  ],
  activities: [
    ["title", "Talk, teaching, or service", "text", true, 500],
    ["period", "Date and location", "text", false, 200],
    ["details", "Details", "textarea", false, 1500]
  ],
  education: [
    ["school", "School or university", "text", true, 160],
    ["degree", "Degree", "text", false, 100],
    ["field", "Field of study", "text", false, 160],
    ["period", "Dates attended", "text", false, 80],
    ["details", "Additional details", "textarea", false, 1500]
  ],
  publications: [
    ["title", "Publication title", "text", true, 500],
    ["authors", "Authors (in publication order)", "text", false, 800],
    ["venue", "Journal or conference", "text", false, 300],
    ["year", "Year", "text", false, 4],
    ["url", "Publication or DOI URL", "url", false, 1000]
  ]
};

export function safeLink(value) {
  try {
    const url = new URL(value);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : "";
  } catch {
    return "";
  }
}

export function avatarLink(value) {
  return /^data:image\/(?:jpeg|png|webp);base64,[A-Za-z0-9+/]+=*$/.test(value)
    ? value
    : safeLink(value);
}

export function readDraft() {
  return JSON.parse(localStorage.getItem(draftKey) || "null");
}

export async function requestContent(url) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) throw new Error("Could not load the homepage content.");
  return response.json();
}

export function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}
