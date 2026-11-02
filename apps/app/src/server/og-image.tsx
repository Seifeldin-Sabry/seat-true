import bricolage800 from "@fontsource/bricolage-grotesque/files/bricolage-grotesque-latin-800-normal.woff?inline";
import inter400 from "@fontsource/inter/files/inter-latin-400-normal.woff?inline";
import inter600 from "@fontsource/inter/files/inter-latin-600-normal.woff?inline";
import { Resvg } from "@resvg/resvg-js";
import satori from "satori";

/** Vite inlines assets as base64 data URLs; satori wants the raw bytes. */
function fontBytes(dataUrl: string): ArrayBuffer {
  const bytes = Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.length);
}

const fonts = [
  { name: "Bricolage", data: fontBytes(bricolage800), weight: 800 as const },
  { name: "Inter", data: fontBytes(inter400), weight: 400 as const },
  { name: "Inter", data: fontBytes(inter600), weight: 600 as const },
];

const color = {
  paper: "#f8f4ec",
  ink: "#1b2230",
  ink2: "#454c59",
  leak: "#c93d00",
  leakInk: "#fffdf9",
  rule: "#e3dccd",
};

export type OgCard = { eyebrow: string; title: string; footer: string };

/** 1200×630 PNG in the SeatTrue look: wordmark, eyebrow, headline, footer rule. */
export async function renderOgImage(
  card: OgCard,
): Promise<Uint8Array<ArrayBuffer>> {
  const titleSize =
    card.title.length > 60 ? 60 : card.title.length > 40 ? 68 : 78;
  const svg = await satori(
    <div
      style={{
        width: 1200,
        height: 630,
        display: "flex",
        flexDirection: "column",
        background: color.paper,
        color: color.ink,
        fontFamily: "Inter",
      }}
    >
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "56px 72px 40px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: color.leak,
              color: color.leakInk,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: "Bricolage",
              fontSize: 34,
            }}
          >
            S
          </div>
          <div style={{ fontFamily: "Bricolage", fontSize: 36 }}>SeatTrue</div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          <div
            style={{
              color: color.leak,
              fontSize: 24,
              fontWeight: 600,
              letterSpacing: 2,
              textTransform: "uppercase",
            }}
          >
            {card.eyebrow}
          </div>
          <div
            style={{
              fontFamily: "Bricolage",
              fontSize: titleSize,
              lineHeight: 1.05,
              letterSpacing: -1.5,
              maxWidth: 1000,
            }}
          >
            {card.title}
          </div>
        </div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            paddingTop: 24,
            borderTop: `2px solid ${color.rule}`,
            color: color.ink2,
            fontSize: 24,
          }}
        >
          <span>{card.footer}</span>
          <span>Microsoft 365 license reconciliation for MSPs</span>
        </div>
      </div>
      <div style={{ height: 16, background: color.leak }} />
    </div>,
    { width: 1200, height: 630, fonts },
  );
  const png = new Resvg(svg, { fitTo: { mode: "width", value: 1200 } })
    .render()
    .asPng();
  return new Uint8Array(png);
}
