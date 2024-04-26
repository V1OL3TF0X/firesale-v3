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

function changeMarkdownContent(c: string) {
    Elements.MarkdownView.value = c;
    renderMarkdown(c);
}

function changeLacksFilePath(lacksFilePath: boolean) {
    Elements.ShowFileButton.disabled = lacksFilePath;
    Elements.OpenInDefaultApplicationButton.disabled = lacksFilePath;
};

const debouncedUpdateSave = debounce(async (contents: string) => {
  const shouldDisable = !(await window.api.checkForChanges(contents));
  Elements.SaveMarkdownButton.disabled = shouldDisable;
  Elements.RevertButton.disabled = shouldDisable;
});


Elements.MarkdownView.addEventListener("input", () => {
  const markdown = Elements.MarkdownView.value;
  debouncedUpdateSave(markdown);
  renderMarkdown(markdown);
});

window.api.onFileOpened((c) => {
    changeMarkdownContent(c);
  Elements.SaveMarkdownButton.disabled = true;
  changeLacksFilePath(false);
});

window.api.onSaveFileError(console.error);
window.api.onFileSaved((fp) => {
    console.log(`File saved successfully to ${fp}`)
    changeLacksFilePath(false);
});
Elements.RevertButton.addEventListener("click", async () => {
  const buttons = [Elements.OpenFileButton, Elements.NewFileButton];
  buttons.forEach((b) => (b.disabled = true));
  Elements.SaveMarkdownButton.disabled = true;
  const savedContent = await window.api.revertChanges();
  buttons.forEach((b) => (b.disabled = false));
    changeMarkdownContent(savedContent);
});
Elements.OpenFileButton.addEventListener("click", window.api.showOpenDialog);
Elements.SaveMarkdownButton.addEventListener("click", () =>
  window.api.saveFile(Elements.MarkdownView.value),
);
Elements.ExportHtmlButton.addEventListener("click", () =>
  window.api.showSaveDialog(Elements.RenderedView.innerHTML),
);
Elements.NewFileButton.addEventListener('click', () => {
    changeMarkdownContent('');
    Elements.SaveMarkdownButton.disabled = false;
    window.api.openNewFile();
    changeLacksFilePath(true);
})
Elements.ShowFileButton.addEventListener('click', window.api.showFile);
Elements.OpenInDefaultApplicationButton.addEventListener('click', window.api.openInDefaultApp);

