/**
 * FACE: turn a bridge result into MCP content blocks. A result with `image: { mimeType, data }`
 * (render_schematic) is shown to the assistant as a picture instead of a wall of base64.
 */
type Content = { type: "text"; text: string } | { type: "image"; mimeType: string; data: string };

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

export function toolResultContent(result: unknown): Content[] {
  if (result && typeof result === "object" && "image" in result) {
    const { image, ...rest } = result as { image?: { mimeType?: unknown; data?: unknown } };
    if (image && typeof image.data === "string" && typeof image.mimeType === "string" && IMAGE_TYPES.has(image.mimeType)) {
      return [
        { type: "image", mimeType: image.mimeType, data: image.data },
        { type: "text", text: JSON.stringify(rest, null, 2) },
      ];
    }
  }
  return [{ type: "text", text: JSON.stringify(result, null, 2) }];
}
