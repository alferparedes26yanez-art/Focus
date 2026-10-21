import { redirect } from "next/navigation";

// The proxy sends guests to /login; everyone else starts at Inicio.
export default function RootPage() {
  redirect("/home");
}
