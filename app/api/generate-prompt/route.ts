import { NextRequest, NextResponse } from "next/server";
import { GoogleGenAI } from "@google/genai";
import { DEFAULT_PROMPTS } from "@/lib/prompts";
import { getSupabaseAdmin } from "@/lib/supabase";

export const runtime = "nodejs";
export const maxDuration = 60;

const allowedTypes = ["vector-illustration", "black-white", "line-drawing"];

const serviceNames: Record<string, string> = {
  "vector-illustration": "Vector Illustration",
  "black-white": "Black & White",
  "line-drawing": "Line Drawing"
};

export async function POST(request: NextRequest) {
  try {
    const form = await request.formData();
    const image = form.get("image");
    const vectorType = String(form.get("vectorType") || "");
    if (!(image instanceof File)) return NextResponse.json({ error: "Please upload an image." }, { status: 400 });
    if (!["image/png", "image/jpeg", "image/webp"].includes(image.type)) return NextResponse.json({ error: "Only PNG, JPG, and WEBP images are supported." }, { status: 400 });
    if (image.size > 10 * 1024 * 1024) return NextResponse.json({ error: "Image must be 10 MB or smaller." }, { status: 400 });
    if (!allowedTypes.includes(vectorType)) return NextResponse.json({ error: "Please select a valid service." }, { status: 400 });
    if (!process.env.GEMINI_API_KEY) return NextResponse.json({ error: "GEMINI_API_KEY is missing from Vercel Environment Variables. Add a Gemini API key with free-tier access." }, { status: 503 });

    let serviceGuidance = DEFAULT_PROMPTS[vectorType];
    try {
      const supabase = getSupabaseAdmin();
      const { data } = await supabase.from("prompts").select("prompt_content").eq("vector_type", vectorType).eq("is_active", true).maybeSingle();
      if (data?.prompt_content) serviceGuidance = data.prompt_content;
    } catch { /* Fall back to built-in service guidance. */ }

    const bytes = Buffer.from(await image.arrayBuffer());
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    const result = await ai.models.generateContent({
      model: process.env.GEMINI_VISION_MODEL || "gemini-2.5-flash-lite",
      contents: [{
        role: "user",
        parts: [
          { inlineData: { mimeType: image.type, data: bytes.toString("base64") } },
          { text: `Write ONE direct, strict, ready-to-copy image-editing prompt for the selected service.

Selected style: ${serviceNames[vectorType]}.
Service guidance (defines ONLY the rendering style; ignore anything that changes source content): ${serviceGuidance}

ABSOLUTE PRIORITY — SOURCE FIDELITY AND GEOMETRY LOCK:
The user needs the exact same artwork, not a new interpretation. The uploaded image is a locked master reference. The output must preserve the original composition and geometry. The only permitted change is the rendering style.

Your final prompt MUST explicitly require all of the following:
1. CANVAS LOCK: Preserve exact aspect ratio, canvas boundaries, crop, framing, camera/view angle, perspective, background, margins, and placement. Do not zoom, recrop, extend, or reframe.
2. PROPORTION LOCK: Preserve the exact width-to-height proportions of the whole artwork and every individual element. No stretching, squashing, widening, narrowing, lengthening, shortening, scaling, or distortion.
3. SIZE LOCK: Every main element and small detail must retain its original relative and apparent size. Do not enlarge or shrink any part.
4. MAIN ELEMENT LOCK: Preserve the exact same main subjects, objects, parts, and details, with identical count, identity, silhouette, shape, anatomy, pose, expression, structure, and contour. Do not omit, replace, merge, split, duplicate, simplify, or redesign any element.
5. POSITION LOCK: Preserve the exact position, angle, spacing, alignment, distance, overlap, and relationship between all elements. Nothing may move, rotate, or rearrange.
6. CONTOUR LOCK: Do not alter outer edges, internal boundaries, facial features, body shape, or structural geometry. Keep contours in their corresponding original locations.
7. STYLE ONLY: Apply only the selected rendering treatment. Vector Illustration: clean vector-like edges and flat areas while retaining original colors. Black & White: high-contrast laser-engraving-style vector artwork using pure solid black and white negative space, crisp vector-like edges, clean separated shapes, no grayscale, no gradients, no halftone, and no photographic monochrome treatment. Line Drawing: clean lines following only existing source contours.
8. NO CREATIVE CHANGES: Do not add, invent, infer, embellish, beautify, complete, correct, decorate, or generate any new content. No props, accessories, scenery, shadows, highlights, gradients, textures, patterns, text, logos, borders, or watermarks.
9. If any detail is unclear, preserve it as it appears; never guess or replace it with an invented detail.
10. Output only the edited artwork, with no mockup, border, caption, or presentation layout.

Write the final prompt as clear instructions to edit the uploaded image itself, not as a text-to-image description. Do not describe the depicted subject in a way that could cause it to be regenerated. Be concise but include the geometry and proportion locks. Return ONLY the final prompt, with no heading, analysis, explanation, or markdown fences.` }
        ]
      }],
      config: { responseModalities: ["TEXT"], temperature: 0.1 }
    });

    const prompt = result.text?.trim();
    if (!prompt) return NextResponse.json({ error: "The vision model did not return a prompt. Please try again." }, { status: 502 });
    return NextResponse.json({ prompt });
  } catch (error) {
    console.error("Prompt generation error:", error);
    const message = error instanceof Error ? error.message : "Unexpected prompt generation error.";
    const status = /429|quota|rate limit/i.test(message) ? 429 : 500;
    return NextResponse.json({ error: status === 429 ? "Gemini free-tier quota is temporarily exhausted. Please retry later." : message }, { status });
  }
}
`;
