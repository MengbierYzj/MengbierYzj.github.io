import {
  apiUrl, avatarLink, branch, contentUrl, draftKey, element, entryFields,
  maxContentBytes, profileFields, readDraft, safeLink
} from "../data.js?v=3";

const byId = (id) => document.getElementById(id);
const form = byId("editor");
const fieldset = byId("editor-fields");
const tokenInput = byId("token");
const profile = {};
const encoder = new TextEncoder();
const labels = { education: "Education entry", publications: "Publication" };
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
    input.title = "Enter a URL starting with https:// or http://.";
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
  const remove = element("button", "Remove", "remove");
  remove.type = "button";
  remove.setAttribute("aria-label", `Remove this ${labels[section].toLowerCase()}`);
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
  if (input.required && !value) throw new Error(`Enter a value for "${input.labels[0].firstChild.textContent}".`);
  if (value && input.type === "url" && !safeLink(value)) throw new Error("Enter a valid URL.");
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
  if (!response.ok) throw new Error("Could not load the homepage content.");
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
    throw new Error("Could not connect to GitHub. Check your connection and try again.");
  }
  if (!response.ok) {
    const messages = {
      401: "Your GitHub token is invalid or has expired.",
      403: "GitHub denied the request. Check which repository the token can access and whether it has Contents permission, or try again later.",
      404: "GitHub could not access the file. Check that the token grants access to this repository.",
      409: "The content changed on GitHub. Load the latest version before editing again.",
      422: "GitHub rejected the commit. Load the latest version and check the branch permissions."
    };
    throw new Error(messages[response.status] || `GitHub request failed (${response.status}).`);
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
      status("Loaded the draft saved in this browser.");
    } else {
      const { data, sha } = await remoteContent().catch(localContent);
      fill(data);
      baseSha = sha;
      status("Homepage content loaded.");
    }
    controls(false);
  } catch (error) {
    status(error.message || "Could not load the homepage content. Refresh the page to try again.", true);
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
      throw new Error("Choose a JPEG, PNG, or WebP image up to 12 MB.");
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
    status("Profile photo added to your draft.");
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
    if (!saveDraft(collect())) throw new Error("Your browser could not save the draft. Check whether site storage is enabled.");
    dirty = false;
    tokenInput.value = "";
    location.assign("../?preview=draft");
  } catch (error) {
    status(error.message, true);
  }
});

byId("reload").addEventListener("click", async () => {
  if (!window.confirm("Replace your current edits and local draft with the latest version from GitHub?")) return;
  controls(true);
  status("Loading the latest version from GitHub…");
  const token = tokenInput.value.trim();
  tokenInput.value = "";
  try {
    const { data, sha } = await remoteContent(token);
    baseSha = sha;
    fill(data);
    try { localStorage.removeItem(draftKey); } catch { /* Storage may be unavailable. */ }
    status("Loaded the latest version from GitHub.");
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
    status("Enter a GitHub access token to publish.", true);
    tokenInput.focus();
    return;
  }
  let data;
  let bytes;
  try {
    data = collect();
    bytes = encoder.encode(JSON.stringify(data, null, 2) + "\n");
    if (bytes.length > maxContentBytes) throw new Error("The content exceeds the publishing size limit. Shorten it and try again.");
  } catch (error) {
    status(error.message, true);
    return;
  }
  tokenInput.value = "";
  controls(true);
  if (saveDraft(data)) dirty = false;
  status("Publishing to GitHub…");
  try {
    const current = await remoteContent(token);
    const content = toBase64(bytes);
    if (current.raw === new TextDecoder().decode(bytes)) {
      baseSha = current.sha;
    } else {
      if (current.sha !== baseSha) throw new Error("The content changed on GitHub. Copy any draft changes you want to keep, then load the latest version.");
      const updated = await github({
        token,
        body: { branch, sha: current.sha, message: "Update academic profile", content }
      });
      baseSha = updated.content.sha;
    }
    try { localStorage.removeItem(draftKey); } catch { /* Storage may be unavailable. */ }
    dirty = false;
    status("Saved to GitHub. The update will appear once GitHub Pages finishes deploying.");
  } catch (error) {
    status(error.message, true);
  } finally {
    controls(false);
  }
});

load();
