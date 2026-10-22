import type { Metadata } from "next";
import Journal from "@/components/journal";
export const metadata: Metadata = { title: "Journal" };
export default function Page() {
  return <Journal />;
}
