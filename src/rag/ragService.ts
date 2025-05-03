import OpenAI from "openai";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { config } from "../config";
import { generateEmbedding } from "../embeddings/embeddingClient";
import { VectorDatabase } from "../vectorDb/vectorDbClient";
import { Response } from "express";
import { buildPrompt, type BuildPromptOptions } from "../prompt";

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

export async function queryFrierenRAG(
    userQuery: string,
    vectorDb: VectorDatabase,
    options?: BuildPromptOptions
): Promise<string> {
    console.log("Embedding user query...");
    const queryEmbedding = await generateEmbedding(userQuery);

    console.log(`Searching vector database for top ${config.retrievalTopK} results...`);
    const relevantChunks = await vectorDb.search(queryEmbedding, config.retrievalTopK);

    if (relevantChunks.length === 0) {
        console.log("No relevant chunks found.");
        // Use buildPrompt for the "not found" message as well, passes empty context
        const prompt = buildPrompt("", userQuery, options);
        // Send a minimal prompt to get the "not found" response style
        try {
            if (llmClient instanceof OpenAI) {
                const completion = await llmClient.chat.completions.create({
                    model: llmModel,
                    messages: [{ role: "user", content: buildPrompt("", userQuery, options) }],
                    max_tokens: 100, // Small max_tokens for "not found" response
                    temperature: 0.1,
                });
                return completion.choices[0].message.content || "Could not generate a response.";
            } else if (llmClient instanceof GoogleGenerativeAI) {
                const model = llmClient.getGenerativeModel({ model: llmModel });
                const result = await model.generateContent(buildPrompt("", userQuery, options));
                const response = await result.response;
                return response.text();
            } else {
                return "Internal error: LLM client not properly initialized.";
            }
        } catch (error) {
            console.error("Error calling LLM for 'not found' response:", error);
            return "I couldn't find relevant information about that in the Frieren data, and an error occurred while generating the specific response.";
        }
    }

    console.log(`Found ${relevantChunks.length} relevant chunks.`);

    const context = relevantChunks.map((item) => item.chunk).join("\n---\n");

    // Build prompt using the new function
    const prompt = buildPrompt(context, userQuery, options);

    console.log(`Calling LLM (${llmModel}) with context...`);
    try {
        if (llmClient instanceof OpenAI) {
            const completion = await llmClient.chat.completions.create({
                model: llmModel,
                messages: [{ role: "user", content: prompt }],
                max_tokens: 800, // Still controlled by API param, not prompt option text
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

export async function streamQueryFrierenRAG(
    userQuery: string,
    vectorDb: VectorDatabase,
    res: Response,
    options?: BuildPromptOptions
): Promise<void> {
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Transfer-Encoding", "chunked");
    res.setHeader("X-Content-Type-Options", "nosniff");

    try {
        console.log("Embedding user query...");
        const queryEmbedding = await generateEmbedding(userQuery);

        console.log(`Searching vector database for top ${config.retrievalTopK} results...`);
        const relevantChunks = await vectorDb.search(queryEmbedding, config.retrievalTopK);

        if (relevantChunks.length === 0) {
            console.log("No relevant chunks found.");
            const prompt = buildPrompt("", userQuery, options);
            if (llmClient instanceof OpenAI) {
                const stream = await llmClient.chat.completions.create({
                    model: llmModel,
                    messages: [{ role: "user", content: prompt }],
                    max_tokens: 100,
                    temperature: 0.1,
                    stream: true,
                });
                for await (const chunk of stream) {
                    if (chunk.choices && chunk.choices[0].delta && chunk.choices[0].delta.content) {
                        res.write(chunk.choices[0].delta.content);
                    }
                }
            } else if (llmClient instanceof GoogleGenerativeAI) {
                const model = llmClient.getGenerativeModel({ model: llmModel });
                const result = await model.generateContent(prompt);
                const response = result.response;
                const stream = response.text();
                for await (const chunk of stream) {
                    res.write(chunk);
                }
            } else {
                res.write("Internal error: LLM client not properly initialized.\n");
            }

            res.end();
            return;
        }

        console.log(`Found ${relevantChunks.length} relevant chunks.`);

        const context = relevantChunks.map((item) => item.chunk).join("\n---\n");

        const prompt = buildPrompt(context, userQuery, options);

        console.log(`Calling LLM (${llmModel}) with streaming...`);

        if (llmClient instanceof OpenAI) {
            const stream = await llmClient.chat.completions.create({
                model: llmModel,
                messages: [{ role: "user", content: prompt }],
                max_tokens: 800,
                temperature: 0.1,
                stream: true,
            });

            for await (const chunk of stream) {
                if (chunk.choices && chunk.choices[0].delta && chunk.choices[0].delta.content) {
                    res.write(chunk.choices[0].delta.content);
                }
            }
        } else if (llmClient instanceof GoogleGenerativeAI) {
            const model = llmClient.getGenerativeModel({ model: llmModel });
            const result = await model.generateContent(prompt);
            const response = result.response;
            const stream = response.text();

            for await (const chunk of stream) {
                res.write(chunk);
            }
        } else {
            res.write("Internal error: LLM client not properly initialized.\n");
        }

        res.end();
    } catch (error) {
        console.error("Error during streaming RAG query:", error);
        if (!res.headersSent) {
            res.status(500).send(`An error occurred: ${(error as any).message || "Unknown error"}`);
        } else {
            res.end(`\nError: ${(error as any).message || "Unknown error"}`);
        }
    }
}
