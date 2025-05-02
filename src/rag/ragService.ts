import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config";
import { generateEmbedding } from "../embeddings/embeddingClient";
import { VectorDatabase } from "../vectorDb/vectorDbClient";

let llmClient: OpenAI | GoogleGenerativeAI;
let llmModel: string;

if (config.llmModelName.includes("gpt")) {
    // Assuming GPT model names contain 'gpt'
    if (!config.openaiApiKey) throw new Error("OpenAI API key not set for LLM.");
    llmClient = new OpenAI({ apiKey: config.openaiApiKey });
    llmModel = config.llmModelName;
} else if (config.llmModelName.includes("gemini")) {
    // Assuming Gemini model names contain 'gemini'
    if (!config.googleApiKey) throw new Error("Google API key not set for LLM.");
    llmClient = new GoogleGenerativeAI(config.googleApiKey);
    llmModel = config.llmModelName;
} else {
    throw new Error(`Unsupported LLM model specified: ${config.llmModelName}`);
}

export async function queryFrierenRAG(userQuery: string, vectorDb: VectorDatabase): Promise<string> {
    // 1. Embed the user query
    console.log("Embedding user query...");
    const queryEmbedding = await generateEmbedding(userQuery);

    // 2. Search the vector database for relevant chunks
    console.log(`Searching vector database for top ${config.retrievalTopK} results...`);
    const relevantChunks = await vectorDb.search(queryEmbedding, config.retrievalTopK);

    if (relevantChunks.length === 0) {
        console.log("No relevant chunks found.");
        return "I couldn't find relevant information about that in the Frieren data.";
    }

    console.log(`Found ${relevantChunks.length} relevant chunks.`);

    // 3. Construct the prompt for the LLM
    const context = relevantChunks.map((item) => item.chunk).join("\n---\n"); // Join chunks with a separator

    const prompt = `Using the following information about Frieren: Beyond Journey's End, answer the user's question accurately and concisely.
Focus solely on the information provided in the context. If the information needed to answer the question is not present in the provided context, state clearly that you don't have enough information from the Frieren data to answer.

Context:
${context}

User Question: ${userQuery}

Answer:`;

    // 4. Call the Language Model
    console.log(`Calling LLM (${llmModel}) with context...`);
    try {
        if (llmClient instanceof OpenAI) {
            const completion = await llmClient.chat.completions.create({
                model: llmModel, // e.g., 'gpt-4o-mini'
                messages: [{ role: "user", content: prompt }],
                max_tokens: 800, // Adjust max response length as needed
                temperature: 0.1, // Lower temperature for more factual responses
            });
            return completion.choices[0].message.content || "Could not generate a response.";
        } else if (llmClient instanceof GoogleGenerativeAI) {
            const model = llmClient.getGenerativeModel({ model: llmModel }); // e.g., 'gemini-1.5-flash-latest'
            const result = await model.generateContent(prompt);
            const response = await result.response;
            // Gemini might return parts, join them
            return response.text();
        } else {
            return "Internal error: LLM client not properly initialized.";
        }
    } catch (error) {
        console.error("Error calling the language model:", error);
        return `An error occurred while generating the response: ${(error as any).message}`;
    }
}
