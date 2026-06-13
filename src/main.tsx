import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";
import { initOfflineAutoSync } from "./lib/offlineSync";

initOfflineAutoSync();

createRoot(document.getElementById("root")!).render(<App />);
