import { ProxyStoreProvider } from "@/context/ProxyStoreContext";
import { MonitoringProvider } from "@/context/MonitoringContext";
import { MainLayout } from "@/components/layout/MainLayout";
import "./App.css";

function App() {
  return (
    <ProxyStoreProvider>
      <MonitoringProvider>
        <MainLayout />
      </MonitoringProvider>
    </ProxyStoreProvider>
  );
}

export default App;