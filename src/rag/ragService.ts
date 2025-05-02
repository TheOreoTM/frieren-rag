// src/rag/ragService.ts
import OpenAI from "openai"; // If using OpenAI LLM
import { GoogleGenerativeAI } from "@google/generative-ai"; // If using Google LLM
import { config } from "../config";
import { generateEmbedding } from "../embeddings/embeddingClient";
import { VectorDatabase } from "../vectorDb/vectorDbClient";

let llmClient: OpenAI | GoogleGenerativeAI;
let llmModel: string;

if (config.llmModelName.includes("gpt")) {
    if (!config.openaiApiKey) throw new Error("OpenAI API key not set for LLM.");
    llmClient = new OpenAI({ apiKey: config.openaiApiKey });
    llmModel = config.llmModelName;
} else if (config.llmModelName.includes("gemini")) {
    if (!config.googleApiKey) throw new Error("Google API key not set for LLM.");
    llmClient = new GoogleGenerativeAI(config.googleApiKey);
    llmModel = config.llmModelName;
} else {
    throw new Error(`Unsupported LLM model specified in config: ${config.llmModelName}`);
}

export async function queryFrierenRAG(userQuery: string, vectorDb: VectorDatabase): Promise<string> {
    console.log("Embedding user query...");
    const queryEmbedding = await generateEmbedding(userQuery);

    console.log(`Searching vector database for top ${config.retrievalTopK} results...`);
    const relevantChunks = await vectorDb.search(queryEmbedding, config.retrievalTopK);

    if (relevantChunks.length === 0) {
        console.log("No relevant chunks found.");
        return "I couldn't find relevant information about that in the Frieren data.";
    }

    console.log(`Found ${relevantChunks.length} relevant chunks.`);

    const context = relevantChunks.map((item) => item.chunk).join("\n---\n"); // Join chunks with a separator

    const prompt = `You are an AI assistant providing information about Frieren: Beyond Journey's End.
Use the following information provided in the "Context" section to answer the "User Question".
Synthesize the answer by combining relevant details from the provided Context.
If the necessary information to answer the question is not present in the Context, state clearly: "I cannot find the answer in the provided information."
Do not include information from outside the provided context.

Context:
${context}

User Question: ${userQuery}

Answer:`;

    console.log(`Calling LLM (${llmModel}) with context...`);
    try {
        if (llmClient instanceof OpenAI) {
            const completion = await llmClient.chat.completions.create({
                model: llmModel,
                messages: [{ role: "user", content: prompt }],
                max_tokens: 800,
                temperature: 0.1,
            });
            return completion.choices[0].message.content || "Could not generate a response.";
        } else if (llmClient instanceof GoogleGenerativeAI) {
            const model = llmClient.getGenerativeModel({ model: llmModel });
            const result = await model.generateContent(prompt);
            const response = await result.response;
            return response.text();
        } else {
            return "Internal error: LLM client not properly initialized.";
        }
    } catch (error) {
        console.error("Error calling the language model:", error);
        return `An error occurred while generating the response: ${(error as any).message || "Unknown error"}`;
    }
}
