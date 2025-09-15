import dotenv from "dotenv";

dotenv.config();

export const COSMOS_DB_ENDPOINT = process.env.COSMOS_DB_ENDPOINT || "";
export const COSMOS_DB_KEY = process.env.COSMOS_DB_KEY || "";
export const COSMOS_DB_NAME =
  process.env.COSMOS_DB_NAME || "nomination-voting-db";
