import { toPng } from "html-to-image";

export async function exportElementToPng(elementId, filename) {
  const node = document.getElementById(elementId);
  if (!node) throw new Error("Export element not found");

  const dataUrl = await toPng(node, {
    cacheBust: true,
    backgroundColor: "white",
  });

  const link = document.createElement("a");
  link.download = filename;
  link.href = dataUrl;
  link.click();
}
