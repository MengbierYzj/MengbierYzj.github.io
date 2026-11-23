import { avatarLink, contentUrl, element, readDraft, requestContent, safeLink } from "./data.js";

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
  document.title = `${name} · 学术主页`;
  const avatar = avatarLink(profile.avatar || "");
  image.alt = `${name} 的头像`;
  image.hidden = !avatar;
  if (avatar) {
    if (image.getAttribute("src") !== avatar) image.src = avatar;
    if (image.complete && !image.naturalWidth) image.hidden = true;
  }

  const affiliation = [profile.role, profile.institution].filter(Boolean).join(" · ");
  setText("affiliation", affiliation);
  byId("affiliation").hidden = !affiliation;

  const links = [["GitHub", safeLink(profile.github)], ["Google Scholar", safeLink(profile.scholar)], ["ORCID", safeLink(profile.orcid)]];
  if (/^[^\s@]+@[^\s@.]+(?:\.[^\s@.]+)+$/.test(profile.email || "")) {
    links.unshift(["邮箱", `mailto:${encodeURIComponent(profile.email).replace("%40", "@")}`]);
  }
  byId("contacts").replaceChildren(...links.filter(([, url]) => url).map(([label, url]) => link(label, url)));
  byId("contacts").hidden = !byId("contacts").childElementCount;

  setText("bio", profile.bio || "个人简介待补充。");
  byId("bio").classList.toggle("empty", !profile.bio);
  const topics = profile.interests || [];
  byId("topics").replaceChildren(...topics.map((topic) => element("li", topic)));
  byId("research").hidden = !topics.length;
}

function row(title, metadata, detail, url) {
  const item = element("li", "", "entry");
  const heading = element("h3", title);
  item.append(heading);
  if (metadata) item.append(element("p", metadata));
  if (detail) item.append(element("p", detail, "detail"));
  if (url) {
    const resource = link("论文链接", url);
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
      [item.venue, item.year].filter(Boolean).join(" · "), safeLink(item.url))),
    sorted.length ? "没有符合条件的论文。" : "发表论文待补充。");
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
    [item.degree, item.field, item.period].filter(Boolean).join(" · "), item.details)), "教育经历待补充。");
  renderPublications(data.publications);
}

load().catch(() => {
  const message = byId("load-message");
  message.textContent = "暂时无法加载主页资料，请稍后刷新。";
  message.hidden = false;
});
