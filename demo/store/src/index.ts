import { app } from "./server";

const port = Number(process.env.PORT ?? 3001);
app.listen(port, () => console.log(`lb-demo-store API on http://localhost:${port}`));
