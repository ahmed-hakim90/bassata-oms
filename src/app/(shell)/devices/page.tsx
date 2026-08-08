import { redirect } from "next/navigation";

/** Device admin UX removed — cashiers use /{slug}/pos + PIN. */
export default function DevicesRoute() {
  redirect("/settings?tab=branches");
}
