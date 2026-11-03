import { ErrorRequestHandler } from "express";

function isPrismaUniqueConstraintError(err: unknown): boolean {

    return(
        typeof err == "object" &&
        err !== null &&
        "code" in err &&
        (err as any).code === "P2002"   
    );
}

function isJsonBodyParseError(err: unknown): boolean {
    return (
        typeof err === "object" &&
        err !== null &&
        (err as {type : string}).type === "entity.parse.failed"
    );
}

export const errorHandler: ErrorRequestHandler = (err, req, res, next) => {
    if (isJsonBodyParseError(err)) {
        res.status(400).json({ error: "Invalid JSON body" });
        return;
    }
    if (isPrismaUniqueConstraintError(err)) {
        res.status(409).json({ error: "Email already Registered" });
        return;
    }
    console.error(err);
    res.status(500).json({ error: "Internal Server Error" });
};