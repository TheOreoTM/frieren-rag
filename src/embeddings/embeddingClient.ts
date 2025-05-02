import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config";

const isUsingOpenAI = config.openaiApiKey !== undefined;

let openaiClient: OpenAI | undefined;
let googleGenAIClient: GoogleGenerativeAI | undefined;

if (isUsingOpenAI) {
    if (!config.openaiApiKey) throw new Error("OPENAI_API_KEY is not set.");
    openaiClient = new OpenAI({ apiKey: config.openaiApiKey });
} else {
    if (!config.googleApiKey) throw new Error("GOOGLE_API_KEY is not set.");
    googleGenAIClient = new GoogleGenerativeAI(config.googleApiKey);
}

export async function generateEmbedding(text: string): Promise<number[]> {
    if (isUsingOpenAI) {
        if (!openaiClient) throw new Error("OpenAI client not initialized.");
        const response = await openaiClient.embeddings.create({
            model: config.embeddingModelName,
            input: text,
        });
        return response.data[0].embedding;
    } else {
        // Using Google
        if (!googleGenAIClient) throw new Error("Google client not initialized.");
        const model = googleGenAIClient.getGenerativeModel({ model: config.embeddingModelName });
        const result = await model.embedContent(text);
        if (!result.embedding || !result.embedding.values) {
            throw new Error("Failed to generate embedding from Google API.");
        }
        return result.embedding.values;
    }
}

export async function generateEmbeddings(chunks: string[]): Promise<number[][]> {
    // Note: For production, implement proper batching based on API limits and efficiency recommendations
    const embeddings: number[][] = [];
    for (const chunk of chunks) {
        embeddings.push(await generateEmbedding(chunk));
    }
    return embeddings;
}
