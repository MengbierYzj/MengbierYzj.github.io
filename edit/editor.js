import {
  apiUrl, avatarLink, branch, contentUrl, draftKey, element, entryFields,
  maxContentBytes, profileFields, readDraft, safeLink
} from "../data.js";

const byId = (id) => document.getElementById(id);
const form = byId("editor");
const fieldset = byId("editor-fields");
const tokenInput = byId("token");
const profile = {};
const encoder = new TextEncoder();
const labels = { education: "教育经历", publications: "论文" };
let baseSha;
let avatarData = "";
let dirty = false;

function status(message, error = false) {
  byId("status").textContent = message;
  byId("status").toggleAttribute("data-error", error);
}

function controls(disabled) {
  fieldset.disabled = disabled;
  for (const id of ["preview", "publish", "reload", "token"]) byId(id).disabled = disabled;
}

function createField([key, label, type, required, maxLength], value = "") {
  const field = element("label", label, "field");
  const input = document.createElement(type === "textarea" ? "textarea" : "input");
  if (type !== "textarea") input.type = type;
  if (type === "textarea" || key === "avatar") field.classList.add("wide");
  if (key === "year") {
    input.inputMode = "numeric";
    input.pattern = "[0-9]{4}";
  }
  if (type === "url") {
    input.pattern = "https?://.+";
    input.title = "请输入以 https:// 或 http:// 开头的网址";
  }
  input.dataset.key = key;
  input.required = required;
  input.maxLength = maxLength;
  input.value = value;
  field.append(input);
  return [field, input];
}

function initProfile() {
  const parent = byId("profile-fields");
  const avatarTools = parent.querySelector(".avatar-tools");

  for (const definition of profileFields) {
    const [key] = definition;
    const [field, input] = createField(definition);
    parent.append(field);
    profile[key] = input;
    if (key === "avatar") field.after(avatarTools);
  }
}

function addRow(section, values = {}) {
  const card = element("div", "", "row-card");
  const heading = element("div", "", "row-head");
  const remove = element("button", "移除", "remove");
  remove.type = "button";
  remove.setAttribute("aria-label", `移除这项${labels[section]}`);
  remove.addEventListener("click", () => {
    card.remove();
    dirty = true;
    document.querySelector(`[data-add="${section}"]`).focus();
  });
  heading.append(element("h3", labels[section]), remove);
  const fields = element("div", "", "fields");
  for (const definition of entryFields[section]) {
    fields.append(createField(definition, values[definition[0]])[0]);
  }
  card.append(heading, fields);
  byId(section).append(card);
  return card;
}

function updateAvatar() {
  const image = byId("avatar-preview");
  const src = avatarLink(profile.avatar.value.trim()) || avatarData;
  image.hidden = !src;
  byId("clear-avatar").hidden = !avatarData;
  if (!src) image.removeAttribute("src");
  else if (image.getAttribute("src") !== src) image.src = src;
  else if (image.complete && !image.naturalWidth) image.hidden = true;
}

function fill(data) {
  for (const key of Object.keys(profile)) profile[key].value = data.profile[key] || "";
  profile.interests.value = (data.profile.interests || []).join("\n");
  const avatar = data.profile.avatar || "";
  avatarData = avatar.startsWith("data:") ? avatarLink(avatar) : "";
  if (avatarData) profile.avatar.value = "";
  byId("avatar-file").value = "";
  updateAvatar();

  for (const section of Object.keys(entryFields)) {
    byId(section).replaceChildren();
    for (const row of data[section]) addRow(section, row);
  }
  dirty = false;
}

function fieldValue(input) {
  const value = input.value.trim();
  if (input.required && !value) throw new Error(`请填写「${input.labels[0].firstChild.textContent}」。`);
  if (value && input.type === "url" && !safeLink(value)) throw new Error("请填写有效的网址。");
  return value;
}

function collect() {
  const values = Object.fromEntries(Object.entries(profile).map(([key, input]) => [key, fieldValue(input)]));
  values.interests = values.interests.split("\n").map((line) => line.trim()).filter(Boolean);
  values.avatar ||= avatarData;
  const data = { profile: values };
  for (const section of Object.keys(entryFields)) {
    data[section] = [...byId(section).children].map((card) =>
      Object.fromEntries([...card.querySelectorAll("[data-key]")].map((input) => [input.dataset.key, fieldValue(input)]))
    );
  }
  return data;
}

function saveDraft(data) {
  try {
    localStorage.setItem(draftKey, JSON.stringify({ data, baseSha }));
    return true;
  } catch {
    return false;
  }
}

async function localContent() {
  const response = await fetch(contentUrl, { cache: "no-store" });
  if (!response.ok) throw new Error("无法读取主页资料。");
  const bytes = new Uint8Array(await response.arrayBuffer());
  const prefix = encoder.encode(`blob ${bytes.length}\0`);
  const gitBlob = new Uint8Array(prefix.length + bytes.length);
  gitBlob.set(prefix);
  gitBlob.set(bytes, prefix.length);
  const hash = await crypto.subtle.digest("SHA-1", gitBlob);
  const sha = Array.from(new Uint8Array(hash), (byte) => byte.toString(16).padStart(2, "0")).join("");
  return { sha, data: JSON.parse(new TextDecoder().decode(bytes)) };
}

function fromBase64(content) {
  const bytes = Uint8Array.from(atob(content), (char) => char.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

function toBase64(bytes) {
  let content = "";
  for (let start = 0; start < bytes.length; start += 8192) {
    content += String.fromCharCode(...bytes.subarray(start, start + 8192));
  }
  return btoa(content);
}

async function github({ token, body } = {}) {
  const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
  if (token) headers.Authorization = `Bearer ${token}`;
  if (body) headers["Content-Type"] = "application/json";
  let response;
  try {
    response = await fetch(body ? apiUrl : `${apiUrl}?ref=${branch}`, {
      method: body ? "PUT" : "GET",
      headers,
      body: body ? JSON.stringify(body) : undefined,
      cache: "no-store",
      redirect: "error"
    });
  } catch {
    throw new Error("无法连接 GitHub，请检查网络后重试。");
  }
  if (!response.ok) {
    const messages = {
      401: "GitHub 令牌无效或已过期。",
      403: "GitHub 拒绝请求。请检查令牌的仓库范围、Contents 权限或稍后重试。",
      404: "GitHub 无法访问该文件。请确认令牌授权了本站仓库。",
      409: "GitHub 已有其他更新。请加载 GitHub 最新版后重新编辑。",
      422: "GitHub 拒绝了提交。请加载 GitHub 最新版，并检查分支权限。"
    };
    throw new Error(messages[response.status] || `GitHub 请求失败（${response.status}）。`);
  }
  return response.json();
}

async function remoteContent(token) {
  const file = await github({ token });
  const raw = fromBase64(file.content);
  return { sha: file.sha, data: JSON.parse(raw), raw };
}

async function load() {
  try {
    let draft;
    try {
      draft = readDraft();
    } catch {
      // Editing remains available when the browser blocks local storage.
    }
    if (draft?.data && draft.baseSha) {
      fill(draft.data);
      baseSha = draft.baseSha;
      status("已载入此浏览器中的草稿。");
    } else {
      const { data, sha } = await remoteContent().catch(localContent);
      fill(data);
      baseSha = sha;
      status("已载入主页资料。");
    }
    controls(false);
  } catch (error) {
    status(error.message || "无法读取主页资料，请刷新后重试。", true);
  }
}

initProfile();
byId("avatar-preview").addEventListener("error", () => { byId("avatar-preview").hidden = true; });
profile.avatar.addEventListener("input", updateAvatar);
byId("clear-avatar").addEventListener("click", () => {
  avatarData = "";
  dirty = true;
  updateAvatar();
  profile.avatar.focus();
});
form.addEventListener("input", (event) => {
  if (fieldset.contains(event.target)) dirty = true;
});
document.querySelectorAll("[data-add]").forEach((button) => {
  button.addEventListener("click", () => {
    const card = addRow(button.dataset.add);
    dirty = true;
    card.querySelector("input").focus();
  });
});
window.addEventListener("beforeunload", (event) => {
  if (!dirty) return;
  event.preventDefault();
  event.returnValue = true;
});

byId("avatar-file").addEventListener("change", async (event) => {
  const input = event.currentTarget;
  const [file] = input.files;
  if (!file) return;
  controls(true);
  try {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 12_000_000) {
      throw new Error("请选择 12 MB 以内的 JPEG、PNG 或 WebP 图片。");
    }
    const bitmap = await createImageBitmap(file);
    try {
      const side = Math.min(bitmap.width, bitmap.height);
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = Math.min(side, 384);
      canvas.getContext("2d").drawImage(bitmap, (bitmap.width - side) / 2, (bitmap.height - side) / 2,
        side, side, 0, 0, canvas.width, canvas.height);
      avatarData = canvas.toDataURL("image/webp", 0.87);
    } finally {
      bitmap.close();
    }
    profile.avatar.value = "";
    updateAvatar();
    dirty = true;
    status("头像已加入当前编辑内容。");
  } catch (error) {
    status(error.message, true);
  } finally {
    input.value = "";
    controls(false);
  }
});

byId("preview").addEventListener("click", () => {
  if (!form.reportValidity()) return;
  try {
    if (!saveDraft(collect())) throw new Error("浏览器无法保存草稿，请检查站点存储是否可用。");
    dirty = false;
    tokenInput.value = "";
    location.assign("../?preview=draft");
  } catch (error) {
    status(error.message, true);
  }
});

byId("reload").addEventListener("click", async () => {
  if (!window.confirm("用 GitHub 最新版替换当前编辑内容和本地草稿？")) return;
  controls(true);
  status("正在读取 GitHub 最新版…");
  const token = tokenInput.value.trim();
  tokenInput.value = "";
  try {
    const { data, sha } = await remoteContent(token);
    baseSha = sha;
    fill(data);
    try { localStorage.removeItem(draftKey); } catch { /* Storage may be unavailable. */ }
    status("已载入 GitHub 最新版。");
  } catch (error) {
    status(error.message, true);
  } finally {
    controls(false);
  }
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const token = tokenInput.value.trim();
  if (!token) {
    status("请先填写 GitHub 访问令牌。", true);
    tokenInput.focus();
    return;
  }
  let data;
  let bytes;
  try {
    data = collect();
    bytes = encoder.encode(JSON.stringify(data, null, 2) + "\n");
    if (bytes.length > maxContentBytes) throw new Error("资料超过发布大小限制，请缩减内容后再试。");
  } catch (error) {
    status(error.message, true);
    return;
  }
  tokenInput.value = "";
  controls(true);
  if (saveDraft(data)) dirty = false;
  status("正在向 GitHub 发布…");
  try {
    const current = await remoteContent(token);
    const content = toBase64(bytes);
    if (current.raw === new TextDecoder().decode(bytes)) {
      baseSha = current.sha;
    } else {
      if (current.sha !== baseSha) throw new Error("GitHub 上已有更新，当前草稿未覆盖它。可先复制草稿，再加载 GitHub 最新版。");
      const updated = await github({
        token,
        body: { branch, sha: current.sha, message: "Update academic profile", content }
      });
      baseSha = updated.content.sha;
    }
    try { localStorage.removeItem(draftKey); } catch { /* Storage may be unavailable. */ }
    dirty = false;
    status("资料已保存到 GitHub。GitHub Pages 部署完成后，访客即可看到更新。");
  } catch (error) {
    status(error.message, true);
  } finally {
    controls(false);
  }
});

load();
