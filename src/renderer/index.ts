import { renderMarkdown } from "./markdown";
import Elements from "./elements";

Elements.MarkdownView.addEventListener("input", async () => {
  const markdown = Elements.MarkdownView.value;
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
Elements.MarkdownView.addEventListener("input", () => {
  Elements.SaveMarkdownButton.disabled = false;
});
Elements.ExportHtmlButton.addEventListener("click", () =>
  window.api.showSaveDialog(Elements.RenderedView.innerHTML),
);
