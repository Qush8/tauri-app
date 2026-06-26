import { ClipboardUI } from "./components/ClipboardUI";
import "./App.css";

function App() {
  return (
    <main className="app-main" style={{ backgroundColor: "transparent", backgroundImage: "none", width: "100vw", height: "100vh", display: "flex", flexDirection: "column", alignItems: "stretch", overflow: "hidden" }}>
      <ClipboardUI />
    </main>
  );
}

export default App;

