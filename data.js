export const owner = "MengbierYzj";
export const repo = "MengbierYzj.github.io";
export const branch = "main";
export const draftKey = "academic-homepage-draft-v1";
export const contentUrl = new URL("./content.json", import.meta.url);
export const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/content.json`;
export const maxContentBytes = 900_000;

export const profileFields = [
  ["name", "姓名或公开署名", "text", true, 100],
  ["role", "身份或职称", "text", false, 120],
  ["institution", "所在机构", "text", false, 160],
  ["email", "公开邮箱", "email", false, 254],
  ["github", "GitHub 链接", "url", false, 500],
  ["scholar", "Google Scholar 链接", "url", false, 500],
  ["orcid", "ORCID 链接", "url", false, 500],
  ["avatar", "头像链接", "url", false, 1000],
  ["interests", "研究方向（每行一项）", "textarea", false, 800],
  ["bio", "个人简介", "textarea", false, 5000]
];

export const entryFields = {
  education: [
    ["school", "学校", "text", true, 160],
    ["degree", "学位", "text", false, 100],
    ["field", "专业", "text", false, 160],
    ["period", "起止时间", "text", false, 80],
    ["details", "补充说明", "textarea", false, 1500]
  ],
  publications: [
    ["title", "论文标题", "text", true, 500],
    ["authors", "作者（按署名顺序）", "text", false, 800],
    ["venue", "期刊或会议", "text", false, 300],
    ["year", "年份", "text", false, 4],
    ["url", "论文链接或 DOI 链接", "url", false, 1000]
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
  if (!response.ok) throw new Error("无法读取主页内容。");
  return response.json();
}

export function element(tag, text, className) {
  const node = document.createElement(tag);
  if (text) node.textContent = text;
  if (className) node.className = className;
  return node;
}
