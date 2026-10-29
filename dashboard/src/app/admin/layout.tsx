import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Platform records — SpOps",
  description:
    "Read-only stored football-module reports, model registry and engineering evidence. These records are not live infrastructure monitoring.",
};

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
