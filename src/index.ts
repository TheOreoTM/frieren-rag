import { config } from "./config";
import { loadAllFrierenData } from "./data/dataLoader";
import { splitTextIntoChunks } from "./data/textSplitter";
import { generateEmbeddings } from "./embeddings/embeddingClient";
import { InMemoryVectorDB, ChromaVectorDB, VectorDatabase } from "./vectorDb/vectorDbClient";
import { startApiServer } from "./api/server";
import { runCli } from "./cli";

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

    const args = process.argv.slice(2);

    if (args.includes("setup-db")) {
        if (config.vectorDbType === "memory") {
            console.warn("Cannot run 'setup-db' command with in-memory database type. Data is not persistent.");
        } else {
            await populateDatabase(vectorDb);
            console.log("Persistent database setup complete.");
        }
        process.exit(0);
    }

    // If in-memory DB, populate it now on startup
    if (config.vectorDbType === "memory") {
        await populateDatabase(vectorDb);
    } else {
        console.log("Assuming persistent database is already populated (run 'npm run setup-db' if not).");
    }

    // Determine whether to start API or CLI based on args
    if (args.includes("cli")) {
        runCli(vectorDb);
    } else {
        startApiServer(vectorDb);
    }
}

main().catch(console.error);
