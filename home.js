import { avatarLink, contentUrl, element, readDraft, requestContent, safeLink } from "./data.js?v=3";

const byId = (id) => document.getElementById(id);
const image = byId("avatar");
image.addEventListener("error", () => { image.hidden = true; });
if (image.complete && !image.naturalWidth) image.hidden = true;

function setText(id, value) {
  byId(id).textContent = value;
}

function link(text, href) {
  const node = element("a", text);
  node.href = href;
  return node;
}

function renderProfile(profile) {
  const name = profile.name || "MengbierYzj";
  setText("name", name);
  setText("footer-name", name);
  setText("initials", Array.from(name)[0].toUpperCase());
  setText("site-title", name);
  setText("header-email", profile.email || "");
  document.title = name;
  const avatar = avatarLink(profile.avatar || "");
  image.alt = `Profile photo of ${name}`;
  image.hidden = !avatar;
  if (avatar) {
    if (image.getAttribute("src") !== avatar) image.src = avatar;
    if (image.complete && !image.naturalWidth) image.hidden = true;
  }

  const affiliation = [profile.role, profile.institution].filter(Boolean).join(" · ");
  setText("affiliation", affiliation);
  byId("affiliation").hidden = !affiliation;

  const links = [["GitHub", safeLink(profile.github)], ["Google Scholar", safeLink(profile.scholar)], ["ORCID", safeLink(profile.orcid)]];
  byId("contacts").replaceChildren(...links.filter(([, url]) => url).map(([label, url]) => link(label, url)));
  byId("contacts").hidden = !byId("contacts").childElementCount;

  setText("bio", profile.bio || "No biography has been added.");
  byId("bio").classList.toggle("empty", !profile.bio);
  const topics = profile.interests || [];
  byId("topics").replaceChildren(...topics.map((topic) => element("li", topic)));
  byId("research").hidden = !topics.length;
}

function row(title, metadata, detail, url, preview) {
  const item = element("li", "", "entry");
  const heading = element("h3", title);
  item.append(heading);
  const src = avatarLink(preview || "");
  if (src) {
    const thumbnail = element("img", "", "publication-thumbnail");
    thumbnail.src = src;
    thumbnail.alt = `Preview of ${title}`;
    thumbnail.loading = "lazy";
    thumbnail.addEventListener("error", () => { thumbnail.hidden = true; });
    item.append(thumbnail);
  }
  if (metadata) item.append(element("p", metadata));
  if (detail) item.append(element("p", detail, "detail"));
  if (url) {
    const resource = link("View publication", url);
    resource.className = "resource";
    item.append(resource);
  }
  return item;
}

function showList(id, items, empty) {
  const list = element("ul", "", "entries");
  list.append(...items);
  byId(id).replaceChildren(items.length ? list : element("p", empty, "empty"));
}

function renderPublications(items) {
  const search = byId("publication-search");
  const sorted = [...items].sort((a, b) => String(b.year || "").localeCompare(String(a.year || "")));
  byId("publication-tools").hidden = !sorted.length;
  function draw() {
    const keywords = search.value.toLocaleLowerCase().trim().split(/\s+/).filter(Boolean);
    const matching = sorted.filter((item) => {
      const text = [item.title, item.authors, item.venue, item.year].join(" ").toLocaleLowerCase();
      return keywords.every((term) => text.includes(term));
    });
    showList("publication-list", matching.map((item) => row(item.title, item.authors,
      [item.venue, item.year].filter(Boolean).join(" · "), safeLink(item.url), item.image)),
    sorted.length ? "No publications match your search." : "No publications have been added.");
  }
  search.addEventListener("input", draw);
  draw();
}

async function load() {
  let data;
  if (new URLSearchParams(location.search).get("preview") === "draft") {
    try {
      data = readDraft()?.data;
    } catch {
      // An unavailable or unreadable local draft leaves the public page usable.
    }
    byId("preview-note").hidden = !data;
  }
  data ??= await requestContent(contentUrl);
  renderProfile(data.profile);
  showList("education-list", data.education.map((item) => row(item.school,
    [item.degree, item.field, item.period].filter(Boolean).join(" · "), item.details)), "No education entries have been added.");
  renderPublications(data.publications);
  for (const section of ["news", "activities"]) {
    showList(`${section}-list`, (data[section] || []).map((item) =>
      row(item.title, item.period, item.details)), "No entries have been added.");
  }
}

load().catch(() => {
  const message = byId("load-message");
  message.textContent = "Could not load the homepage content. Refresh the page to try again.";
  message.hidden = false;
});
