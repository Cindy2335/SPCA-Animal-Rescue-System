import "dotenv/config";
import createApp from './app';
import { prisma } from '../lib/prisma';

const PORT = Number(process.env.PORT) || 3000;
const app = createApp();
const server = app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

process.on("SIGINT", async() => {
    server.close();
    await prisma.$disconnect();
    console.log("Server stopped gracefully.");
    process.exit(0);
    });

