import { Worker, Job } from 'bullmq';
import { redisConnection } from '../db/redis';
import { query } from '../db/connection';
import { logAudit } from '../services/audit';
import { canTransition } from '../services/transitions';
import { generateWithModel, cleanAndParseJSON } from '../services/aiService';
import { PromptId, getPromptTemplate, fillPromptVariables } from '../services/prompts';
import { v4 as uuidv4 } from 'uuid';

interface AgentFillData {
    itemId: string;
}

// ---------------------------------------------------------------------------
// Determine the best prompt template based on the content item's properties
// ---------------------------------------------------------------------------
function selectPromptId(item: Record<string, string | null>): PromptId {
    const goal = (item.campaign_goal || '').toLowerCase();

    if (goal.includes('email')) return PromptId.EMAIL_CAMPAIGN;
    if (goal.includes('flyer') || goal.includes('print')) return PromptId.FLYER_CONTENT;
    if (goal.includes('brand') || goal.includes('dna')) return PromptId.BRAND_DNA;
    if (goal.includes('product') || goal.includes('analysis')) return PromptId.PRODUCT_DNA;
    if (goal.includes('strategy') || goal.includes('concept')) return PromptId.SOCIAL_STRATEGY;

    // Default: social posts (most common content type)
    return PromptId.SOCIAL_POSTS;
}

// ---------------------------------------------------------------------------
// Build variable map for a given prompt template from a content item
// ---------------------------------------------------------------------------
function buildVariables(
    promptId: PromptId,
    item: Record<string, string | null>,
): Record<string, string> {
    const brand = item.brand || 'Unknown Brand';
    const platform = item.platform || 'Instagram';
    const direction = item.direction || '';
    const productUrl = item.product_url || '';
    const productTitle = item.product_title || '';
    const campaignGoal = item.campaign_goal || '';

    const brandContext = `Brand: ${brand}\nPlatform: ${platform}\nCreative Direction: ${direction}`;
    const productContext = productUrl
        ? `Product URL: ${productUrl}\nProduct: ${productTitle}`
        : 'Focus: General Brand Awareness';

    switch (promptId) {
        case PromptId.BRAND_DNA:
            return {
                '{{URL}}': productUrl || 'N/A',
                '{{BRAND_NAME}}': brand,
            };

        case PromptId.PRODUCT_DNA:
            return {
                '{{PRODUCT_INPUT}}': productUrl || productTitle || brand,
                '{{BRAND_CONTEXT}}': brandContext,
            };

        case PromptId.EMAIL_CAMPAIGN:
            return {
                '{{BRAND_CONTEXT}}': brandContext,
                '{{PRODUCT_CONTEXT}}': productContext,
                '{{OBJECTIVE}}': campaignGoal || 'Drive engagement and conversions',
                '{{DESIGN_SYSTEM}}': 'Use a modern, clean email layout with responsive design.',
            };

        case PromptId.SOCIAL_STRATEGY:
            return {
                '{{BRAND_CONTEXT}}': brandContext,
                '{{PRODUCT_CONTEXT}}': productContext,
                '{{COUNT}}': '3',
            };

        case PromptId.SOCIAL_POSTS:
            return {
                '{{BRAND_CONTEXT}}': brandContext,
                '{{CONCEPT_TITLE}}': campaignGoal || 'Brand Awareness',
                '{{CONCEPT_HOOK}}': direction || 'Engage the target audience',
                '{{VISUAL_DIRECTION}}': 'Modern, eye-catching, platform-native aesthetic',
                '{{IMAGE_INSTRUCTIONS}}': `Create image prompts suitable for ${platform}.`,
            };

        case PromptId.FLYER_CONTENT:
            return {
                '{{BRAND_CONTEXT}}': brandContext,
                '{{PRODUCT_CONTEXT}}': productContext,
                '{{FLYER_TYPE}}': campaignGoal || 'Promotional',
            };

        default:
            return {
                '{{BRAND_CONTEXT}}': brandContext,
                '{{PRODUCT_CONTEXT}}': productContext,
            };
    }
}

// ---------------------------------------------------------------------------
// Main worker processor
// ---------------------------------------------------------------------------
async function processAgentFill(job: Job<AgentFillData>) {
    const { itemId } = job.data;
    console.log(`[agent-fill] Processing item ${itemId}`);

    // 1. Fetch the content item
    const itemResult = await query('SELECT * FROM content_items WHERE id = $1', [itemId]);
    if (itemResult.rows.length === 0) {
        throw new Error(`Content item ${itemId} not found`);
    }
    const item = itemResult.rows[0] as Record<string, string | null>;

    // 2. Select prompt template and build variables
    const promptId = selectPromptId(item);
    const template = getPromptTemplate(promptId);
    const variables = buildVariables(promptId, item);
    const prompt = fillPromptVariables(template, variables);

    console.log(`[agent-fill] Using prompt "${promptId}" for item ${itemId}`);

    // 3. Call the AI model
    const modelId = process.env.DEFAULT_AI_MODEL || 'gemini-2.0-flash';
    let aiResponseText: string;

    try {
        aiResponseText = await generateWithModel(prompt, '', modelId);
    } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        console.error(`[agent-fill] AI generation failed for item ${itemId}:`, message);

        // Store the error as an output so the user can see what happened
        await query(
            `INSERT INTO content_item_outputs (id, content_item_id, output_type, output_data, created_by)
             VALUES ($1, $2, $3, $4, $5)`,
            [
                uuidv4(),
                itemId,
                'error',
                JSON.stringify({ error: message, prompt_id: promptId, model: modelId }),
                'agent-worker',
            ],
        );
        throw err;
    }

    // 4. Parse the AI response
    let parsedOutput: unknown;
    try {
        parsedOutput = cleanAndParseJSON(aiResponseText);
    } catch (_parseErr) {
        // If JSON parsing fails, treat the raw text as draft copy
        parsedOutput = { text: aiResponseText };
    }

    // 5. Build outputs to store
    const draftCopy =
        typeof parsedOutput === 'object' && parsedOutput !== null
            ? (parsedOutput as Record<string, unknown>).bodyContent ??
              (parsedOutput as Record<string, unknown>).caption ??
              (parsedOutput as Record<string, unknown>).headline ??
              (parsedOutput as Record<string, unknown>).text ??
              JSON.stringify(parsedOutput)
            : String(parsedOutput);

    const outputs: { type: string; data: unknown }[] = [
        { type: 'draft_copy', data: parsedOutput },
        {
            type: 'metadata',
            data: {
                prompt_id: promptId,
                model: modelId,
                generated_at: new Date().toISOString(),
            },
        },
    ];

    // 6. Insert outputs into content_item_outputs
    for (const output of outputs) {
        await query(
            `INSERT INTO content_item_outputs (id, content_item_id, output_type, output_data, created_by)
             VALUES ($1, $2, $3, $4, $5)`,
            [uuidv4(), itemId, output.type, JSON.stringify(output.data), 'agent-worker'],
        );
    }

    // 7. Update final_copy on the content item
    const finalCopy = typeof draftCopy === 'string' ? draftCopy : JSON.stringify(draftCopy);
    await query('UPDATE content_items SET final_copy = $1, updated_at = NOW() WHERE id = $2', [
        finalCopy,
        itemId,
    ]);

    // 8. Transition idea → draft using canTransition for safety
    if (item.status === 'idea' && canTransition('idea', 'draft', 'staff')) {
        await query(
            "UPDATE content_items SET status = 'draft', updated_at = NOW() WHERE id = $1",
            [itemId],
        );

        await logAudit({
            entityType: 'content_item',
            entityId: itemId,
            action: 'transition',
            actor: 'agent-worker',
            actorRole: 'staff',
            details: { from: 'idea', to: 'draft', reason: 'Agent fill completed' },
        });
    }

    // 9. Log agent fill completed
    await logAudit({
        entityType: 'content_item',
        entityId: itemId,
        action: 'agent_fill_completed',
        actor: 'agent-worker',
        actorRole: 'staff',
        details: {
            prompt_id: promptId,
            model: modelId,
            outputs_generated: outputs.map((o) => o.type),
            draft_copy_length: finalCopy.length,
        },
    });

    console.log(`[agent-fill] Completed item ${itemId}`);
}

// ---------------------------------------------------------------------------
// Worker lifecycle
// ---------------------------------------------------------------------------
let worker: Worker | null = null;

export function startAgentWorker() {
    worker = new Worker<AgentFillData>('agent-fill', processAgentFill, {
        connection: redisConnection,
        concurrency: 3,
    });

    worker.on('completed', (job) => {
        console.log(`[agent-fill] Job ${job.id} completed for item ${job.data.itemId}`);
    });

    worker.on('failed', (job, err) => {
        console.error(`[agent-fill] Job ${job?.id} failed:`, err.message);
    });

    console.log('Agent worker started on queue "agent-fill"');
    return worker;
}

export function getWorker() {
    return worker;
}
