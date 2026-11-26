const commands = {
  textbf: "strong",
  textit: "em",
  emph: "em",
  underline: "u",
  sout: "s",
  texttt: "code"
};

// Parse only text-formatting commands. User text never becomes HTML.
export function formattedText(value, depth = 0) {
  const text = String(value ?? "");
  const fragment = document.createDocumentFragment();
  if (depth >= 30) {
    fragment.append(text);
    return fragment;
  }
  let plain = "";
  function flush() {
    fragment.append(plain);
    plain = "";
  }
  for (let index = 0; index < text.length;) {
    if (text[index] !== "\\") {
      plain += text[index++];
      continue;
    }
    const next = text[index + 1];
    if (next === "{" || next === "}") {
      plain += next;
      index += 2;
      continue;
    }
    if (next === "\\") {
      flush();
      fragment.append(document.createElement("br"));
      index += 2;
      continue;
    }
    const match = /^\\([a-z]+)\{/.exec(text.slice(index));
    const tag = match && commands[match[1]];
    if (!tag) {
      plain += text[index++];
      continue;
    }
    const start = index + match[0].length;
    let end = start;
    let braces = 1;
    while (end < text.length && braces) {
      if (text[end] === "\\") {
        end += 2;
        continue;
      }
      if (text[end] === "{") braces++;
      if (text[end] === "}") braces--;
      if (braces) end++;
    }
    if (braces) {
      plain += text.slice(index);
      break;
    }
    flush();
    const node = document.createElement(tag);
    node.append(formattedText(text.slice(start, end), depth + 1));
    fragment.append(node);
    index = end + 1;
  }
  flush();
  return fragment;
}
