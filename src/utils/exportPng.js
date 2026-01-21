import { toPng } from "html-to-image";

export async function exportElementToPng(elementId, filename = "export.png") {
  const node = document.getElementById(elementId);
  if (!node) throw new Error(`Element not found: ${elementId}`);

  const clone = node.cloneNode(true);

  const wrapper = document.createElement("div");
  wrapper.style.position = "fixed";
  wrapper.style.left = "-10000px";
  wrapper.style.top = "0";
  wrapper.style.background = "white";
  wrapper.style.padding = "0";
  wrapper.style.zIndex = "-1";

  // ✅ Force full width and visible overflow
  clone.style.maxWidth = "none";
  clone.style.width = `${node.scrollWidth}px`;
  clone.style.overflow = "visible";

  // ✅ Add export-only padding (gives bottom margin in PNG)
  clone.style.padding = "16px";
  clone.style.background = "#ffffff";

  wrapper.appendChild(clone);
  document.body.appendChild(wrapper);

  try {
    // Recompute after styles applied
    const w = clone.scrollWidth;
    const h = clone.scrollHeight;

    const bottomPad = 24; // extra pixels at bottom (tweak to taste)

    const dataUrl = await toPng(clone, {
      backgroundColor: "#ffffff",
      pixelRatio: 2,
      width: w,
      height: h + bottomPad, // ✅ add a bit more height
      style: { overflow: "visible" },
    });

    const link = document.createElement("a");
    link.download = filename;
    link.href = dataUrl;
    link.click();
  } finally {
    document.body.removeChild(wrapper);
  }
}
