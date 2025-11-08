import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./utils/testMdxParser"; // 加载 MDX 测试工具

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
