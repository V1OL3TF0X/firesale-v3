import { renderMarkdown } from "./markdown";
import Elements from "./elements";

function debounce<Args extends unknown[]>(
  cb: (...args: Args) => void,
  timeout = 200,
) {
  let timeoutID: NodeJS.Timeout | number | undefined;
  return (...args: Args) => {
    clearTimeout(timeoutID);
    timeoutID = setTimeout(() => cb(...args), timeout);
  };
}

const debouncedUpdateSave = debounce(async (contents: string) => {
  Elements.SaveMarkdownButton.disabled =
    !(await window.api.checkForChanges(contents));
});

Elements.MarkdownView.addEventListener("input", () => {
  const markdown = Elements.MarkdownView.value;
  debouncedUpdateSave(markdown);
  renderMarkdown(markdown);
});

window.api.onFileOpened((c) => {
  Elements.MarkdownView.value = c;
  Elements.SaveMarkdownButton.disabled = true;
  renderMarkdown(c);
});

window.api.onSaveFileError(console.error);
window.api.onFileSaved((fp) => console.log(`File saved successfully to ${fp}`));

Elements.OpenFileButton.addEventListener("click", window.api.showOpenDialog);
Elements.SaveMarkdownButton.addEventListener("click", () =>
  window.api.saveFile(Elements.MarkdownView.value),
);
Elements.ExportHtmlButton.addEventListener("click", () =>
  window.api.showSaveDialog(Elements.RenderedView.innerHTML),
);
