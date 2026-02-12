import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import App from "./App";
import EditorWindow from "./components/editor/editorWindow";
import "./index.css";
import reportWebVitals from "./reportWebVitals";
import { registerSW } from 'virtual:pwa-register'

const router = createBrowserRouter([
  { path: "/", element: <App /> },
  { path: "/editor", element: <EditorWindow /> },
]);

const root = ReactDOM.createRoot(
  document.getElementById("root") as HTMLElement
);
root.render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>
);

reportWebVitals(console.log);

// Register service worker for PWA support with update notification
if (import.meta.env.PROD) {
  const updateSW = registerSW({
    onNeedRefresh() {
      if (confirm('New version available. Reload to update?')) {
        updateSW(true);
      }
    },
    onOfflineReady() {
      console.log('App ready to work offline');
    },
  });
}
