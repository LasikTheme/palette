// Renders palette.toml as SVG images for the README:
//   screenshots/palette.svg        the colors on the dark background (OBSIDIAN)
//   screenshots/palette-light.svg  the same colors on the white editor background of Lasik Light High Contrast
// The image is generated from the palette, so it can never go out of date like a screenshot.
//
// Run from the repo root:
//   deno run --allow-read --allow-write scripts/render-palette.ts
//
// --allow-read / --allow-write: Deno blocks file access by default, these let the script
// read palette.toml and write the SVG.

const PALETTE_FILE = "palette.toml"

// palette.toml only has lines like `RED_MUTED = "#bb6579"`, so a regex is enough (no TOML library)
const palette: Record<string, string> = {}
for (const line of (await Deno.readTextFile(PALETTE_FILE)).split("\n")) {
  const match = line.match(/^([A-Z_]+)\s*=\s*"(#[0-9a-fA-F]{6})"/)
  if (match) palette[match[1]] = match[2].toLowerCase()
}

// Lasik Light High Contrast editor background. The UI around the editor uses grays.
const LIGHT_BACKGROUND = "#ffffff"
const TIERS = ["_MUTED", "", "_DEEP", "_BRIGHT", "_QUIET"] // column order
const TIER_LABELS = ["Muted", "Base", "Deep", "Bright", "Quiet"]
// base color names, in rainbow order, then the neutrals and the 5 colors added later
const COLORS = [
  "RED", "PEACH", "TUMBLEWEED", "YELLOW", "GREEN", "TEAL", "SAPPHIRE", "BLUE", "MAUVE", "PINK",
  "LAVENDER", "SLATE", "APRICOT", "ROSE", "SKY", "PERIWINKLE", "SILVER",
]

// WCAG contrast ratio: (lighter luminance + 0.05) / (darker luminance + 0.05), from 1 to 21
function luminance(hex: string): number {
  const channels = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
  // undo the sRGB gamma curve to get linear light
  const [r, g, b] = channels.map((c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4))
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (light + 0.05) / (dark + 0.05)
}

// layout in pixels
const NAME_WIDTH = 140
const CELL_WIDTH = 190
const ROW_HEIGHT = 48
const SWATCH = 32
const TOP = 96 // room for the title and the column headings
const PADDING = 24
const width = PADDING * 2 + NAME_WIDTH + CELL_WIDTH * TIERS.length
const height = TOP + ROW_HEIGHT * COLORS.length + PADDING + 28

interface Look {
  file: string
  background: string
  backgroundName: string
  text: string // titles, names, hex values
  mutedText: string // contrast numbers and notes (at least 4.5:1)
  low: string // marks values below 4.5:1
  note: string // line at the bottom
}

function renderSvg(look: Look): string {
  let cells = ""
  COLORS.forEach((name, row) => {
    const y = TOP + row * ROW_HEIGHT
    cells += `<text x="${PADDING}" y="${y + 21}" class="name">${name}</text>\n`
    TIERS.forEach((tier, column) => {
      const hex = palette[name + tier]
      if (!hex) return // SILVER has no MUTED tier
      const x = PADDING + NAME_WIDTH + column * CELL_WIDTH
      const ratio = contrast(hex, look.background)
      const low = ratio < 4.5
      cells += `<rect x="${x}" y="${y}" width="${SWATCH}" height="${SWATCH}" rx="6" fill="${hex}" stroke="${palette.SLATE}"/>\n`
      cells += `<text x="${x + SWATCH + 10}" y="${y + 14}" class="hex">${hex}</text>\n`
      cells += `<text x="${x + SWATCH + 10}" y="${y + 30}" class="ratio${low ? " low" : ""}">` +
        `${ratio.toFixed(1)}:1${low ? " low" : ""}</text>\n`
    })
  })

  const headings = TIER_LABELS.map((label, column) =>
    `<text x="${PADDING + NAME_WIDTH + column * CELL_WIDTH}" y="${TOP - 16}" class="heading">${label}</text>`
  ).join("\n")

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" role="img" aria-labelledby="title desc">
<title id="title">Lasik palette on ${look.backgroundName}</title>
<desc id="desc">Every Lasik color in five tiers (muted, base, deep, bright, quiet) with its hex value and its contrast ratio against the ${look.backgroundName} background ${look.background}.</desc>
<style>
  text { font-family: ui-monospace, "JetBrains Mono", "Fira Code", Menlo, monospace; fill: ${look.text}; }
  .title { font-size: 22px; font-weight: 700; }
  .heading { font-size: 14px; font-weight: 700; }
  .name { font-size: 14px; font-weight: 700; }
  .hex { font-size: 13px; }
  .ratio, .note { font-size: 12px; fill: ${look.mutedText}; }
  .low { fill: ${look.low}; } /* a CSS class, because CSS would override a fill="" attribute */
</style>
<rect width="100%" height="100%" rx="12" fill="${look.background}"/>
<text x="${PADDING}" y="40" class="title">Lasik palette</text>
<text x="${PADDING + 190}" y="40" class="note">contrast against ${look.backgroundName} ${look.background} · "low" = below 4.5:1 (WCAG AA for text)</text>
${headings}
${cells}<text x="${PADDING}" y="${height - PADDING}" class="note">${look.note}</text>
</svg>
`
}

const LOOKS: Look[] = [
  {
    file: "screenshots/palette.svg",
    background: palette.OBSIDIAN,
    backgroundName: "OBSIDIAN",
    text: palette.LAVENDER_MUTED, // 13.7:1 on OBSIDIAN
    mutedText: palette.SLATE_MUTED, // 4.7:1
    low: palette.RED_MUTED,
    note: "Quiet colors are below WCAG on purpose: only the Lasik Dark Quiet variant uses them.",
  },
  {
    file: "screenshots/palette-light.svg",
    background: LIGHT_BACKGROUND,
    backgroundName: "white",
    text: "#0d1120", // the Light High Contrast text color, 18.8:1 on white
    mutedText: "#3b4566", // 9.4:1
    low: "#af013f", // vivid red, 7.2:1
    note: "These are the dark-theme colors. Lasik Light High Contrast uses vivid, darker versions of the DEEP colors (7:1 or more).",
  },
]

for (const look of LOOKS) {
  await Deno.writeTextFile(look.file, renderSvg(look))
  console.log(`wrote ${look.file}: ${Object.keys(palette).length} colors, ${width}x${height}px`)
}
// expected output:
// wrote screenshots/palette.svg: 86 colors, 1138x964px
// wrote screenshots/palette-light.svg: 86 colors, 1138x964px
