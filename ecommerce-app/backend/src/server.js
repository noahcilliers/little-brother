import { createApp } from "./app.js";
import { openDb } from "./db.js";

const port = Number(process.env.PORT ?? 4000);
createApp(openDb()).listen(port, () => {
  console.log(`API listening on http://localhost:${port}/api`);
});
