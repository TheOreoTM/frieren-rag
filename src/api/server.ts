import express, { Express, Request, Response } from "express";
import bodyParser from "body-parser";
import path from "path";
import { VectorDatabase } from "../vectorDb/vectorDbClient";
import { streamQueryFrierenRAG } from "../rag/ragService";

export const startApiServer = (vectorDb: VectorDatabase) => {
    const app: Express = express();
    const port = process.env.PORT || 3000;

    app.use(express.static(path.join(__dirname, "../../public")));

    app.use(bodyParser.json());

    app.post("/query", async (req: Request, res: Response) => {
        const userQuery = req.body.query;
        const options = req.body.options || {};

        if (!userQuery || typeof userQuery !== "string") {
            res.status(400).json({ error: 'Invalid query. Please provide a "query" string in the request body.' });
            return;
        }

        console.log(`Received query: "${userQuery}" with options: ${JSON.stringify(options)}`);

        try {
            await streamQueryFrierenRAG(userQuery, vectorDb, res, options);
        } catch (error) {
            console.error("Error handling /query request:", error);
            if (!res.headersSent) {
                res.status(500).json({ error: "An internal error occurred while processing your query." });
            }
        }
    });

    app.listen(port, () => {
        console.log(`⚡️[server]: API Server is running at http://localhost:${port}`);
        console.log(`Serving static files from http://localhost:${port}/`);
        console.log(`POST /query endpoint available.`);
    });
};
