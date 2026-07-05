import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "SpOps Admin — internal platform status (read-only)",
  description:
    "Read-only internal view of SpOps's football module: system health, MLOps pipeline, model registry, training, monitoring, data quality, predictions, and observability.",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
