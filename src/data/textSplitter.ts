import { RecursiveCharacterTextSplitter } from "langchain/text_splitter";

export async function splitTextIntoChunks(
    text: string,
    chunkSize: number,
    chunkOverlap: number
): Promise<{ content: string; metadata?: any }[]> {
    const splitter = new RecursiveCharacterTextSplitter({
        chunkSize: chunkSize,
        chunkOverlap: chunkOverlap,
    });
    const docs = await splitter.createDocuments([text]);
    return docs.map((doc) => ({ content: doc.pageContent, metadata: doc.metadata }));
}
