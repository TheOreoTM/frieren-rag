// src/index.ts
import { config } from "./config";
import { loadAllFrierenData } from "./data/dataLoader";
import { splitTextIntoChunks } from "./data/textSplitter";
import { generateEmbeddings } from "./embeddings/embeddingClient";
import { InMemoryVectorDB, ChromaVectorDB, VectorDatabase } from "./vectorDb/vectorDbClient";
import { queryFrierenRAG } from "./rag/ragService";
import * as readline from "readline";

async function populateDatabase(vectorDb: VectorDatabase): Promise<void> {
    console.log(`Loading data from ${config.frierenDataDir}...`);
    const allFrierenText = loadAllFrierenData(config.frierenDataDir).join("\n");

    if (allFrierenText.length === 0) {
        console.error("No data loaded. Make sure you have .txt files in the data directory.");
        return;
    }

    console.log(`Total text loaded: ${allFrierenText.length} characters.`);
    console.log(`Splitting text into chunks (size: ${config.chunkSize}, overlap: ${config.chunkOverlap})...`);
    const textChunks = await splitTextIntoChunks(allFrierenText, config.chunkSize, config.chunkOverlap);
    console.log(`Created ${textChunks.length} chunks.`);

    console.log("Generating embeddings for chunks...");
    const chunkEmbeddings = await generateEmbeddings(textChunks.map((c) => c.content));
    console.log(`Generated ${chunkEmbeddings.length} embeddings.`);

    console.log("Populating Vector Database...");
    await vectorDb.addDocuments(textChunks, chunkEmbeddings);
    console.log("Database population complete.");
}

async function main() {
    console.log(`Initializing Vector Database (${config.vectorDbType})...`);
    let vectorDb: VectorDatabase;
    if (config.vectorDbType === "memory") {
        vectorDb = new InMemoryVectorDB();
    } else {
        // config.vectorDbType === 'chroma'
        vectorDb = new ChromaVectorDB();
    }
    await vectorDb.initialize();

    if (config.vectorDbType === "memory") {
        await populateDatabase(vectorDb); // Populate the in-memory DB on startup
    } else {
        console.log("Assuming persistent database is already populated.");
    }

    console.log("\nFrieren RAG System Ready!");
    console.log("Type your questions about Frieren. Type 'quit' or 'exit' to close.");

    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });

    rl.on("line", async (input) => {
        const query = input.trim();
        if (query.toLowerCase() === "quit" || query.toLowerCase() === "exit") {
            rl.close();
            return;
        }

        if (query === "") {
            console.log("Please enter a question.");
            return;
        }

        console.log(`\nUser: ${query}`);
        const answer = await queryFrierenRAG(query, vectorDb);
        console.log(`\nAI: ${answer}`);
        console.log("\nType your next question:");
    });

    rl.on("close", () => {
        console.log("Exiting Frieren RAG System. Farewell!");
        process.exit(0);
    });

    console.log("Type your question:");
}

main().catch(console.error);
