import express from "express";
import cors from "cors";
import { router } from "./routes.js";

const app = express();
const PORT = 3001;

app.use(
  cors({
    origin: ["http://localhost:5173", "http://localhost:5174"],
    methods: ["GET", "POST"],
  })
);
app.use(express.json());
app.use(router);

app.listen(PORT, () => {
  console.log(`Discovery server running at http://localhost:${PORT}`);
});
