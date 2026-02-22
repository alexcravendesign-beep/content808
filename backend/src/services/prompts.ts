// ============================================================================
// Prompt Templates — Ported from CravenDesignHQ/services/geminiService.ts
// ============================================================================

export enum PromptId {
  BRAND_DNA = 'brand_dna',
  PRODUCT_DNA = 'product_dna',
  EMAIL_CAMPAIGN = 'email_campaign',
  SOCIAL_STRATEGY = 'social_strategy',
  SOCIAL_POSTS = 'social_posts',
  FLYER_CONTENT = 'flyer_content',
  SCENE_DESCRIPTION = 'scene_description',
  IMAGE_GEN_PRO = 'image_gen_pro',
  IMAGE_GEN_FREE = 'image_gen_free',
  IMAGE_EDIT = 'image_edit',
  CHAT_ALEX = 'chat_alex',
}

export interface PromptTemplate {
  id: PromptId;
  name: string;
  description: string;
  variables: string[];
  template: string;
}

// ---------------------------------------------------------------------------
// Default prompt registry
// ---------------------------------------------------------------------------
export const CONTENT_PROMPTS: Record<PromptId, PromptTemplate> = {
  // ── Brand DNA ──────────────────────────────────────────────────────────
  [PromptId.BRAND_DNA]: {
    id: PromptId.BRAND_DNA,
    name: 'Brand DNA Extraction',
    description: 'Analyzes a website URL to extract visual identity, voice, and strategy.',
    variables: ['{{URL}}', '{{BRAND_NAME}}'],
    template: `ROLE: Expert Chief Marketing Officer and Visual Brand Strategist.

TASK: Conduct a deep strategic and visual analysis of the brand "{{BRAND_NAME}}" based on its website URL: {{URL}}. Use Google Search to visit the site.

REQUIREMENTS:
1. Colors: Extract at least 3 distinct colors (Hex codes) and their usage (Primary, Accent, etc).
2. Visual Style: Describe the aesthetic (e.g. "Minimalist with organic shapes").
3. Archetype: Assign one of the 12 Jungian Brand Archetypes.
4. Contact: Extract physical address, phone, and email.
5. Competitors: Identify 3-5 real-world competitors.
6. Marketing Angles: Identify 3 distinct psychological hooks.

OUTPUT FORMAT:
Return a JSON Object matching this structure (Do not use Markdown blocks):
{
  "name": "string",
  "tagline": "string",
  "description": "string",
  "visualStyle": "string",
  "colors": [{ "name": "string", "hex": "#...", "usage": "string" }],
  "typography": [{ "family": "string", "usage": "string", "fallback": "serif|sans-serif" }],
  "voice": ["string", "string"],
  "logoDescription": "string",
  "values": ["string"],
  "demographics": { "ageRange": "string", "gender": "string", "location": "string", "incomeLevel": "string" },
  "targetAudience": ["string"],
  "brandArchetype": "string",
  "uniqueValueProposition": "string",
  "competitors": ["string"],
  "marketingAngles": ["string"],
  "contact": { "address": "string", "phone": "string", "email": "string" }
}`,
  },

  // ── Product DNA ────────────────────────────────────────────────────────
  [PromptId.PRODUCT_DNA]: {
    id: PromptId.PRODUCT_DNA,
    name: 'Product Analysis',
    description: 'Analyzes a product for marketing angles, benefits, specs, and price.',
    variables: ['{{PRODUCT_INPUT}}', '{{BRAND_CONTEXT}}'],
    template: `ROLE: Senior Product Marketing Manager and Technical Copywriter.

CONTEXT:
Analyzing Product Input (URL or Name): "{{PRODUCT_INPUT}}"
{{BRAND_CONTEXT}}

TASK: Conduct a comprehensive product analysis. If the input is a URL, use Google Search to find specific details.

REQUIREMENTS:
1.  **Price**: Find the actual selling price (e.g. "£499.00"). If not found, estimate based on market or leave as "Contact for Price".
2.  **Description**: Write a compelling 2-3 sentence product summary that feels like a sales page intro.
3.  **Specs**: Extract key technical specifications (Dimensions, Capacity, Power, Material, Temperature Range, etc.).
4.  **Energy**: Look specifically for Annual Energy Consumption (kWh/annum) or Power (Watts). Extract just the number for "annualEnergyConsumption" if found (assume kWh).
5.  **Marketing Angles**: Generate exactly 6 DISTINCT marketing hooks. Provide a catchy "title" and a persuasive "content" body (2-3 sentences) for each.
6.  **Psychology**: Deep dive into pain points and benefits.

OUTPUT FORMAT:
Return a JSON Object matching this structure (Do not use Markdown blocks):
{
  "name": "string",
  "category": "string",
  "description": "string",
  "price": "string",
  "pricePoint": "Budget | Mid-Range | Premium",
  "technicalSpecs": ["string", "string", "string"],
  "annualEnergyConsumption": "string (number only, e.g. '365')",
  "targetAudience": ["string"],
  "usp": "string",
  "features": ["string"],
  "visualStyle": "string",
  "painPoints": ["string"],
  "benefits": ["string"],
  "marketingAngles": [
    { "title": "Speed Demon", "content": "This product cuts prep time in half..." },
    { "title": "Energy Saver", "content": "Reduce overheads with..." }
  ],
  "competitors": ["string"]
}`,
  },

  // ── Email Campaign ─────────────────────────────────────────────────────
  [PromptId.EMAIL_CAMPAIGN]: {
    id: PromptId.EMAIL_CAMPAIGN,
    name: 'Email Campaign Generator',
    description: 'Generates the structure and copy for an HTML email.',
    variables: ['{{BRAND_CONTEXT}}', '{{PRODUCT_CONTEXT}}', '{{OBJECTIVE}}', '{{DESIGN_SYSTEM}}'],
    template: `ROLE: Expert Email Developer & Conversion Copywriter.

CONTEXT:
{{BRAND_CONTEXT}}
{{PRODUCT_CONTEXT}}

CAMPAIGN OBJECTIVE: {{OBJECTIVE}}

{{DESIGN_SYSTEM}}

TASK: Create high-converting content for a structured HTML email template.

REQUIREMENTS:
1. Subject Lines: 3 distinct options (Curiosity, Benefit, Urgency).
2. Hero Image Prompt: A creative AI prompt for the header image.
3. Body: Persuasive, short paragraphs.
4. Benefits: Exactly 3 key bullet points.
5. Tone: Match the brand voice.

OUTPUT FORMAT:
Return a JSON Object matching this structure (Do not use Markdown blocks):
{
  "subjectLines": ["string", "string", "string"],
  "preheader": "string",
  "headline": "string",
  "heroImagePrompt": "string",
  "bodyContent": "string (plain text, no HTML tags)",
  "keyBenefits": ["string", "string", "string"],
  "ctaText": "string",
  "ctaUrl": "string"
}`,
  },

  // ── Social Strategy ────────────────────────────────────────────────────
  [PromptId.SOCIAL_STRATEGY]: {
    id: PromptId.SOCIAL_STRATEGY,
    name: 'Social Media Strategy',
    description: 'Generates high-level concepts for social campaigns.',
    variables: ['{{BRAND_CONTEXT}}', '{{PRODUCT_CONTEXT}}', '{{COUNT}}'],
    template: `ROLE: Creative Director for a Digital Marketing Agency.

CONTEXT:
{{BRAND_CONTEXT}}
{{PRODUCT_CONTEXT}}

TASK: Generate {{COUNT}} distinct strategic concepts for a social media campaign.

REQUIREMENTS:
- Concepts must be diverse (e.g., Educational, Lifestyle, Promotional).
- Explain the Rationale and Visual Direction for each.

OUTPUT FORMAT:
Return a JSON Array of objects (Do not use Markdown blocks):
[
  {
    "id": "concept_1",
    "title": "Short catchy title",
    "hook": "The core message/angle",
    "rationale": "Strategic reasoning",
    "visualDirection": "Mood and style description"
  }
]`,
  },

  // ── Social Posts ───────────────────────────────────────────────────────
  [PromptId.SOCIAL_POSTS]: {
    id: PromptId.SOCIAL_POSTS,
    name: 'Social Posts & Image Prompts',
    description: 'Generates captions and detailed AI image prompts for specific posts.',
    variables: [
      '{{BRAND_CONTEXT}}',
      '{{CONCEPT_TITLE}}',
      '{{CONCEPT_HOOK}}',
      '{{VISUAL_DIRECTION}}',
      '{{IMAGE_INSTRUCTIONS}}',
    ],
    template: `ROLE: Social Media Manager & Visual Prompt Engineer.

CONTEXT:
{{BRAND_CONTEXT}}

SELECTED CONCEPT:
Title: {{CONCEPT_TITLE}}
Hook: {{CONCEPT_HOOK}}
Visual Direction: {{VISUAL_DIRECTION}}

{{IMAGE_INSTRUCTIONS}}

TASK: Create exactly 3 social media posts based on this concept.

OUTPUT FORMAT:
Return a JSON Array of objects (Do not use Markdown blocks):
[
  {
    "id": "post_1",
    "platform": "Instagram" | "Facebook" | "LinkedIn",
    "caption": "string",
    "hashtags": ["string"],
    "imagePrompt": "string (The optimized prompt for the image model)"
  }
]`,
  },

  // ── Flyer Content ──────────────────────────────────────────────────────
  [PromptId.FLYER_CONTENT]: {
    id: PromptId.FLYER_CONTENT,
    name: 'Flyer Content Generator',
    description: 'Generates copy and layout directives for print flyers.',
    variables: ['{{BRAND_CONTEXT}}', '{{PRODUCT_CONTEXT}}', '{{FLYER_TYPE}}'],
    template: `ROLE: Professional Advertising Copywriter.

CONTEXT:
{{BRAND_CONTEXT}}
{{PRODUCT_CONTEXT}}

FLYER TYPE: {{FLYER_TYPE}}

TASK: Generate content and visual layout directives for a single-page flyer.

OUTPUT FORMAT:
Return a JSON Object matching this structure (Do not use Markdown blocks):
{
  "headline": "string",
  "subheadline": "string",
  "keyBenefits": ["string", "string", "string"],
  "bodyCopy": "string",
  "technicalSpecs": ["string", "string"],
  "footerContact": "string",
  "visualDirectives": "string"
}`,
  },

  // ── Scene Description ──────────────────────────────────────────────────
  [PromptId.SCENE_DESCRIPTION]: {
    id: PromptId.SCENE_DESCRIPTION,
    name: 'AI Scene Architect',
    description: 'Generates the physical environment description for the "AI Architect" feature in Design Studio.',
    variables: [
      '{{BRAND_NAME}}',
      '{{VISUAL_STYLE}}',
      '{{BRAND_COLORS}}',
      '{{ARCHETYPE}}',
      '{{PRODUCT_NAME}}',
      '{{PRODUCT_CATEGORY}}',
    ],
    template: `ROLE: Senior Art Director for High-End Commercial Photography.

TASK: Write a concise but vividly detailed scene description for a product photoshoot.

BRAND DNA:
- Name: {{BRAND_NAME}}
- Visual Style: {{VISUAL_STYLE}}
- Colors: {{BRAND_COLORS}}
- Archetype: {{ARCHETYPE}}

PRODUCT:
- Name: {{PRODUCT_NAME}}
- Category: {{PRODUCT_CATEGORY}}

REQUIREMENTS:
- Create a physical environment that embodies the brand's DNA (e.g. if Industrial, use concrete/metal; if Luxury, use velvet/marble).
- Describe the lighting (rim lighting, gobos, softboxes) specifically.
- Describe the background surfaces and textures.
- NO humans. Focus on the stage for the object.
- Length: 2-3 sentences max.

OUTPUT EXAMPLE:
"High-end industrial studio environment inspired by precision engineering. The space is architectural and minimal, built from layered matte-black planes with sharp geometric lines. White technical light strips frame the scene like calibration markers."`,
  },

  // ── Image Gen Pro ──────────────────────────────────────────────────────
  [PromptId.IMAGE_GEN_PRO]: {
    id: PromptId.IMAGE_GEN_PRO,
    name: 'Image Generation (Pro)',
    description: 'The system prompt wrapping your requests when using the Paid Tier (Gemini Pro Image).',
    variables: ['{{IMAGE_PROMPT}}', '{{BRAND_COLORS}}'],
    template: `ACT AS: A World-Class Commercial Photographer and 3D Artist.
TASK: Create a 2K resolution, award-winning advertising image.
CORE PROMPT: {{IMAGE_PROMPT}}
ADVANCED ART DIRECTION:
- **Lighting**: Global Illumination, Studio.
- **Color Grading**: Cinematic grade using: [{{BRAND_COLORS}}].
- **Composition**: Golden Ratio.
QUALITY STANDARD: Photorealistic, 4k, Commercial Grade, No Artifacts.`,
  },

  // ── Image Gen Free ─────────────────────────────────────────────────────
  [PromptId.IMAGE_GEN_FREE]: {
    id: PromptId.IMAGE_GEN_FREE,
    name: 'Image Generation (Free)',
    description: 'The system prompt wrapping your requests when using the Free Tier (Flash Image).',
    variables: ['{{IMAGE_PROMPT}}', '{{BRAND_COLORS}}'],
    template: `Create a high-quality social media image based on this prompt: {{IMAGE_PROMPT}}.
Colors: Use {{BRAND_COLORS}}.
Requirements: Photorealistic, clear focus on the product, good lighting.`,
  },

  // ── Image Edit ─────────────────────────────────────────────────────────
  [PromptId.IMAGE_EDIT]: {
    id: PromptId.IMAGE_EDIT,
    name: 'Image Editing (Refine)',
    description: 'System instruction for the "Edit & Refine" mode.',
    variables: ['{{EDIT_INSTRUCTION}}'],
    template: `ACT AS: Expert Photo Retoucher.
TASK: Edit the input image based on these instructions: {{EDIT_INSTRUCTION}}
REQUIREMENTS: Maintain the realism and core subject of the original image unless told otherwise.`,
  },

  // ── Chat Alex ──────────────────────────────────────────────────────────
  [PromptId.CHAT_ALEX]: {
    id: PromptId.CHAT_ALEX,
    name: 'Alex (Dashboard Assistant)',
    description: 'System instruction for the interactive chatbot.',
    variables: ['{{BRAND_KNOWLEDGE_BASE}}'],
    template: `You are Alex, the advanced AI assistant for Content808.
    
YOUR ROLE:
You help users manage Brand DNA, Product DNA, and Marketing assets.
You have access to the dashboard's navigation and form-filling capabilities.

YOUR KNOWLEDGE BASE (Brands you know):
{{BRAND_KNOWLEDGE_BASE}}

CAPABILITIES:
1. Answer questions about the brands.
2. Navigate the app for the user.
3. Draft new product profiles.
4. Draft new brand profiles.
5. Switch the active brand context.

BEHAVIOR:
- Be concise, professional, and helpful.
- If a user asks to "create a product" or "go to settings", USE THE TOOLS. Do not just say you will do it.
- If you use a tool, explain briefly what you are doing.`,
  },
};

// ---------------------------------------------------------------------------
// Helper: get a prompt template string by ID
// ---------------------------------------------------------------------------
export function getPromptTemplate(id: PromptId): string {
  return CONTENT_PROMPTS[id].template;
}

// ---------------------------------------------------------------------------
// Helper: list all available prompts (metadata only)
// ---------------------------------------------------------------------------
export function getAvailablePrompts(): PromptTemplate[] {
  return Object.values(CONTENT_PROMPTS);
}

// ---------------------------------------------------------------------------
// Helper: perform variable substitution on a prompt template
// ---------------------------------------------------------------------------
export function fillPromptVariables(
  template: string,
  variables: Record<string, string>,
): string {
  let result = template;
  for (const [key, value] of Object.entries(variables)) {
    const placeholder = key.startsWith('{{') ? key : `{{${key}}}`;
    result = result.split(placeholder).join(value);
  }
  return result;
}
