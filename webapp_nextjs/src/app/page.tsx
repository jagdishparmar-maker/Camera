import { RequireAuth } from "@/components/RequireAuth";
import { VehiclesPage } from "@/components/VehiclesPage";

export default function Home() {
  return (
    <RequireAuth>
      <VehiclesPage />
    </RequireAuth>
  );
}
